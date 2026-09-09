const express = require('express');
const { getBioData, saveBioData } = require('../controllers/bioDataController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Member's own bio data — the "Fill Bio Data" / "Edit Bio Data" form.
router.get('/', authenticateToken, getBioData);
router.put('/', authenticateToken, saveBioData);

module.exports = router;