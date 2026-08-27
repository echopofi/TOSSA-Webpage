const request = require('supertest');
const { createTestApp } = require('./helpers/app');
const { seedTestData, generateAccessToken } = require('./helpers/seed');
const { prisma } = require('./helpers/app');
const config = require('../src/config');

let app, data;

beforeAll(async () => {
  ({ app } = createTestApp());
  data = await seedTestData();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/dues/cycles', () => {
  it('lists dues cycles publicly (no auth)', async () => {
    const res = await request(app).get('/api/dues/cycles');

    expect(res.status).toBe(200);
    expect(res.body.cycles.length).toBeGreaterThanOrEqual(1);
    expect(res.body.cycles[0].title).toBeDefined();
    expect(res.body.cycles[0].cycleType).toBeDefined();
    expect(res.body.cycles[0].dueDate).toBeDefined();
    expect(res.body.cycles[0].paidCount).toBeDefined();
  });
});

describe('POST /api/dues/cycles (admin)', () => {
  it('creates a new cycle as admin', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .post('/api/dues/cycles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Q1 2025 Term',
        cycleType: 'term',
        amount: 3000,
        startDate: '2025-01-01',
        endDate: '2025-03-31',
        dueDate: '2025-03-15',
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Q1 2025 Term');
    expect(res.body.cycleType).toBe('term');
    expect(res.body.amount).toBe(3000);
    expect(res.body.dueDate).toBeDefined();
  });

  it('rejects non-admin', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .post('/api/dues/cycles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Should Fail',
        cycleType: 'term',
        amount: 1000,
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        dueDate: '2025-12-31',
      });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/dues/pay/:cycleId', () => {
  it('initiates dues payment', async () => {
    const paystackModule = require('../src/services/paystack');
    const originalInit = paystackModule.initializeTransaction;
    paystackModule.initializeTransaction = jest.fn().mockResolvedValue({
      data: {
        authorization_url: 'https://checkout.paystack.com/dues',
        access_code: 'dues_access_code',
        reference: 'DUE-TEST123',
      },
    });

    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .post(`/api/dues/pay/${data.cycle.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.reference).toBeDefined();

    paystackModule.initializeTransaction = originalInit;
  });

  it('rejects payment for inactive cycle', async () => {
    const paystackModule = require('../src/services/paystack');
    const originalInit = paystackModule.initializeTransaction;
    paystackModule.initializeTransaction = jest.fn();

    await prisma.duesCycle.update({
      where: { id: data.cycle.id },
      data: { isActive: false },
    });

    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .post(`/api/dues/pay/${data.cycle.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);

    await prisma.duesCycle.update({
      where: { id: data.cycle.id },
      data: { isActive: true },
    });

    paystackModule.initializeTransaction = originalInit;
  });
});

describe('GET /api/dues/verify/:reference', () => {
  it('verifies dues payment and creates ledger entry', async () => {
    const paystackModule = require('../src/services/paystack');
    const originalVerify = paystackModule.verifyTransaction;
    paystackModule.verifyTransaction = jest.fn().mockResolvedValue({
      data: {
        id: 55555,
        status: 'success',
        amount: data.cycle.amount * 100,
        reference: 'DUE-TEST123',
      },
    });

    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .get('/api/dues/verify/DUE-TEST123')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    // Verify ledger entry
    const ledger = await prisma.paymentTransaction.findUnique({ where: { reference: 'DUE-TEST123' } });
    expect(ledger).not.toBeNull();
    expect(ledger.status).toBe('success');

    // Verify amount_paid was set
    const dp = await prisma.duesPayment.findFirst({ where: { paystackReference: 'DUE-TEST123' } });
    expect(dp.amountPaid).toBe(data.cycle.amount);

    paystackModule.verifyTransaction = originalVerify;
  });
});

describe('GET /api/dues/history', () => {
  it('returns dues payment history', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .get('/api/dues/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.payments)).toBe(true);
    if (res.body.payments.length > 0) {
      expect(res.body.payments[0].cycle).toBeDefined();
      expect(res.body.payments[0].amountPaid).toBeDefined();
    }
  });
});
