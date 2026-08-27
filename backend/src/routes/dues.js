const express = require('express');
const { listCycles, createCycle, updateCycle, initiateDuesPayment, verifyDuesPayment, duesHistory } = require('../controllers/duesController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/cycles', listCycles);
router.post('/cycles', authenticateToken, requireAdmin, createCycle);
router.put('/cycles/:id', authenticateToken, requireAdmin, updateCycle);
router.post('/pay/:cycleId', authenticateToken, initiateDuesPayment);
router.get('/verify/:reference', authenticateToken, verifyDuesPayment);
router.get('/history', authenticateToken, duesHistory);

module.exports = router;
