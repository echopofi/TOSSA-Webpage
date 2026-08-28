const express = require('express');
const { register, login, refresh, logout, me, updateProfile, changePassword } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticateToken, me);
router.patch('/me', authenticateToken, updateProfile);
router.patch('/password', authenticateToken, changePassword);

module.exports = router;
