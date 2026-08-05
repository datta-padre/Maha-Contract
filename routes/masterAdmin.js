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

var STAFF_ROLE_LABELS = {
    VerifyAdmin: 'Verify Admin',
    BudgetAdmin: 'Budget Admin',
    MaterialsAdmin: 'Materials Admin'
};

function normalizeStaffRole(role) {
    var map = {
        'Verify Admin': 'VerifyAdmin',
        'Budget Admin': 'BudgetAdmin',
        'Materials Admin': 'MaterialsAdmin',
        VerifyAdmin: 'VerifyAdmin',
        BudgetAdmin: 'BudgetAdmin',
        MaterialsAdmin: 'MaterialsAdmin'
    };
    return map[role] || role;
}

function formatStaffRole(role) {
    return STAFF_ROLE_LABELS[role] || role;
}

function generateStaffPassword() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function mapStaffRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(function (row) {
        return {
            id: row.staff_id,
            name: row.staff_name,
            email: row.staff_email,
            mobile: row.staff_mobile,
            role: formatStaffRole(row.staff_role),
            roleKey: row.staff_role,
            status: row.staff_status || 'active',
            created: row.staff_created_at
        };
    });
}

async function getStaffById(staffId) {
    var rows = await exe(
        `SELECT staff_id, staff_name, staff_email, staff_mobile, staff_role, staff_status, staff_password, staff_created_at
         FROM staff WHERE staff_id = ? LIMIT 1`,
        [staffId]
    );
    if (!Array.isArray(rows) || !rows.length) return null;
    var member = mapStaffRows(rows)[0];
    member.password = rows[0].staff_password || '';
    return member;
}

async function getStaffStats() {
    var rows = await exe(
        `SELECT staff_status AS status, COUNT(*) AS c FROM staff GROUP BY staff_status`
    );
    if (!Array.isArray(rows)) rows = [];
    var total = rows.reduce(function (sum, r) { return sum + (Number(r.c) || 0); }, 0);
    var activeCount = 0;
    for (var i = 0; i < rows.length; i++) {
        if (String(rows[i].status).toLowerCase() === 'active') {
            activeCount = Number(rows[i].c) || 0;
        }
    }
    return { total: total, activeCount: activeCount };
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

router.get('/staff-management', (req, res) => {
    res.redirect('/master-admin/staff-management/hire-employee');
});

router.get('/staff-management/hire-employee', async (req, res) => {
    try {
        var stats = await getStaffStats();
        res.render('master-admin/hire-employee', {
            activePage: 'hire-employee',
            staffStats: stats,
            staffFromDb: true
        });
    } catch (err) {
        console.error(err);
        res.render('master-admin/hire-employee', {
            activePage: 'hire-employee',
            staffStats: { total: 0, activeCount: 0 },
            staffFromDb: true,
            error: 'Could not load staff stats.'
        });
    }
});

router.post('/staff-management/hire-employee', async (req, res) => {
    try {
        var staffName = (req.body.staffName || '').trim();
        var staffEmail = (req.body.staffEmail || '').trim();
        var staffMobile = (req.body.staffMobile || '').trim();
        var staffRole = normalizeStaffRole(req.body.staffRole);
        var staffPassword = (req.body.staffPassword || '').trim() || generateStaffPassword();

        if (!staffName || !staffEmail || !staffRole) {
            return res.redirect('/master-admin/staff-management/hire-employee?error=missing');
        }

        await exe(
            `INSERT INTO staff (staff_name, staff_email, staff_mobile, staff_role, staff_password)
             VALUES (?, ?, ?, ?, ?)`,
            [staffName, staffEmail, staffMobile || null, staffRole, staffPassword]
        );
        res.redirect('/master-admin/staff-management/employee-list');
    } catch (err) {
        console.error(err);
        res.redirect('/master-admin/staff-management/hire-employee?error=save');
    }
});

router.get('/staff-management/employee-list', async (req, res) => {
    try {
        var rows = await exe(
            `SELECT staff_id, staff_name, staff_email, staff_mobile, staff_role, staff_status, staff_created_at
             FROM staff ORDER BY staff_id DESC`
        );
        var stats = await getStaffStats();
        res.render('master-admin/employee-list', {
            activePage: 'employee-list',
            staff: mapStaffRows(rows),
            staffStats: stats,
            staffFromDb: true,
            notice: req.query.notice || '',
            noticeName: req.query.name || '',
            noticeCode: req.query.code || ''
        });
    } catch (err) {
        console.error(err);
        res.render('master-admin/employee-list', {
            activePage: 'employee-list',
            staff: [],
            staffStats: { total: 0, activeCount: 0 },
            staffFromDb: true,
            error: 'Could not load staff list.'
        });
    }
});

router.post('/staff-management/employee-list/reset', async (req, res) => {
    try {
        var staffId = Number(req.body.staffId);
        if (!staffId) {
            return res.redirect('/master-admin/staff-management/employee-list?notice=error');
        }

        var rows = await exe(
            `SELECT staff_id, staff_name, staff_status FROM staff WHERE staff_id = ? LIMIT 1`,
            [staffId]
        );
        if (!Array.isArray(rows) || !rows.length) {
            return res.redirect('/master-admin/staff-management/employee-list?notice=notfound');
        }

        var member = rows[0];
        if (String(member.staff_status).toLowerCase() !== 'active') {
            return res.redirect('/master-admin/staff-management/employee-list?notice=inactive');
        }

        var newPassword = generateStaffPassword();
        await exe(
            `UPDATE staff SET staff_password = ? WHERE staff_id = ?`,
            [newPassword, staffId]
        );

        var name = encodeURIComponent(member.staff_name || 'Staff');
        res.redirect(
            '/master-admin/staff-management/employee-list?notice=reset&name=' + name + '&code=' + newPassword
        );
    } catch (err) {
        console.error(err);
        res.redirect('/master-admin/staff-management/employee-list?notice=error');
    }
});

router.post('/staff-management/employee-list/fire', async (req, res) => {
    try {
        var staffId = Number(req.body.staffId);
        if (!staffId) {
            return res.redirect('/master-admin/staff-management/employee-list?notice=error');
        }

        var rows = await exe(
            `SELECT staff_id, staff_name, staff_status FROM staff WHERE staff_id = ? LIMIT 1`,
            [staffId]
        );
        if (!Array.isArray(rows) || !rows.length) {
            return res.redirect('/master-admin/staff-management/employee-list?notice=notfound');
        }

        var member = rows[0];
        if (String(member.staff_status).toLowerCase() === 'inactive') {
            return res.redirect('/master-admin/staff-management/employee-list?notice=already');
        }

        await exe(
            `UPDATE staff SET staff_status = 'inactive' WHERE staff_id = ?`,
            [staffId]
        );

        var name = encodeURIComponent(member.staff_name || 'Staff');
        res.redirect('/master-admin/staff-management/employee-list?notice=fired&name=' + name);
    } catch (err) {
        console.error(err);
        res.redirect('/master-admin/staff-management/employee-list?notice=error');
    }
});

router.get('/staff-management/employee-list/edit/:id', async (req, res) => {
    try {
        var staffId = Number(req.params.id);
        var member = await getStaffById(staffId);
        if (!member) {
            return res.redirect('/master-admin/staff-management/employee-list?notice=notfound');
        }

        res.render('master-admin/edit-employee', {
            activePage: 'employee-list',
            member: member,
            error: req.query.error || '',
            notice: req.query.notice || ''
        });
    } catch (err) {
        console.error(err);
        res.redirect('/master-admin/staff-management/employee-list?notice=error');
    }
});

router.post('/staff-management/employee-list/edit/:id', async (req, res) => {
    try {
        var staffId = Number(req.params.id);
        var member = await getStaffById(staffId);
        if (!member) {
            return res.redirect('/master-admin/staff-management/employee-list?notice=notfound');
        }

        var staffName = (req.body.staffName || '').trim();
        var staffEmail = (req.body.staffEmail || '').trim();
        var staffMobile = (req.body.staffMobile || '').trim();
        var staffRole = normalizeStaffRole(req.body.staffRole);
        var staffStatus = String(req.body.staffStatus || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active';
        var staffPassword = (req.body.staffPassword || '').trim();
        var staffPasswordConfirm = (req.body.staffPasswordConfirm || '').trim();
        var passwordChanged = false;

        if (!staffName || !staffEmail || !staffRole) {
            return res.redirect('/master-admin/staff-management/employee-list/edit/' + staffId + '?error=missing');
        }

        if (staffPassword || staffPasswordConfirm) {
            if (staffPassword !== staffPasswordConfirm) {
                return res.redirect('/master-admin/staff-management/employee-list/edit/' + staffId + '?error=password');
            }
            if (staffPassword.length < 4) {
                return res.redirect('/master-admin/staff-management/employee-list/edit/' + staffId + '?error=passwordweak');
            }
            passwordChanged = true;
        }

        if (passwordChanged) {
            await exe(
                `UPDATE staff
                 SET staff_name = ?, staff_email = ?, staff_mobile = ?, staff_role = ?, staff_status = ?, staff_password = ?
                 WHERE staff_id = ?`,
                [staffName, staffEmail, staffMobile || null, staffRole, staffStatus, staffPassword, staffId]
            );
        } else {
            await exe(
                `UPDATE staff
                 SET staff_name = ?, staff_email = ?, staff_mobile = ?, staff_role = ?, staff_status = ?
                 WHERE staff_id = ?`,
                [staffName, staffEmail, staffMobile || null, staffRole, staffStatus, staffId]
            );
        }

        var name = encodeURIComponent(staffName);
        if (passwordChanged) {
            return res.redirect('/master-admin/staff-management/employee-list/edit/' + staffId + '?notice=password');
        }
        res.redirect('/master-admin/staff-management/employee-list?notice=updated&name=' + name);
    } catch (err) {
        console.error(err);
        res.redirect('/master-admin/staff-management/employee-list?notice=error');
    }
});

module.exports = router;
