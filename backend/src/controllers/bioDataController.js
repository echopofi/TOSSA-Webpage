const prisma = require('../config/prisma');

// Allowed enums for the bio data form. These mirror the options rendered in
// frontend/app/bio-data/page.tsx — the server is the authoritative gate.
const GENDERS = ['Male', 'Female'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const OCCUPATION_CATEGORIES = [
  'employed',
  'self_employed',
  'entrepreneur',
  'student',
  'civil_public_servant',
  'clergy_ministry',
  'professional_practice',
  'retired',
  'unemployed',
  'other',
];

// Mirror of the client-side rule in frontend/lib/validation.ts.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NAME_MAX = 255;
const NICKNAME_MAX = 100;
const PHONE_MAX = 30;
const EMAIL_MAX = 254;
const LOCATION_MAX = 120;
const SPECIALIZATION_MAX = 255;
const MIN_SET_YEAR = 1950;
const MAX_SET_YEAR = new Date().getFullYear() + 1;

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function countSetYear(v) {
  return Number.isInteger(v) && v >= MIN_SET_YEAR && v <= MAX_SET_YEAR;
}

function serialize(record) {
  return {
    id: record.id,
    member_id: record.memberId,
    full_name: record.fullName,
    former_nickname: record.formerNickname,
    gender: record.gender,
    set_year: record.setYear,
    phone: record.phone,
    email: record.email,
    city: record.city,
    state: record.state,
    country: record.country,
    blood_group: record.bloodGroup,
    occupation_category: record.occupationCategory,
    specialization: record.specialization,
    membership_declaration: record.membershipDeclaration,
    data_privacy_consent: record.dataPrivacyConsent,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

// Thrown by validateBioDataPayload so both the member form and the admin edit
// path surface the exact same messages. status mirrors the equivalent res.status.
class BioDataValidationError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'BioDataValidationError';
    this.status = status;
  }
}

// Shared validation used by PUT /api/bio-data (member's own form) and
// PATCH /api/admin/members/:id/bio-data (admin edit). Can never be bypassed by
// a side channel — both callers funnel through the one gate.
function validateBioDataPayload(b) {
  const requiredStrings = [
    'fullName',
    'gender',
    'phone',
    'email',
    'city',
    'state',
    'country',
    'bloodGroup',
    'occupationCategory',
    'specialization',
  ];

  for (const key of requiredStrings) {
    if (!isNonEmptyString(b[key])) {
      throw new BioDataValidationError(400, 'All required fields must be filled');
    }
  }

  if (b.membershipDeclaration !== true || b.dataPrivacyConsent !== true) {
    throw new BioDataValidationError(400, 'Both the membership declaration and data privacy consent must be accepted');
  }

  const fullName = b.fullName.trim();
  if (fullName.length > NAME_MAX) {
    throw new BioDataValidationError(400, 'Full name is too long');
  }

  const formerNickname = typeof b.formerNickname === 'string' ? b.formerNickname.trim() : '';
  if (formerNickname && formerNickname.length > NICKNAME_MAX) {
    throw new BioDataValidationError(400, 'Former nickname is too long');
  }

  if (!GENDERS.includes(b.gender)) {
    throw new BioDataValidationError(400, 'Gender is invalid');
  }

  if (!countSetYear(b.setYear)) {
    throw new BioDataValidationError(400, 'Set / admission year is invalid');
  }

  const phone = b.phone.trim();
  if (phone.length > PHONE_MAX) {
    throw new BioDataValidationError(400, 'Phone number is too long');
  }

  const email = b.email.trim().toLowerCase();
  if (email.length > EMAIL_MAX) {
    throw new BioDataValidationError(400, 'Email is too long');
  }
  if (!EMAIL_REGEX.test(email)) {
    throw new BioDataValidationError(400, 'Invalid email address');
  }

  if (b.city.trim().length > LOCATION_MAX || b.state.trim().length > LOCATION_MAX || b.country.trim().length > LOCATION_MAX) {
    throw new BioDataValidationError(400, 'Location fields are too long');
  }

  if (!BLOOD_GROUPS.includes(b.bloodGroup)) {
    throw new BioDataValidationError(400, 'Blood group is invalid');
  }

  if (!OCCUPATION_CATEGORIES.includes(b.occupationCategory)) {
    throw new BioDataValidationError(400, 'Occupation category is invalid');
  }

  const specialization = b.specialization.trim();
  if (specialization.length > SPECIALIZATION_MAX) {
    throw new BioDataValidationError(400, 'Profession area is too long');
  }

  return {
    fullName,
    formerNickname: formerNickname || null,
    gender: b.gender,
    setYear: b.setYear,
    phone,
    email,
    city: b.city.trim(),
    state: b.state.trim(),
    country: b.country.trim(),
    bloodGroup: b.bloodGroup,
    occupationCategory: b.occupationCategory,
    specialization,
    membershipDeclaration: true,
    dataPrivacyConsent: true,
  };
}

// Creates/updates the bio data record. issueMembershipNumber guards the one-time
// TOSA/{year}/{seq} assignment: only the member's own first submission issues a
// number; admin edits must never mint a second one (and never renumber).
async function upsertBioData(memberId, data, { issueMembershipNumber = false } = {}) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      membershipNumber: true,
      setMembers: {
        include: { set: true },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });
  if (!member) {
    throw new BioDataValidationError(404, 'Member not found');
  }

  return prisma.$transaction(async (tx) => {
    if (issueMembershipNumber && !member.membershipNumber) {
      const primarySet = member.setMembers[0]?.set;
      if (!primarySet) {
        throw new Error('Member has no graduation set to number against');
      }
      const [seq] = await tx.$queryRaw`
        UPDATE "graduation_sets"
        SET "next_member_seq" = "next_member_seq" + 1
        WHERE "id" = ${primarySet.id}::uuid
        RETURNING "next_member_seq"
      `;
      const setYear = Number.parseInt(primarySet.setName, 10) || data.setYear;
      const membershipNumber = `TOSA/${setYear}/${String(Number(seq.next_member_seq)).padStart(4, '0')}`;
      await tx.member.update({
        where: { id: member.id },
        data: { membershipNumber },
      });
    }

    return tx.bioData.upsert({
      where: { memberId: member.id },
      update: { ...data, updatedAt: new Date() },
      create: { memberId: member.id, ...data },
    });
  });
}

// GET /api/bio-data — returns the current member's record (or { bioData: null }
// when it has not been filled yet).
async function getBioData(req, res) {
  try {
    const member = await prisma.member.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const record = await prisma.bioData.findUnique({
      where: { memberId: member.id },
    });

    res.json({ bioData: record ? serialize(record) : null });
  } catch (err) {
    console.error('Get bio data error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT /api/bio-data — creates or updates the current member's bio data in one
// go (upsert keyed on memberId). Every required field must be present and both
// Section I checkboxes must be ticked before anything reaches the DB.
async function saveBioData(req, res) {
  try {
    const data = validateBioDataPayload(req.body || {});

    const member = await prisma.member.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const record = await upsertBioData(member.id, data, { issueMembershipNumber: true });
    res.json({ bioData: serialize(record) });
  } catch (err) {
    if (err instanceof BioDataValidationError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Save bio data error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PATCH /api/admin/members/:id/bio-data — admin corrects a member's bio data.
// Same validation as the member's own form; no membership number is issued.
async function adminSaveBioData(req, res) {
  try {
    const data = validateBioDataPayload(req.body || {});

    const member = await prisma.member.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const record = await upsertBioData(member.id, data, { issueMembershipNumber: false });
    res.json({ bioData: serialize(record) });
  } catch (err) {
    if (err instanceof BioDataValidationError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Admin save bio data error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getBioData, saveBioData, adminSaveBioData };