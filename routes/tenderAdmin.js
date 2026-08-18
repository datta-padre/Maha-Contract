const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const exe = require('../config/connection');
const { ROLES, STAFF_ROLES, verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken, requireRole(ROLES.ADMIN, STAFF_ROLES.TENDER));

router.get('/', async (req, res) => {
    try {
        let pendingTenders = [];
        let publishedTenders = [];
        let assignedTenders = [];
        let stats = { ready: 0, published: 0, assigned: 0, approvedBudgets: 0 };

        try {
            pendingTenders = await exe(`
                SELECT t.tender_id,
                       t.constructionCode,
                       t.estimated_cost,
                       t.plotLocation,
                       t.bhk,
                       t.floors,
                       t.budget_status,
                       t.tender_status,
                       t.created_at,
                       u.username AS owner_name,
                       u.email AS owner_email
                FROM tenders t
                LEFT JOIN users u ON u.user_id = t.user_id
                WHERE t.budget_status = 'estimated'
                ORDER BY t.tender_id DESC
                LIMIT 6
            `);
        } catch (e) {
            pendingTenders = [];
        }

        try {
            publishedTenders = await exe(`
                SELECT t.tender_id,
                       t.constructionCode,
                       t.estimated_cost,
                       t.plotLocation,
                       t.bhk,
                       t.floors,
                       t.tender_status,
                       t.created_at,
                       u.username AS owner_name,
                       u.email AS owner_email
                FROM tenders t
                LEFT JOIN users u ON u.user_id = t.user_id
                WHERE t.tender_status = 'published'
                ORDER BY t.tender_id DESC
                LIMIT 6
            `);
        } catch (e) {
            publishedTenders = [];
        }

        try {
            assignedTenders = await exe(`
                SELECT a.assigned_id,
                       a.tender_id,
                       a.assigned_at,
                       t.constructionCode,
                       t.estimated_cost,
                       t.plotLocation,
                       t.bhk,
                       t.floors,
                       t.tender_status,
                       owner.username AS owner_name,
                       COALESCE(k.full_name, cu.username) AS contractor_name
                FROM assigned_tenders a
                LEFT JOIN tenders t ON t.tender_id = a.tender_id
                LEFT JOIN users owner ON owner.user_id = t.user_id
                LEFT JOIN users cu ON cu.user_id = a.contractor_id
                LEFT JOIN (
                    SELECT k1.user_id, k1.full_name
                    FROM contractor_kyc k1
                    INNER JOIN (
                        SELECT user_id, MAX(kyc_id) AS kyc_id
                        FROM contractor_kyc
                        GROUP BY user_id
                    ) latest ON latest.kyc_id = k1.kyc_id
                ) k ON k.user_id = a.contractor_id
                ORDER BY a.assigned_id DESC
                LIMIT 6
            `);
        } catch (e) {
            assignedTenders = [];
        }

        async function countOf(sql) {
            try {
                const rows = await exe(sql);
                return Array.isArray(rows) && rows[0] ? Number(rows[0].c) || 0 : 0;
            } catch (e) {
                return 0;
            }
        }

        stats.ready = await countOf(`SELECT COUNT(*) AS c FROM tenders WHERE budget_status = 'estimated'`);
        stats.published = await countOf(`SELECT COUNT(*) AS c FROM tenders WHERE tender_status = 'published'`);
        stats.assigned = await countOf(`SELECT COUNT(*) AS c FROM assigned_tenders`);
        stats.approvedBudgets = await countOf(`SELECT COUNT(*) AS c FROM tenders WHERE budget_status = 'approved'`);

        res.render('tender/overview', {
            activePage: 'overview',
            stats: stats,
            readyTenders: Array.isArray(pendingTenders) ? pendingTenders : [],
            publishedTenders: Array.isArray(publishedTenders) ? publishedTenders : [],
            assignedTenders: Array.isArray(assignedTenders) ? assignedTenders : []
        });
    } catch (err) {
        console.error(err);
        res.render('tender/overview', {
            activePage: 'overview',
            stats: { ready: 0, published: 0, assigned: 0, approvedBudgets: 0 },
            readyTenders: [],
            publishedTenders: [],
            assignedTenders: [],
            error: 'Could not load overview.'
        });
    }
});

router.get('/pending', async (req, res) => {
    try {
        const sql = `
            SELECT t.*,
                   u.username AS owner_name,
                   u.email AS owner_email,
                   u.mobile AS owner_mobile
            FROM tenders t
            LEFT JOIN users u ON u.user_id = t.user_id
            WHERE t.budget_status = 'estimated'
            ORDER BY t.tender_id DESC
        `;
        const rows = await exe(sql);
        const tenders = Array.isArray(rows) ? rows : [];

        res.render('tender/pending', {
            activePage: 'pending',
            tenders: tenders
        });
    } catch (err) {
        console.error(err);
        res.render('tender/pending', {
            activePage: 'pending',
            tenders: [],
            error: 'Could not load pending tenders.'
        });
    }
});

router.get('/pending/view/:id', async (req, res) => {
    try {
        const tenderId = Number(req.params.id);
        if (!tenderId) return res.redirect('/tender-admin/pending');

        const sql = `
            SELECT t.*,
                   u.username AS owner_name,
                   u.email AS owner_email,
                   u.mobile AS owner_mobile
            FROM tenders t
            LEFT JOIN users u ON u.user_id = t.user_id
            WHERE t.tender_id = ?
            LIMIT 1
        `;
        const rows = await exe(sql, [tenderId]);
        if (!Array.isArray(rows) || !rows.length) {
            return res.redirect('/tender-admin/pending?error=notfound');
        }

        res.render('tender/view', {
            activePage: 'pending',
            tender: rows[0]
        });
    } catch (err) {
        console.error(err);
        res.redirect('/tender-admin/pending?error=view');
    }
});

router.post('/publish/:id', async (req, res) => {
    try {
        const tenderId = Number(req.params.id);
        if (!tenderId) return res.redirect('/tender-admin/pending');

        try {
            const check = await exe("SHOW COLUMNS FROM tenders LIKE 'tender_status'");
            if (!Array.isArray(check) || !check.length) {
                await exe(
                    "ALTER TABLE tenders ADD COLUMN tender_status ENUM('draft','ready','published','assigned') DEFAULT 'draft'"
                );
            }
        } catch (e) {
            console.error('tender_status ensure failed:', e.message);
        }
        try {
            const checkPub = await exe("SHOW COLUMNS FROM tenders LIKE 'published_at'");
            if (!Array.isArray(checkPub) || !checkPub.length) {
                await exe('ALTER TABLE tenders ADD COLUMN published_at TIMESTAMP NULL');
            }
        } catch (e) {
            console.error('published_at ensure failed:', e.message);
        }

        await exe(
            `UPDATE tenders
             SET tender_status = 'published',
                 published_at = NOW(),
                 budget_status = 'approved'
             WHERE tender_id = ?`,
            [tenderId]
        );

        res.redirect('/tender-admin/publish?notice=published');
    } catch (err) {
        console.error(err);
        res.redirect('/tender-admin/pending?error=publish');
    }
});

router.get("/publish", async (req, res) => {
    try {
        const sql = `
            SELECT t.*,
                   u.username AS owner_name,
                   u.email AS owner_email,
                   u.mobile AS owner_mobile
            FROM tenders t
            LEFT JOIN users u ON u.user_id = t.user_id
            WHERE t.tender_status = 'published'
            ORDER BY t.tender_id DESC
        `;
        let rows = [];
        try {
            rows = await exe(sql);
        } catch (e) {
            rows = [];
        }

        let contractors = [];
        try {
            contractors = await exe(
                `SELECT k.user_id,
                        COALESCE(k.full_name, u.username) AS username,
                        COALESCE(k.email, u.email) AS email,
                        COALESCE(k.phone, u.mobile) AS mobile
                 FROM contractor_kyc k
                 LEFT JOIN users u ON u.user_id = k.user_id
                 WHERE k.contractor_kyc_status = 'approved'
                 ORDER BY username ASC`
            );
        } catch (e) {
            contractors = [];
        }

        res.render('tender/publish', {
            activePage: 'publish',
            publishedTenders: Array.isArray(rows) ? rows : [],
            contractors: Array.isArray(contractors) ? contractors : [],
            notice: req.query.notice || '',
            error: req.query.error || ''
        });
    } catch (err) {
        console.error(err);
        res.render('tender/publish', {
            activePage: 'publish',
            publishedTenders: [],
            contractors: [],
            error: 'Could not load live tenders.'
        });
    }
});

router.post('/assign/:id', async (req, res) => {
    try {
        const tenderId = Number(req.params.id);
        const contractorId = Number(req.body.contractor_id);
        if (!tenderId || !contractorId) {
            return res.redirect('/tender-admin/publish?error=assign');
        }

        const assignedRows = await exe(
            `INSERT INTO assigned_tenders (tender_id, contractor_id) VALUES (?, ?)`,
            [tenderId, contractorId]
        );
        if (!assignedRows || !assignedRows.affectedRows) {
            return res.redirect('/tender-admin/publish?error=assign');
        }

        await exe(
            `UPDATE tenders SET tender_status = 'assigned' WHERE tender_id = ?`,
            [tenderId]
        );

        return res.redirect('/tender-admin/assigned?notice=assigned');
    } catch (err) {
        console.error(err);
        return res.redirect('/tender-admin/publish?error=assign');
    }
});

router.get('/assigned', async (req, res) => {
    try {
        const sql = `
            SELECT a.assigned_id,
                   a.tender_id,
                   a.contractor_id,
                   a.staff_id,
                   a.assigned_at,
                   t.constructionCode,
                   t.estimated_cost,
                   t.plotLocation,
                   t.bhk,
                   t.floors,
                   t.tender_status,
                   owner.username AS owner_name,
                   owner.email AS owner_email,
                   owner.mobile AS owner_mobile,
                   COALESCE(k.full_name, cu.username) AS contractor_name,
                   COALESCE(k.email, cu.email) AS contractor_email,
                   COALESCE(k.phone, cu.mobile) AS contractor_mobile
            FROM assigned_tenders a
            LEFT JOIN tenders t ON t.tender_id = a.tender_id
            LEFT JOIN users owner ON owner.user_id = t.user_id
            LEFT JOIN users cu ON cu.user_id = a.contractor_id
            LEFT JOIN (
                SELECT k1.user_id, k1.full_name, k1.email, k1.phone
                FROM contractor_kyc k1
                INNER JOIN (
                    SELECT user_id, MAX(kyc_id) AS kyc_id
                    FROM contractor_kyc
                    GROUP BY user_id
                ) latest ON latest.kyc_id = k1.kyc_id
            ) k ON k.user_id = a.contractor_id
            ORDER BY a.assigned_id DESC
        `;
        const rows = await exe(sql);
        res.render('tender/assigned', {
            activePage: 'assigned',
            assignedTenders: Array.isArray(rows) ? rows : [],
            notice: req.query.notice || '',
            error: req.query.error || ''
        });
    } catch (err) {
        console.error(err);
        res.render('tender/assigned', {
            activePage: 'assigned',
            assignedTenders: [],
            error: 'Could not load assigned tenders.'
        });
    }
});

router.get("/profile",async (req,res)=>{
    res.render('tender/profile');
});

module.exports = router;
