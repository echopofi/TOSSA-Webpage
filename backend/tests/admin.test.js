const request = require('supertest');
const { createTestApp } = require('./helpers/app');
const { seedTestData, generateAccessToken } = require('./helpers/seed');
const { prisma } = require('./helpers/app');

let app, data;

beforeAll(async () => {
  ({ app } = createTestApp());
  data = await seedTestData();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/admin/dashboard', () => {
  it('returns dashboard data as admin', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalMembers).toBe(2);
    expect(res.body.totalSets).toBe(2);
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
