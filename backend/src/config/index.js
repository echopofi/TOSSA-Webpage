require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY,
    webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  // Confirmed fee values (replacing placeholders):
  //   registration fee ₦1,000 one-time
  //   annual dues ₦2,000/yr and web-fee ₦1,000/yr are stored per-cycle on
  //   dues_cycles (fee_type 'dues' | 'web'); amounts are always read from the DB.
  registrationFeeAmount: parseInt(process.env.REGISTRATION_FEE_AMOUNT, 10) || 1000,
  email: {
    // Resend API takes precedence when RESEND_API_KEY is set; SMTP (nodemailer)
    // remains as a fallback for self-hosted setups.
    resendApiKey: process.env.RESEND_API_KEY,
    resendFrom: process.env.RESEND_FROM, // e.g. "Alumni Association <no-reply@yourdomain.com>"
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM,
    fromName: process.env.EMAIL_FROM_NAME || 'Alumni Association',
  },
};
