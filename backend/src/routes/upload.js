const express = require('express');
const { cloudinarySignature } = require('../controllers/uploadController');

const router = express.Router();

// Works pre-auth so the registration flow can upload a photo before the
// account exists. Keep it to signature generation only — never expose secrets.
router.post('/cloudinary-signature', cloudinarySignature);

module.exports = router;