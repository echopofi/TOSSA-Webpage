const crypto = require('crypto');

// UploadController reads config.cloudinary at require time, so set these
// before anything else is imported (tests run with --runInBand).
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-api-key';
process.env.CLOUDINARY_API_SECRET = 'test-api-secret';

const request = require('supertest');
const { createTestApp } = require('./helpers/app');
const { prisma } = require('./helpers/app');

let app;

beforeAll(async () => {
  ({ app } = createTestApp());
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/upload/cloudinary-signature', () => {
  it('returns a valid signature without leaking the secret', async () => {
    const res = await request(app)
      .post('/api/upload/cloudinary-signature')
      .send({ folder: 'members' });

    expect(res.status).toBe(200);
    expect(res.body.cloudName).toBe('test-cloud');
    expect(res.body.apiKey).toBe('test-api-key');
    expect(res.body.folder).toBe('members');
    expect(res.body.timestamp).toEqual(expect.any(Number));
    expect(res.body.signature).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toContain('test-api-secret');

    const expected = crypto
      .createHash('sha256')
      .update(`folder=members&timestamp=${res.body.timestamp}test-api-secret`)
      .digest('hex');
    expect(res.body.signature).toBe(expected);
  });

  it('allows a custom folder', async () => {
    const res = await request(app)
      .post('/api/upload/cloudinary-signature')
      .send({ folder: 'election-manifestos' });
    expect(res.status).toBe(200);
    expect(res.body.folder).toBe('election-manifestos');
  });
});