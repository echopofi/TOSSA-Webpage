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
    display_blood_group_on_id: record.displayBloodGroupOnId,
    occupation_category: record.occupationCategory,
    specialization: record.specialization,
    membership_declaration: record.membershipDeclaration,
    data_privacy_consent: record.dataPrivacyConsent,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
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
    const b = req.body || {};

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
        return res.status(400).json({ error: 'All required fields must be filled' });
      }
    }

    // The two Section I consents must both be explicitly true.
    if (b.membershipDeclaration !== true || b.dataPrivacyConsent !== true) {
      return res.status(400).json({
        error: 'Both the membership declaration and data privacy consent must be accepted',
      });
    }

    const fullName = b.fullName.trim();
    if (fullName.length > NAME_MAX) {
      return res.status(400).json({ error: 'Full name is too long' });
    }

    const formerNickname =
      typeof b.formerNickname === 'string' ? b.formerNickname.trim() : '';
    if (formerNickname && formerNickname.length > NICKNAME_MAX) {
      return res.status(400).json({ error: 'Former nickname is too long' });
    }

    if (!GENDERS.includes(b.gender)) {
      return res.status(400).json({ error: 'Gender is invalid' });
    }

    if (!countSetYear(b.setYear)) {
      return res.status(400).json({ error: 'Set / admission year is invalid' });
    }

    const phone = b.phone.trim();
    if (phone.length > PHONE_MAX) {
      return res.status(400).json({ error: 'Phone number is too long' });
    }

    const email = b.email.trim().toLowerCase();
    if (email.length > EMAIL_MAX) {
      return res.status(400).json({ error: 'Email is too long' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    if (b.city.trim().length > LOCATION_MAX || b.state.trim().length > LOCATION_MAX || b.country.trim().length > LOCATION_MAX) {
      return res.status(400).json({ error: 'Location fields are too long' });
    }

    if (!BLOOD_GROUPS.includes(b.bloodGroup)) {
      return res.status(400).json({ error: 'Blood group is invalid' });
    }

    if (!OCCUPATION_CATEGORIES.includes(b.occupationCategory)) {
      return res.status(400).json({ error: 'Occupation category is invalid' });
    }

    const specialization = b.specialization.trim();
    if (specialization.length > SPECIALIZATION_MAX) {
      return res.status(400).json({ error: 'Profession area is too long' });
    }

    const member = await prisma.member.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const data = {
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
      displayBloodGroupOnId: b.displayBloodGroupOnId === true,
      occupationCategory: b.occupationCategory,
      specialization,
      membershipDeclaration: true,
      dataPrivacyConsent: true,
    };

    const record = await prisma.bioData.upsert({
      where: { memberId: member.id },
      update: { ...data, updatedAt: new Date() },
      create: { memberId: member.id, ...data },
    });

    res.json({ bioData: serialize(record) });
  } catch (err) {
    console.error('Save bio data error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getBioData, saveBioData };