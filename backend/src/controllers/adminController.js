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
// Lists every registrant whose account is not yet verified AND whose one-time
// registration fee has been confirmed paid. Unpaid registrants never appear
// here — they stay on their own "payment outstanding" screen until they pay.
// Rejected applicants are deleted outright, so this is the only "review"
// state an admin sees.
async function pendingMembers(req, res) {
  try {
    const members = await prisma.member.findMany({
      where: {
        user: { isVerified: false },
        payments: {
          some: { paymentType: 'registration_fee', status: 'success' },
        },
      },
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

// Shapes a single member record for the admin user-management view. It is the
// payload behind GET /api/admin/members/:id and the snapshot shape used by the
// suspend/unsuspend endpoints, so the frontend always renders fresh status.
function serializeMemberDetail(member) {
  return {
    user: {
      id: member.user.id,
      fullName: member.user.fullName,
      email: member.user.email,
      role: member.user.role,
      isVerified: member.user.isVerified,
      createdAt: member.user.createdAt,
    },
    member: {
      id: member.id,
      membershipNumber: member.membershipNumber,
      matricNumber: member.matricNumber,
      gender: member.gender,
      phone: member.phone,
      address: member.address,
      bio: member.bio,
      profileImage: member.profileImage,
      isActive: member.isActive,
      joinedAt: member.joinedAt,
    },
    bioData: member.bioData
      ? {
          fullName: member.bioData.fullName,
          formerNickname: member.bioData.formerNickname,
          gender: member.bioData.gender,
          setYear: member.bioData.setYear,
          phone: member.bioData.phone,
          email: member.bioData.email,
          city: member.bioData.city,
          state: member.bioData.state,
          country: member.bioData.country,
          bloodGroup: member.bioData.bloodGroup,
          occupationCategory: member.bioData.occupationCategory,
          specialization: member.bioData.specialization,
          membershipDeclaration: member.bioData.membershipDeclaration,
          dataPrivacyConsent: member.bioData.dataPrivacyConsent,
          updatedAt: member.bioData.updatedAt,
        }
      : null,
    sets: member.setMembers.map((sm) => ({
      id: sm.set.id,
      name: sm.set.setName,
      active: sm.set.isActive,
      joinedAt: sm.joinedAt,
    })),
    payments: member.payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      status: p.status,
      reference: p.reference,
      createdAt: p.createdAt,
    })),
    duesPayments: member.duesPayments.map((d) => ({
      id: d.id,
      cycle: d.cycle ? d.cycle.title : null,
      amount: d.amountPaid,
      status: d.status,
      createdAt: d.createdAt,
      paidAt: d.paidAt,
    })),
    activeSessions: member.user._count.refreshTokens,
  };
}

async function loadMemberDetail(id) {
  return prisma.member.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isVerified: true,
          createdAt: true,
          _count: { select: { refreshTokens: { where: { revoked: false } } } },
        },
      },
      bioData: true,
      setMembers: { include: { set: true }, orderBy: { joinedAt: 'asc' } },
      payments: { orderBy: { createdAt: 'desc' } },
      duesPayments: { include: { cycle: true }, orderBy: { createdAt: 'desc' } },
    },
  });
}

// GET /api/admin/members/:id
// Full read-only snapshot for the admin user-management view (dashboard view,
// edit form prefill, suspension status, payment history).
async function getMemberDetail(req, res) {
  try {
    const member = await loadMemberDetail(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json({ member: serializeMemberDetail(member) });
  } catch (err) {
    console.error('Get member detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PATCH /api/admin/members/:id/suspend  body: { suspended: boolean }
// Any admin can suspend/unsuspend. Suspending flips member.isActive to false —
// which login, refresh-token renewal, and every per-request auth check now
// reject — and immediately revokes every outstanding refresh token so the
// member's live sessions are kicked server-side. Unsuspending flips it back;
// the member signs in again with a fresh session.
async function updateMemberSuspension(req, res) {
  try {
    const { suspended } = req.body || {};
    if (typeof suspended !== 'boolean') {
      return res.status(400).json({ error: 'suspended must be a boolean' });
    }

    const member = await loadMemberDetail(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    if (member.user.role === 'admin') {
      return res.status(400).json({ error: 'Admin accounts cannot be suspended' });
    }

    if (suspended) {
      await prisma.$transaction([
        prisma.member.update({ where: { id: member.id }, data: { isActive: false } }),
        // Kill every live session: the member's stored refresh tokens are the
        // only way an expired access token gets renewed, so revoking them makes
        // the suspension hold even after the 5-minute access-token window.
        prisma.refreshToken.updateMany({
          where: { userId: member.user.id, revoked: false },
          data: { revoked: true },
        }),
      ]);
      console.log(
        `[admin] ${req.user.email} suspended ${member.user.fullName} <${member.user.email}> (${member.user.id})`
      );
    } else {
      await prisma.member.update({ where: { id: member.id }, data: { isActive: true } });
      console.log(
        `[admin] ${req.user.email} unsuspended ${member.user.fullName} <${member.user.email}> (${member.user.id})`
      );
    }

    const updated = await loadMemberDetail(member.id);
    res.json({ member: serializeMemberDetail(updated) });
  } catch (err) {
    console.error('Update member suspension error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE /api/admin/members/:id  (super admin only — route-gated)
// Permanently removes the user and, via the verified cascades (75f23aa +
// bio_data/refresh_tokens), every member-owned record: set_members, payments +
// payment_transactions, dues_payments, milestones, election_applications,
// exco_officers, bio_data, refresh_tokens. announcements.target_member_id is
// SET NULL (never deleted); announcements created BY the user would violate the
// created_by RESTRICT, so any such rows are re-authored to the deleting super
// admin first (announcements are standing content, not member-owned data).
async function deleteMemberAndUser(req, res) {
  try {
    const member = await loadMemberDetail(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    if (member.user.role === 'admin') {
      return res.status(400).json({ error: 'Admin accounts cannot be deleted' });
    }
    if (!member.user.isVerified) {
      return res.status(400).json({ error: 'Unverified applicants should be rejected, not deleted' });
    }

    const announcementsAuthored = await prisma.announcement.count({
      where: { createdBy: member.user.id },
    });
    if (announcementsAuthored > 0) {
      await prisma.announcement.updateMany({
        where: { createdBy: member.user.id },
        data: { createdBy: req.user.id },
      });
      console.log(
        `[admin] reassigned ${announcementsAuthored} announcement(s) authored by ${member.user.email} to ${req.user.email}`
      );
    }

    await prisma.user.delete({ where: { id: member.user.id } });

    console.log(
      `[admin] ${req.user.email} permanently deleted ${member.user.fullName} <${member.user.email}> (user ${member.user.id}, member ${member.id})`
    );
    res.json({ message: 'User permanently deleted' });
  } catch (err) {
    console.error('Delete member error:', err);
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
  getMemberDetail,
  updateMemberSuspension,
  deleteMemberAndUser,
};
