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

describe('POST /api/auth/register', () => {
  it('registers a new user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'newuser@test.com',
        password: 'password123',
        fullName: 'New User',
        setId: data.set2020.id,
        matricNumber: 'NEW-001',
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('newuser@test.com');
    expect(res.body.user.fullName).toBe('New User');
    expect(res.body.member).toBeDefined();
    expect(res.body.accessToken).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'admin@test.com',
        password: 'password123',
        fullName: 'Dup User',
        setId: data.set2020.id,
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already registered');
  });

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com' });

    expect(res.status).toBe(400);
  });

  it('rejects short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'short@test.com',
        password: '123',
        fullName: 'Short Pass',
        setId: data.set2020.id,
      });

    expect(res.status).toBe(400);
  });

  it('rejects invalid set', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'badset@test.com',
        password: 'password123',
        fullName: 'Bad Set',
        setId: '00000000-0000-0000-0000-000000000000',
      });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'admin12345' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('admin@test.com');
    expect(res.body.user.fullName).toBe('Admin User');
    expect(res.body.accessToken).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('rejects non-existent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'password123' });

    expect(res.status).toBe(401);
  });

  it('rejects unverified user', async () => {
    // Create unverified user
    const bcrypt = require('bcryptjs');
    const unverified = await prisma.user.create({
      data: {
        email: 'unverified@test.com',
        passwordHash: await bcrypt.hash('pass12345', 12),
        fullName: 'Unverified',
        isVerified: false,
      },
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unverified@test.com', password: 'pass12345' });

    expect(res.status).toBe(403);

    await prisma.user.delete({ where: { id: unverified.id } });
  });
});

describe('GET /api/auth/me', () => {
  it('returns current user profile', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('member@test.com');
    expect(res.body.user.fullName).toBe('Member User');
    expect(res.body.member).toBeDefined();
    expect(res.body.member.sets).toBeDefined();
    expect(res.body.member.sets.length).toBeGreaterThan(0);
    expect(res.body.member.sets[0].setName).toBe('2021');
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('logs out and clears cookie', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out');
  });
});
