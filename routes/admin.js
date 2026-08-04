const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const exe = require('../config/connection');

router.get('/', (req, res) => {
    res.render('admin/directory');
});
router.get('/directory', (req, res) => {
    res.render('admin/directory');
});
router.get('/pending-users', async (req, res) => {
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
router.get('/upload-tender', (req, res) => {
    res.render('admin/upload-tender');
});

router.get('/verified', async (req, res) => {
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

router.get('/verify-dashboard', async (req, res) => {
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

// Open uploaded KYC document from public/kyc
router.get('/view-doc', (req, res) => {
    var file = String(req.query.file || '').trim();
    // Filenames may contain spaces/commas (e.g. "ChatGPT Image Jul 20, 2026...")
    if (!file || file.includes('..') || file.includes('/') || file.includes('\\')) {
        return res.status(400).send('Invalid document.');
    }

    var fullPath = path.join(__dirname, '..', 'public', 'kyc', file);
    if (!fs.existsSync(fullPath)) {
        return res.status(404).send('Document file not found on server.');
    }

    res.sendFile(path.resolve(fullPath));
});

router.post('/approve-kyc/:id', async (req, res) => {
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

router.get('/budget-dashboard', (req, res) => {
    res.render('admin/budget-dashboard');
});
router.get('/tender-dashboard', (req, res) => {
    res.render('admin/tender-dashboard');
});
router.get('/partner-dashboard', (req, res) => {
    res.render('admin/partner-dashboard');
});
router.get('/quality-team-dashboard', (req, res) => {
    res.render('admin/quality-team-dashboard');
});
router.get('/super-dashboard', (req, res) => {
    res.render('admin/super-dashboard');
});
router.get('/super-staff', (req, res) => {
    res.render('admin/super-staff');
});
router.get('/login', (req, res) => {
    res.render('admin/login');
});

module.exports = router;
