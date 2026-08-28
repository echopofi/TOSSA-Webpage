const crypto = require('crypto');
const prisma = require('../config/prisma');
const config = require('../config');
const { sendPaymentConfirmation } = require('../services/email');

function verifyWebhookSignature(body, signature) {
  const hash = crypto
    .createHmac('sha512', config.paystack.webhookSecret)
    .update(JSON.stringify(body))
    .digest('hex');
  return hash === signature;
}

async function handlePaystackWebhook(req, res) {
  try {
    const body = JSON.parse(req.body.toString());
    if (!verifyWebhookSignature(body, req.headers['x-paystack-signature'])) {
      console.warn('Invalid Paystack webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    req.body = body;
    const event = req.body;
    if (event.event !== 'charge.success') {
      return res.status(200).json({ message: 'Event ignored' });
    }

    const data = event.data;
    const paystackRef = data.reference;
    const metadata = data.metadata || {};
    const type = metadata.type;
    const memberId = metadata.member_id;

    // Check payment_transactions ledger for idempotency
    const existingLedger = await prisma.paymentTransaction.findUnique({ where: { reference: paystackRef } });
    if (existingLedger && existingLedger.status === 'success') {
      return res.status(200).json({ message: 'Already processed' });
    }

    if (type === 'registration') {
      const paymentId = metadata.payment_id;
      if (!paymentId) {
        return res.status(200).json({ message: 'No payment_id, ignored' });
      }

      const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
      if (!payment) {
        return res.status(200).json({ message: 'Payment not found' });
      }

      // Verify amount
      if (data.amount !== payment.amount) {
        console.error(`Webhook amount mismatch: expected ${payment.amount}, got ${data.amount}`);
        await prisma.payment.update({ where: { id: paymentId }, data: { status: 'failed' } });
        if (!existingLedger) {
          await prisma.paymentTransaction.create({
            data: {
              paymentId,
              amount: data.amount,
              status: 'failed',
              channel: 'paystack',
              reference: paystackRef,
              metadata: data,
            },
          });
        }
        return res.status(200).json({ message: 'Amount mismatch, recorded as failed' });
      }

      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'success', paidAt: new Date() },
      });

      if (!existingLedger) {
        await prisma.paymentTransaction.create({
          data: {
            paymentId,
            amount: data.amount,
            status: 'success',
            channel: 'paystack',
            reference: paystackRef,
            metadata: data,
          },
        });
      }

      await sendPaymentEmail(memberId, data.amount, paystackRef, 'registration');
    } else if (type === 'dues') {
      const duesCycleId = metadata.dues_cycle_id;
      if (!duesCycleId) {
        return res.status(200).json({ message: 'No dues_cycle_id, ignored' });
      }

      // Find the dues payment
      const duesPayment = await prisma.duesPayment.findFirst({
        where: { paystackReference: paystackRef },
      });

      if (!duesPayment) {
        // Create new
        const cycle = await prisma.duesCycle.findUnique({ where: { id: duesCycleId } });
        if (!cycle) {
          return res.status(200).json({ message: 'Cycle not found' });
        }

        if (data.amount !== cycle.amount * 100) {
          await prisma.duesPayment.create({
            data: {
              memberId,
              duesCycleId,
              amount: cycle.amount,
              amountPaid: 0,
              paystackReference: paystackRef,
              status: 'failed',
            },
          });
          await prisma.paymentTransaction.create({
            data: {
              amount: data.amount,
              status: 'failed',
              channel: 'paystack',
              reference: paystackRef,
              metadata: data,
            },
          });
          return res.status(200).json({ message: 'Amount mismatch, recorded as failed' });
        }

        const newDuesPayment = await prisma.duesPayment.create({
          data: {
            memberId,
            duesCycleId,
            amount: cycle.amount,
            amountPaid: cycle.amount,
            paystackReference: paystackRef,
            status: 'success',
            paidAt: new Date(),
          },
        });

        await prisma.paymentTransaction.create({
          data: {
            duesPaymentId: newDuesPayment.id,
            amount: data.amount,
            status: 'success',
            channel: 'paystack',
            reference: paystackRef,
            metadata: data,
          },
        });

        await sendPaymentEmail(memberId, data.amount, paystackRef, 'dues');
      } else {
        // Update existing
        if (duesPayment.status === 'success') {
          return res.status(200).json({ message: 'Already processed' });
        }

        const cycle = await prisma.duesCycle.findUnique({ where: { id: duesCycleId } });
        if (cycle && data.amount !== cycle.amount * 100) {
          await prisma.duesPayment.update({
            where: { id: duesPayment.id },
            data: { status: 'failed' },
          });
          return res.status(200).json({ message: 'Amount mismatch' });
        }

        await prisma.duesPayment.update({
          where: { id: duesPayment.id },
          data: {
            status: 'success',
            amountPaid: duesPayment.amount,
            paidAt: new Date(),
          },
        });

        if (!existingLedger) {
          await prisma.paymentTransaction.create({
            data: {
              duesPaymentId: duesPayment.id,
              amount: data.amount,
              status: 'success',
              channel: 'paystack',
              reference: paystackRef,
              metadata: data,
            },
          });
        }

        await sendPaymentEmail(memberId, data.amount, paystackRef, 'dues');
      }
    } else if (type === 'election') {
      const applicationId = metadata.election_application_id;
      if (!applicationId) {
        return res.status(200).json({ message: 'No election_application_id, ignored' });
      }

      const application = await prisma.electionApplication.findUnique({
        where: { id: applicationId },
        include: { position: true },
      });
      if (!application) {
        return res.status(200).json({ message: 'Application not found' });
      }

      if (application.status === 'submitted') {
        return res.status(200).json({ message: 'Already processed' });
      }

      // Amount must come from the position fee — never trust a client amount
      if (data.amount !== application.position.feeAmount * 100) {
        console.error(`Election webhook amount mismatch: expected ${application.position.feeAmount * 100}, got ${data.amount}`);
        await prisma.electionApplication.update({
          where: { id: application.id },
          data: { status: 'rejected' },
        });
        if (!existingLedger) {
          await prisma.paymentTransaction.create({
            data: {
              electionApplicationId: application.id,
              amount: data.amount,
              status: 'failed',
              channel: 'paystack',
              reference: paystackRef,
              metadata: data,
            },
          });
        }
        return res.status(200).json({ message: 'Amount mismatch, recorded as failed' });
      }

      await prisma.electionApplication.update({
        where: { id: application.id },
        data: { status: 'submitted' },
      });

      if (!existingLedger) {
        await prisma.paymentTransaction.create({
          data: {
            electionApplicationId: application.id,
            amount: data.amount,
            status: 'success',
            channel: 'paystack',
            reference: paystackRef,
            metadata: data,
          },
        });
      }

      await sendPaymentEmail(memberId, data.amount, paystackRef, 'election');
    }

    res.status(200).json({ message: 'Processed' });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function sendPaymentEmail(memberId, amount, reference, type) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { user: { select: { email: true, fullName: true } } },
  });
  if (member) {
    sendPaymentConfirmation(
      { email: member.user.email, fullName: member.user.fullName },
      { amount, reference, type }
    ).catch(() => {});
  }
}

module.exports = { handlePaystackWebhook };
