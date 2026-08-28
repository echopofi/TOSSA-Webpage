const express = require('express');
const { listCurrentOfficers } = require('../controllers/excoController');

const router = express.Router();

router.get('/', listCurrentOfficers); // public

module.exports = router;