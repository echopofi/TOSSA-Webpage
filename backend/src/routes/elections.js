const express = require('express');
const {
  listOpenPositions,
  myApplications,
  applyForPosition,
  verifyApplication,
} = require('../controllers/electionController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/positions', listOpenPositions);                       // public
router.post('/apply', authenticateToken, applyForPosition);        // member
router.get('/verify/:reference', authenticateToken, verifyApplication); // member
router.get('/my-applications', authenticateToken, myApplications); // member

module.exports = router;