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

describe('POST /api/payments/initiate-registration', () => {
  it('rejects unauthenticated request', async () => {
    const res = await request(app).post('/api/payments/initiate-registration');
    expect(res.status).toBe(401);
  });

  it('creates pending payment and returns reference', async () => {
    const paystackModule = require('../src/services/paystack');
    const originalInit = paystackModule.initializeTransaction;
    paystackModule.initializeTransaction = jest.fn().mockResolvedValue({
      data: {
        authorization_url: 'https://checkout.paystack.com/test',
        access_code: 'test_access_code',
        reference: 'REG-TEST123',
      },
    });

    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .post('/api/payments/initiate-registration')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.reference).toBeDefined();
    expect(res.body.authorizationUrl).toBeDefined();

    paystackModule.initializeTransaction = originalInit;
  });

  it('returns existing pending reference if one exists', async () => {
    const paystackModule = require('../src/services/paystack');
    const originalInit = paystackModule.initializeTransaction;
    paystackModule.initializeTransaction = jest.fn().mockResolvedValue({
      data: {
        authorization_url: 'https://checkout.paystack.com/test',
        access_code: 'test_access_code',
        reference: 'REG-DUP123',
      },
    });

    const token = generateAccessToken(data.memberUser);

    await request(app)
      .post('/api/payments/initiate-registration')
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/api/payments/initiate-registration')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.reference).toBeDefined();

    paystackModule.initializeTransaction = originalInit;
  });
});

describe('GET /api/payments/verify/:reference', () => {
  it('verifies payment and creates ledger entry', async () => {
    const paystackModule = require('../src/services/paystack');
    const originalVerify = paystackModule.verifyTransaction;
    paystackModule.verifyTransaction = jest.fn().mockResolvedValue({
      data: {
        id: 12345,
        status: 'success',
        amount: config.registrationFeeAmount * 100,
        reference: 'REG-TEST123',
      },
    });

    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .get('/api/payments/verify/REG-TEST123')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    // Verify ledger entry was created
    const ledger = await prisma.paymentTransaction.findUnique({ where: { reference: 'REG-TEST123' } });
    expect(ledger).not.toBeNull();
    expect(ledger.status).toBe('success');
    expect(ledger.channel).toBe('paystack');

    paystackModule.verifyTransaction = originalVerify;
  });

  it('handles amount mismatch — marks payment failed', async () => {
    const member = await prisma.member.findFirst({ where: { userId: data.memberUser.id } });

    // Create a payment with known amount
    const payment = await prisma.payment.create({
      data: {
        memberId: member.id,
        paymentType: 'registration_fee',
        amount: config.registrationFeeAmount * 100,
        paystackReference: 'REG-AMOUNT01',
        status: 'pending',
      },
    });

    const paystackModule = require('../src/services/paystack');
    const originalVerify = paystackModule.verifyTransaction;
    paystackModule.verifyTransaction = jest.fn().mockResolvedValue({
      data: {
        id: 99999,
        status: 'success',
        amount: 1, // wrong amount
        reference: 'REG-AMOUNT01',
      },
    });

    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .get('/api/payments/verify/REG-AMOUNT01')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);

    // Verify payment marked as failed
    const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(updated.status).toBe('failed');

    paystackModule.verifyTransaction = originalVerify;
  });
});

describe('GET /api/payments/history', () => {
  it('returns payment history', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .get('/api/payments/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.payments)).toBe(true);
    if (res.body.payments.length > 0) {
      expect(res.body.payments[0].paymentType).toBeDefined();
      expect(res.body.payments[0].status).toBeDefined();
    }
  });
});
