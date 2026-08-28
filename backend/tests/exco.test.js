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

describe('GET /api/exco', () => {
  it('returns empty list before any officer is assigned', async () => {
    const res = await request(app).get('/api/exco');
    expect(res.status).toBe(200);
    expect(res.body.officers).toEqual([]);
  });
});

describe('POST /api/admin/exco', () => {
  it('assigns an officer to a position for a term', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .post('/api/admin/exco')
      .set('Authorization', `Bearer ${token}`)
      .send({
        positionId: data.electionPosition.id,
        memberId: data.memberProfile.id,
        termLabel: '2026/2027',
      });

    expect(res.status).toBe(201);
    expect(res.body.isCurrent).toBe(true);
  });

  it('rejects non-admin', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .post('/api/admin/exco')
      .set('Authorization', `Bearer ${token}`)
      .send({
        positionId: data.electionPosition.id,
        memberId: data.memberProfile.id,
        termLabel: '2026/2027',
      });
    expect(res.status).toBe(403);
  });

  it('replaces a current officer on the same position', async () => {
    const token = generateAccessToken(data.admin);
    await request(app)
      .post('/api/admin/exco')
      .set('Authorization', `Bearer ${token}`)
      .send({
        positionId: data.electionPosition.id,
        memberId: data.adminMember.id,
        termLabel: '2027/2028',
      });

    const current = await prisma.excoOfficer.findMany({
      where: { positionId: data.electionPosition.id, isCurrent: true },
    });
    expect(current).toHaveLength(1);
    expect(current[0].memberId).toBe(data.adminMember.id);
  });
});

describe('PATCH /api/admin/exco/:id', () => {
  it('ends a term', async () => {
    const officer = await prisma.excoOfficer.findFirst({
      where: { memberId: data.adminMember.id, isCurrent: true },
    });
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .patch(`/api/admin/exco/${officer.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.isCurrent).toBe(false);

    const ended = await prisma.excoOfficer.findUnique({ where: { id: officer.id } });
    expect(ended.isCurrent).toBe(false);
    expect(ended.endedAt).not.toBeNull();
  });

  it('ending the only active term leaves no current officer', async () => {
    const res = await request(app).get('/api/exco');
    expect(res.status).toBe(200);
    expect(res.body.officers.length).toBe(0);
  });
});

describe('Public exco list reflects assigned officers', () => {
  it('shows the assigned officer once a term is active', async () => {
    const position = await prisma.electionPosition.create({
      data: { title: 'Publicity Secretary', feeAmount: 5000, electionYear: '2026/2027', isOpen: false },
    });
    const token = generateAccessToken(data.admin);
    await request(app)
      .post('/api/admin/exco')
      .set('Authorization', `Bearer ${token}`)
      .send({
        positionId: position.id,
        memberId: data.memberProfile.id,
        termLabel: '2026/2027',
      });

    const res = await request(app).get('/api/exco');
    expect(res.status).toBe(200);
    expect(res.body.officers.length).toBe(1);
    expect(res.body.officers[0].position).toBe('Publicity Secretary');
    expect(res.body.officers[0].member.fullName).toBe('Member User');
  });
});