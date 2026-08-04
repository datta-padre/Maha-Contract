const express = require('express');
const router = express.Router();
const exe = require('../config/connection');

function countBy(rows, key, value) {
    if (!Array.isArray(rows)) return 0;
    for (var i = 0; i < rows.length; i++) {
        if (String(rows[i][key]) === String(value)) return Number(rows[i].c) || 0;
    }
    return 0;
}

function firstCount(rows) {
    return Array.isArray(rows) && rows[0] ? Number(rows[0].c) || 0 : 0;
}

router.get('/', async (req, res) => {
    try {
        var roleRows = await exe(`SELECT role, COUNT(*) AS c FROM users GROUP BY role`);
        var kycRows = await exe(
            `SELECT contractor_kyc_status AS status, COUNT(*) AS c FROM contractor_kyc GROUP BY contractor_kyc_status`
        );
        var tenderRows = await exe(`SELECT COUNT(*) AS c FROM tenders`);
        var materialRows = await exe(`SELECT COUNT(*) AS c FROM materials`);
        var users = await exe(
            `SELECT user_id, username, email, mobile, role, address, taluka, district, state, pincode, created_at
             FROM users ORDER BY user_id DESC LIMIT 200`
        );

        if (!Array.isArray(roleRows)) roleRows = [];
        if (!Array.isArray(kycRows)) kycRows = [];
        if (!Array.isArray(users)) users = [];

        var stats = {
            totalUsers: roleRows.reduce(function (sum, r) { return sum + (Number(r.c) || 0); }, 0),
            houseowners: countBy(roleRows, 'role', 'houseowner'),
            contractors: countBy(roleRows, 'role', 'contractor'),
            vendors: countBy(roleRows, 'role', 'vendor'),
            admins: countBy(roleRows, 'role', 'admin'),
            kycPending: countBy(kycRows, 'status', 'pending'),
            kycApproved: countBy(kycRows, 'status', 'approved'),
            kycRejected: countBy(kycRows, 'status', 'rejected'),
            tenders: firstCount(tenderRows),
            materials: firstCount(materialRows)
        };

        res.render('master-admin/index', {
            activePage: 'overview',
            stats: stats,
            users: users
        });
    } catch (err) {
        console.error(err);
        res.render('master-admin/index', {
            activePage: 'overview',
            stats: {
                totalUsers: 0, houseowners: 0, contractors: 0, vendors: 0, admins: 0,
                kycPending: 0, kycApproved: 0, kycRejected: 0, tenders: 0, materials: 0
            },
            users: [],
            error: 'Could not load master admin panel.'
        });
    }
});

module.exports = router;
