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

    // Check for pending
    const pending = await prisma.payment.findFirst({
      where: { memberId: member.id, paymentType: 'registration_fee', status: 'pending' },
    });
    if (pending) {
      return res.json({ reference: pending.paystackReference });
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

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const paystackResponse = await paystack.initializeTransaction({
      email: user.email,
      amount,
      reference,
      metadata: { member_id: member.id, payment_id: payment.id, type: 'registration' },
    });

    // Update paystack reference if Paystack returned a different one
    if (paystackResponse.data.reference !== reference) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { paystackReference: paystackResponse.data.reference },
      });
    }

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

    // Create ledger entry
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
