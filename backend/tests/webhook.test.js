const request = require('supertest');
const crypto = require('crypto');
const { createTestApp } = require('./helpers/app');
const { seedTestData } = require('./helpers/seed');
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

function signPayload(payload) {
  return crypto
    .createHmac('sha512', config.paystack.webhookSecret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

describe('POST /api/webhooks/paystack', () => {
  it('rejects invalid signature', async () => {
    const res = await request(app)
      .post('/api/webhooks/paystack')
      .set('x-paystack-signature', 'invalid_hash')
      .send({ event: 'charge.success', data: {} });

    expect(res.status).toBe(401);
  });

  it('ignores non-charge.success events', async () => {
    const payload = { event: 'charge.failed', data: {} };
    const signature = signPayload(payload);

    const res = await request(app)
      .post('/api/webhooks/paystack')
      .set('x-paystack-signature', signature)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Event ignored');
  });

  it('processes registration charge.success — creates payment + ledger', async () => {
    const member = await prisma.member.findFirst({ where: { userId: data.memberUser.id } });
    const reference = 'REG-WHTEST01';

    const payment = await prisma.payment.create({
      data: {
        memberId: member.id,
        paymentType: 'registration_fee',
        amount: config.registrationFeeAmount * 100,
        paystackReference: reference,
        status: 'pending',
      },
    });

    const payload = {
      event: 'charge.success',
      data: {
        id: 98765,
        status: 'success',
        amount: config.registrationFeeAmount * 100,
        reference,
        metadata: { member_id: member.id, payment_id: payment.id, type: 'registration' },
      },
    };
    const signature = signPayload(payload);

    const res = await request(app)
      .post('/api/webhooks/paystack')
      .set('x-paystack-signature', signature)
      .send(payload);

    expect(res.status).toBe(200);

    const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(updated.status).toBe('success');
    expect(updated.paidAt).not.toBeNull();

    const ledger = await prisma.paymentTransaction.findUnique({ where: { reference } });
    expect(ledger).not.toBeNull();
    expect(ledger.status).toBe('success');
    expect(ledger.channel).toBe('paystack');
  });

  it('is IDEMPOTENT — retrying same webhook does not duplicate', async () => {
    const member = await prisma.member.findFirst({ where: { userId: data.memberUser.id } });
    const reference = 'REG-IDEMPOT01';

    const payment = await prisma.payment.create({
      data: {
        memberId: member.id,
        paymentType: 'registration_fee',
        amount: config.registrationFeeAmount * 100,
        paystackReference: reference,
        status: 'success',
        paidAt: new Date(),
      },
    });

    // Ledger already exists (simulating first webhook processed it)
    await prisma.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        amount: config.registrationFeeAmount * 100,
        status: 'success',
        channel: 'paystack',
        reference,
      },
    });

    const payload = {
      event: 'charge.success',
      data: {
        id: 11111,
        status: 'success',
        amount: config.registrationFeeAmount * 100,
        reference,
        metadata: { member_id: member.id, payment_id: payment.id, type: 'registration' },
      },
    };
    const signature = signPayload(payload);

    const ledgerBefore = await prisma.paymentTransaction.count({ where: { reference } });

    const res = await request(app)
      .post('/api/webhooks/paystack')
      .set('x-paystack-signature', signature)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Already processed');

    const ledgerAfter = await prisma.paymentTransaction.count({ where: { reference } });
    expect(ledgerAfter).toBe(ledgerBefore); // no duplicate
  });

  it('rejects webhook with amount mismatch — marks payment failed', async () => {
    const member = await prisma.member.findFirst({ where: { userId: data.memberUser.id } });
    const reference = 'REG-WHAMT01';

    const payment = await prisma.payment.create({
      data: {
        memberId: member.id,
        paymentType: 'registration_fee',
        amount: config.registrationFeeAmount * 100,
        paystackReference: reference,
        status: 'pending',
      },
    });

    const payload = {
      event: 'charge.success',
      data: {
        id: 22222,
        status: 'success',
        amount: 1, // wrong amount
        reference,
        metadata: { member_id: member.id, payment_id: payment.id, type: 'registration' },
      },
    };
    const signature = signPayload(payload);

    const res = await request(app)
      .post('/api/webhooks/paystack')
      .set('x-paystack-signature', signature)
      .send(payload);

    expect(res.status).toBe(200); // Still 200 to Paystack

    const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(updated.status).toBe('failed');

    const ledger = await prisma.paymentTransaction.findUnique({ where: { reference } });
    expect(ledger).not.toBeNull();
    expect(ledger.status).toBe('failed');
  });

  it('processes dues charge.success — creates dues_payment + ledger', async () => {
    const member = await prisma.member.findFirst({ where: { userId: data.memberUser.id } });
    const reference = 'DUE-WHTEST01';

    const dp = await prisma.duesPayment.create({
      data: {
        memberId: member.id,
        duesCycleId: data.cycle.id,
        amount: data.cycle.amount,
        paystackReference: reference,
        status: 'pending',
      },
    });

    const payload = {
      event: 'charge.success',
      data: {
        id: 33333,
        status: 'success',
        amount: data.cycle.amount * 100,
        reference,
        metadata: { member_id: member.id, dues_cycle_id: data.cycle.id, type: 'dues' },
      },
    };
    const signature = signPayload(payload);

    const res = await request(app)
      .post('/api/webhooks/paystack')
      .set('x-paystack-signature', signature)
      .send(payload);

    expect(res.status).toBe(200);

    const updated = await prisma.duesPayment.findUnique({ where: { id: dp.id } });
    expect(updated.status).toBe('success');
    expect(updated.amountPaid).toBe(data.cycle.amount);
    expect(updated.paidAt).not.toBeNull();

    const ledger = await prisma.paymentTransaction.findUnique({ where: { reference } });
    expect(ledger).not.toBeNull();
    expect(ledger.status).toBe('success');
  });

  it('dues idempotency — retry does not duplicate', async () => {
    const member = await prisma.member.findFirst({ where: { userId: data.memberUser.id } });
    const reference = 'DUE-IDEMPOT01';

    const dp = await prisma.duesPayment.create({
      data: {
        memberId: member.id,
        duesCycleId: data.cycle.id,
        amount: data.cycle.amount,
        amountPaid: data.cycle.amount,
        paystackReference: reference,
        status: 'success',
        paidAt: new Date(),
      },
    });

    await prisma.paymentTransaction.create({
      data: {
        duesPaymentId: dp.id,
        amount: data.cycle.amount * 100,
        status: 'success',
        channel: 'paystack',
        reference,
      },
    });

    const payload = {
      event: 'charge.success',
      data: {
        id: 44444,
        status: 'success',
        amount: data.cycle.amount * 100,
        reference,
        metadata: { member_id: member.id, dues_cycle_id: data.cycle.id, type: 'dues' },
      },
    };
    const signature = signPayload(payload);

    const ledgerBefore = await prisma.paymentTransaction.count({ where: { reference } });

    const res = await request(app)
      .post('/api/webhooks/paystack')
      .set('x-paystack-signature', signature)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Already processed');

    const ledgerAfter = await prisma.paymentTransaction.count({ where: { reference } });
    expect(ledgerAfter).toBe(ledgerBefore);
  });
});
