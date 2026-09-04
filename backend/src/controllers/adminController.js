const prisma = require('../config/prisma');

// GET /api/admin/dashboard
async function getDashboard(req, res) {
  try {
    const [totalMembers, activeMembers, totalSets, recentPayments, activeCycleStats, pendingRegPayments, pendingDuesPayments, duesCollected, regCollected] = await Promise.all([
      prisma.member.count(),
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
      prisma.payment.count({ where: { status: 'pending' } }),
      prisma.duesPayment.count({ where: { status: 'pending' } }),
      prisma.duesPayment.aggregate({
        where: { status: 'success' },
        _sum: { amountPaid: true },
      }),
      prisma.payment.aggregate({
        where: { paymentType: 'registration_fee', status: 'success' },
        _sum: { amount: true },
      }),
    ]);

    res.json({
      totalMembers,
      activeMembers,
      totalSets,
      // Registration payment amounts are stored in kobo (config.registrationFeeAmount * 100)
      // — return naira like the other aggregates so the UI displays ₦ values directly.
      pendingPayments: pendingRegPayments + pendingDuesPayments,
      totalDuesCollected: duesCollected._sum.amountPaid ?? 0,
      totalRegistrationPayments: Math.round((regCollected._sum.amount ?? 0) / 100),
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

// GET /api/admin/members/pending
// Lists every registrant whose account is not yet verified. Rejected applicants
// are deleted outright, so this is the only "review" state an admin sees.
async function pendingMembers(req, res) {
  try {
    const members = await prisma.member.findMany({
      where: { user: { isVerified: false } },
      include: {
        user: { select: { id: true, fullName: true, email: true, createdAt: true } },
        setMembers: { include: { set: { select: { setName: true } } } },
      },
      orderBy: { joinedAt: 'desc' },
    });

    res.json({
      members: members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        fullName: m.user.fullName,
        email: m.user.email,
        matricNumber: m.matricNumber,
        profileImage: m.profileImage,
        set: m.setMembers.map((s) => s.set.setName).join(', ') || null,
        registeredAt: m.user.createdAt,
      })),
    });
  } catch (err) {
    console.error('Pending members error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PATCH /api/admin/members/:id/approve
// Flips the applicant's account to verified so they can sign in (login rejects
// unverified accounts with 403). The "you're verified" email uses the same
// retry-and-log sendMail as the admin alert — a delivery failure is logged
// loudly, never silently swallowed.
async function approveMember(req, res) {
  try {
    const member = await prisma.member.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, fullName: true, email: true, isVerified: true } } },
    });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    if (member.user.isVerified) {
      return res.status(400).json({ error: 'Member is already verified' });
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: member.userId }, data: { isVerified: true } }),
      prisma.member.update({ where: { id: member.id }, data: { isActive: true } }),
    ]);

    const { sendVerificationApproved } = require('../services/email');
    sendVerificationApproved({ email: member.user.email, fullName: member.user.fullName })
      .then((result) => {
        if (result && !result.success) {
          console.error(`Verification-approved email to ${member.user.email} failed: ${result.error}`);
        }
      })
      .catch((err) => {
        console.error(`Verification-approved email to ${member.user.email} call failed:`, err && err.message);
      });

    console.log(`[admin] approved member ${member.user.fullName} <${member.user.email}> (member ${member.id})`);
    res.json({
      message: 'Member approved — they can now log in',
      member: {
        id: member.id,
        fullName: member.user.fullName,
        email: member.user.email,
        isVerified: true,
      },
    });
  } catch (err) {
    console.error('Approve member error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PATCH /api/admin/members/:id/reject
// Deletes the applicant's user + member records entirely (a rejected applicant
// was never confirmed as a TSSOSA alumnus, so nothing is retained). The
// rejection notice is sent BEFORE the deletion, while the email address still
// exists, using the same retry-and-log sendMail pattern.
async function rejectMember(req, res) {
  try {
    const member = await prisma.member.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, fullName: true, email: true, role: true } } },
    });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    if (member.user.role === 'admin') {
      return res.status(400).json({ error: 'Cannot reject an admin account' });
    }

    const { sendRegistrationRejected } = require('../services/email');
    const admin = await prisma.user.findFirst({ where: { role: 'admin' }, select: { email: true } });
    const contact = admin ? admin.email : 'echopofii@gmail.com';

    // 1. Email first — we still have their address here.
    const emailResult = await sendRegistrationRejected(
      { email: member.user.email, fullName: member.user.fullName },
      contact
    );
    if (!emailResult || !emailResult.success) {
      console.error(
        `[admin] rejection email to ${member.user.email} failed: ${emailResult && emailResult.error}`
      );
    } else {
      console.log(
        `[admin] rejection email sent to ${member.user.email} (${emailResult.messageId}) before deletion`
      );
    }

    // 2. Then delete. user.delete cascades member, set_members, refresh tokens,
    // payments, etc. — a re-registration with the same email is a fresh start.
    await prisma.user.delete({ where: { id: member.user.id } });

    console.log(
      `[admin] rejected + deleted registration for ${member.user.email} (user ${member.user.id}, member ${member.id})`
    );
    res.json({ message: 'Registration rejected and removed' });
  } catch (err) {
    console.error('Reject member error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getDashboard,
  allPayments,
  allDuesPayments,
  deactivateMember,
  updateMemberRole,
  pendingMembers,
  approveMember,
  rejectMember,
};
