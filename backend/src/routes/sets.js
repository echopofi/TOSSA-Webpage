const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { listSets, createSet, updateSet } = require('../controllers/memberController');

// GET /api/sets — public
router.get('/', listSets);

// POST /api/sets — admin only
router.post('/', authenticateToken, requireAdmin, createSet);

// PUT /api/sets/:id — admin only
router.put('/:id', authenticateToken, requireAdmin, updateSet);

module.exports = router;
