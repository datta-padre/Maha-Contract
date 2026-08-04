const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const exe = require('../config/connection');
const { ROLES, verifyToken, requireRole } = require('../middleware/auth');

router.get('/', async (req, res) => {
    try {
        var pending = await exe(
            `SELECT * FROM contractor_kyc WHERE contractor_kyc_status = 'pending' ORDER BY kyc_id DESC`
        );
        var approved = await exe(
            `SELECT * FROM contractor_kyc WHERE contractor_kyc_status = 'approved' ORDER BY kyc_id DESC`
        );
        var rejected = await exe(
            `SELECT COUNT(*) AS total FROM contractor_kyc WHERE contractor_kyc_status = 'rejected'`
        );

        if (!Array.isArray(pending)) pending = [];
        if (!Array.isArray(approved)) approved = [];
        var rejectedCount = Array.isArray(rejected) && rejected[0] ? Number(rejected[0].total) || 0 : 0;

        res.render('kyc-verified/index', {
            pendingUsers: pending,
            approvedUsers: approved,
            rejectedCount: rejectedCount,
            activePage: 'overview'
        });
    } catch (err) {
        console.error(err);
        res.render('kyc-verified/index', {
            pendingUsers: [],
            approvedUsers: [],
            rejectedCount: 0,
            activePage: 'overview',
            error: 'Could not load KYC verify panel.'
        });
    }
});

// Pending verification queue
router.get('/pending', async (req, res) => {
    try {
        var pending = await exe(
            `SELECT * FROM contractor_kyc WHERE contractor_kyc_status = 'pending' ORDER BY kyc_id DESC`
        );
        if (!Array.isArray(pending)) pending = [];
        res.render('kyc-verified/pending', {
            pendingUsers: pending,
            activePage: 'pending'
        });
    } catch (err) {
        console.error(err);
        res.render('kyc-verified/pending', {
            pendingUsers: [],
            activePage: 'pending',
            error: 'Could not load pending KYC queue.'
        });
    }
});

// Verified contractors table
router.get('/verified', async (req, res) => {
    try {
        var approved = await exe(
            `SELECT * FROM contractor_kyc WHERE contractor_kyc_status = 'approved' ORDER BY kyc_id DESC`
        );
        if (!Array.isArray(approved)) approved = [];
        res.render('kyc-verified/verified', {
            approvedUsers: approved,
            activePage: 'verified'
        });
    } catch (err) {
        console.error(err);
        res.render('kyc-verified/verified', {
            approvedUsers: [],
            activePage: 'verified',
            error: 'Could not load verified KYC records.'
        });
    }
});

// Open KYC document
router.get('/view-doc', (req, res) => {    
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

// Approve KYC
router.post('/approve/:id', async (req, res) => {
    try {
        var id = Number(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid KYC id.' });

        await exe(
            `UPDATE contractor_kyc SET contractor_kyc_status = 'approved' WHERE kyc_id = ? AND contractor_kyc_status = 'pending'`,
            [id]
        );
        res.json({ success: true, message: 'KYC approved.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Could not approve KYC.' });
    }
});

// Reject KYC
router.post('/reject/:id', async (req, res) => {
    try {
        var id = Number(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid KYC id.' });

        await exe(
            `UPDATE contractor_kyc SET contractor_kyc_status = 'rejected' WHERE kyc_id = ? AND contractor_kyc_status = 'pending'`,
            [id]
        );
        res.json({ success: true, message: 'KYC rejected.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Could not reject KYC.' });
    }
});

module.exports = router;
