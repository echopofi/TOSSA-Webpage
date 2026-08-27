const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
  }
  return transporter;
}

async function sendMail({ to, subject, html }) {
  try {
    const transport = getTransporter();
    const info = await transport.sendMail({
      from: `"${config.email.fromName}" <${config.email.from}>`,
      to,
      subject,
      html,
    });
    console.log(`Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

async function sendRegistrationConfirmation(user) {
  return sendMail({
    to: user.email,
    subject: 'Welcome to the Alumni Association!',
    html: `
      <h2>Welcome, ${user.fullName}!</h2>
      <p>Your account has been created successfully.</p>
      <p>Please complete your registration by paying the one-time registration fee.</p>
    `,
  });
}

async function sendPaymentConfirmation(user, payment) {
  return sendMail({
    to: user.email,
    subject: 'Payment Confirmed',
    html: `
      <h2>Payment Received</h2>
      <p>Hello ${user.fullName},</p>
      <p>We have received your payment of <strong>₦${(payment.amount / 100).toLocaleString()}</strong>.</p>
      <p>Reference: ${payment.reference}</p>
      <p>Type: ${payment.type === 'registration' ? 'Registration Fee' : 'Dues'}</p>
    `,
  });
}

async function sendDuesReminder(user, cycle) {
  return sendMail({
    to: user.email,
    subject: `Dues Reminder — ${cycle.title}`,
    html: `
      <h2>Dues Payment Reminder</h2>
      <p>Hello ${user.fullName},</p>
      <p>This is a reminder that dues for <strong>${cycle.title}</strong> are due by <strong>${cycle.dueDate}</strong>.</p>
      <p>Amount: <strong>₦${(cycle.amount / 100).toLocaleString()}</strong></p>
    `,
  });
}

module.exports = {
  sendMail,
  sendRegistrationConfirmation,
  sendPaymentConfirmation,
  sendDuesReminder,
};
