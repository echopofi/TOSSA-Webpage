const request = require('supertest');
const { createTestApp } = require('./helpers/app');
const { seedTestData, generateAccessToken } = require('./helpers/seed');
const { prisma } = require('./helpers/app');

// Emails are REAL in the live backend, but the suite must not fire network
// calls (or trip on Resend sandbox 403s) — assert on the calls instead.
jest.mock('../src/services/email', () => {
  const fn = (id) => jest.fn().mockResolvedValue({ success: true, transport: 'resend', messageId: id });
  return {
    sendMail: fn('msg-sendmail'),
    sendRegistrationConfirmation: fn('msg-confirm'),
    sendNewRegistrationAlert: fn('msg-alert'),
    sendVerificationApproved: fn('msg-verify'),
    sendRegistrationRejected: fn('msg-reject'),
    sendPaymentConfirmation: fn('msg-pay'),
    sendDuesReminder: fn('msg-dues'),
  };
});
const emailService = require('../src/services/email');

let app, data;

beforeAll(async () => {
  ({ app } = createTestApp());
  data = await seedTestData();
});

beforeEach(() => {
  Object.values(emailService).forEach((fn) => fn.mockClear());
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Builds a pending applicant the same way POST /api/auth/register would
// (unverified user + member + a set membership).
async function createPendingApplicant(email, overrides = {}) {
  const bcrypt = require('bcryptjs');
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash('pass12345', 12),
      fullName: overrides.fullName || 'Pending Applicant',
      isVerified: false,
    },
  });
  const member = await prisma.member.create({
    data: { userId: user.id, profileImage: overrides.profileImage || null },
  });
  if (overrides.setId !== null) {
    await prisma.setMember.create({
      data: { memberId: member.id, setId: overrides.setId || data.set2021.id },
    });
  }
  return { user, member };
}

async function removeApplicant(userId) {
  const m = await prisma.member.findUnique({ where: { userId } });
  if (m) {
    await prisma.setMember.deleteMany({ where: { memberId: m.id } });
    await prisma.member.delete({ where: { id: m.id } });
  }
  await prisma.refreshToken.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
}

describe('GET /api/admin/dashboard', () => {
  it('returns dashboard data as admin', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalMembers).toBe(2);
    expect(res.body.totalSets).toBe(2);
    expect(res.body.activeMembers).toBe(2);
    expect(res.body.pendingPayments).toBe(0);
    expect(res.body.totalDuesCollected).toBe(0);
    expect(res.body.totalRegistrationPayments).toBe(0);
    expect(Array.isArray(res.body.recentPayments)).toBe(true);
    expect(Array.isArray(res.body.activeDuesCycles)).toBe(true);
  });

  it('rejects non-admin', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('rejects unauthenticated', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/payments', () => {
  it('returns all payments as admin', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .get('/api/admin/payments')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.payments)).toBe(true);
  });
});

describe('GET /api/admin/dues-payments', () => {
  it('returns all dues payments as admin', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .get('/api/admin/dues-payments')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.payments)).toBe(true);
  });
});

describe('POST /api/admin/members/:id/deactivate', () => {
  it('deactivates a member', async () => {
    const bcrypt = require('bcryptjs');
    const tempUser = await prisma.user.create({
      data: {
        email: 'temp@test.com',
        passwordHash: await bcrypt.hash('pass12345', 12),
        fullName: 'Temp User',
      },
    });
    const tempMember = await prisma.member.create({
      data: { userId: tempUser.id },
    });

    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .post(`/api/admin/members/${tempMember.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const member = await prisma.member.findUnique({ where: { id: tempMember.id } });
    expect(member.isActive).toBe(false);

    await prisma.paymentTransaction.deleteMany({ where: { duesPayment: { memberId: tempMember.id } } });
    await prisma.setMember.deleteMany({ where: { memberId: tempMember.id } });
    await prisma.member.delete({ where: { id: tempMember.id } });
    await prisma.user.delete({ where: { id: tempUser.id } });
  });
});

describe('PUT /api/admin/members/:id/role', () => {
  it('updates member role', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .put(`/api/admin/members/${data.memberProfile.id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'admin' });

    expect(res.status).toBe(200);

    await request(app)
      .put(`/api/admin/members/${data.memberProfile.id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'member' });
  });

  it('rejects invalid role', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .put(`/api/admin/members/${data.memberProfile.id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'superadmin' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/admin/members/pending', () => {
  it('returns only unverified registrants (with set, photo, date)', async () => {
    const applicant = await createPendingApplicant('pending@test.com', {
      fullName: 'Awaiting Review',
      profileImage: 'https://example.com/p.jpg',
    });

    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .get('/api/admin/members/pending')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const row = res.body.members.find((m) => m.email === 'pending@test.com');
    expect(row).toMatchObject({
      fullName: 'Awaiting Review',
      profileImage: 'https://example.com/p.jpg',
    });
    expect(row.set).toContain('2021');
    expect(typeof row.registeredAt).toBe('string');

    // Verified members must NOT appear.
    const verified = res.body.members.find((m) => m.email === 'member@test.com');
    expect(verified).toBeUndefined();

    await removeApplicant(applicant.user.id);
  });

  it('rejects non-admin (403) and unauthenticated (401)', async () => {
    const memberToken = generateAccessToken(data.memberUser);
    const asMember = await request(app)
      .get('/api/admin/members/pending')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(asMember.status).toBe(403);

    const anonymous = await request(app).get('/api/admin/members/pending');
    expect(anonymous.status).toBe(401);
  });
});

describe('PATCH /api/admin/members/:id/approve', () => {
  it('verifies the user, activates the member, emails them, and unblocks login', async () => {
    const applicant = await createPendingApplicant('approve@test.com', { fullName: 'Approve Me' });
    const token = generateAccessToken(data.admin);

    const res = await request(app)
      .patch(`/api/admin/members/${applicant.member.id}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { id: applicant.user.id } });
    const member = await prisma.member.findUnique({ where: { id: applicant.member.id } });
    expect(user.isVerified).toBe(true);
    expect(member.isActive).toBe(true);

    expect(emailService.sendVerificationApproved).toHaveBeenCalledWith({
      email: 'approve@test.com',
      fullName: 'Approve Me',
    });

    // They can now log in.
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'approve@test.com', password: 'pass12345' });
    expect(login.status).toBe(200);

    await removeApplicant(applicant.user.id);
  });

  it('rejects approving an already-verified member, and guards auth', async () => {
    const token = generateAccessToken(data.admin);
    const memberToken = generateAccessToken(data.memberUser);

    const already = await request(app)
      .patch(`/api/admin/members/${data.memberProfile.id}/approve`)
      .set('Authorization', `Bearer ${token}`);
    expect(already.status).toBe(400);
    expect(emailService.sendVerificationApproved).not.toHaveBeenCalled();

    const asMember = await request(app)
      .patch(`/api/admin/members/${data.memberProfile.id}/approve`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(asMember.status).toBe(403);

    const anonymous = await request(app).patch(`/api/admin/members/${data.memberProfile.id}/approve`);
    expect(anonymous.status).toBe(401);

    const missing = await request(app)
      .patch('/api/admin/members/00000000-0000-4000-8000-000000000000/approve')
      .set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);
  });
});

describe('PATCH /api/admin/members/:id/reject', () => {
  it('emails the applicant BEFORE deleting the record; re-registering works', async () => {
    const applicant = await createPendingApplicant('reject@test.com', { fullName: 'Reject Me' });
    const token = generateAccessToken(data.admin);

    const res = await request(app)
      .patch(`/api/admin/members/${applicant.member.id}/reject`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // Rejection notice went out with the member's address + an admin contact.
    expect(emailService.sendRegistrationRejected).toHaveBeenCalledWith(
      { email: 'reject@test.com', fullName: 'Reject Me' },
      data.admin.email
    );

    // Record is GONE — user, member, and set memberships all deleted.
    expect(await prisma.user.findUnique({ where: { id: applicant.user.id } })).toBeNull();
    expect(await prisma.member.findUnique({ where: { id: applicant.member.id } })).toBeNull();

    // Login fails (no account left).
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reject@test.com', password: 'pass12345' });
    expect(login.status).toBe(401);

    // Re-registering with the same email is a fresh registration (201) — no
    // leftover unique-constraint conflict from the deleted record.
    const reRegister = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'reject@test.com',
        password: 'pass12345',
        fullName: 'Reject Me Again',
        setId: data.set2021.id,
      });
    expect(reRegister.status).toBe(201);

    const recreated = await prisma.user.findUnique({ where: { email: 'reject@test.com' } });
    expect(recreated).not.toBeNull();
    await removeApplicant(recreated.id);
  });

  it('rejects guarding: admin protection, 404, and auth', async () => {
    const token = generateAccessToken(data.admin);
    const memberToken = generateAccessToken(data.memberUser);

    const adminReject = await request(app)
      .patch(`/api/admin/members/${data.adminMember.id}/reject`)
      .set('Authorization', `Bearer ${token}`);
    expect(adminReject.status).toBe(400);

    const missing = await request(app)
      .patch('/api/admin/members/00000000-0000-4000-8000-000000000000/reject')
      .set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);

    const asMember = await request(app)
      .patch(`/api/admin/members/${data.memberProfile.id}/reject`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(asMember.status).toBe(403);

    const anonymous = await request(app).patch(`/api/admin/members/${data.memberProfile.id}/reject`);
    expect(anonymous.status).toBe(401);
  });
});
