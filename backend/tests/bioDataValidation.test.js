const { getBioData, saveBioData } = require('../src/controllers/bioDataController');

jest.mock('../src/config/prisma', () => ({
  member: {
    findUnique: jest.fn(),
  },
  bioData: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
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

const VALID_BODY = {
  fullName: 'Angela Markel',
  formerNickname: 'Necklace',
  gender: 'Female',
  setYear: 2015,
  phone: '+2348012345678',
  email: 'angela@example.com',
  city: 'Jos',
  state: 'Plateau',
  country: 'Nigeria',
  bloodGroup: 'O+',
  displayBloodGroupOnId: false,
  occupationCategory: 'professional_practice',
  specialization: 'Medical Doctor',
  membershipDeclaration: true,
  dataPrivacyConsent: true,
};

const MEMBER = { id: 'member-id-1' };

describe('BioData endpoints', () => {
  describe('GET /api/bio-data', () => {
    test('returns null when the member has no bio data record', async () => {
      prisma.member.findUnique.mockResolvedValue(MEMBER);
      prisma.bioData.findUnique.mockResolvedValue(null);
      const res = makeRes();

      await getBioData({ user: { id: 'user-id-1' } }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ bioData: null });
    });

    test('returns the serialized record when one exists', async () => {
      prisma.member.findUnique.mockResolvedValue(MEMBER);
      prisma.bioData.findUnique.mockResolvedValue({
        id: 'bio-1', memberId: 'member-id-1', fullName: 'Angela Markel',
        formerNickname: 'Necklace', gender: 'Female', setYear: 2015,
        phone: '+2348012345678', email: 'angela@example.com',
        city: 'Jos', state: 'Plateau', country: 'Nigeria',
        bloodGroup: 'O+', displayBloodGroupOnId: false,
        occupationCategory: 'professional_practice', specialization: 'Medical Doctor',
        membershipDeclaration: true, dataPrivacyConsent: true,
        createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z'),
      });
      const res = makeRes();

      await getBioData({ user: { id: 'user-id-1' } }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.bioData).toEqual({
        id: 'bio-1', member_id: 'member-id-1', full_name: 'Angela Markel',
        former_nickname: 'Necklace', gender: 'Female', set_year: 2015,
        phone: '+2348012345678', email: 'angela@example.com',
        city: 'Jos', state: 'Plateau', country: 'Nigeria',
        blood_group: 'O+', display_blood_group_on_id: false,
        occupation_category: 'professional_practice', specialization: 'Medical Doctor',
        membership_declaration: true, data_privacy_consent: true,
        created_at: expect.any(Date), updated_at: expect.any(Date),
      });
    });

    test('404 when the user has no member record', async () => {
      prisma.member.findUnique.mockResolvedValue(null);
      const res = makeRes();

      await getBioData({ user: { id: 'user-id-1' } }, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('Member not found');
    });
  });

  describe('PUT /api/bio-data', () => {
    test('rejects when a required field is missing', async () => {
      const res = makeRes();
      const { city, ...partial } = VALID_BODY;

      await saveBioData({ user: { id: 'user-id-1' }, body: partial }, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/required fields/);
      expect(prisma.bioData.upsert).not.toHaveBeenCalled();
    });

    test('rejects when a required field is empty/whitespace', async () => {
      const res = makeRes();
      await saveBioData({ user: { id: 'user-id-1' }, body: { ...VALID_BODY, email: '  ' } }, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/required fields/);
      expect(prisma.bioData.upsert).not.toHaveBeenCalled();
    });

    test('rejects when the membership declaration is not ticked', async () => {
      const res = makeRes();
      await saveBioData({ user: { id: 'user-id-1' }, body: { ...VALID_BODY, membershipDeclaration: false } }, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/membership declaration and data privacy consent/);
      expect(prisma.bioData.upsert).not.toHaveBeenCalled();
    });

    test('rejects when the data privacy consent is not ticked', async () => {
      const res = makeRes();
      await saveBioData({ user: { id: 'user-id-1' }, body: { ...VALID_BODY, dataPrivacyConsent: false } }, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/membership declaration and data privacy consent/);
      expect(prisma.bioData.upsert).not.toHaveBeenCalled();
    });

    test('rejects an invalid blood group', async () => {
      const res = makeRes();
      await saveBioData({ user: { id: 'user-id-1' }, body: { ...VALID_BODY, bloodGroup: 'Z+' } }, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Blood group/);
      expect(prisma.bioData.upsert).not.toHaveBeenCalled();
    });

    test('rejects an invalid occupation category', async () => {
      const res = makeRes();
      await saveBioData({ user: { id: 'user-id-1' }, body: { ...VALID_BODY, occupationCategory: 'astronaut' } }, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Occupation category/);
      expect(prisma.bioData.upsert).not.toHaveBeenCalled();
    });

    test('rejects an invalid set year', async () => {
      const res = makeRes();
      await saveBioData({ user: { id: 'user-id-1' }, body: { ...VALID_BODY, setYear: 1800 } }, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Set \/ admission year/);
      expect(prisma.bioData.upsert).not.toHaveBeenCalled();
    });

    test('rejects an invalid gender', async () => {
      const res = makeRes();
      await saveBioData({ user: { id: 'user-id-1' }, body: { ...VALID_BODY, gender: 'Rocket' } }, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Gender/);
      expect(prisma.bioData.upsert).not.toHaveBeenCalled();
    });

    test('rejects an invalid email', async () => {
      const res = makeRes();
      await saveBioData({ user: { id: 'user-id-1' }, body: { ...VALID_BODY, email: 'not-an-email' } }, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Invalid email/);
      expect(prisma.bioData.upsert).not.toHaveBeenCalled();
    });

    test('creates a record on first submission', async () => {
      prisma.member.findUnique.mockResolvedValue(MEMBER);
      prisma.bioData.upsert.mockResolvedValue({
        id: 'bio-1', memberId: 'member-id-1', fullName: 'Angela Markel',
        formerNickname: 'Necklace', gender: 'Female', setYear: 2015,
        phone: '+2348012345678', email: 'angela@example.com',
        city: 'Jos', state: 'Plateau', country: 'Nigeria',
        bloodGroup: 'O+', displayBloodGroupOnId: false,
        occupationCategory: 'professional_practice', specialization: 'Medical Doctor',
        membershipDeclaration: true, dataPrivacyConsent: true,
        createdAt: new Date(), updatedAt: new Date(),
      });
      const res = makeRes();

      await saveBioData({ user: { id: 'user-id-1' }, body: VALID_BODY }, res);

      expect(res.statusCode).toBe(200);
      expect(prisma.bioData.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.bioData.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { memberId: 'member-id-1' },
          create: expect.objectContaining({ memberId: 'member-id-1', membershipDeclaration: true, dataPrivacyConsent: true }),
        })
      );
      expect(res.body.bioData.member_id).toBe('member-id-1');
    });

    test('404 when the user has no member record', async () => {
      prisma.member.findUnique.mockResolvedValue(null);
      const res = makeRes();

      await saveBioData({ user: { id: 'user-id-1' }, body: VALID_BODY }, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('Member not found');
      expect(prisma.bioData.upsert).not.toHaveBeenCalled();
    });
  });
});