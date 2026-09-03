/**
 * prisma/seed.js
 * Seeds reference/config data for the alumni platform.
 *
 *   npm run db:seed   (or: node prisma/seed.js)
 *
 * Reference data only — graduation sets, dues cycles and election positions.
 * It is idempotent (safe to run repeatedly; nothing is ever deleted).
 *
 * User-owned data (users, members, payments, elections, exco, announcements,
 * refresh tokens) is intentionally NOT handled here — that is the job of
 * scripts/reset-db.js, which seeds the real admin account and wipes user data.
 *
 * This mirrors the canonical reference data in frontend/lib/mockData.ts and the
 * pattern used in tests/helpers/seed.js, but without test users/members. It also
 * guarantees the graduation set "2021" exists, which scripts/reset-db.js
 * requires before it can seed the admin.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Graduating sets 1997–2026 (30 sets). setName is the graduation year.
const SET_YEARS = Array.from({ length: 2026 - 1997 + 1 }, (_, i) => 1997 + i);

// Election positions for the 2026/2027 term (isOpen matches mockData.ts).
const ELECTION_POSITIONS = [
  { title: 'President', feeAmount: 40000, isOpen: true },
  { title: 'General Secretary', feeAmount: 20000, isOpen: true },
  { title: 'Treasurer', feeAmount: 15000, isOpen: true },
  { title: 'Publicity Secretary', feeAmount: 5000, isOpen: false },
];

// Confirmed fees: annual dues ₦2,000/yr, web-fee ₦1,000/yr (separate fee_type).
const DUES_CYCLES = [
  {
    title: '2023/2024 Annual Dues',
    cycleType: 'year',
    feeType: 'dues',
    amount: 2000,
    startDate: new Date('2023-01-01'),
    endDate: new Date('2024-12-31'),
    dueDate: new Date('2024-03-31'),
    isActive: false,
  },
  {
    title: '2025/2026 Annual Dues',
    cycleType: 'year',
    feeType: 'dues',
    amount: 2000,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2026-12-31'),
    dueDate: new Date('2025-12-31'),
    isActive: true,
  },
  {
    title: '2025/2026 Annual Web-fee',
    cycleType: 'year',
    feeType: 'web',
    amount: 1000,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2026-12-31'),
    dueDate: new Date('2025-12-31'),
    isActive: true,
  },
];

async function seedGraduationSets() {
  let created = 0;
  let existing = 0;

  for (const y of SET_YEARS) {
    const data = {
      setName: String(y),
      startYear: y - 4,
      endYear: y,
      description: `The Class of ${y} — a proud chapter in our school's story. We have grown into professionals across every sector, but the bonds forged in those classrooms and hostels remain unbroken.`,
      groupInviteLink: `https://chat.whatsapp.com/set_${y}`,
      isActive: true,
    };

    const alreadyExists = await prisma.graduationSet.findUnique({
      where: { setName: data.setName },
      select: { id: true },
    });

    if (alreadyExists) {
      existing += 1;
    } else {
      await prisma.graduationSet.create({ data });
      created += 1;
    }
  }

  return { created, existing };
}

async function seedDuesCycles() {
  let created = 0;

  for (const cycle of DUES_CYCLES) {
    const existing = await prisma.duesCycle.findFirst({
      where: { title: cycle.title, cycleType: cycle.cycleType },
    });

    if (existing) {
      await prisma.duesCycle.update({
        where: { id: existing.id },
        data: {
          feeType: cycle.feeType,
          amount: cycle.amount,
          startDate: cycle.startDate,
          endDate: cycle.endDate,
          dueDate: cycle.dueDate,
          isActive: cycle.isActive,
        },
      });
    } else {
      await prisma.duesCycle.create({ data: cycle });
      created += 1;
    }
  }

  return { created, existing: DUES_CYCLES.length - created };
}

async function seedElectionPositions() {
  const electionYear = '2026/2027';
  let created = 0;

  for (const pos of ELECTION_POSITIONS) {
    const existing = await prisma.electionPosition.findFirst({
      where: { title: pos.title, electionYear },
    });

    if (existing) {
      await prisma.electionPosition.update({
        where: { id: existing.id },
        data: { feeAmount: pos.feeAmount, isOpen: pos.isOpen },
      });
    } else {
      await prisma.electionPosition.create({
        data: { ...pos, electionYear },
      });
      created += 1;
    }
  }

  return { created, existing: ELECTION_POSITIONS.length - created };
}

async function seed() {
  const sets = await seedGraduationSets();
  const cycles = await seedDuesCycles();
  const positions = await seedElectionPositions();

  console.log('Seed summary:');
  console.log(`  graduation sets:  ${sets.created} created, ${sets.existing} existing`);
  console.log(`  dues cycles:      ${cycles.created} created, ${cycles.existing} existing`);
  console.log(`  election positions: ${positions.created} created, ${positions.existing} existing`);
}

seed()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Seed failed:', err.message || err);
    await prisma.$disconnect();
    process.exit(1);
  });
