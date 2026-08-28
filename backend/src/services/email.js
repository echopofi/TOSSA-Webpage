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

// Sends through Resend's HTTP API when RESEND_API_KEY is configured (the
// preferred path); otherwise falls back to SMTP via nodemailer.
async function sendWithResend({ to, subject, html, text }) {
  const body = {
    from: config.email.resendFrom || `"${config.email.fromName}" <onboarding@resend.dev>`,
    to,
    subject,
    html,
    ...(text ? { text } : {}),
  };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.email.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`Resend ${res.status}: ${detail}`);
    err.status = res.status;
    throw err;
  }
  return { messageId: (await res.json()).id };
}

const RETRYABLE_NETWORK = /fetch failed|ECONN|ETIMEDOUT|EAI_AGAIN|UND_ERR|socket|connect timeout/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Abort after the whole retry budget; staggered inside the caller using delays.
const RETRY_DELAYS = [1500, 4000];

/**
 * Resilient sendMail: retries transient failures (network blips, DNS, connect
 * timeouts, 5xx) with backoff up to 3 attempts. Configuration errors (4xx —
 * e.g. Resend test-mode 403) are NOT retried; they're permanent. Every outcome
 * is logged server-side so a failed send is never fully silent.
 */
async function sendMail({ to, subject, html, text }) {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt += 1) {
    try {
      if (config.email.resendApiKey) {
        const info = await sendWithResend({ to, subject, html, text });
        console.log(`[email] sent to ${to} via Resend: ${info.messageId}`);
        return { success: true, transport: 'resend', messageId: info.messageId };
      }
      const transport = getTransporter();
      const info = await transport.sendMail({
        from: `"${config.email.fromName}" <${config.email.from}>`,
        to,
        subject,
        html,
      });
      console.log(`Email sent to ${to}: ${info.messageId}`);
      return { success: true, transport: 'smtp', messageId: info.messageId };
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      const retryable =
        err && err.status && err.status >= 500
          ? true
          : RETRYABLE_NETWORK.test(message) || !err.status;
      if (attempt < RETRY_DELAYS.length && retryable) {
        console.error(`Email to ${to} failed (attempt ${attempt + 1}/3) — retrying: ${message}`);
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      console.error(`Failed to send email to ${to}: ${message}`);
      return { success: false, error: message, retries: attempt };
    }
  }
  return { success: false, error: 'unreachable' };
}

async function sendRegistrationConfirmation(user) {
  return sendMail({
    to: user.email,
    subject: 'Welcome to the Alumni Association!',
    html: `
      <h2>Welcome, ${user.fullName}!</h2>
      <p>Your account has been created successfully.</p>
      <p>An administrator will verify your account shortly — you'll be able to sign in once it's approved.</p>
      <p>After verification, please complete your registration by paying the one-time registration fee.</p>
    `,
  });
}

async function sendVerificationApproved(user) {
  return sendMail({
    to: user.email,
    subject: 'Your Alumni Association account is verified',
    html: `
      <h2>You're all set, ${user.fullName}!</h2>
      <p>An administrator has verified your account. You can now sign in and complete your registration.</p>
      <p>Need to pay the one-time registration fee? Sign in and head to your dashboard.</p>
    `,
  });
}

async function sendPaymentConfirmation(user, payment) {
  const typeLabels = {
    registration: 'Registration Fee',
    dues: 'Annual Dues',
    web: 'Web-fee',
    election: 'Election Application Fee',
  };
  return sendMail({
    to: user.email,
    subject: 'Payment Confirmed',
    html: `
      <h2>Payment Received</h2>
      <p>Hello ${user.fullName},</p>
      <p>We have received your payment of <strong>₦${(payment.amount / 100).toLocaleString()}</strong>.</p>
      <p>Reference: ${payment.reference}</p>
      <p>Type: ${typeLabels[payment.type] || 'Dues'}</p>
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
      <p>Amount: <strong>₦${cycle.amount.toLocaleString()}</strong></p>
    `,
  });
}

async function sendNewRegistrationAlert(adminEmail, user) {
  return sendMail({
    to: adminEmail,
    subject: 'New registration awaiting verification',
    html: `
      <h2>New member registration</h2>
      <p>A new alumni account was created and needs verification:</p>
      <ul>
        <li><strong>Name:</strong> ${user.fullName}</li>
        <li><strong>Email:</strong> ${user.email}</li>
      </ul>
      <p>Sign in to the admin panel to verify this account.</p>
    `,
  });
}

module.exports = {
  sendMail,
  sendRegistrationConfirmation,
  sendVerificationApproved,
  sendPaymentConfirmation,
  sendDuesReminder,
  sendNewRegistrationAlert,
};