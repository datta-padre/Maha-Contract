const express = require('express');
const router = express.Router();
const { ROLES, STAFF_ROLES, verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken, requireRole(ROLES.ADMIN, STAFF_ROLES.MATERIALS));

router.get('/', (req, res) => {
    res.render('materialsAdmin/index');
});

router.get('/staff-management', (req, res) => {
    res.redirect('/master-admin/staff-management/hire-employee');
});

module.exports = router;
