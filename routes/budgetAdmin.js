const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const exe = require('../config/connection');
const { ROLES, STAFF_ROLES, verifyToken, requireRole } = require('../middleware/auth');

const REPORT_DIR = path.join(__dirname, '..', 'public', 'budget-reports');
if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
}

let budgetColumnsReady = false;

async function ensureBudgetColumns() {
    if (budgetColumnsReady) return;

    const cols = [
        { name: 'budget_status', ddl: "ADD COLUMN budget_status ENUM('pending','approved','estimated') DEFAULT 'pending'" },
        { name: 'estimated_cost', ddl: 'ADD COLUMN estimated_cost VARCHAR(255)' },
        { name: 'estimated_completion_date', ddl: 'ADD COLUMN estimated_completion_date DATE' },
        { name: 'budget_report', ddl: 'ADD COLUMN budget_report TEXT' },
        { name: 'budget_notes', ddl: 'ADD COLUMN budget_notes TEXT' },
        { name: 'budget_estimated_at', ddl: 'ADD COLUMN budget_estimated_at TIMESTAMP NULL' }
    ];

    for (let i = 0; i < cols.length; i++) {
        try {
            const check = await exe('SHOW COLUMNS FROM tenders LIKE ?', [cols[i].name]);
            if (!Array.isArray(check) || !check.length) {
                await exe('ALTER TABLE tenders ' + cols[i].ddl);
            }
        } catch (err) {
            console.error('Budget column ensure failed for', cols[i].name, err.message);
        }
    }

    // Ensure approved is allowed on existing DBs that only had pending/estimated.
    try {
        await exe(
            `ALTER TABLE tenders
             MODIFY COLUMN budget_status ENUM('pending','approved','estimated') DEFAULT 'pending'`
        );
    } catch (err) {
        console.error('Budget status ENUM update failed:', err.message);
    }

    budgetColumnsReady = true;
}

function firstCount(rows) {
    return Array.isArray(rows) && rows[0] ? Number(rows[0].c) || 0 : 0;
}

function sanitizeFilename(name) {
    return String(name || 'report')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 120);
}

async function fetchTenders(status) {
    let sql = `
        SELECT t.*,
               u.username AS owner_name,
               u.email AS owner_email,
               u.mobile AS owner_mobile
        FROM tenders t
        LEFT JOIN users u ON u.user_id = t.user_id
    `;

    if (status === 'pending') {
        sql += ` WHERE COALESCE(t.budget_status, 'pending') = 'pending'`;
    } else if (status === 'estimated') {
        sql += ` WHERE t.budget_status = 'estimated'`;
    } else if (status === 'approved') {
        sql += ` WHERE t.budget_status = 'approved'`;
    } else if (status === 'completed') {
        sql += ` WHERE t.budget_status IN ('estimated', 'approved')`;
    }

    sql += ' ORDER BY t.tender_id DESC';
    const rows = await exe(sql);
    return Array.isArray(rows) ? rows : [];
}

async function getStats() {
    const pendingRows = await exe(
        `SELECT COUNT(*) AS c FROM tenders WHERE COALESCE(budget_status, 'pending') = 'pending'`
    );
    const estimatedRows = await exe(
        `SELECT COUNT(*) AS c FROM tenders WHERE budget_status = 'estimated'`
    );
    const approvedRows = await exe(
        `SELECT COUNT(*) AS c FROM tenders WHERE budget_status = 'approved'`
    );
    const paidRows = await exe(
        `SELECT COUNT(*) AS c FROM tenders WHERE payment_status = 'paid'`
    );
    const feeRows = await exe(
        `SELECT COALESCE(SUM(payment_amount), 0) AS c FROM tenders WHERE payment_status = 'paid'`
    );

    return {
        pending: firstCount(pendingRows),
        estimated: firstCount(estimatedRows),
        approved: firstCount(approvedRows),
        paid: firstCount(paidRows),
        feesCollected: firstCount(feeRows)
    };
}

router.use(verifyToken, requireRole(ROLES.ADMIN, STAFF_ROLES.BUDGET));

router.use(async function (req, res, next) {
    try {
        await ensureBudgetColumns();
        next();
    } catch (err) {
        next(err);
    }
});

router.get('/', async (req, res) => {
    try {
        const stats = await getStats();
        const pending = await fetchTenders('pending');
        const estimated = await fetchTenders('estimated');
        res.render('budget/index', {
            activePage: 'overview',
            stats: stats,
            pendingTenders: pending.slice(0, 5),
            estimatedTenders: estimated.slice(0, 5)
        });
    } catch (err) {
        console.error(err);
        res.render('budget/index', {
            activePage: 'overview',
            stats: { pending: 0, estimated: 0, approved: 0, paid: 0, feesCollected: 0 },
            pendingTenders: [],
            estimatedTenders: [],
            error: 'Could not load Budget Admin panel.'
        });
    }
});

router.get('/pending', async (req, res) => {
    try {
        const pending = await fetchTenders('pending');
        res.render('budget/pending', { activePage: 'pending', pendingTenders: pending });
    } catch (err) {
        console.error(err);
        res.render('budget/pending', { activePage: 'pending', pendingTenders: [], error: 'Could not load pending budgets.' });
    }
});

router.get('/completed', async (req, res) => {
    try {
        const estimated = await fetchTenders('completed');
        res.render('budget/completed', {
            activePage: 'completed',
            estimatedTenders: estimated,
            notice: req.query.notice || '',
            error: req.query.error || ''
        });
    } catch (err) {
        console.error(err);
        res.render('budget/completed', {
            activePage: 'completed',
            estimatedTenders: [],
            error: 'Could not load completed budgets.'
        });
    }
});

router.get('/payments', async (req, res) => {
    try {
        const tenders = await fetchTenders(); // all
        const stats = await getStats();
        res.render('budget/payments', { activePage: 'payments', tenders: tenders, stats: stats });
    } catch (err) {
        console.error(err);
        res.render('budget/payments', {
            activePage: 'payments',
            tenders: [],
            stats: { pending: 0, estimated: 0, approved: 0, paid: 0, feesCollected: 0 },
            error: 'Could not load payment overview.'
        });
    }
});

router.get('/estimate/:id', async (req, res) => {
    try {
        const tenderId = Number(req.params.id);
        const rows = await exe(
            `
            SELECT t.*,
                   u.username AS owner_name,
                   u.email AS owner_email,
                   u.mobile AS owner_mobile
            FROM tenders t
            LEFT JOIN users u ON u.user_id = t.user_id
            WHERE t.tender_id = ?
            LIMIT 1
            `,
            [tenderId]
        );
        if (!Array.isArray(rows) || !rows.length) return res.redirect('/budget-admin/pending');

        res.render('budget/estimate', {
            activePage: 'pending',
            tender: rows[0],
            error: req.query.error || ''
        });
    } catch (err) {
        console.error(err);
        res.redirect('/budget-admin/pending');
    }
});

router.post('/estimate/:id', async (req, res) => {
    try {
        const tenderId = Number(req.params.id);
        const estimatedCost = String(req.body.estimatedCost || '').trim();
        const completionDate = String(req.body.completionDate || '').trim();
        const notes = String(req.body.budgetNotes || '').trim();

        if (!estimatedCost || !completionDate) {
            return res.redirect('/budget-admin/estimate/' + tenderId + '?error=missing');
        }

        let reportName = null;
        if (req.files && req.files.budgetReport) {
            const file = req.files.budgetReport;
            const ext = path.extname(file.name || '') || '.pdf';
            reportName =
                'budget_' +
                tenderId +
                '_' +
                Date.now() +
                '_' +
                sanitizeFilename(path.basename(file.name || 'report', ext)) +
                ext;

            await file.mv(path.join(REPORT_DIR, reportName));
        }

        if (reportName) {
            await exe(
                `
                UPDATE tenders
                SET estimated_cost = ?,
                    estimated_completion_date = ?,
                    budget_notes = ?,
                    budget_report = ?,
                    budget_status = 'estimated',
                    budget_estimated_at = NOW()
                WHERE tender_id = ?
                `,
                [estimatedCost, completionDate, notes || null, reportName, tenderId]
            );
        } else {
            await exe(
                `
                UPDATE tenders
                SET estimated_cost = ?,
                    estimated_completion_date = ?,
                    budget_notes = ?,
                    budget_status = 'estimated',
                    budget_estimated_at = NOW()
                WHERE tender_id = ?
                `,
                [estimatedCost, completionDate, notes || null, tenderId]
            );
        }

        res.redirect('/budget-admin/completed?notice=saved');
    } catch (err) {
        console.error(err);
        res.redirect('/budget-admin/estimate/' + req.params.id + '?error=save');
    }
});

router.post('/reopen/:id', async (req, res) => {
    try {
        const tenderId = Number(req.params.id);
        await exe(`UPDATE tenders SET budget_status = 'pending' WHERE tender_id = ?`, [tenderId]);
        res.redirect('/budget-admin/estimate/' + tenderId);
    } catch (err) {
        console.error(err);
        res.redirect('/budget-admin/completed?error=reopen');
    }
});


router.get('/profile', (req, res) => {
    res.render('budget/profile', { activePage: 'profile' });
});

router.get('/view-report', (req, res) => {
    try {
        const file = String(req.query.file || '').trim();
        if (!file || file.includes('..') || file.includes('/') || file.includes('\\')) {
            return res.status(400).send('Invalid file.');
        }
        const full = path.join(REPORT_DIR, file);
        if (!fs.existsSync(full)) return res.status(404).send('Report not found');
        res.sendFile(path.resolve(full));
    } catch (err) {
        console.error(err);
        res.status(500).send('Could not open report');
    }
});

module.exports = router;