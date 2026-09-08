const { createSet, updateSet } = require('../src/controllers/memberController');

jest.mock('../src/services/cloudinary', () => ({
  deleteImage: jest.fn().mockResolvedValue({ result: 'ok' }),
  publicIdFromUrl: jest.fn(() => 'sets/mock'),
  cloudinary: {},
}));

jest.mock('../src/config/prisma', () => ({
  graduationSet: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
}));

const prisma = require('../src/config/prisma');

beforeEach(() => {
  jest.clearAllMocks();
});

function makeRes() {
  const res = { statusCode: 0, body: null };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return { json: (body) => { res.body = body; return res; } };
  });
  res.json = jest.fn((body) => {
    if (res.statusCode === 0) res.statusCode = 200;
    res.body = body;
    return res;
  });
  return res;
}

describe('GraduationSet 6-year span validation', () => {
  test('createSet rejects a 4-year gap', async () => {
    prisma.graduationSet.create.mockRejectedValue(new Error('should not be called'));
    const res = makeRes();

    await createSet({ body: { setName: '2099', startYear: 2095, endYear: 2099 } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/must span exactly 6 years/);
    expect(prisma.graduationSet.create).not.toHaveBeenCalled();
  });

  test('createSet accepts a valid 6-year gap', async () => {
    prisma.graduationSet.create.mockResolvedValue({
      id: 'uuid-1', setName: '2098', startYear: 2092, endYear: 2098,
      description: null, groupInviteLink: null, coverImage: null,
      coverImageCaption: null, createdAt: new Date(),
    });
    const res = makeRes();

    await createSet({ body: { setName: '2098', startYear: 2092, endYear: 2098 } }, res);

    expect(res.statusCode).toBe(201);
    expect(prisma.graduationSet.create).toHaveBeenCalledTimes(1);
  });

  test('updateSet rejects a span-breaking year change', async () => {
    prisma.graduationSet.findUnique.mockResolvedValue({ startYear: 2092, endYear: 2098 });
    prisma.graduationSet.update.mockRejectedValue(new Error('should not be called'));
    const res = makeRes();

    await updateSet({ params: { id: 'uuid-1' }, body: { startYear: 2094 } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/must span exactly 6 years/);
    expect(prisma.graduationSet.update).not.toHaveBeenCalled();
  });

  test('updateSet accepts a compliant year change', async () => {
    prisma.graduationSet.findUnique.mockResolvedValue({ startYear: 2092, endYear: 2098 });
    prisma.graduationSet.update.mockResolvedValue({
      id: 'uuid-1', setName: '2098', startYear: 2092, endYear: 2098,
      description: null, groupInviteLink: null, coverImage: null,
      coverImageCaption: null, isActive: true,
    });
    const res = makeRes();

    await updateSet({ params: { id: 'uuid-1' }, body: { endYear: 2098 } }, res);

    expect(res.statusCode).toBe(200);
    expect(prisma.graduationSet.update).toHaveBeenCalledTimes(1);
  });
});