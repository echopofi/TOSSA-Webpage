const crypto = require('crypto');
const prisma = require('../config/prisma');
const config = require('../config');
const paystack = require('../services/paystack');
const { sendPaymentConfirmation } = require('../services/email');

// Returns true when Paystack still holds a transaction for this reference (an
// initialize that actually reached Paystack). false when it has no record — an
// orphan left by a failed/errored initialize, a crash, or pre-fix code — or
// when Paystack is momentarily unreachable (treated as not-live so the guard
// never blocks a retry on a best-effort liveness check).
async function referenceKnownToPaystack(reference) {
  try {
    const res = await paystack.verifyTransaction(reference);
    return Boolean(res && res.data && res.data.status);
  } catch (err) {
    return false;
  }
}

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

    // Pending-payment guard. Only a pending row that Paystack still recognises
    // AND is fresh is treated as "in progress" (the user may still have that
    // checkout open). Anything stale OR unknown to Paystack is an orphan —
    // a failed/errored initialize, a crash after row creation, or a pre-fix
    // leftover — so it is retired and we fall through to a fresh attempt.
    // This makes the guard self-healing: a broken pending can never permanently
    // lock a member out of retrying.
    const staleMs = config.registrationPaymentPendingTtlMinutes * 60 * 1000;
    const pending = await prisma.payment.findFirst({
      where: { memberId: member.id, paymentType: 'registration_fee', status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
    if (pending) {
      const ageMs = Date.now() - pending.createdAt.getTime();
      const knownOnPaystack = await referenceKnownToPaystack(pending.paystackReference);
      const isStale = ageMs >= staleMs;
      if (knownOnPaystack && !isStale) {
        console.log(
          `[payments] pending registration payment ${pending.id} (ref ${pending.paystackReference})` +
            ` is ${Math.round(ageMs / 1000)}s old and live on Paystack — returning reference`,
        );
        return res.json({ reference: pending.paystackReference });
      }
      console.warn(
        `[payments] retiring pending registration payment ${pending.id}` +
          ` (ref ${pending.paystackReference}, age ${Math.round(ageMs / 60000)}m, knownOnPaystack=${knownOnPaystack})`,
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
      `[payments] created pending registration payment ${payment.id} (ref ${reference}, amount ${amount})`,
    );

    // ONE try/catch covers everything after row creation, so no code path can
    // leave the row orphaned: on ANY failure the created row is rolled back
    // (or, if the delete itself fails, marked failed and logged loudly — never
    // silently swallowed) and a precise error is returned.
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });

      const paystackResponse = await paystack.initializeTransaction({
        email: user.email,
        amount,
        reference,
        metadata: { member_id: member.id, payment_id: payment.id, type: 'registration' },
        callback_url: `${config.frontendUrl}/verify-payment?reference=${reference}`,
      });

      // Validate the Paystack response shape — a malformed body is treated the
      // same as a failed initialize (row rolled back) so we never hand a
      // broken reference out.
      if (
        !paystackResponse ||
        !paystackResponse.data ||
        !paystackResponse.data.authorization_url ||
        !paystackResponse.data.reference
      ) {
        const err = new Error('Paystack returned a malformed response');
        err.code = 'PAYSTACK_INVALID_RESPONSE';
        throw err;
      }

      // Update paystack reference if Paystack returned a different one
      if (paystackResponse.data.reference !== reference) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { paystackReference: paystackResponse.data.reference },
        });
      }

      console.log(
        `[payments] Paystack initialized for ${paystackResponse.data.reference} (payment ${payment.id})`,
      );
      res.json({
        authorizationUrl: paystackResponse.data.authorization_url,
        accessCode: paystackResponse.data.access_code,
        reference: paystackResponse.data.reference,
      });
    } catch (rollbackErr) {
      try {
        await prisma.payment.delete({ where: { id: payment.id } });
      } catch (deleteErr) {
        await prisma.payment
          .update({ where: { id: payment.id }, data: { status: 'failed' } })
          .catch(() => {});
        console.error(
          `[payments] rollback delete failed for ${payment.id}; marked as failed instead`,
          deleteErr,
        );
      }

      const isGateway =
        typeof rollbackErr.code === 'string' && rollbackErr.code.startsWith('PAYSTACK_');
      const errorInfo = `${rollbackErr.message || 'unknown error'}${
        rollbackErr.status ? ` (HTTP ${rollbackErr.status})` : ''
      }${rollbackErr.code ? ` [${rollbackErr.code}]` : ''}`;
      console.error(
        isGateway
          ? `[payments] Paystack failed for ${reference}; rolled back pending payment ${payment.id}: ${errorInfo}`
          : `[payments] initiate-registration failed for ${reference}; rolled back pending payment ${payment.id}: ${errorInfo}`,
      );
      return res
        .status(isGateway ? 502 : 500)
        .json({
          error: isGateway
            ? 'Payment gateway is temporarily unavailable. Please try again in a moment.'
            : 'Internal server error',
        });
    }
  } catch (err) {
    // Errors BEFORE the payment row is created (lookups, guards) — nothing to
    // roll back, but logged at full detail so the failing step is identifiable.
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
