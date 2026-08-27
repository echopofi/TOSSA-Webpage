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

describe('GET /api/members/sets', () => {
  it('lists all sets publicly (no auth required)', async () => {
    const res = await request(app).get('/api/members/sets');

    expect(res.status).toBe(200);
    expect(res.body.sets.length).toBe(2);
    expect(res.body.sets[0].setName).toBeDefined();
    expect(res.body.sets[0].startYear).toBeDefined();
    expect(res.body.sets[0].endYear).toBeDefined();
    expect(res.body.sets[0].memberCount).toBeDefined();
  });
});

describe('POST /api/members/sets (admin)', () => {
  it('creates a new set as admin', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .post('/api/members/sets')
      .set('Authorization', `Bearer ${token}`)
      .send({ setName: '2022', startYear: 2018, endYear: 2022 });

    expect(res.status).toBe(201);
    expect(res.body.setName).toBe('2022');
    expect(res.body.startYear).toBe(2018);
    expect(res.body.endYear).toBe(2022);
  });

  it('rejects non-admin creating set', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .post('/api/members/sets')
      .set('Authorization', `Bearer ${token}`)
      .send({ setName: '2023', startYear: 2019, endYear: 2023 });

    expect(res.status).toBe(403);
  });

  it('rejects duplicate set name', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .post('/api/members/sets')
      .set('Authorization', `Bearer ${token}`)
      .send({ setName: '2020', startYear: 2010, endYear: 2014 });

    expect(res.status).toBe(409);
  });
});

describe('GET /api/members', () => {
  it('lists all members', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .get('/api/members')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.members.length).toBe(2);
    expect(res.body.total).toBe(2);
    expect(res.body.members[0].fullName).toBeDefined();
    expect(res.body.members[0].sets).toBeDefined();
  });

  it('filters by setId', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .get(`/api/members?setId=${data.set2021.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.members.length).toBe(1);
    expect(res.body.members[0].sets.some((s) => s.id === data.set2021.id)).toBe(true);
  });
});

describe('GET /api/members/:id', () => {
  it('returns a specific member', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .get(`/api/members/${data.memberProfile.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Member User');
    expect(res.body.sets).toBeDefined();
    expect(res.body.sets.length).toBeGreaterThan(0);
    expect(res.body.sets[0].setName).toBe('2021');
  });

  it('returns 404 for non-existent member', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .get('/api/members/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/members/search?q= (admin)', () => {
  it('searches members by name', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .get('/api/members/search?q=Member')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.members.length).toBe(1);
    expect(res.body.members[0].fullName).toBe('Member User');
  });

  it('searches members by email', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .get('/api/members/search?q=admin@test.com')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.members.length).toBe(1);
  });

  it('rejects non-admin', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .get('/api/members/search?q=Member')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('rejects missing query', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .get('/api/members/search')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/members/:id (admin)', () => {
  it('updates member fields', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .patch(`/api/members/${data.memberProfile.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ gender: 'non-binary', bio: 'Hello world' });

    expect(res.status).toBe(200);
    expect(res.body.gender).toBe('non-binary');
    expect(res.body.bio).toBe('Hello world');
  });

  it('rejects non-admin', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .patch(`/api/members/${data.memberProfile.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'hacked' });

    expect(res.status).toBe(403);
  });
});

describe('Member milestones', () => {
  let milestoneId;

  it('creates a milestone', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .post(`/api/members/${data.memberProfile.id}/milestones`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Graduated', milestoneDate: '2021-07-15' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Graduated');
    milestoneId = res.body.id;
  });

  it('lists milestones', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .get(`/api/members/${data.memberProfile.id}/milestones`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.milestones.length).toBe(1);
    expect(res.body.milestones[0].title).toBe('Graduated');
  });

  it('prevents creating milestone for another member', async () => {
    const token = generateAccessToken(data.admin);
    const res = await request(app)
      .post(`/api/members/${data.memberProfile.id}/milestones`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Should Fail', milestoneDate: '2021-01-01' });

    expect(res.status).toBe(403);
  });

  it('deletes a milestone', async () => {
    const token = generateAccessToken(data.memberUser);
    const res = await request(app)
      .delete(`/api/members/${data.memberProfile.id}/milestones/${milestoneId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Milestone deleted');
  });
});
