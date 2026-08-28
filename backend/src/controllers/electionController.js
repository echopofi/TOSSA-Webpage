const crypto = require('crypto');
const prisma = require('../config/prisma');
const paystack = require('../services/paystack');
const { sendPaymentConfirmation } = require('../services/email');

// GET /api/elections/positions — public
async function listOpenPositions(req, res) {
  try {
    const positions = await prisma.electionPosition.findMany({
      where: { isOpen: true },
      orderBy: { feeAmount: 'desc' },
    });

    res.json({
      positions: positions.map((p) => ({
        id: p.id,
        title: p.title,
        feeAmount: p.feeAmount,
        electionYear: p.electionYear,
        isOpen: p.isOpen,
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    console.error('List election positions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/elections/my-applications — member
async function myApplications(req, res) {
  try {
    const member = await prisma.member.findFirst({ where: { userId: req.user.id } });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const applications = await prisma.electionApplication.findMany({
      where: { memberId: member.id },
      include: { position: true },
      orderBy: { appliedAt: 'desc' },
    });

    res.json({
      applications: applications.map((a) => ({
        id: a.id,
        positionId: a.positionId,
        position: {
          id: a.position.id,
          title: a.position.title,
          feeAmount: a.position.feeAmount,
          electionYear: a.position.electionYear,
        },
        paystackReference: a.paystackReference,
        status: a.status,
        manifesto: a.manifesto,
        appliedAt: a.appliedAt,
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    console.error('My election applications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/elections/apply — member
async function applyForPosition(req, res) {
  try {
    const { positionId, manifesto } = req.body;
    if (!positionId) {
      return res.status(400).json({ error: 'position_id is required' });
    }

    const member = await prisma.member.findFirst({ where: { userId: req.user.id } });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const position = await prisma.electionPosition.findFirst({
      where: { id: positionId, isOpen: true },
    });
    if (!position) {
      return res.status(404).json({ error: 'Open election position not found' });
    }

    // One application per member per position
    const existing = await prisma.electionApplication.findFirst({
      where: { memberId: member.id, positionId },
    });
    if (existing && existing.status !== 'rejected') {
      if (existing.status === 'pending_payment' && existing.paystackReference) {
        return res.json({ reference: existing.paystackReference });
      }
      return res.status(400).json({ error: 'You already applied for this position' });
    }

    const reference = `ELE-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
    const amount = position.feeAmount * 100; // kobo — amount always server-side

    const application = await prisma.electionApplication.create({
      data: {
        memberId: member.id,
        positionId: position.id,
        paystackReference: reference,
        status: 'pending_payment',
        manifesto: manifesto || null,
        appliedAt: new Date(),
      },
    });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const paystackResponse = await paystack.initializeTransaction({
      email: user.email,
      amount,
      reference,
      metadata: {
        member_id: member.id,
        election_application_id: application.id,
        type: 'election',
      },
    });

    await prisma.electionApplication.update({
      where: { id: application.id },
      data: { paystackReference: paystackResponse.data.reference },
    });

    res.json({
      applicationId: application.id,
      authorizationUrl: paystackResponse.data.authorization_url,
      accessCode: paystackResponse.data.access_code,
      reference: paystackResponse.data.reference,
    });
  } catch (err) {
    console.error('Apply for election position error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/elections/verify/:reference — member
async function verifyApplication(req, res) {
  try {
    const { reference } = req.params;
    const paystackResult = await paystack.verifyTransaction(reference);
    const tx = paystackResult.data;

    const application = await prisma.electionApplication.findFirst({
      where: { paystackReference: reference },
      include: { position: true },
    });
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const expectedAmount = application.position.feeAmount * 100;
    if (tx.amount !== expectedAmount) {
      console.error(`Election amount mismatch for ${reference}: expected ${expectedAmount}, got ${tx.amount}`);
      await prisma.electionApplication.update({
        where: { id: application.id },
        data: { status: 'rejected' },
      });
      return res.status(400).json({ error: 'Amount verification failed' });
    }

    const newStatus = tx.status === 'success' ? 'submitted' : 'pending_payment';

    await prisma.electionApplication.update({
      where: { id: application.id },
      data: { status: newStatus },
    });

    // Ledger entry
    await prisma.paymentTransaction.create({
      data: {
        electionApplicationId: application.id,
        amount: tx.amount,
        status: tx.status === 'success' ? 'success' : 'failed',
        channel: 'paystack',
        reference,
        metadata: tx,
      },
    });

    if (newStatus === 'submitted') {
      const member = await prisma.member.findUnique({
        where: { id: application.memberId },
        include: { user: { select: { email: true, fullName: true } } },
      });
      sendPaymentConfirmation(
        { email: member.user.email, fullName: member.user.fullName },
        { amount: tx.amount, reference, type: 'election' }
      ).catch(() => {});
    }

    res.json({ reference, status: newStatus, amount: tx.amount });
  } catch (err) {
    console.error('Verify election application error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/admin/elections/positions — admin, create/open a position for a cycle
async function createPosition(req, res) {
  try {
    const { title, feeAmount, electionYear, isOpen } = req.body;
    if (!title || !feeAmount || !electionYear) {
      return res.status(400).json({ error: 'title, feeAmount, and electionYear are required' });
    }

    const position = await prisma.electionPosition.create({
      data: {
        title,
        feeAmount: parseInt(feeAmount, 10),
        electionYear,
        isOpen: isOpen !== false,
      },
    });

    res.status(201).json({
      id: position.id,
      title: position.title,
      feeAmount: position.feeAmount,
      electionYear: position.electionYear,
      isOpen: position.isOpen,
      createdAt: position.createdAt,
    });
  } catch (err) {
    console.error('Create election position error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/admin/elections/applications — admin
async function adminListApplications(req, res) {
  try {
    const { positionId, status } = req.query;
    const where = {};
    if (positionId) where.positionId = positionId;
    if (status) where.status = status;

    const applications = await prisma.electionApplication.findMany({
      where,
      include: {
        member: {
          include: {
            user: { select: { fullName: true, email: true } },
            setMembers: { include: { set: { select: { setName: true } } } },
          },
        },
        position: true,
      },
      orderBy: { appliedAt: 'desc' },
    });

    res.json({
      applications: applications.map((a) => ({
        id: a.id,
        positionId: a.positionId,
        position: {
          id: a.position.id,
          title: a.position.title,
          feeAmount: a.position.feeAmount,
          electionYear: a.position.electionYear,
        },
        paystackReference: a.paystackReference,
        status: a.status,
        manifesto: a.manifesto,
        appliedAt: a.appliedAt,
        member: {
          id: a.member.id,
          fullName: a.member.user.fullName,
          email: a.member.user.email,
          profileImage: a.member.profileImage,
          set_name: a.member.setMembers[0]?.set.setName ?? null,
        },
      })),
    });
  } catch (err) {
    console.error('Admin list election applications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PATCH /api/admin/elections/applications/:id — admin approve/reject
async function adminUpdateApplication(req, res) {
  try {
    const { status } = req.body;
    if (!['pending_payment', 'submitted', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be pending_payment, submitted, approved, or rejected' });
    }

    const application = await prisma.electionApplication.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json({
      id: application.id,
      status: application.status,
      message: `Application ${status}`,
    });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Application not found' });
    }
    console.error('Admin update election application error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { listOpenPositions, myApplications, applyForPosition, verifyApplication, createPosition, adminListApplications, adminUpdateApplication };