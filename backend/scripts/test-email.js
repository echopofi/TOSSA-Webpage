/**
 * scripts/test-email.js
 * Sends a test email to the first admin in the DB (in Resend test mode that's
 * the account owner, so it will actually be delivered).
 *
 *   npm run db:testemail
 */
const { PrismaClient } = require('@prisma/client');
const { sendMail } = require('../src/services/email');

const prisma = new PrismaClient();

async function main() {
  const to =
    process.argv[2] ||
    (await prisma.user.findFirst({ where: { role: 'admin' }, select: { email: true } }))?.email;
  if (!to) {
    throw new Error('No recipient given and no admin found in the DB.');
  }
  const res = await sendMail({
    to,
    subject: 'Alumni Association test email',
    html: '<h2>Test email</h2><p>If you can read this, email delivery is working end-to-end.</p>',
  });
  console.log('Result:', JSON.stringify(res, null, 2));
  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('test-email failed:', err.message || err);
    await prisma.$disconnect();
    process.exit(1);
  });