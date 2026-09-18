const request = require('supertest');
const bcrypt = require('bcryptjs');
const { createTestApp } = require('./helpers/app');
const { seedTestData, generateAccessToken } = require('./helpers/seed');
const { prisma } = require('./helpers/app');

// Email services fire network calls against the live backend — stub them.
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

let app, data;

// The production super admin is identified by email (config.superAdminEmail,
// default echopofii@gmail.com). The test seed's admin is a *regular* admin, so
// we add a super-admin account alongside it to exercise the delete gate.
const SUPER_EMAIL = 'echopofii@gmail.com';
let superAdmin;

async function createVerifiedMember(email, fullName) {
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash('pass12345', 12),
      fullName,
      isVerified: true,
    },
  });
  const member = await prisma.member.create({
    data: {
      userId: user.id,
      matricNumber: `MAT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      gender: 'female',
      phone: '+2348000000000',
      address: 'Test City',
    },
  });
  await prisma.setMember.create({ data: { memberId: member.id, setId: data.set2021.id } });
  // Reward the member with a live session so we can prove suspension kills it.
  const { generateAccessToken, generateRefreshToken, hashToken } = require('../src/controllers/authController');
  const refresh = generateRefreshToken(user);
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hashToken(refresh), expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) },
  });
  return {
    user,
    member,
    accessToken: generateAccessToken(user),
    refreshToken: refresh,
    loginBody: { email, password: 'pass12345' },
  };
}

async function removeUser(userId) {
  const m = await prisma.member.findUnique({ where: { userId } });
  if (m) {
    await prisma.bioData.deleteMany({ where: { memberId: m.id } });
    await prisma.duesPayment.deleteMany({ where: { memberId: m.id } });
    await prisma.paymentTransaction.deleteMany({ where: { payment: { memberId: m.id } } });
    await prisma.payment.deleteMany({ where: { memberId: m.id } });
    await prisma.memberMilestone.deleteMany({ where: { memberId: m.id } });
    await prisma.electionApplication.deleteMany({ where: { memberId: m.id } });
    await prisma.excoOfficer.deleteMany({ where: { memberId: m.id } });
    await prisma.setMember.deleteMany({ where: { memberId: m.id } });
    await prisma.member.delete({ where: { id: m.id } });
  }
  await prisma.announcement.deleteMany({ where: { createdBy: userId } });
  await prisma.refreshToken.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
}

beforeAll(async () => {
  ({ app } = createTestApp());
  data = await seedTestData();

  superAdmin = await prisma.user.create({
    data: {
      email: SUPER_EMAIL,
      passwordHash: await bcrypt.hash('super12345', 12),
      fullName: 'Super Admin',
      role: 'admin',
      isVerified: true,
    },
  });
  await prisma.member.create({ data: { userId: superAdmin.id, matricNumber: 'SUP-001' } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/admin/members/:id — detail snapshot', () => {
  it('returns the full dashboard shape for an admin', async () => {
    const target = await createVerifiedMember('detail@test.com', 'Detail Target');
    const token = generateAccessToken(data.admin);

    const res = await request(app)
      .get(`/api/admin/members/${target.member.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.member.user).toMatchObject({
      email: 'detail@test.com',
      fullName: 'Detail Target',
      role: 'member',
      isVerified: true,
    });
    expect(res.body.member.member.isActive).toBe(true);
    expect(Array.isArray(res.body.member.sets)).toBe(true);
    expect(res.body.member.sets[0].name).toBe('2021');
    expect(res.body.member.activeSessions).toBe(1);

    await removeUser(target.user.id);
  });

  it('404 for unknown member and 403 for non-admin', async () => {
    const memberToken = generateAccessToken(data.memberUser);
    const asMember = await request(app)
      .get('/api/admin/members/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(asMember.status).toBe(403);

    const token = generateAccessToken(data.admin);
    const missing = await request(app)
      .get('/api/admin/members/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);
  });
});

describe('PATCH /api/admin/members/:id/suspend — full lifecycle', () => {
  it('suspends → blocks login + kills live session → unsuspends → login works again', async () => {
    const target = await createVerifiedMember('suspend@test.com', 'Suspend Target');
    const adminToken = generateAccessToken(data.admin);

    // Sanity: the account works right now.
    const beforeLogin = await request(app).post('/api/auth/login').send(target.loginBody);
    expect(beforeLogin.status).toBe(200);

    // Suspend.
    const suspend = await request(app)
      .patch(`/api/admin/members/${target.member.id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ suspended: true });
    expect(suspend.status).toBe(200);
    expect(suspend.body.member.member.isActive).toBe(false);
    expect(suspend.body.member.activeSessions).toBe(0);

    const dbMember = await prisma.member.findUnique({ where: { id: target.member.id } });
    expect(dbMember.isActive).toBe(false);
    const liveTokens = await prisma.refreshToken.count({ where: { userId: target.user.id, revoked: false } });
    expect(liveTokens).toBe(0);

    // Login is now blocked with the specific message.
    const blockedLogin = await request(app).post('/api/auth/login').send(target.loginBody);
    expect(blockedLogin.status).toBe(403);
    expect(blockedLogin.body.error).toBe('Account suspended');

    // Their already-issued access token is dead on the next authenticated request.
    const kicked = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${target.accessToken}`);
    expect(kicked.status).toBe(403);
    expect(kicked.body.error).toBe('Account suspended');

    // Refresh flow is also blocked.
    const refreshKick = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${target.refreshToken}`]);
    expect(refreshKick.status).toBe(403);
    expect(refreshKick.body.error).toBe('Account suspended');

    // Unsuspend (reversible, any admin).
    const unsuspend = await request(app)
      .patch(`/api/admin/members/${target.member.id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ suspended: false });
    expect(unsuspend.status).toBe(200);
    expect(unsuspend.body.member.member.isActive).toBe(true);

    // Login works again (fresh session).
    const restoredLogin = await request(app).post('/api/auth/login').send(target.loginBody);
    expect(restoredLogin.status).toBe(200);

    await removeUser(target.user.id);
  });

  it('rejects non-boolean payload and admin accounts', async () => {
    const adminToken = generateAccessToken(data.admin);
    const bad = await request(app)
      .patch(`/api/admin/members/${data.memberProfile.id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ suspended: 'yes' });
    expect(bad.status).toBe(400);

    const adminMember = await request(app)
      .patch(`/api/admin/members/${data.adminMember.id}/suspend`)
      .set('Authorization', `Bearer ${generateAccessToken(data.admin)}`)
      .send({ suspended: true });
    expect(adminMember.status).toBe(400);
  });
});

describe('PATCH /api/admin/members/:id/bio-data — validated admin edit', () => {
  it('updates bio data through the same validation as the member form (no second number)', async () => {
    const target = await createVerifiedMember('biodata@test.com', 'Bio Target');
    const adminToken = generateAccessToken(data.admin);

    const before = await request(app)
      .patch(`/api/admin/members/${target.member.id}/bio-data`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Bio Target',
        gender: 'Female',
        setYear: 2017,
        phone: '+2348000000000',
        email: 'biodata@test.com',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        bloodGroup: 'O+',
        occupationCategory: 'employed',
        specialization: 'Software Engineer',
        membershipDeclaration: true,
        dataPrivacyConsent: true,
      });
    expect(before.status).toBe(200);
    expect(before.body.bioData.occupationCategory).toBe('employed');

    // No membership number should ever be minted by an admin edit.
    const after = await prisma.member.findUnique({ where: { id: target.member.id } });
    expect(after.membershipNumber).toBeNull();

    // Invalid data is rejected with the same message the member would get.
    const invalid = await request(app)
      .patch(`/api/admin/members/${target.member.id}/bio-data`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Bio Target',
        gender: 'Female',
        setYear: 2017,
        phone: '+2348000000000',
        email: 'biodata@test.com',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        bloodGroup: 'Z+',
        occupationCategory: 'employed',
        specialization: 'Software Engineer',
        membershipDeclaration: true,
        dataPrivacyConsent: true,
      });
    expect(invalid.status).toBe(400);

    await removeUser(target.user.id);
  });
});

describe('DELETE /api/admin/members/:id — super admin gate', () => {
  it('permanently deletes the user + cascades, only for the single super admin', async () => {
    const target = await createVerifiedMember('delete@test.com', 'Delete Target');
    await prisma.payment.create({
      data: { memberId: target.member.id, paymentType: 'registration_fee', amount: 1000 * 100, status: 'success' },
    });
    await prisma.duesPayment.create({
      data: { memberId: target.member.id, duesCycleId: data.cycle.id, amount: 2000, status: 'success' },
    });

    // 1. A regular (non-super) admin is rejected.
    const regularAdmin = generateAccessToken(data.admin);
    const asRegularAdmin = await request(app)
      .delete(`/api/admin/members/${target.member.id}`)
      .set('Authorization', `Bearer ${regularAdmin}`);
    expect(asRegularAdmin.status).toBe(403);
    expect(asRegularAdmin.body.error).toBe('Super admin access required');

    // 2. A plain member is rejected.
    const asMember = await request(app)
      .delete(`/api/admin/members/${target.member.id}`)
      .set('Authorization', `Bearer ${generateAccessToken(data.memberUser)}`);
    expect(asMember.status).toBe(403);

    // 3. The single super admin can delete.
    const superToken = generateAccessToken(superAdmin);
    const del = await request(app)
      .delete(`/api/admin/members/${target.member.id}`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(del.status).toBe(200);

    // Everything is gone: user, member, set membership, payments, dues, sessions.
    expect(await prisma.user.findUnique({ where: { id: target.user.id } })).toBeNull();
    expect(await prisma.member.findUnique({ where: { id: target.member.id } })).toBeNull();
    expect(await prisma.payment.findFirst({ where: { memberId: target.member.id } })).toBeNull();
    expect(await prisma.duesPayment.findFirst({ where: { memberId: target.member.id } })).toBeNull();
    expect(await prisma.refreshToken.findFirst({ where: { userId: target.user.id } })).toBeNull();
  });

  it('refuses to delete admin accounts and unverified applicants', async () => {
    const superToken = generateAccessToken(superAdmin);

    const adminDelete = await request(app)
      .delete(`/api/admin/members/${data.adminMember.id}`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(adminDelete.status).toBe(400);

    const bcryptjs = require('bcryptjs');
    const unverifiedUser = await prisma.user.create({
      data: {
        email: 'unverified@test.com',
        passwordHash: await bcryptjs.hash('pass12345', 12),
        fullName: 'Unverified Applicant',
        isVerified: false,
      },
    });
    const unverifiedMember = await prisma.member.create({ data: { userId: unverifiedUser.id } });

    const unverifiedDelete = await request(app)
      .delete(`/api/admin/members/${unverifiedMember.id}`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(unverifiedDelete.status).toBe(400);

    await removeUser(unverifiedUser.id);
  });
});