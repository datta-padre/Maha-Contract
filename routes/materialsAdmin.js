const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('materialsAdmin/index');
});

router.get('/staff-management', (req, res) => {
    res.redirect('/master-admin/staff-management/hire-employee');
});

module.exports = router;
