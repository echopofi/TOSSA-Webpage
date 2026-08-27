const prisma = require('../config/prisma');

// GET /api/admin/dashboard
async function getDashboard(req, res) {
  try {
    const [totalMembers, totalSets, recentPayments, activeCycleStats] = await Promise.all([
      prisma.member.count({ where: { isActive: true } }),
      prisma.graduationSet.count({ where: { isActive: true } }),
      prisma.payment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          member: {
            include: { user: { select: { fullName: true } } },
          },
        },
      }),
      prisma.duesCycle.findMany({
        where: { isActive: true },
        include: {
          _count: { select: { duesPayments: { where: { status: 'success' } } } },
        },
        orderBy: { endDate: 'desc' },
      }),
    ]);

    res.json({
      totalMembers,
      totalSets,
      recentPayments: recentPayments.map((r) => ({
        id: r.id,
        paymentType: r.paymentType,
        amount: r.amount,
        status: r.status,
        paystackReference: r.paystackReference,
        member: { fullName: r.member.user.fullName },
        createdAt: r.createdAt,
      })),
      activeDuesCycles: activeCycleStats.map((c) => ({
        id: c.id,
        title: c.title,
        cycleType: c.cycleType,
        amount: c.amount,
        dueDate: c.dueDate,
        paidCount: c._count.duesPayments,
      })),
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/admin/payments
async function allPayments(req, res) {
  try {
    const { status, paymentType, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};
    if (status) where.status = status;
    if (paymentType) where.paymentType = paymentType;

    const payments = await prisma.payment.findMany({
      where,
      include: {
        member: {
          include: {
            user: { select: { fullName: true, email: true } },
            setMembers: { include: { set: { select: { setName: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    res.json({
      payments: payments.map((p) => ({
        id: p.id,
        paymentType: p.paymentType,
        amount: p.amount,
        status: p.status,
        paystackReference: p.paystackReference,
        member: { fullName: p.member.user.fullName, email: p.member.user.email },
        sets: p.member.setMembers.map((sm) => sm.set.setName),
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    console.error('All payments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/admin/dues-payments
async function allDuesPayments(req, res) {
  try {
    const { status, cycleId, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};
    if (status) where.status = status;
    if (cycleId) where.duesCycleId = cycleId;

    const payments = await prisma.duesPayment.findMany({
      where,
      include: {
        member: {
          include: {
            user: { select: { fullName: true, email: true } },
            setMembers: { include: { set: { select: { setName: true } } } },
          },
        },
        cycle: { select: { id: true, title: true, cycleType: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    res.json({
      payments: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        amountPaid: p.amountPaid,
        status: p.status,
        paystackReference: p.paystackReference,
        member: { fullName: p.member.user.fullName, email: p.member.user.email },
        cycle: p.cycle,
        sets: p.member.setMembers.map((sm) => sm.set.setName),
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    console.error('All dues payments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/admin/members/:id/deactivate
async function deactivateMember(req, res) {
  try {
    const member = await prisma.member.findUnique({ where: { id: req.params.id } });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    await prisma.member.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ message: 'Member deactivated' });
  } catch (err) {
    console.error('Deactivate member error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT /api/admin/members/:id/role
async function updateMemberRole(req, res) {
  try {
    const { role } = req.body;
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'role must be admin or member' });
    }

    const member = await prisma.member.findUnique({ where: { id: req.params.id } });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    await prisma.user.update({
      where: { id: member.userId },
      data: { role },
    });

    res.json({ message: `Role updated to ${role}` });
  } catch (err) {
    console.error('Update member role error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getDashboard, allPayments, allDuesPayments, deactivateMember, updateMemberRole };
