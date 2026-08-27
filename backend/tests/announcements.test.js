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

describe('GET /api/announcements', () => {
  it('returns published announcements for members', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .get('/api/announcements')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.announcements.length).toBeGreaterThanOrEqual(1);
    expect(res.body.announcements[0].targetType).toBeDefined();
    expect(res.body.announcements[0].content).toBeDefined();
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/announcements');
    expect(res.status).toBe(401);
  });

  it('returns all announcements for admin', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .get('/api/announcements')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.announcements.length).toBeGreaterThanOrEqual(1);
  });
});

describe('POST /api/announcements (admin)', () => {
  it('creates global announcement', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'New Announcement', content: 'Hello alumni!' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('New Announcement');
    expect(res.body.targetType).toBe('all_members');
  });

  it('creates set-targeted announcement', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Set 2021 Only', content: 'Targeted', targetType: 'set', setId: data.set2021.id });

    expect(res.status).toBe(201);
    expect(res.body.targetType).toBe('set');
  });

  it('creates member-targeted announcement', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'For You', content: 'Personal', targetType: 'member', targetMemberId: data.memberProfile.id });

    expect(res.status).toBe(201);
    expect(res.body.targetType).toBe('member');
  });

  it('creates scheduled announcement', async () => {
    const token = generateAccessToken(data.admin);
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Future', content: 'Later', scheduledAt: futureDate });

    expect(res.status).toBe(201);
    expect(res.body.scheduledAt).toBeDefined();
  });

  it('rejects non-admin', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Fail', content: 'Should not work' });

    expect(res.status).toBe(403);
  });

  it('rejects missing fields', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'No content' });

    expect(res.status).toBe(400);
  });

  it('rejects invalid targetType', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Bad', content: 'Type', targetType: 'invalid' });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/announcements/:id (admin)', () => {
  it('updates an announcement', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .put(`/api/announcements/${data.announcement.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Title');
  });

  it('returns 404 for non-existent', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .put('/api/announcements/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Nope' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/announcements/:id (admin)', () => {
  it('deletes an announcement', async () => {
    const token = generateAccessToken(data.admin);
    const created = await prisma.announcement.create({
      data: { title: 'Delete Me', content: 'Bye', targetType: 'all_members', createdBy: data.admin.id, publishedAt: new Date() },
    });

    const res = await request(app)
      .delete(`/api/announcements/${created.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Announcement deleted');
  });

  it('returns 404 for non-existent', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .delete('/api/announcements/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
