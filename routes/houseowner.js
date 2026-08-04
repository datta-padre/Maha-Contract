const express = require('express');
const router = express.Router();
const fs = require('fs');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const exe = require('../config/connection');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
router.use(cookieParser()); 

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


// Make sure upload folder exists
if (!fs.existsSync('public/tenders')) {
    fs.mkdirSync('public/tenders', { recursive: true });
}

const TENDER_FEE = 5999; // ₹5,999

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


router.get('/overview',verifyToken, async (req, res) => {
    var result = await exe(`SELECT COUNT(tender_id) as total_tenders FROM tenders`);
        res.render('houseowner/overview', { total_tenders: result[0].total_tenders });
    });

router.get('/post', verifyToken, (req, res) => {
    res.render('houseowner/post', {
        success: false,
        formData: {},
        razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
});

router.get('/tenders', verifyToken, async(req, res) => {

    var sql = `SELECT * FROM tenders  `
    var value = [req.user_id]

     var data = await exe(sql,value)

    if (!Array.isArray(data)) data = [];
    res.render('houseowner/tenders', { tenders: data });
});

router.get('/materials', verifyToken, async (req, res) => {
    var sql = `SELECT * FROM materials`;
    var data = await exe(sql);
    if (!Array.isArray(data)) data = [];
    res.render('houseowner/materials', { materials: data });
});

router.get('/payments', verifyToken, (req, res) => {
    res.render('houseowner/payments');
});

router.get('/profile', verifyToken, async (req, res) => {
    var result = await exe(`SELECT * FROM users WHERE user_id = ?`, [req.user_id]);
    if (!result.length) {
        return res.redirect('/');
    }
    res.render('houseowner/profile', { user: result[0] });
});

// ---------- step 1: create Razorpay order (no DB save) ----------

router.post('/create-order', verifyToken, async (req, res) => {
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

router.post('/save-tender', verifyToken, async (req, res) => {
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

module.exports = router;
