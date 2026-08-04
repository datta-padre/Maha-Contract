const express = require('express');
const fs = require('fs');
const router = express.Router();
const exe = require('../config/connection');
const { ROLES, verifyToken, requireRole } = require('../middleware/auth');

const vendorOnly = [verifyToken, requireRole(ROLES.VENDOR)];

if (!fs.existsSync('public/materials')) {
    fs.mkdirSync('public/materials', { recursive: true });
}

router.get('/dashboard', vendorOnly, (req, res) => {
    res.render('vendor/dashboard');
});

router.get('/inventory', vendorOnly, async (req, res) => {
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

router.post('/add-material', vendorOnly, async (req, res) => {
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
});

router.post('/update-material', vendorOnly, async (req, res) => {
    const { mat_id, matName, matCategory, matQuantity, matPrice } = req.body;
    const sql = `UPDATE materials SET matName = ?, matCategory = ?, matQuantity = ?, matPrice = ? WHERE mat_id = ? AND user_id = ?`;
    await exe(sql, [matName, matCategory, matQuantity, matPrice, mat_id, req.user_id]);
    res.redirect('/vendor/inventory');
});

router.post('/delete-material', vendorOnly, async (req, res) => {
    const { mat_id } = req.body;
    const sql = `DELETE FROM materials WHERE mat_id = ? AND user_id = ?`;
    await exe(sql, [mat_id, req.user_id]);
    res.redirect('/vendor/inventory');
});

router.get('/orders', vendorOnly, (req, res) => {
    res.render('vendor/orders');
});

router.get('/payments', vendorOnly, (req, res) => {
    res.render('vendor/payments');
});

router.get('/profile', vendorOnly, async (req, res) => {
    var result = await exe(`SELECT * FROM users WHERE user_id = ?`, [req.user_id]);
    if (!result.length) {
        return res.redirect('/');
    }
    res.render('vendor/profile', { user: result[0] });
});

router.post('/update-profile', vendorOnly, async (req, res) => {
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
