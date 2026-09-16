const express = require('express');
const { initiateRegistration, verifyPayment, paymentHistory, requestOtp, verifyOtp } = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/initiate-registration', authenticateToken, initiateRegistration);
router.get('/verify/:reference', authenticateToken, verifyPayment);
router.get('/history', authenticateToken, paymentHistory);

router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);

module.exports = router;
