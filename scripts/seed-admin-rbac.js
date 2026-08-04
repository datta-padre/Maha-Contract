const crypto = require('crypto');
const exe = require('../config/connection');

const hash = crypto.createHash('sha256').update('admin123').digest('hex');

(async function () {
    try {
        await exe(
            "ALTER TABLE users MODIFY role ENUM('admin','user','vendor','contractor','houseowner') NOT NULL"
        );
        console.log('ENUM updated');
    } catch (e) {
        console.log('ALTER:', e.message);
    }

    const rows = await exe(
        "SELECT user_id FROM users WHERE email = ? AND role = 'admin' LIMIT 1",
        ['admin@buildtender.com']
    );

    if (Array.isArray(rows) && rows.length) {
        console.log('Admin exists', rows[0].user_id);
    } else {
        const r = await exe(
            'INSERT INTO users(username, mobile, email, password_hash, role) VALUES (?,?,?,?,?)',
            ['Admin', '9999999999', 'admin@buildtender.com', hash, 'admin']
        );
        console.log('Admin created', r.insertId);
    }

    process.exit(0);
})().catch(function (e) {
    console.error(e);
    process.exit(1);
});
