const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const exe = require('../config/connection');

const JWT_SECRET = process.env.JWT_SECRET || 'dattapadre';
const JWT_EXPIRES = '1h';

// Canonical public roles (matches users.role ENUM)
const ROLES = {
    ADMIN: 'admin',
    USER: 'user',
    VENDOR: 'vendor',
    CONTRACTOR: 'contractor',
    HOUSEOWNER: 'houseowner'
};

// Desk roles stored on staff.staff_role, normalized lowercase in JWT
const STAFF_ROLES = {
    VERIFY: 'verifyadmin',
    BUDGET: 'budgetadmin',
    TENDER: 'tenderadmin',
    MATERIALS: 'materialsadmin'
};

const STAFF_ROLE_DB = {
    verifyadmin: 'VerifyAdmin',
    budgetadmin: 'BudgetAdmin',
    tenderadmin: 'TenderAdmin',
    materialsadmin: 'MaterialsAdmin'
};

const PUBLIC_ROLES = [
    ROLES.USER,
    ROLES.VENDOR,
    ROLES.CONTRACTOR,
    ROLES.HOUSEOWNER
];

function hashPassword(password) {
    return crypto.createHash('sha256').update(String(password || '')).digest('hex');
}

function passwordsMatch(plain, stored) {
    if (!stored) return false;
    var hashed = hashPassword(plain);
    return stored === hashed || stored === String(plain);
}

function normalizeAuthRole(role) {
    var r = String(role || '').toLowerCase().replace(/[\s_-]/g, '');
    if (r === 'verifyadmin') return STAFF_ROLES.VERIFY;
    if (r === 'budgetadmin') return STAFF_ROLES.BUDGET;
    if (r === 'tenderadmin') return STAFF_ROLES.TENDER;
    if (r === 'materialsadmin') return STAFF_ROLES.MATERIALS;
    if (r === 'superadmin' || r === 'masteradmin') return ROLES.ADMIN;
    return String(role || '').toLowerCase();
}

function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function setAuthCookie(res, token) {
    res.cookie('accessToken', token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 1000
    });
}

function clearAuth(res) {
    res.clearCookie('accessToken');
}

function dashboardForRole(role) {
    var r = normalizeAuthRole(role);
    if (r === ROLES.ADMIN) return '/master-admin';
    if (r === STAFF_ROLES.VERIFY) return '/verify-admin';
    if (r === STAFF_ROLES.BUDGET) return '/budget-admin';
    if (r === STAFF_ROLES.TENDER) return '/tender-admin';
    if (r === STAFF_ROLES.MATERIALS) return '/materials-admin';
    if (r === ROLES.CONTRACTOR) return '/contractor/dashboard';
    if (r === ROLES.VENDOR) return '/vendor/dashboard';
    if (r === ROLES.HOUSEOWNER) return '/houseowner/overview';
    if (r === ROLES.USER) return '/';
    return '/';
}

function profileForRole(role) {
    var r = normalizeAuthRole(role);
    if (r === ROLES.VENDOR) return '/vendor/profile';
    if (r === ROLES.CONTRACTOR) return '/contractor/profile';
    if (r === ROLES.HOUSEOWNER) return '/houseowner/profile';
    if (r === STAFF_ROLES.BUDGET) return '/budget-admin/profile';
    if (r === STAFF_ROLES.TENDER) return '/tender-admin/profile';
    if (r === ROLES.ADMIN) return '/master-admin';
    return dashboardForRole(r);
}

function isAdminPath(url) {
    var u = String(url || '');
    return (
        u.indexOf('/admin') === 0 ||
        u.indexOf('/kyc-verified') === 0 ||
        u.indexOf('/master-admin') === 0 ||
        u.indexOf('/verify-admin') === 0 ||
        u.indexOf('/budget-admin') === 0 ||
        u.indexOf('/tender-admin') === 0 ||
        u.indexOf('/materials-admin') === 0 ||
        u.indexOf('/staff') === 0
    );
}

function wantsJson(req) {
    var accept = String(req.headers.accept || '');
    var contentType = String(req.headers['content-type'] || '');
    if (req.xhr) return true;
    if (accept.indexOf('application/json') !== -1) return true;
    if (contentType.indexOf('application/json') !== -1) return true;
    if (req.path && (
        req.path.indexOf('create-order') !== -1 ||
        req.path.indexOf('approve-kyc') !== -1 ||
        req.path.indexOf('/approve/') !== -1 ||
        req.path.indexOf('/reject/') !== -1
    )) return true;
    return false;
}

function unauthorized(req, res, message) {
    if (wantsJson(req)) {
        return res.status(401).json({
            success: false,
            message: message || 'Authentication required.'
        });
    }
    if (isAdminPath(req.originalUrl)) {
        return res.redirect('/master-admin/login');
    }
    return res.redirect('/login');
}

function forbidden(req, res, message) {
    if (wantsJson(req)) {
        return res.status(403).json({
            success: false,
            message: message || 'You do not have permission to access this resource.'
        });
    }
    if (req.role) {
        return res.redirect(dashboardForRole(req.role));
    }
    if (isAdminPath(req.originalUrl)) {
        return res.redirect('/master-admin/login');
    }
    return res.redirect('/login');
}

/**
 * Authentication middleware — validates JWT cookie + blacklist.
 * Sets: req.user_id, req.staff_id, req.role, req.kind, req.user
 */
async function verifyToken(req, res, next) {
    var token = req.cookies && req.cookies.accessToken;
    if (!token) {
        clearAuth(res);
        return unauthorized(req, res, 'Authentication required.');
    }

    try {
        var blacklisted = await exe(
            `SELECT token_id FROM token_blacklist WHERE token = ? LIMIT 1`,
            [token]
        );
        if (Array.isArray(blacklisted) && blacklisted.length > 0) {
            clearAuth(res);
            return unauthorized(req, res, 'Session expired. Please login again.');
        }

        var decoded = jwt.verify(token, JWT_SECRET);
        var role = normalizeAuthRole(decoded && decoded.role);
        var isStaff = decoded && (decoded.kind === 'staff' || decoded.staff_id);

        if (!decoded || !role) {
            clearAuth(res);
            return unauthorized(req, res, 'Invalid token payload.');
        }

        if (isStaff) {
            if (!decoded.staff_id) {
                clearAuth(res);
                return unauthorized(req, res, 'Invalid staff token.');
            }
            req.kind = 'staff';
            req.staff_id = decoded.staff_id;
            req.user_id = null;
        } else {
            if (!decoded.user_id) {
                clearAuth(res);
                return unauthorized(req, res, 'Invalid token payload.');
            }
            req.kind = 'user';
            req.user_id = decoded.user_id;
            req.staff_id = null;
        }

        req.role = role;
        req.user = {
            user_id: req.user_id,
            staff_id: req.staff_id,
            email: decoded.email,
            role: req.role,
            kind: req.kind
        };
        res.locals.authUser = req.user;
        res.locals.authRole = req.role;
        next();
    } catch (err) {
        clearAuth(res);
        return unauthorized(req, res, 'Invalid or expired token.');
    }
}

/**
 * Role authorization middleware.
 * Usage: requireRole('admin') or requireRole('admin', 'verifyadmin')
 */
function requireRole() {
    var allowed = Array.prototype.slice.call(arguments)
        .flat()
        .map(function (r) { return normalizeAuthRole(r); });

    return function roleMiddleware(req, res, next) {
        var role = normalizeAuthRole(req.role || (req.user && req.user.role));
        if (!role || allowed.indexOf(role) === -1) {
            return forbidden(
                req,
                res,
                'Access denied for role: ' + (role || 'none') + '.'
            );
        }
        next();
    };
}

function deskGuard() {
    var roles = Array.prototype.slice.call(arguments);
    return [verifyToken, requireRole.apply(null, roles)];
}

module.exports = {
    ROLES,
    STAFF_ROLES,
    STAFF_ROLE_DB,
    PUBLIC_ROLES,
    JWT_SECRET,
    hashPassword,
    passwordsMatch,
    normalizeAuthRole,
    signToken,
    setAuthCookie,
    clearAuth,
    dashboardForRole,
    profileForRole,
    verifyToken,
    requireRole,
    deskGuard
};
