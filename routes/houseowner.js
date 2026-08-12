const express = require('express');
const router = express.Router();
const fs = require('fs');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const exe = require('../config/connection');
const { ROLES, verifyToken, requireRole } = require('../middleware/auth');

const houseownerOnly = [verifyToken, requireRole(ROLES.HOUSEOWNER)];

// Make sure upload folder exists
if (!fs.existsSync('public/tenders')) {
    fs.mkdirSync('public/tenders', { recursive: true });
}

const TENDER_FEE = 5999; // ₹5,999

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


router.get('/overview',houseownerOnly, async (req, res) => {
    var result = await exe(`SELECT COUNT(tender_id) as total_tenders FROM tenders WHERE user_id = ?`, [req.user_id]);
        res.render('houseowner/overview', { total_tenders: result[0].total_tenders });
    });

router.get('/post', houseownerOnly, (req, res) => {
    res.render('houseowner/post', {
        success: false,
        formData: {},
        razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
});

router.get('/tenders', houseownerOnly, async(req, res) => {
    try {
        // Only fetch tenders created by this houseowner.
        var tenders = await exe(
            `SELECT * FROM tenders WHERE user_id = ? ORDER BY tender_id DESC`,
            [req.user_id]
        );
        if (!Array.isArray(tenders)) tenders = [];

        // Optional: owner details (some templates don't use it, but keep it safe).
        var owners = await exe(
            `SELECT * FROM users WHERE user_id = ? LIMIT 1`,
            [req.user_id]
        );
        var owner_details = (Array.isArray(owners) && owners[0]) ? owners[0] : {};

        console.log("owner_details",owner_details);
        console.log("tenders",tenders);

        res.render('houseowner/tenders', {
            tenders: tenders,
            owner_details: owner_details,
            notice: req.query.notice || ''
        });
    } catch (err) {
        console.error(err);
        res.render('houseowner/tenders', { tenders: [], owner_details: {}, notice: '' });
    }
});

router.get('/materials', houseownerOnly, async (req, res) => {
    var sql = `SELECT * FROM materials`;
    var data = await exe(sql);
    if (!Array.isArray(data)) data = [];
    res.render('houseowner/materials', { materials: data });
});

router.get('/payments', houseownerOnly, (req, res) => {
    res.render('houseowner/payments');
});

router.get('/profile', houseownerOnly, async (req, res) => {
    var result = await exe(`SELECT * FROM users WHERE user_id = ?`, [req.user_id]);
    if (!result.length) {
        return res.redirect('/');
    }
    res.render('houseowner/profile', { user: result[0] });
});

// ---------- step 1: create Razorpay order (no DB save) ----------

router.post('/create-order', houseownerOnly, async (req, res) => {
    try {
        var order = await razorpay.orders.create({
            amount: TENDER_FEE * 100, // paise
            currency: 'INR',
            receipt: 'tender_' + Date.now()
        });

        res.json({
            success: true,
            key: process.env.RAZORPAY_KEY_ID,
            order_id: order.id,
            amount: order.amount,
            currency: order.currency
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Could not create payment order' });
    }
});

// ---------- step 2: verify payment → then save tender ----------

router.post('/save-tender', houseownerOnly, async (req, res) => {
    var d = req.body;

    var orderId = d.razorpay_order_id || '';
    var paymentId = d.razorpay_payment_id || '';
    var signature = d.razorpay_signature || '';

    // check payment fields
    if (!orderId || !paymentId || !signature) {
        return res.status(400).send('Payment details missing. Tender was not saved.');
    }

    // verify signature: order_id|payment_id
    var expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(orderId + '|' + paymentId)
        .digest('hex');

    if (expected !== signature) {
        // failed → do not save data
        return res.status(400).send('Payment verification failed. Tender was not saved.');
    }

    // signature OK → save files
    var architectural_plan = '';
    var Plot_documents = '';
    var house_owner_digital_signature = '';

    if (req.files) {
        if (req.files.architecturalPlan) {
            architectural_plan = Date.now() + req.files.architecturalPlan.name;
            req.files.architecturalPlan.mv('public/tenders/' + architectural_plan);
        }
        if (req.files.Plot_documents) {
            Plot_documents = Date.now() + req.files.Plot_documents.name;
            req.files.Plot_documents.mv('public/tenders/' + Plot_documents);
        }
        if (req.files.House_Owner_Digital_Signature) {
            house_owner_digital_signature = Date.now() + req.files.House_Owner_Digital_Signature.name;
            req.files.House_Owner_Digital_Signature.mv('public/tenders/' + house_owner_digital_signature);
        }
    }

    var ancillary = d.ancillary_requirements;
    var ancillaryString = Array.isArray(ancillary) ? ancillary.join(',') : (ancillary || '');

    // save tender + payment
    var query = `INSERT INTO tenders (user_id, plotArea, soilType, plotLocation, constructionCode, materialsProvided, finalizedPlan, ancillary_requirements, externalWorks, boundaryWallType, budget, bhk, floors, constructionTime, specialInstructions, architectural_plan, Plot_documents, house_owner_digital_signature, payment_status, payment_amount, payment_transaction_id, razorpay_order_id) VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

    var values = [req.user_id, d.plotArea, d.soilType, d.plotLocation, d.constructionCode, d.materialsProvided, d.finalizedPlan, ancillaryString, d.externalWorks, d.boundaryWallType, d.budget, d.bhk, d.floors, d.constructionTime, d.specialInstructions, architectural_plan, Plot_documents, house_owner_digital_signature, 'paid', TENDER_FEE, paymentId, orderId];

    var result = await exe(query, values);
    res.redirect('/houseowner/tenders');
});

// Delete tender (only for the logged-in houseowner)
router.post('/delete-tender/:id', houseownerOnly, async (req, res) => {
    try {
        var tenderId = Number(req.params.id);
        if (!tenderId) return res.redirect('/houseowner/tenders');

        var rows = await exe(
            `SELECT tender_id, architectural_plan, Plot_documents, house_owner_digital_signature
             FROM tenders
             WHERE tender_id = ? AND user_id = ? LIMIT 1`,
            [tenderId, req.user_id]
        );

        if (!Array.isArray(rows) || !rows.length) return res.redirect('/houseowner/tenders');

        var t = rows[0];

        // Best-effort file cleanup
        var files = [t.architectural_plan, t.Plot_documents, t.house_owner_digital_signature]
            .filter(function (x) { return x && String(x).trim(); })
            .map(function (x) { return String(x).trim(); });

        for (var i = 0; i < files.length; i++) {
            try {
                var p = 'public/tenders/' + files[i];
                if (fs.existsSync(p)) fs.unlinkSync(p);
            } catch (e) {
                // Ignore file delete errors
            }
        }

        await exe(`DELETE FROM tenders WHERE tender_id = ? AND user_id = ?`, [tenderId, req.user_id]);
        return res.redirect('/houseowner/tenders?notice=deleted');
    } catch (err) {
        console.error(err);
        return res.redirect('/houseowner/tenders');
    }
});

module.exports = router;
