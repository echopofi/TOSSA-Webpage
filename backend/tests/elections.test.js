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

describe('GET /api/elections/positions', () => {
  it('lists open positions publicly with fees', async () => {
    const res = await request(app).get('/api/elections/positions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.positions)).toBe(true);
    const president = res.body.positions.find((p) => p.title === 'President');
    expect(president).toBeDefined();
    expect(president.feeAmount).toBe(40000);
    expect(president.electionYear).toBe('2026/2027');
  });
});

describe('POST /api/elections/apply', () => {
  it('creates a pending application + initializes paystack', async () => {
    const paystackModule = require('../src/services/paystack');
    const originalInit = paystackModule.initializeTransaction;
    paystackModule.initializeTransaction = jest.fn().mockResolvedValue({
      data: {
        authorization_url: 'https://checkout.paystack.com/election',
        access_code: 'elec_access',
        reference: 'ELE-TEST123',
      },
    });

    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .post('/api/elections/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({ positionId: data.electionPosition.id, manifesto: 'I will serve' });

    expect(res.status).toBe(200);
    expect(res.body.reference).toBeDefined();
    expect(res.body.authorizationUrl).toBeDefined();

    const application = await prisma.electionApplication.findFirst({
      where: { memberId: data.memberProfile.id },
    });
    expect(application).not.toBeNull();
    expect(application.status).toBe('pending_payment');
    expect(application.manifesto).toBe('I will serve');

    paystackModule.initializeTransaction = originalInit;
  });

  it('returns the existing reference when applying again while unpaid', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .post('/api/elections/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({ positionId: data.electionPosition.id, manifesto: 'trying again' });

    expect(res.status).toBe(200);
    expect(res.body.reference).toBeDefined();
  });

  it('rejects a closed position', async () => {
    const closed = await prisma.electionPosition.create({
      data: { title: 'Treasurer', feeAmount: 15000, electionYear: '2026/2027', isOpen: false },
    });
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .post('/api/elections/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({ positionId: closed.id });
    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/elections/apply')
      .send({ positionId: data.electionPosition.id });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/elections/verify/:reference', () => {
  it('marks application submitted on successful payment', async () => {
    const reference = 'ELE-TEST123';
    const paystackModule = require('../src/services/paystack');
    const originalVerify = paystackModule.verifyTransaction;
    paystackModule.verifyTransaction = jest.fn().mockResolvedValue({
      data: {
        id: 77777,
        status: 'success',
        amount: data.electionPosition.feeAmount * 100,
        reference,
      },
    });

    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .get(`/api/elections/verify/${reference}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('submitted');

    const application = await prisma.electionApplication.findFirst({
      where: { paystackReference: reference },
    });
    expect(application.status).toBe('submitted');

    const ledger = await prisma.paymentTransaction.findUnique({ where: { reference } });
    expect(ledger).not.toBeNull();
    expect(ledger.status).toBe('success');
    expect(ledger.electionApplicationId).toBe(application.id);

    paystackModule.verifyTransaction = originalVerify;
  });
});

describe('GET /api/elections/my-applications', () => {
  it('returns own applications', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .get('/api/elections/my-applications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.applications)).toBe(true);
    expect(res.body.applications[0].position.title).toBe('President');
    expect(res.body.applications[0].status).toBe('submitted');
  });

  it('rejects a second application once the first is submitted', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .post('/api/elections/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({ positionId: data.electionPosition.id });

    expect(res.status).toBe(400);
  });
});

describe('Admin election management', () => {
  it('POST /api/admin/elections/positions creates a position', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .post('/api/admin/elections/positions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'General Secretary', feeAmount: 20000, electionYear: '2026/2027' });
    expect(res.status).toBe(201);
    expect(res.body.feeAmount).toBe(20000);
  });

  it('rejects non-admin for position creation', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .post('/api/admin/elections/positions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Should Fail', feeAmount: 1000, electionYear: '2026/2027' });
    expect(res.status).toBe(403);
  });

  it('GET /api/admin/elections/applications lists all with filters', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .get('/api/admin/elections/applications')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.applications)).toBe(true);
    expect(res.body.applications[0].member.fullName).toBeDefined();
  });

  it('PATCH /api/admin/elections/applications/:id approves', async () => {
    const application = await prisma.electionApplication.findFirst();
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .patch(`/api/admin/elections/applications/${application.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
  });
});