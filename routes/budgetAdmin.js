const express = require('express');
const router = express.Router();
const exe = require('../config/connection');

router.get('/', (req, res) => {
    res.render('budgetAdmin/index');
});

module.exports = router;