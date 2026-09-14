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

  it('returns existing pending reference if one exists and is live on Paystack', async () => {
    await prisma.payment.deleteMany({
      where: { memberId: data.memberProfile.id, paymentType: 'registration_fee' },
    });

    const paystackModule = require('../src/services/paystack');
    const originalInit = paystackModule.initializeTransaction;
    const originalVerify = paystackModule.verifyTransaction;
    paystackModule.initializeTransaction = jest.fn().mockResolvedValue({
      data: {
        authorization_url: 'https://checkout.paystack.com/test',
        access_code: 'test_access_code',
        reference: 'REG-DUP123',
      },
    });
    // Paystack still holds a transaction for the earlier attempt, so the guard
    // must return that same reference instead of spawning a fresh one.
    paystackModule.verifyTransaction = jest.fn().mockResolvedValue({
      data: { status: 'initiated', amount: config.registrationFeeAmount * 100 },
    });

    const token = generateAccessToken(data.memberUser);

    const first = await request(app)
      .post('/api/payments/initiate-registration')
      .set('Authorization', `Bearer ${token}`);
    expect(first.body.reference).toBe('REG-DUP123');

    const freshPending = await prisma.payment.findFirst({
      where: { memberId: data.memberProfile.id, paymentType: 'registration_fee', status: 'pending' },
    });
    expect(freshPending.paystackReference).toBe('REG-DUP123');

    const res = await request(app)
      .post('/api/payments/initiate-registration')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.reference).toBe('REG-DUP123');

    // No extra row was created for the "in progress" call.
    const pendings = await prisma.payment.findMany({
      where: { memberId: data.memberProfile.id, paymentType: 'registration_fee', status: 'pending' },
    });
    expect(pendings).toHaveLength(1);

    paystackModule.initializeTransaction = originalInit;
    paystackModule.verifyTransaction = originalVerify;
  });

  it('self-heals a FRESH pending orphan (unknown to Paystack) instead of blocking', async () => {
    await prisma.payment.deleteMany({
      where: { memberId: data.memberProfile.id, paymentType: 'registration_fee' },
    });

    const orphan = await prisma.payment.create({
      data: {
        memberId: data.memberProfile.id,
        paymentType: 'registration_fee',
        amount: config.registrationFeeAmount * 100,
        paystackReference: 'REG-ORPHAN01',
        status: 'pending',
        createdAt: new Date(), // fresh — the exact scenario the user hit
      },
    });

    const paystackModule = require('../src/services/paystack');
    const originalInit = paystackModule.initializeTransaction;
    const originalVerify = paystackModule.verifyTransaction;
    // Paystack has no record of the orphaned reference.
    paystackModule.verifyTransaction = jest
      .fn()
      .mockRejectedValue(new Error('Transaction reference not found'));
    paystackModule.initializeTransaction = jest.fn().mockResolvedValue({
      data: {
        authorization_url: 'https://checkout.paystack.com/fresh',
        access_code: 'fresh_code',
        reference: 'REG-FRESH02',
      },
    });

    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .post('/api/payments/initiate-registration')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.reference).toBe('REG-FRESH02');

    // The orphan was retired, not left blocking.
    const retired = await prisma.payment.findUnique({ where: { id: orphan.id } });
    expect(retired.status).toBe('failed');

    paystackModule.initializeTransaction = originalInit;
    paystackModule.verifyTransaction = originalVerify;
  });

  it('rolls back the pending row when Paystack initialize fails (no stuck payments)', async () => {
    await prisma.payment.deleteMany({
      where: { memberId: data.memberProfile.id, paymentType: 'registration_fee' },
    });

    const paystackModule = require('../src/services/paystack');
    const originalInit = paystackModule.initializeTransaction;
    paystackModule.initializeTransaction = jest.fn().mockRejectedValue(new Error('Paystack is down'));

    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .post('/api/payments/initiate-registration')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(502);

    // No orphaned pending row may survive a failed initialize.
    const leftovers = await prisma.payment.findMany({
      where: { memberId: data.memberProfile.id, paymentType: 'registration_fee', status: 'pending' },
    });
    expect(leftovers).toHaveLength(0);

    paystackModule.initializeTransaction = originalInit;
  });

  it('retires a stale pending payment (> TTL) so the member can retry with a fresh reference', async () => {
    await prisma.payment.deleteMany({
      where: { memberId: data.memberProfile.id, paymentType: 'registration_fee' },
    });

    const stale = await prisma.payment.create({
      data: {
        memberId: data.memberProfile.id,
        paymentType: 'registration_fee',
        amount: config.registrationFeeAmount * 100,
        paystackReference: 'REG-STALE01',
        status: 'pending',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h old > 30m TTL
      },
    });

    const paystackModule = require('../src/services/paystack');
    const originalInit = paystackModule.initializeTransaction;
    const originalVerify = paystackModule.verifyTransaction;
    paystackModule.initializeTransaction = jest.fn().mockResolvedValue({
      data: {
        authorization_url: 'https://checkout.paystack.com/fresh',
        access_code: 'fresh_code',
        reference: 'REG-FRESH01',
      },
    });
    // Stale reference is unknown to Paystack → treated as orphan.
    paystackModule.verifyTransaction = jest
      .fn()
      .mockRejectedValue(new Error('Transaction reference not found'));

    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .post('/api/payments/initiate-registration')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.reference).toBe('REG-FRESH01');

    const retired = await prisma.payment.findUnique({ where: { id: stale.id } });
    expect(retired.status).toBe('failed');

    paystackModule.initializeTransaction = originalInit;
    paystackModule.verifyTransaction = originalVerify;
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
