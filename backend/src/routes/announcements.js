const express = require('express');
const { listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } = require('../controllers/announcementController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, listAnnouncements);
router.post('/', authenticateToken, requireAdmin, createAnnouncement);
router.put('/:id', authenticateToken, requireAdmin, updateAnnouncement);
router.delete('/:id', authenticateToken, requireAdmin, deleteAnnouncement);

module.exports = router;
