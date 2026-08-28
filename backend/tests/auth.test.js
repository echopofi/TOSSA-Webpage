const request = require('supertest');
const bcrypt = require('bcryptjs');
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

  it('rejects invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'not-an-email',
        password: 'password123',
        fullName: 'Bad Email',
        setId: data.set2020.id,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid email');
  });

  it('rejects overlong email and name', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `${'a'.repeat(250)}@test.com`,
        password: 'password123',
        fullName: 'X'.repeat(300),
        setId: data.set2020.id,
      });

    expect(res.status).toBe(400);
  });

  it('rejects overlong password and phone', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'toolong@test.com',
        password: 'x'.repeat(200),
        fullName: 'Too Long',
        phone: '0'.repeat(60),
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

  it('rejects non-UUID (mock) setId with 400, not 500', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'legacyset@test.com',
        password: 'password123',
        fullName: 'Legacy Set',
        setId: 'set_2021',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid graduation set');
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

  it('rejects malformed email on login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid email');
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

describe('PATCH /api/auth/me', () => {
  it('updates the authenticated user’s profile and persists it', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Renamed Member',
        phone: '+234 800 000 1234',
        gender: 'Female',
        address: 'Lagos, Nigeria',
        bio: 'Hello world',
      });

    expect(res.status).toBe(200);
    expect(res.body.user.fullName).toBe('Renamed Member');
    expect(res.body.member.phone).toBe('+234 800 000 1234');
    expect(res.body.member.address).toBe('Lagos, Nigeria');
    expect(res.body.member.bio).toBe('Hello world');

    const persisted = await prisma.user.findUnique({
      where: { id: data.memberUser.id },
      include: { member: true },
    });
    expect(persisted.fullName).toBe('Renamed Member');
    expect(persisted.member.phone).toBe('+234 800 000 1234');

    // Restore seed state for later tests
    await prisma.user.update({
      where: { id: data.memberUser.id },
      data: { fullName: 'Member User' },
    });
    await prisma.member.update({
      where: { id: persisted.member.id },
      data: { phone: null, address: null, bio: null, gender: 'female' },
    });
  });

  it('rejects an overlong phone number', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: 'x'.repeat(31) });
    expect(res.status).toBe(400);
  });

  it('rejects an empty fullName', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: '   ' });
    expect(res.status).toBe(400);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).patch('/api/auth/me').send({ fullName: 'X' });
    expect(res.status).toBe(401);
  });

  it('creates a missing member record (admin who never completed registration)', async () => {
    const hash = await bcrypt.hash('password123', 12);
    const loneAdmin = await prisma.user.create({
      data: {
        email: 'loneadmin@test.com',
        passwordHash: hash,
        fullName: 'Lone Admin',
        role: 'admin',
        isVerified: true,
      },
    });

    try {
      const token = generateAccessToken(loneAdmin);
      const res = await request(app)
        .patch('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: '+234 1', gender: 'male' });

      expect(res.status).toBe(200);
      expect(res.body.member).toBeDefined();
      expect(res.body.member.phone).toBe('+234 1');
      expect(res.body.member.gender).toBe('male');
    } finally {
      await prisma.member.deleteMany({ where: { userId: loneAdmin.id } });
      await prisma.user.delete({ where: { id: loneAdmin.id } });
    }
  });
});

describe('PATCH /api/auth/password', () => {
  it('changes the password, rejects the old one, and accepts the new one', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .patch('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'member12345', newPassword: 'newpass12345' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Password changed successfully');

    const updated = await prisma.user.findUnique({ where: { id: data.memberUser.id } });
    expect(await bcrypt.compare('member12345', updated.passwordHash)).toBe(false);
    expect(await bcrypt.compare('newpass12345', updated.passwordHash)).toBe(true);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'member@test.com', password: 'member12345' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'member@test.com', password: 'newpass12345' });
    expect(newLogin.status).toBe(200);

    // Restore seed password for later tests
    const hash = await bcrypt.hash('member12345', 12);
    await prisma.user.update({ where: { id: data.memberUser.id }, data: { passwordHash: hash } });
  });

  it('rejects a wrong current password', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .patch('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrong-password', newPassword: 'whatever123' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Current password is incorrect');
  });

  it('rejects a too-short new password', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .patch('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'member12345', newPassword: '123' });
    expect(res.status).toBe(400);
  });

  it('rejects missing fields', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .patch('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'member12345' });
    expect(res.status).toBe(400);
  });
});
