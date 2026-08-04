const express = require('express');
const fs = require('fs');
const router = express.Router();
const exe = require('../config/connection');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
router.use(cookieParser());

if (!fs.existsSync('public/materials')) {
    fs.mkdirSync('public/materials', { recursive: true });
}

async function verifyToken(req, res, next) {

    const query = `SELECT * FROM token_blacklist WHERE token = ?`;
    const result = await exe(query, [req.cookies.accessToken]);
    if (result.length > 0) {
        return res.redirect('/');
    }

    const token = req.cookies.accessToken;
    if (!token) {
        res.clearCookie('accessToken');
        return res.redirect('/');
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user_id = decoded.user_id;
        next();
    } catch (err) {
        // Invalid or expired (TokenExpiredError) token
        res.clearCookie('accessToken');
        return res.redirect('/');
    }
}

router.get('/dashboard', (req, res) => {
    res.render('vendor/dashboard')
});

router.get('/inventory', verifyToken, async (req, res) => {
    var sql = `SELECT * FROM materials WHERE user_id = ?`;
    var materials = await exe(sql, [req.user_id]);
    if (!Array.isArray(materials)) materials = [];

    var totalItems = materials.length;
    var totalStock = 0;
    var inventoryValue = 0;

    materials.forEach(function (m) {
        var qty = parseFloat(m.matQuantity) || 0;
        var price = parseFloat(m.matPrice) || 0;
        totalStock += qty;
        inventoryValue += qty * price;
    });

    res.render('vendor/inventory', {
        materials: materials,
        totalItems: totalItems,
        totalStock: totalStock,
        inventoryValue: inventoryValue
    });
});

router.post('/add-material', verifyToken, async (req, res) => {
    const { matName, matCategory, matQuantity, matPrice } = req.body;

    let matImage = null;
    if (req.files && req.files.matImage) {
        matImage = Date.now() + req.files.matImage.name;
        req.files.matImage.mv('public/materials/' + matImage);
    }

    const sql = `INSERT INTO materials (user_id, matName, matCategory, matQuantity, matPrice, matImage) VALUES (?, ?, ?, ?, ?, ?)`;
    const values = [req.user_id, matName, matCategory, matQuantity, matPrice, matImage];
    await exe(sql, values);
    res.redirect('/vendor/inventory');

    // res.send(req.files);
});

router.post('/update-material', verifyToken, async (req, res) => {
    const { mat_id, matName, matCategory, matQuantity, matPrice } = req.body;
    const sql = `UPDATE materials SET matName = ?, matCategory = ?, matQuantity = ?, matPrice = ? WHERE mat_id = ? AND user_id = ?`;
    await exe(sql, [matName, matCategory, matQuantity, matPrice, mat_id, req.user_id]);
    res.redirect('/vendor/inventory');
});

router.post('/delete-material', verifyToken, async (req, res) => {
    const { mat_id } = req.body;
    const sql = `DELETE FROM materials WHERE mat_id = ? AND user_id = ?`;
    await exe(sql, [mat_id, req.user_id]);
    res.redirect('/vendor/inventory');
});

router.get('/orders', (req, res) => {
    res.render('vendor/orders')
});
router.get('/payments', (req, res) => {
    res.render('vendor/payments')
});
router.get('/profile', verifyToken, async (req, res) => {
    var result = await exe(`SELECT * FROM users WHERE user_id = ?`, [req.user_id]);
    if (!result.length) {
        return res.redirect('/');
    }
    res.render('vendor/profile', { user: result[0] });
});


router.post('/update-profile', verifyToken, async (req, res) => {
    var d = req.body;
    var query = `UPDATE users SET username = ?, mobile = ?, email = ?, address = ?, taluka = ?, district = ?, state = ?, pincode = ? WHERE user_id = ?`;
    await exe(query, [
        d.username, d.mobile, d.email,
        d.address || '', d.taluka || '', d.district || '', d.state || '', d.pincode || '',
        req.user_id
    ]);
    res.redirect('/vendor/profile');
});

module.exports = router;
