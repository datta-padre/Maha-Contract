const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const exe = require('../config/connection');
const {
    ROLES,
    hashPassword,
    signToken,
    setAuthCookie,
    verifyToken,
    requireRole,
    dashboardForRole
} = require('../middleware/auth');

const adminOnly = [verifyToken, requireRole(ROLES.ADMIN)];

// ---------- Public admin login ----------
router.get('/login', (req, res) => {
    res.render('admin/login');
});

router.post('/login', async (req, res) => {
    try {
        var email = req.body && req.body.email;
        var password = req.body && req.body.password;
        if (!email || !password) {
            return res.json({ success: false, message: 'Email and password required.' });
        }

        var hashedPassword = hashPassword(password);
        var users = await exe(
            `SELECT * FROM users WHERE email = ? AND password_hash = ? AND role = ? LIMIT 1`,
            [email, hashedPassword, ROLES.ADMIN]
        );

        if (!Array.isArray(users) || users.length === 0) {
            return res.json({ success: false, message: 'Invalid admin credentials.' });
        }

        var admin = users[0];
        var accessToken = signToken({
            email: admin.email,
            role: ROLES.ADMIN,
            user_id: admin.user_id
        });
        setAuthCookie(res, accessToken);

        return res.json({
            success: true,
            message: 'Admin logged in successfully',
            role: ROLES.ADMIN,
            redirect: dashboardForRole(ROLES.ADMIN)
        });
    } catch (err) {
        console.error(err);
        return res.json({ success: false, message: 'Admin login failed.' });
    }
});

// ---------- Protected admin routes ----------
router.get('/', adminOnly, (req, res) => {
    res.render('admin/directory');
});
router.get('/directory', adminOnly, (req, res) => {
    res.render('admin/directory');
});

router.get('/pending-users', adminOnly, async (req, res) => {
    try {
        var resultPending = await exe(
            `SELECT * FROM contractor_kyc WHERE contractor_kyc_status = 'pending' ORDER BY kyc_id DESC`
        );
        if (!Array.isArray(resultPending)) resultPending = [];
        res.render('admin/pending-users', { pendingUsers: resultPending });
    } catch (err) {
        console.error(err);
        res.render('admin/pending-users', {
            pendingUsers: [],
            error: 'Could not load pending KYC data.'
        });
    }
});

router.get('/upload-tender', adminOnly, (req, res) => {
    res.render('admin/upload-tender');
});

router.get('/verified', adminOnly, async (req, res) => {
    try {
        var resultApproved = await exe(
            `SELECT * FROM contractor_kyc WHERE contractor_kyc_status = 'approved' ORDER BY kyc_id DESC`
        );
        if (!Array.isArray(resultApproved)) resultApproved = [];
        res.render('admin/verified', { approvedUsers: resultApproved });
    } catch (err) {
        console.error(err);
        res.render('admin/verified', {
            approvedUsers: [],
            error: 'Could not load verified KYC data.'
        });
    }
});

router.get('/verify-dashboard', adminOnly, async (req, res) => {
    try {
        var resultPending = await exe(
            `SELECT * FROM contractor_kyc WHERE contractor_kyc_status = 'pending' ORDER BY kyc_id DESC`
        );
        var resultApproved = await exe(
            `SELECT * FROM contractor_kyc WHERE contractor_kyc_status = 'approved' ORDER BY kyc_id DESC`
        );

        if (!Array.isArray(resultPending)) resultPending = [];
        if (!Array.isArray(resultApproved)) resultApproved = [];

        res.render('admin/verify-dashboard', {
            pendingUsers: resultPending,
            approvedUsers: resultApproved
        });
    } catch (err) {
        console.error(err);
        res.render('admin/verify-dashboard', {
            pendingUsers: [],
            approvedUsers: [],
            error: 'Could not load KYC data.'
        });
    }
});

router.get('/view-doc', adminOnly, (req, res) => {
    var file = String(req.query.file || '').trim();
    if (!file || file.includes('..') || file.includes('/') || file.includes('\\')) {
        return res.status(400).send('Invalid document.');
    }

    var fullPath = path.join(__dirname, '..', 'public', 'kyc', file);
    if (!fs.existsSync(fullPath)) {
        return res.status(404).send('Document file not found on server.');
    }

    res.sendFile(path.resolve(fullPath));
});

router.post('/approve-kyc/:id', adminOnly, async (req, res) => {
    try {
        var id = Number(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid KYC id.' });
        await exe(
            `UPDATE contractor_kyc SET contractor_kyc_status = 'approved' WHERE kyc_id = ?`,
            [id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Could not approve KYC.' });
    }
});

router.get('/budget-dashboard', adminOnly, (req, res) => {
    res.render('admin/budget-dashboard');
});
router.get('/tender-dashboard', adminOnly, (req, res) => {
    res.render('admin/tender-dashboard');
});
router.get('/partner-dashboard', adminOnly, (req, res) => {
    res.render('admin/partner-dashboard');
});
router.get('/quality-team-dashboard', adminOnly, (req, res) => {
    res.render('admin/quality-team-dashboard');
});
router.get('/super-dashboard', adminOnly, (req, res) => {
    res.render('admin/super-dashboard');
});
router.get('/super-staff', adminOnly, (req, res) => {
    res.render('admin/super-staff');
});

module.exports = router;
