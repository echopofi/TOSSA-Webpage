const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { prisma } = require('./app');
const config = require('../../src/config');

async function seedTestData() {
  // Clean all tables (order matters for FK constraints)
  await prisma.paymentTransaction.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.duesPayment.deleteMany();
  await prisma.duesCycle.deleteMany();
  await prisma.memberMilestone.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.setMember.deleteMany();
  await prisma.electionApplication.deleteMany();
  await prisma.excoOfficer.deleteMany();
  await prisma.electionPosition.deleteMany();
  await prisma.member.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.graduationSet.deleteMany();
  await prisma.user.deleteMany();

  // Create graduation sets
  const set2020 = await prisma.graduationSet.create({
    data: { setName: '2020', startYear: 2016, endYear: 2020, description: 'Set of 2020' },
  });
  const set2021 = await prisma.graduationSet.create({
    data: { setName: '2021', startYear: 2017, endYear: 2021, description: 'Set of 2021' },
  });

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin12345', 12);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      passwordHash: adminPasswordHash,
      fullName: 'Admin User',
      role: 'admin',
      isVerified: true,
    },
  });

  // Create member user
  const memberPasswordHash = await bcrypt.hash('member12345', 12);
  const memberUser = await prisma.user.create({
    data: {
      email: 'member@test.com',
      passwordHash: memberPasswordHash,
      fullName: 'Member User',
      role: 'member',
      isVerified: true,
    },
  });

  // Create member profiles
  const adminMember = await prisma.member.create({
    data: { userId: admin.id, matricNumber: 'ADM-001', gender: 'male' },
  });

  const memberProfile = await prisma.member.create({
    data: { userId: memberUser.id, matricNumber: 'MEM-001', gender: 'female' },
  });

  // Create set memberships
  await prisma.setMember.create({
    data: { memberId: adminMember.id, setId: set2020.id, roleInSet: 'president' },
  });

  await prisma.setMember.create({
    data: { memberId: memberProfile.id, setId: set2021.id },
  });

  // Create a dues cycle (annual dues ₦2,000 — confirmed fee)
  const cycle = await prisma.duesCycle.create({
    data: {
      title: 'Annual Dues 2025',
      cycleType: 'year',
      feeType: 'dues',
      amount: 2000,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      dueDate: new Date('2025-06-30'),
    },
  });

  // Create a web-fee cycle (₦1,000 — separate recurring charge)
  const webFeeCycle = await prisma.duesCycle.create({
    data: {
      title: 'Annual Web-fee 2025',
      cycleType: 'year',
      feeType: 'web',
      amount: 1000,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      dueDate: new Date('2025-06-30'),
    },
  });

  // Create an open election position
  const electionPosition = await prisma.electionPosition.create({
    data: {
      title: 'President',
      feeAmount: 40000,
      electionYear: '2026/2027',
      isOpen: true,
    },
  });

  // Create an announcement
  const announcement = await prisma.announcement.create({
    data: {
      title: 'Test Announcement',
      content: 'This is a test announcement.',
      targetType: 'all_members',
      createdBy: admin.id,
      publishedAt: new Date(),
    },
  });

  return {
    set2020,
    set2021,
    admin,
    memberUser,
    adminMember,
    memberProfile,
    cycle,
    webFeeCycle,
    electionPosition,
    announcement,
  };
}

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: '15m' }
  );
}

module.exports = { seedTestData, generateAccessToken };
