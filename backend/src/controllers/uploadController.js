const crypto = require('crypto');
const config = require('../config');

// POST /api/upload/cloudinary-signature
// Generates a signed upload signature server-side so the Cloudinary API secret
// never reaches the browser. Works pre-auth too so the registration flow can
// upload the member photo before an account exists.
async function cloudinarySignature(req, res) {
  try {
    const { cloudName, apiKey, apiSecret } = config.cloudinary;
    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Cloudinary is not configured' });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = {
      timestamp,
      folder: 'members',
    };
    if (req.body && typeof req.body.folder === 'string') {
      paramsToSign.folder = req.body.folder;
    }

    const signature = crypto
      .createHash('sha256')
      .update(Object.keys(paramsToSign).sort().map((k) => `${k}=${paramsToSign[k]}`).join('&') + apiSecret)
      .digest('hex');

    res.json({
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder: paramsToSign.folder,
    });
  } catch (err) {
    console.error('Cloudinary signature error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { cloudinarySignature };