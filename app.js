const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const cookie = require('cookie-parser');
const app = express();
require("dotenv").config();
const port = process.env.PORT || 8080;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload());
app.use(cors());
app.use(cookie());
app.use(express.static(path.join(__dirname, 'uploads')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

const userRoutes = require('./routes/user');
const vendorRoutes = require('./routes/vendor');
const contractorRoutes = require('./routes/contractor');
const houseownerRoutes = require('./routes/houseowner');
const masterAdminRoutes = require('./routes/masterAdmin');
const verifyAdminRoutes = require('./routes/verifyAdmin');
const budgetAdminRoutes = require('./routes/budgetAdmin');
const materialsAdminRoutes = require('./routes/materialsAdmin');

app.use('/', userRoutes);
app.use('/vendor', vendorRoutes);
app.use('/contractor', contractorRoutes);
app.use('/houseowner', houseownerRoutes);
app.use('/master-admin', masterAdminRoutes);
app.use('/verify-admin', verifyAdminRoutes);
app.use("/budget-admin", budgetAdminRoutes);
app.use("/materials-admin", materialsAdminRoutes);

app.listen(port, () => console.log(`BuildTender frontend running on http://localhost:${port}`));
