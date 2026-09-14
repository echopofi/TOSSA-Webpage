const crypto = require('crypto');
const prisma = require('../config/prisma');
const config = require('../config');
const paystack = require('../services/paystack');
const { sendPaymentConfirmation } = require('../services/email');

// POST /api/payments/initiate-registration
async function initiateRegistration(req, res) {
  try {
    const member = await prisma.member.findFirst({
      where: { userId: req.user.id },
    });
    if (!member) {
      return res.status(404).json({ error: 'Member profile not found' });
    }

    // Check if registration already paid
    const existingPayment = await prisma.payment.findFirst({
      where: { memberId: member.id, paymentType: 'registration_fee', status: 'success' },
    });
    if (existingPayment) {
      return res.status(400).json({ error: 'Registration fee already paid' });
    }

    // Pending-payment guard. A FRESH pending means the Paystack checkout was
    // actually spawned — surface its reference so the user can resume/finish
    // rather than silently re-initialising (Paystack rejects reusing a live
    // reference). A STALE pending is retired instead of blocking, so a broken
    // or abandoned attempt can never permanently lock the user out of retrying.
    const staleMs = config.registrationPaymentPendingTtlMinutes * 60 * 1000;
    const pending = await prisma.payment.findFirst({
      where: { memberId: member.id, paymentType: 'registration_fee', status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
    if (pending) {
      const ageMs = Date.now() - pending.createdAt.getTime();
      if (ageMs < staleMs) {
        console.log(
          `[payments] pending registration payment ${pending.id} (ref ${pending.paystackReference})` +
            ` is ${Math.round(ageMs / 1000)}s old — returning reference, not re-initialising`
        );
        return res.json({ reference: pending.paystackReference });
      }
      console.warn(
        `[payments] retiring stale pending registration payment ${pending.id}` +
          ` (ref ${pending.paystackReference}, age ${Math.round(ageMs / 60000)}m)`
      );
      await prisma.payment.update({ where: { id: pending.id }, data: { status: 'failed' } });
    }

    const reference = `REG-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
    const amount = config.registrationFeeAmount * 100;

    const payment = await prisma.payment.create({
      data: {
        memberId: member.id,
        paymentType: 'registration_fee',
        amount,
        paystackReference: reference,
        status: 'pending',
      },
    });
    console.log(
      `[payments] created pending registration payment ${payment.id} (ref ${reference}, amount ${amount})`
    );

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    let paystackResponse;
    try {
      paystackResponse = await paystack.initializeTransaction({
        email: user.email,
        amount,
        reference,
        metadata: { member_id: member.id, payment_id: payment.id, type: 'registration' },
        callback_url: `${config.frontendUrl}/verify-payment?reference=${reference}`,
      });
    } catch (paystackErr) {
      const errorInfo = `${paystackErr.message || 'unknown error'}${
        paystackErr.status ? ` (HTTP ${paystackErr.status})` : ''
      }${paystackErr.code ? ` [${paystackErr.code}]` : ''}`;
      // Paystack holds no usable record of a reference whose initialization
      // itself failed, so discard the pending row — never leave a stale row
      // that would block the user from retrying.
      await prisma.payment.delete({ where: { id: payment.id } }).catch(() => {});
      console.error(
        `[payments] Paystack initialize failed for ${reference}; rolled back pending payment ${payment.id}: ${errorInfo}`
      );
      return res
        .status(502)
        .json({ error: 'Payment gateway is temporarily unavailable. Please try again in a moment.' });
    }

    // Validate the Paystack response shape — a malformed body is treated the same
    // as a failed initialize (row rolled back) so we never hand a broken ref out.
    if (
      !paystackResponse ||
      !paystackResponse.data ||
      !paystackResponse.data.authorization_url ||
      !paystackResponse.data.reference
    ) {
      await prisma.payment.delete({ where: { id: payment.id } }).catch(() => {});
      console.error(
        `[payments] Paystack returned a malformed response for ${reference}; rolled back pending payment ${payment.id}`
      );
      return res
        .status(502)
        .json({ error: 'Payment gateway returned an invalid response. Please try again in a moment.' });
    }

    // Update paystack reference if Paystack returned a different one
    if (paystackResponse.data.reference !== reference) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { paystackReference: paystackResponse.data.reference },
      });
    }

    console.log(
      `[payments] Paystack initialized for ${paystackResponse.data.reference} (payment ${payment.id})`
    );
    res.json({
      authorizationUrl: paystackResponse.data.authorization_url,
      accessCode: paystackResponse.data.access_code,
      reference: paystackResponse.data.reference,
    });
  } catch (err) {
    console.error('Initiate registration payment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/payments/verify/:reference
async function verifyPayment(req, res) {
  try {
    const { reference } = req.params;
    const paystackResult = await paystack.verifyTransaction(reference);
    const tx = paystackResult.data;

    const payment = await prisma.payment.findFirst({
      where: { paystackReference: reference },
    });
    if (!payment) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const expectedAmount = payment.amount;
    if (tx.amount !== expectedAmount) {
      console.error(`Amount mismatch for ${reference}: expected ${expectedAmount}, got ${tx.amount}`);
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed' },
      });
      return res.status(400).json({ error: 'Amount verification failed' });
    }

    const newStatus = tx.status === 'success' ? 'success' : tx.status === 'abandoned' ? 'abandoned' : 'failed';

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        paidAt: newStatus === 'success' ? new Date() : null,
      },
    });

    // Create ledger entry (idempotent — never duplicate a paystack reference)
    const existingLedger = await prisma.paymentTransaction.findUnique({ where: { reference } });
    if (!existingLedger) {
      await prisma.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          amount: tx.amount,
          status: newStatus,
          channel: 'paystack',
          reference,
          metadata: tx,
        },
      });
    }

    if (newStatus === 'success') {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });
      sendPaymentConfirmation(
        { email: user.email, fullName: user.fullName },
        { amount: payment.amount, reference, type: payment.paymentType }
      ).catch(() => {});
    }

    res.json({ reference, status: newStatus, amount: tx.amount });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/payments/history
async function paymentHistory(req, res) {
  try {
    const member = await prisma.member.findFirst({ where: { userId: req.user.id } });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const payments = await prisma.payment.findMany({
      where: { memberId: member.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      payments: payments.map((p) => ({
        id: p.id,
        paymentType: p.paymentType,
        amount: p.amount,
        status: p.status,
        paystackReference: p.paystackReference,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    console.error('Payment history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { initiateRegistration, verifyPayment, paymentHistory };
