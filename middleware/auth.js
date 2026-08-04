const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const exe = require('../config/connection');

const JWT_SECRET = process.env.JWT_SECRET || 'dattapadre';
const JWT_EXPIRES = '1h';

// Canonical roles (lowercase — matches users.role ENUM)
const ROLES = {
    ADMIN: 'admin',
    USER: 'user',
    VENDOR: 'vendor',
    CONTRACTOR: 'contractor',
    HOUSEOWNER: 'houseowner'
};

// Roles allowed on public /register (admin must be seeded / created by staff)
const PUBLIC_ROLES = [
    ROLES.USER,
    ROLES.VENDOR,
    ROLES.CONTRACTOR,
    ROLES.HOUSEOWNER
];

function hashPassword(password) {
    return crypto.createHash('sha256').update(String(password || '')).digest('hex');
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
    var r = String(role || '').toLowerCase();
    if (r === ROLES.ADMIN) return '/master-admin';
    if (r === ROLES.CONTRACTOR) return '/contractor/dashboard';
    if (r === ROLES.VENDOR) return '/vendor/dashboard';
    if (r === ROLES.HOUSEOWNER) return '/houseowner/overview';
    if (r === ROLES.USER) return '/';
    return '/';
}

function profileForRole(role) {
    var r = String(role || '').toLowerCase();
    if (r === ROLES.VENDOR) return '/vendor/profile';
    if (r === ROLES.CONTRACTOR) return '/contractor/profile';
    if (r === ROLES.HOUSEOWNER) return '/houseowner/profile';
    return '/';
}

function wantsJson(req) {
    var accept = String(req.headers.accept || '');
    var contentType = String(req.headers['content-type'] || '');
    if (req.xhr) return true;
    if (accept.indexOf('application/json') !== -1) return true;
    if (contentType.indexOf('application/json') !== -1) return true;
    // fetch() create-order / approve-kyc style APIs
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
    if (req.originalUrl && (
        req.originalUrl.indexOf('/admin') === 0 ||
        req.originalUrl.indexOf('/kyc-verified') === 0 ||
        req.originalUrl.indexOf('/master-admin') === 0 ||
        req.originalUrl.indexOf('/verify-admin') === 0
    )) {
        return res.redirect('/master-admin/login');
    }
    return res.redirect('/');
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
    if (req.originalUrl && (
        req.originalUrl.indexOf('/admin') === 0 ||
        req.originalUrl.indexOf('/kyc-verified') === 0 ||
        req.originalUrl.indexOf('/master-admin') === 0 ||
        req.originalUrl.indexOf('/verify-admin') === 0
    )) {
        return res.redirect('/master-admin/login');
    }
    return res.redirect('/');
}

/**
 * Authentication middleware — validates JWT cookie + blacklist.
 * Sets: req.user_id, req.role, req.user { user_id, email, role }
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
        if (!decoded || !decoded.user_id || !decoded.role) {
            clearAuth(res);
            return unauthorized(req, res, 'Invalid token payload.');
        }

        req.user_id = decoded.user_id;
        req.role = String(decoded.role).toLowerCase();
        req.user = {
            user_id: decoded.user_id,
            email: decoded.email,
            role: req.role
        };
        next();
    } catch (err) {
        clearAuth(res);
        return unauthorized(req, res, 'Invalid or expired token.');
    }
}

/**
 * Role authorization middleware.
 * Usage: requireRole('contractor') or requireRole('admin', 'user')
 */
function requireRole() {
    var allowed = Array.prototype.slice.call(arguments)
        .flat()
        .map(function (r) { return String(r).toLowerCase(); });

    return function roleMiddleware(req, res, next) {
        var role = req.role || (req.user && req.user.role);
        if (!role || allowed.indexOf(String(role).toLowerCase()) === -1) {
            return forbidden(
                req,
                res,
                'Access denied for role: ' + (role || 'none') + '.'
            );
        }
        next();
    };
}

module.exports = {
    ROLES,
    PUBLIC_ROLES,
    JWT_SECRET,
    hashPassword,
    signToken,
    setAuthCookie,
    clearAuth,
    dashboardForRole,
    profileForRole,
    verifyToken,
    requireRole
};
