const express = require('express');
const { listMembers, searchMembers, getMember, updateMember, listSets, createSet, updateSet } = require('../controllers/memberController');
const { listMilestones, createMilestone, deleteMilestone } = require('../controllers/milestoneController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Sets — public for list, admin for write
router.get('/sets', listSets);
router.post('/sets', authenticateToken, requireAdmin, createSet);
router.put('/sets/:id', authenticateToken, requireAdmin, updateSet);

// Members — authenticated
router.get('/search', authenticateToken, requireAdmin, searchMembers);
router.get('/', authenticateToken, listMembers);
router.get('/:id', authenticateToken, getMember);
router.patch('/:id', authenticateToken, requireAdmin, updateMember);

// Milestones
router.get('/:id/milestones', authenticateToken, listMilestones);
router.post('/:id/milestones', authenticateToken, createMilestone);
router.delete('/:id/milestones/:milestoneId', authenticateToken, deleteMilestone);

module.exports = router;
