const express = require('express');
const { getDashboard, allPayments, allDuesPayments, deactivateMember, updateMemberRole } = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken, requireAdmin);

router.get('/dashboard', getDashboard);
router.get('/payments', allPayments);
router.get('/dues-payments', allDuesPayments);
router.post('/members/:id/deactivate', deactivateMember);
router.put('/members/:id/role', updateMemberRole);

module.exports = router;
