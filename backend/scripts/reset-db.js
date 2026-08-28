/**
 * scripts/reset-db.js
 * Flushes every user and their data from the database, then seeds the real
 * admin account.
 *
 *   node scripts/reset-db.js
 *
 * Keeps reference/config data: graduation sets (2020/2021), dues cycles and
 * election positions. Wipes everything user-owned: users, members, payments,
 * dues payments, elections, exco, announcements, refresh tokens.
 */
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'echopofii@gmail.com';
const ADMIN_PASSWORD = 'admin12345';
const ADMIN_NAME = 'Aaron';
const ADMIN_SET = '2021';

async function resetDb() {
  // Wipe user-owned data (FK constraint order — deepest dependants first)
  const counts = {};
  for (const model of [
    'paymentTransaction',
    'payment',
    'duesPayment',
    'memberMilestone',
    'announcement',
    'setMember',
    'electionApplication',
    'excoOfficer',
    'refreshToken',
    'member',
    'user',
  ]) {
    counts[model] = await prisma[model].deleteMany({});
  }
  console.log('Flushed counts:', counts);

  const set = await prisma.graduationSet.findUnique({ where: { setName: ADMIN_SET } });
  if (!set) {
    throw new Error(`Graduation set "Class of ${ADMIN_SET}" not found — create sets before seeding.`);
  }

  // Remove any stale admin account with the same email, then seed fresh.
  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } });

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const user = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash,
      fullName: ADMIN_NAME,
      role: 'admin',
      isVerified: true,
    },
  });

  const member = await prisma.member.create({
    data: {
      userId: user.id,
      gender: 'male',
      phone: '+234 800 000 0000',
      address: 'Lagos, Nigeria',
      bio: 'Alumni Association administrator',
    },
  });

  await prisma.setMember.create({
    data: { memberId: member.id, setId: set.id },
  });

  console.log('Seeded admin:');
  console.log(`  email:    ${ADMIN_EMAIL}`);
  console.log(`  password: ${ADMIN_PASSWORD}`);
  console.log(`  name:     ${ADMIN_NAME}`);
  console.log(`  role:     admin (verified)`);
  console.log(`  set:      Class of ${ADMIN_SET}`);
}

resetDb()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Reset failed:', err.message || err);
    await prisma.$disconnect();
    process.exit(1);
  });