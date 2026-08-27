const express = require('express');
const { handlePaystackWebhook } = require('../controllers/webhookController');

const router = express.Router();

// Paystack webhook — raw body needed for signature verification
// This route is mounted BEFORE express.json() in the main app
router.post('/paystack', express.raw({ type: 'application/json' }), handlePaystackWebhook);

module.exports = router;
