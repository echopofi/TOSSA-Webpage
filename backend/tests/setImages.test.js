const request = require('supertest');
const { createTestApp, prisma } = require('./helpers/app');
const { seedTestData, generateAccessToken } = require('./helpers/seed');
const { deleteImage } = require('../src/services/cloudinary');

jest.mock('../src/services/cloudinary', () => ({
  deleteImage: jest.fn().mockResolvedValue({ result: 'ok' }),
  publicIdFromUrl: jest.fn(() => 'sets/mock'),
  cloudinary: {},
}));

let app;
let adminToken;
let memberToken;
let set2020;

beforeAll(async () => {
  ({ app } = createTestApp());
});

afterEach(() => {
  deleteImage.mockClear();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  const data = await seedTestData();
  set2020 = data.set2020;
  adminToken = generateAccessToken(data.admin);
  memberToken = generateAccessToken(data.memberUser);
});

describe('Set cover image (admin only)', () => {
  describe('POST /api/admin/sets/:id/cover', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await request(app).put(`/api/admin/sets/${set2020.id}/cover`).send({});
      expect(res.status).toBe(401);
    });

    it('rejects non-admin members', async () => {
      const res = await request(app)
        .put(`/api/admin/sets/${set2020.id}/cover`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ coverImage: 'https://res.cloudinary.com/x/image/upload/v1/sets/a.jpg' });
      expect(res.status).toBe(403);
    });

    it('sets the cover image for an admin', async () => {
      const url = 'https://res.cloudinary.com/x/image/upload/v1/sets/cover-1.jpg';
      const res = await request(app)
        .put(`/api/admin/sets/${set2020.id}/cover`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ coverImage: url });

      expect(res.status).toBe(200);
      expect(res.body.coverImage).toBe(url);
      const db = await prisma.graduationSet.findUnique({ where: { id: set2020.id } });
      expect(db.coverImage).toBe(url);
      expect(deleteImage).not.toHaveBeenCalled();
    });

    it('saves the chairman name (coverImageCaption) with the cover', async () => {
      const url = 'https://res.cloudinary.com/x/image/upload/v1/sets/cover-2.jpg';
      const res = await request(app)
        .put(`/api/admin/sets/${set2020.id}/cover`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ coverImage: url, coverImageCaption: 'John Owusu' });

      expect(res.status).toBe(200);
      expect(res.body.coverImage).toBe(url);
      expect(res.body.coverImageCaption).toBe('John Owusu');
      const db = await prisma.graduationSet.findUnique({ where: { id: set2020.id } });
      expect(db.coverImageCaption).toBe('John Owusu');
    });

    it('clears the caption when removed alongside the cover', async () => {
      await prisma.graduationSet.update({
        where: { id: set2020.id },
        data: { coverImage: 'https://res.cloudinary.com/x/image/upload/v1/sets/old.jpg', coverImageCaption: 'Old Chair' },
      });

      const res = await request(app)
        .put(`/api/admin/sets/${set2020.id}/cover`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ coverImage: null, coverImageCaption: '' });

      expect(res.status).toBe(200);
      const db = await prisma.graduationSet.findUnique({ where: { id: set2020.id } });
      expect(db.coverImage).toBeNull();
      expect(db.coverImageCaption).toBeNull();
    });

    it('replaces the old cover and deletes it from Cloudinary', async () => {
      await prisma.graduationSet.update({
        where: { id: set2020.id },
        data: { coverImage: 'https://res.cloudinary.com/x/image/upload/v1/sets/old.jpg' },
      });

      const res = await request(app)
        .put(`/api/admin/sets/${set2020.id}/cover`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ coverImage: 'https://res.cloudinary.com/x/image/upload/v1/sets/new.jpg' });

      expect(res.status).toBe(200);
      expect(deleteImage).toHaveBeenCalledWith(
        'https://res.cloudinary.com/x/image/upload/v1/sets/old.jpg'
      );
      const db = await prisma.graduationSet.findUnique({ where: { id: set2020.id } });
      expect(db.coverImage).toBe('https://res.cloudinary.com/x/image/upload/v1/sets/new.jpg');
    });

    it('clears the cover when null is passed and deletes the old asset', async () => {
      await prisma.graduationSet.update({
        where: { id: set2020.id },
        data: { coverImage: 'https://res.cloudinary.com/x/image/upload/v1/sets/old.jpg' },
      });

      const res = await request(app)
        .put(`/api/admin/sets/${set2020.id}/cover`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ coverImage: null });

      expect(res.status).toBe(200);
      expect(deleteImage).toHaveBeenCalledTimes(1);
      const db = await prisma.graduationSet.findUnique({ where: { id: set2020.id } });
      expect(db.coverImage).toBeNull();
    });

    it('rejects base64 data URLs', async () => {
      const res = await request(app)
        .put(`/api/admin/sets/${set2020.id}/cover`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ coverImage: 'data:image/png;base64,AAAA' });
      expect(res.status).toBe(400);
    });

    it('returns 404 for a missing set', async () => {
      const res = await request(app)
        .put('/api/admin/sets/00000000-0000-4000-8000-000000000000/cover')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ coverImage: 'https://res.cloudinary.com/x/image/upload/v1/sets/a.jpg' });
      expect(res.status).toBe(404);
    });
  });
});

describe('Set gallery images (admin only)', () => {
  describe('POST /api/admin/sets/:id/images', () => {
    it('adds a gallery image', async () => {
      const url = 'https://res.cloudinary.com/x/image/upload/v1/sets/gallery-1.jpg';
      const res = await request(app)
        .post(`/api/admin/sets/${set2020.id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ imageUrl: url });

      expect(res.status).toBe(201);
      expect(res.body.imageUrl).toBe(url);

      const count = await prisma.setImage.count({ where: { setId: set2020.id } });
      expect(count).toBe(1);
    });

    it('rejects non-admin members', async () => {
      const res = await request(app)
        .post(`/api/admin/sets/${set2020.id}/images`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ imageUrl: 'https://res.cloudinary.com/x/image/upload/v1/sets/g.jpg' });
      expect(res.status).toBe(403);
    });

    it('allows up to many images (no cap)', async () => {
      for (let i = 0; i < 3; i += 1) {
        const res = await request(app)
          .post(`/api/admin/sets/${set2020.id}/images`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ imageUrl: `https://res.cloudinary.com/x/image/upload/v1/sets/g-${i}.jpg` });
        expect(res.status).toBe(201);
      }
      const count = await prisma.setImage.count({ where: { setId: set2020.id } });
      expect(count).toBe(3);
    });

    it('returns 404 for a missing set', async () => {
      const res = await request(app)
        .post('/api/admin/sets/00000000-0000-4000-8000-000000000000/images')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ imageUrl: 'https://res.cloudinary.com/x/image/upload/v1/sets/g.jpg' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/admin/sets/:id/images/:imageId', () => {
    it('removes an image and deletes it from Cloudinary', async () => {
      const created = await prisma.setImage.create({
        data: {
          setId: set2020.id,
          imageUrl: 'https://res.cloudinary.com/x/image/upload/v1/sets/gone.jpg',
        },
      });

      const res = await request(app)
        .delete(`/api/admin/sets/${set2020.id}/images/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(deleteImage).toHaveBeenCalledWith(
        'https://res.cloudinary.com/x/image/upload/v1/sets/gone.jpg'
      );
      const db = await prisma.setImage.findUnique({ where: { id: created.id } });
      expect(db).toBeNull();
    });

    it('rejects non-admin members', async () => {
      const res = await request(app)
        .delete(`/api/admin/sets/${set2020.id}/images/00000000-0000-4000-8000-000000000000`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(403);
    });

    it('returns 404 for a missing image', async () => {
      const res = await request(app)
        .delete(`/api/admin/sets/${set2020.id}/images/00000000-0000-4000-8000-000000000000`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });
});

describe('GET /api/sets (public)', () => {
  it('returns coverImage and setImages on the list', async () => {
    await prisma.graduationSet.update({
      where: { id: set2020.id },
      data: { coverImage: 'https://res.cloudinary.com/x/image/upload/v1/sets/c.jpg' },
    });
    await prisma.setImage.create({
      data: { setId: set2020.id, imageUrl: 'https://res.cloudinary.com/x/image/upload/v1/sets/g.jpg' },
    });

    const res = await request(app).get('/api/sets');
    expect(res.status).toBe(200);

    const set = res.body.sets.find((s) => s.id === set2020.id);
    expect(set.coverImage).toBe('https://res.cloudinary.com/x/image/upload/v1/sets/c.jpg');
    expect(set.setImages).toHaveLength(1);
    expect(set.setImages[0].imageUrl).toBe('https://res.cloudinary.com/x/image/upload/v1/sets/g.jpg');
  });

  it('works without any auth for pagination-free list', async () => {
    const res = await request(app).get('/api/sets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sets)).toBe(true);
  });
});

describe('PUT /api/sets/:id (admin)', () => {
  it('accepts coverImage in the generic set update', async () => {
    const url = 'https://res.cloudinary.com/x/image/upload/v1/sets/c2.jpg';
    const res = await request(app)
      .put(`/api/sets/${set2020.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ coverImage: url });
    expect(res.status).toBe(200);
    expect(res.body.coverImage).toBe(url);
  });
});