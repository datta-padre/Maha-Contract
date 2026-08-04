const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const router = express.Router();
const exe = require('../config/connection');
const { ROLES, verifyToken, requireRole } = require('../middleware/auth');

const contractorOnly = [verifyToken, requireRole(ROLES.CONTRACTOR)];

if (!fs.existsSync('public/kyc')) {
    fs.mkdirSync('public/kyc', { recursive: true });
}

const KYC_FEES = {
    Advance: 5900,
    Intermediate: 3540,
    Final: 5635
};

const PAYMENT_ORDER = ['Advance', 'Intermediate', 'Final'];

function getCompletedPayments(row) {
    if (!row || row.payment_status !== 'paid') return [];
    var idx = PAYMENT_ORDER.indexOf(row.contractor_payment_status);
    if (idx < 0) return [];
    return PAYMENT_ORDER.slice(0, idx + 1);
}

function nextPaymentType(completed) {
    for (var i = 0; i < PAYMENT_ORDER.length; i++) {
        if (completed.indexOf(PAYMENT_ORDER[i]) === -1) return PAYMENT_ORDER[i];
    }
    return null;
}

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

function saveFile(file, prefix) {
    if (!file || !file.name) return null;
    var safeName = String(file.name).replace(/[^\w.\-]+/g, '_');
    var filename = Date.now() + '_' + prefix + '_' + safeName;
    file.mv('public/kyc/' + filename);
    return filename;
}

function saveFiles(files, prefix) {
    if (!files) return null;
    var list = Array.isArray(files) ? files : [files];
    if (!list.length) return null;
    var base = Date.now();
    return list.map(function (file, idx) {
        var safeName = String(file.name).replace(/[^\w.\-]+/g, '_');
        var filename = base + '_' + prefix + '_' + idx + '_' + safeName;
        file.mv('public/kyc/' + filename);
        return filename;
    }).join('|');
}

function keepOrReplace(newVal, oldVal) {
    return newVal || oldVal || null;
}

function mapRowToFormData(row, user) {
    var completed = getCompletedPayments(row);
    var nextType = nextPaymentType(completed) || 'Final';

    if (!row) {
        return {
            email: (user && user.email) || '',
            mobile: (user && user.mobile) || '',
            availability: 'ready',
            paymentType: 'Advance'
        };
    }
    return {
        fullName: row.full_name || '',
        email: row.email || (user && user.email) || '',
        mobile: row.phone || (user && user.mobile) || '',
        location: row.location_link || '',
        experience: row.experience || '',
        specialization: row.specialization || '',
        availability: row.availability || 'ready',
        pricePerSqft: row.base_price_range || '',
        paymentType: nextType,
        acceptPrivacy: !!row.acceptPrivacy,
        acceptTerms: !!row.acceptTerms,
        paymentStatus: row.payment_status || 'pending'
    };
}

function mapDocs(row) {
    if (!row) return {};
    return {
        profilePhoto: row.profile_picture || '',
        digitalSignature: row.digital_signature || '',
        qualificationDoc: row.qualifications || '',
        licenseDoc: row.licenses || '',
        aadhaarDoc: row.adhar_card || '',
        panDoc: row.pan_card || '',
        gstDoc: row.gst_certificate || '',
        incomeCert: row.insurance_certificate || '',
        nclCert: row.non_crime_certificate || '',
        policeNoc: row.police_ncertificate || '',
        portfolioImages: row.previous_work || '',
        stampAgreement: row.legal_agreement || ''
    };
}

function renderDashboard(res, opts) {
    return res.render('contractor/dashboard', {
        success: opts.success || false,
        error: opts.error || null,
        formData: opts.formData || {},
        docs: opts.docs || {},
        completedPayments: opts.completedPayments || [],
        allPaymentsDone: !!opts.allPaymentsDone
    });
}

router.get('/dashboard', contractorOnly, async (req, res) => {
    try {
        var userRows = await exe(`SELECT email, mobile FROM users WHERE user_id = ?`, [req.user_id]);
        var user = Array.isArray(userRows) && userRows[0] ? userRows[0] : null;
        if (!user) return res.redirect('/');

        var kycRows = await exe(
            `SELECT * FROM contractor_kyc WHERE user_id = ? OR email = ? OR phone = ? ORDER BY kyc_id DESC LIMIT 1`,
            [req.user_id, user.email, user.mobile]
        );
        var existing = Array.isArray(kycRows) && kycRows[0] ? kycRows[0] : null;
        var completed = getCompletedPayments(existing);

        renderDashboard(res, {
            success: req.query.success === 'true',
            error: req.query.error || null,
            formData: mapRowToFormData(existing, user),
            docs: mapDocs(existing),
            completedPayments: completed,
            allPaymentsDone: completed.length === 3
        });
    } catch (err) {
        console.error(err);
        renderDashboard(res, {
            success: false,
            error: 'Could not load KYC form.',
            formData: {},
            docs: {},
            completedPayments: [],
            allPaymentsDone: false
        });
    }
});

// Step 1: create Razorpay order — NO database save
router.post('/create-order', contractorOnly, async (req, res) => {
    try {
        var paymentType = (req.body && req.body.paymentType) || 'Advance';
        if (!KYC_FEES[paymentType]) {
            return res.status(400).json({ success: false, message: 'Invalid payment type.' });
        }

        var userRows = await exe(`SELECT email, mobile FROM users WHERE user_id = ?`, [req.user_id]);
        var user = Array.isArray(userRows) && userRows[0] ? userRows[0] : null;
        if (user) {
            var kycRows = await exe(
                `SELECT * FROM contractor_kyc WHERE user_id = ? OR email = ? OR phone = ? ORDER BY kyc_id DESC LIMIT 1`,
                [req.user_id, user.email, user.mobile]
            );
            var existing = Array.isArray(kycRows) && kycRows[0] ? kycRows[0] : null;
            var completed = getCompletedPayments(existing);
            if (completed.length === 3) {
                return res.status(400).json({ success: false, message: 'All 3 payments are already completed.' });
            }
            if (completed.indexOf(paymentType) !== -1) {
                return res.status(400).json({ success: false, message: paymentType + ' payment is already completed.' });
            }
        }

        var amount = KYC_FEES[paymentType];
        var order = await razorpay.orders.create({
            amount: amount * 100,
            currency: 'INR',
            receipt: 'kyc_' + req.user_id + '_' + Date.now()
        });

        res.json({
            success: true,
            key: process.env.RAZORPAY_KEY_ID,
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            paymentType: paymentType
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Could not create payment order' });
    }
});

// Step 2: verify payment → ONLY THEN save KYC to database
router.post('/kyc', contractorOnly, async (req, res) => {
    var d = req.body || {};
    var files = req.files || {};

    var orderId = d.razorpay_order_id || '';
    var paymentId = d.razorpay_payment_id || '';
    var signature = d.razorpay_signature || '';
    var paymentType = d.paymentType || 'Advance';

    // No payment tokens → do not save
    if (!orderId || !paymentId || !signature) {
        return renderDashboard(res, {
            success: false,
            error: 'Payment not completed. KYC data was not saved.',
            formData: d,
            docs: {}
        });
    }

    // Verify Razorpay signature
    var expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(orderId + '|' + paymentId)
        .digest('hex');

    if (expected !== signature) {
        return renderDashboard(res, {
            success: false,
            error: 'Payment verification failed. KYC data was not saved.',
            formData: d,
            docs: {}
        });
    }

    // Duplicate payment → do not insert twice
    var dupRows = await exe(
        `SELECT kyc_id FROM contractor_kyc WHERE payment_transaction_id = ? OR razorpay_order_id = ? LIMIT 1`,
        [paymentId, orderId]
    );
    if (Array.isArray(dupRows) && dupRows.length > 0) {
        return res.redirect('/contractor/dashboard?success=true');
    }

    if (!d.fullName || !d.email || !d.mobile || !d.location) {
        return renderDashboard(res, {
            success: false,
            error: 'Please fill all required profile fields. KYC data was not saved.',
            formData: d,
            docs: {}
        });
    }
    if (!d.acceptPrivacy || !d.acceptTerms) {
        return renderDashboard(res, {
            success: false,
            error: 'Please accept Privacy Policy and Terms. KYC data was not saved.',
            formData: d,
            docs: {}
        });
    }
    if (!KYC_FEES[paymentType]) {
        return renderDashboard(res, {
            success: false,
            error: 'Invalid payment type. KYC data was not saved.',
            formData: d,
            docs: {}
        });
    }

    var amount = KYC_FEES[paymentType];

    var existingRows = await exe(
        `SELECT * FROM contractor_kyc WHERE user_id = ? OR email = ? OR phone = ? ORDER BY kyc_id DESC LIMIT 1`,
        [req.user_id, d.email, d.mobile]
    );
    var existingRow = Array.isArray(existingRows) && existingRows[0] ? existingRows[0] : null;
    var completed = getCompletedPayments(existingRow);
    if (completed.length === 3) {
        return renderDashboard(res, {
            success: false,
            error: 'All 3 payments are already completed. No further payment needed.',
            formData: d,
            docs: mapDocs(existingRow),
            completedPayments: completed,
            allPaymentsDone: true
        });
    }
    if (completed.indexOf(paymentType) !== -1) {
        return renderDashboard(res, {
            success: false,
            error: paymentType + ' payment is already completed.',
            formData: d,
            docs: mapDocs(existingRow),
            completedPayments: completed,
            allPaymentsDone: false
        });
    }

    // Save files only after payment verified
    var profile_picture = keepOrReplace(saveFile(files.profilePhoto, 'profile'), existingRow && existingRow.profile_picture);
    var digital_signature = keepOrReplace(saveFile(files.digitalSignature, 'signature'), existingRow && existingRow.digital_signature);
    var qualifications = keepOrReplace(saveFile(files.qualificationDoc, 'qualification'), existingRow && existingRow.qualifications);
    var licenses = keepOrReplace(saveFile(files.licenseDoc, 'license'), existingRow && existingRow.licenses);
    var adhar_card = keepOrReplace(saveFile(files.aadhaarDoc, 'aadhaar'), existingRow && existingRow.adhar_card);
    var pan_card = keepOrReplace(saveFile(files.panDoc, 'pan'), existingRow && existingRow.pan_card);
    var gst_certificate = keepOrReplace(saveFile(files.gstDoc, 'gst'), existingRow && existingRow.gst_certificate);
    var insurance_certificate = keepOrReplace(saveFile(files.incomeCert, 'income'), existingRow && existingRow.insurance_certificate);
    var non_crime_certificate = keepOrReplace(saveFile(files.nclCert, 'ncl'), existingRow && existingRow.non_crime_certificate);
    var police_ncertificate = keepOrReplace(saveFile(files.policeNoc, 'police'), existingRow && existingRow.police_ncertificate);
    var previous_work = keepOrReplace(saveFiles(files.portfolioImages, 'portfolio'), existingRow && existingRow.previous_work);
    var legal_agreement = keepOrReplace(saveFile(files.stampAgreement, 'stamp'), existingRow && existingRow.legal_agreement);

    if (!profile_picture || !digital_signature || !qualifications || !licenses || !adhar_card || !pan_card || !legal_agreement) {
        return renderDashboard(res, {
            success: false,
            error: 'Please upload all required documents. KYC data was not saved.',
            formData: d,
            docs: mapDocs(existingRow)
        });
    }

    var acceptPrivacy = d.acceptPrivacy ? 1 : 0;
    var acceptTerms = d.acceptTerms ? 1 : 0;

    try {
        await exe('START TRANSACTION');

        var dupAgain = await exe(
            `SELECT kyc_id FROM contractor_kyc WHERE payment_transaction_id = ? OR razorpay_order_id = ? LIMIT 1`,
            [paymentId, orderId]
        );
        if (Array.isArray(dupAgain) && dupAgain.length > 0) {
            await exe('COMMIT');
            return res.redirect('/contractor/dashboard?success=true');
        }

        if (existingRow) {
            var updateSql = `UPDATE contractor_kyc SET
                user_id = ?, full_name = ?, email = ?, phone = ?, location_link = ?, experience = ?, specialization = ?,
                availability = ?, base_price_range = ?, profile_picture = ?, digital_signature = ?, qualifications = ?,
                licenses = ?, adhar_card = ?, pan_card = ?, gst_certificate = ?, insurance_certificate = ?,
                non_crime_certificate = ?, police_ncertificate = ?, previous_work = ?, legal_agreement = ?,
                acceptPrivacy = ?, acceptTerms = ?, payment_status = ?, contractor_kyc_status = ?,
                contractor_payment_status = ?, payment_amount = ?, payment_transaction_id = ?, razorpay_order_id = ?
                WHERE kyc_id = ?`;
            await exe(updateSql, [
                req.user_id, d.fullName, d.email, d.mobile, d.location, d.experience, d.specialization,
                d.availability || 'ready', d.pricePerSqft || '',
                profile_picture, digital_signature, qualifications, licenses, adhar_card, pan_card,
                gst_certificate, insurance_certificate, non_crime_certificate, police_ncertificate,
                previous_work, legal_agreement, acceptPrivacy, acceptTerms,
                'paid', 'pending', paymentType, amount, paymentId, orderId,
                existingRow.kyc_id
            ]);
        } else {
            var insertSql = `INSERT INTO contractor_kyc (
                user_id, full_name, email, phone, location_link, experience, specialization, availability, base_price_range,
                profile_picture, digital_signature, qualifications, licenses, adhar_card, pan_card, gst_certificate,
                insurance_certificate, non_crime_certificate, police_ncertificate, previous_work, legal_agreement,
                acceptPrivacy, acceptTerms, payment_status, contractor_kyc_status, contractor_payment_status,
                payment_amount, payment_transaction_id, razorpay_order_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            await exe(insertSql, [
                req.user_id, d.fullName, d.email, d.mobile, d.location, d.experience, d.specialization,
                d.availability || 'ready', d.pricePerSqft || '',
                profile_picture, digital_signature, qualifications, licenses, adhar_card, pan_card, gst_certificate,
                insurance_certificate, non_crime_certificate, police_ncertificate, previous_work, legal_agreement,
                acceptPrivacy, acceptTerms, 'paid', 'pending', paymentType,
                amount, paymentId, orderId
            ]);
        }

        await exe('COMMIT');
        return res.redirect('/contractor/dashboard?success=true');
    } catch (err) {
        console.error(err);
        try { await exe('ROLLBACK'); } catch (e) { console.error(e); }
        return renderDashboard(res, {
            success: false,
            error: 'Payment succeeded but saving failed. KYC was not saved. Payment ID: ' + paymentId,
            formData: d,
            docs: mapDocs(existingRow)
        });
    }
});

router.get('/marketplace', contractorOnly, (req, res) => {
    res.render('contractor/marketplace');
});
router.get('/materials', contractorOnly, (req, res) => {
    res.render('contractor/materials');
});
router.get('/bids', contractorOnly, (req, res) => {
    res.render('contractor/bids');
});
router.get('/profile', contractorOnly, (req, res) => {
    res.render('contractor/profile');
});

module.exports = router;
