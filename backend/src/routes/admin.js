const express = require('express');
const {
  getDashboard,
  allPayments,
  allDuesPayments,
  deactivateMember,
  updateMemberRole,
  pendingMembers,
  approveMember,
  rejectMember,
} = require('../controllers/adminController');
const {
  createPosition,
  adminListApplications,
  adminUpdateApplication,
} = require('../controllers/electionController');
const { assignOfficer, endOfficerTerm } = require('../controllers/excoController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken, requireAdmin);

router.get('/dashboard', getDashboard);
router.get('/payments', allPayments);
router.get('/dues-payments', allDuesPayments);
router.post('/members/:id/deactivate', deactivateMember);
router.put('/members/:id/role', updateMemberRole);
router.get('/members/pending', pendingMembers);
router.patch('/members/:id/approve', approveMember);
router.patch('/members/:id/reject', rejectMember);

// Elections — admin review
router.get('/elections/applications', adminListApplications);
router.patch('/elections/applications/:id', adminUpdateApplication);
router.post('/elections/positions', createPosition);

// Exco — admin assignment
router.post('/exco', assignOfficer);
router.patch('/exco/:id', endOfficerTerm);

module.exports = router;
