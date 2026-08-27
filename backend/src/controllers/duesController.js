const crypto = require('crypto');
const prisma = require('../config/prisma');
const config = require('../config');
const paystack = require('../services/paystack');
const { sendPaymentConfirmation } = require('../services/email');

// GET /api/dues/cycles — public
async function listCycles(req, res) {
  try {
    const cycles = await prisma.duesCycle.findMany({
      include: {
        _count: { select: { duesPayments: { where: { status: 'success' } } } },
      },
      orderBy: { startDate: 'desc' },
    });

    res.json({
      cycles: cycles.map((c) => ({
        id: c.id,
        title: c.title,
        cycleType: c.cycleType,
        startDate: c.startDate,
        endDate: c.endDate,
        amount: c.amount,
        dueDate: c.dueDate,
        isActive: c.isActive,
        paidCount: c._count.duesPayments,
        createdAt: c.createdAt,
      })),
    });
  } catch (err) {
    console.error('List cycles error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/dues/cycles — admin
async function createCycle(req, res) {
  try {
    const { title, cycleType, startDate, endDate, amount, dueDate } = req.body;
    if (!title || !cycleType || !startDate || !endDate || !amount || !dueDate) {
      return res.status(400).json({ error: 'title, cycleType, startDate, endDate, amount, dueDate required' });
    }

    const cycle = await prisma.duesCycle.create({
      data: {
        title,
        cycleType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        amount,
        dueDate: new Date(dueDate),
      },
    });

    res.status(201).json({
      id: cycle.id,
      title: cycle.title,
      cycleType: cycle.cycleType,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      amount: cycle.amount,
      dueDate: cycle.dueDate,
      isActive: cycle.isActive,
    });
  } catch (err) {
    console.error('Create cycle error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT /api/dues/cycles/:id — admin
async function updateCycle(req, res) {
  try {
    const { title, cycleType, startDate, endDate, amount, dueDate, isActive } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (cycleType !== undefined) data.cycleType = cycleType;
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = new Date(endDate);
    if (amount !== undefined) data.amount = amount;
    if (dueDate !== undefined) data.dueDate = new Date(dueDate);
    if (isActive !== undefined) data.isActive = isActive;

    const cycle = await prisma.duesCycle.update({
      where: { id: req.params.id },
      data,
    });

    res.json({
      id: cycle.id,
      title: cycle.title,
      cycleType: cycle.cycleType,
      amount: cycle.amount,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      dueDate: cycle.dueDate,
      isActive: cycle.isActive,
    });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Cycle not found' });
    }
    console.error('Update cycle error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/dues/pay/:cycleId — member
async function initiateDuesPayment(req, res) {
  try {
    const { cycleId } = req.params;

    const member = await prisma.member.findFirst({ where: { userId: req.user.id } });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const cycle = await prisma.duesCycle.findFirst({
      where: { id: cycleId, isActive: true },
    });
    if (!cycle) {
      return res.status(404).json({ error: 'Active dues cycle not found' });
    }

    const alreadyPaid = await prisma.duesPayment.findFirst({
      where: { memberId: member.id, duesCycleId: cycleId, status: 'success' },
    });
    if (alreadyPaid) {
      return res.status(400).json({ error: 'Already paid for this cycle' });
    }

    const pending = await prisma.duesPayment.findFirst({
      where: { memberId: member.id, duesCycleId: cycleId, status: 'pending' },
    });
    if (pending) {
      return res.json({ reference: pending.paystackReference });
    }

    const reference = `DUE-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
    const amount = cycle.amount * 100;

    await prisma.duesPayment.create({
      data: {
        memberId: member.id,
        duesCycleId: cycleId,
        amount: cycle.amount,
        paystackReference: reference,
        status: 'pending',
      },
    });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const paystackResponse = await paystack.initializeTransaction({
      email: user.email,
      amount,
      reference,
      metadata: { member_id: member.id, dues_cycle_id: cycleId, type: 'dues' },
    });

    await prisma.duesPayment.update({
      where: { paystackReference: reference },
      data: { paystackReference: paystackResponse.data.reference },
    });

    res.json({
      authorizationUrl: paystackResponse.data.authorization_url,
      accessCode: paystackResponse.data.access_code,
      reference: paystackResponse.data.reference,
    });
  } catch (err) {
    console.error('Initiate dues payment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/dues/verify/:reference — member
async function verifyDuesPayment(req, res) {
  try {
    const { reference } = req.params;
    const paystackResult = await paystack.verifyTransaction(reference);
    const tx = paystackResult.data;

    const duesPayment = await prisma.duesPayment.findFirst({
      where: { paystackReference: reference },
    });
    if (!duesPayment) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const expectedAmount = duesPayment.amount * 100;
    if (tx.amount !== expectedAmount) {
      console.error(`Amount mismatch for ${reference}: expected ${expectedAmount}, got ${tx.amount}`);
      await prisma.duesPayment.update({
        where: { id: duesPayment.id },
        data: { status: 'failed' },
      });
      return res.status(400).json({ error: 'Amount verification failed' });
    }

    const newStatus = tx.status === 'success' ? 'success' : tx.status === 'abandoned' ? 'abandoned' : 'failed';

    await prisma.duesPayment.update({
      where: { id: duesPayment.id },
      data: {
        status: newStatus,
        amountPaid: newStatus === 'success' ? duesPayment.amount : duesPayment.amountPaid,
        paidAt: newStatus === 'success' ? new Date() : null,
      },
    });

    // Create ledger entry
    await prisma.paymentTransaction.create({
      data: {
        duesPaymentId: duesPayment.id,
        amount: tx.amount,
        status: newStatus,
        channel: 'paystack',
        reference,
        metadata: tx,
      },
    });

    if (newStatus === 'success') {
      const member = await prisma.member.findUnique({
        where: { id: duesPayment.memberId },
        include: { user: { select: { email: true, fullName: true } } },
      });
      sendPaymentConfirmation(
        { email: member.user.email, fullName: member.user.fullName },
        { amount: duesPayment.amount * 100, reference, type: 'dues' }
      ).catch(() => {});
    }

    res.json({ reference, status: newStatus, amount: tx.amount });
  } catch (err) {
    console.error('Verify dues payment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/dues/history — member
async function duesHistory(req, res) {
  try {
    const member = await prisma.member.findFirst({ where: { userId: req.user.id } });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const payments = await prisma.duesPayment.findMany({
      where: { memberId: member.id },
      include: { cycle: { select: { id: true, title: true, cycleType: true, startDate: true, endDate: true, dueDate: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      payments: payments.map((p) => ({
        id: p.id,
        cycle: p.cycle,
        amount: p.amount,
        amountPaid: p.amountPaid,
        status: p.status,
        paystackReference: p.paystackReference,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    console.error('Dues history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { listCycles, createCycle, updateCycle, initiateDuesPayment, verifyDuesPayment, duesHistory };
