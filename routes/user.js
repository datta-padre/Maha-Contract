  const express = require("express");
  const router = express.Router();
  const crypto = require("crypto");
  const exe = require("../config/connection");
  const jwt = require("jsonwebtoken");
  const cookieParser = require("cookie-parser");

  router.use(cookieParser());

  const JWT_SECRET = process.env.JWT_SECRET || "dattapadre";

  async function verifyToken(req, res, next) {
    const token = req.cookies.accessToken;
    if (!token) {
      res.clearCookie("accessToken");
      return res.redirect("/");
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user_id = decoded.user_id;
      next();
    } catch (err) {
      // Invalid or expired (TokenExpiredError) token
      res.clearCookie("accessToken");
      return res.redirect("/");
    }
  }

  const hashPassword = (password) => {
    return crypto.createHash("sha256").update(password).digest("hex");
  };

  router.get("/", (req, res) => {
    res.render("index");
  });

  router.post("/register", async (req, res) => {
      const { mobile, email, password, role } = req.body;
      const username = req.body.username || email?.split("@")[0] || `user_${Date.now()}`;

      console.log(req.body);

      const sql = `SELECT * FROM users WHERE email = ? AND role = ?`;
      const user = await exe(sql, [email, role]);

      if (user.length > 0) {
        return res.json({
          success: false,
          message: "User already exists",
        });
      }

      const hashedPassword = hashPassword(password);
      const query = `INSERT INTO users(username, mobile, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`;
       var data = await exe(query, [username, mobile, email, hashedPassword, role]);

      var accessToken = jwt.sign({ email, role ,user_id: data.insertId }, JWT_SECRET, { expiresIn: "1h" });
      res.cookie("accessToken", accessToken);

      return res.json({
        success: true,
        message: "User registered successfully",
      });   
  });

  router.post("/login", async (req, res) => {
    const { email, password, role } = req.body;
    const hashedPassword = hashPassword(password);

    const sql = `SELECT * FROM users WHERE email = ? AND password_hash = ? AND role = ?`;
    const user = await exe(sql, [email, hashedPassword, role]);

    if (user.length === 0) {
      return res.json({
        success: false,
        message: "Invalid credentials",
      });
    }

    var accessToken = jwt.sign({ email, role, user_id: user[0].user_id }, JWT_SECRET, { expiresIn: "1h" });
    res.cookie("accessToken", accessToken);

    return res.json({
      success: true,
      message: "User logged in successfully",
    });
  });

  router.get("/logout", (req, res) => {
    const token = req.cookies.accessToken;
    const query = `INSERT INTO token_blacklist(token) VALUES (?)`;
    exe(query, [token]);
    res.clearCookie("accessToken");
    res.redirect("/");
  });

  router.post("/update-profile", verifyToken, async (req, res) => {
    var d = req.body;
    var username = d.username;
    var mobile = d.mobile;
    var email = d.email;
    var address = d.address || '';
    var taluka = d.taluka || '';
    var district = d.district || '';
    var state = d.state || '';
    var pincode = d.pincode || '';

    // update password only if user entered new password
    if (d.password && d.password.trim() !== '') {
      var hashedPassword = hashPassword(d.password);
      var query = `UPDATE users SET username = ?, mobile = ?, email = ?, address = ?, taluka = ?, district = ?, state = ?, pincode = ?, password_hash = ? WHERE user_id = ?`;
      await exe(query, [username, mobile, email, address, taluka, district, state, pincode, hashedPassword, req.user_id]);
    } else {
      var query = `UPDATE users SET username = ?, mobile = ?, email = ?, address = ?, taluka = ?, district = ?, state = ?, pincode = ? WHERE user_id = ?`;
      await exe(query, [username, mobile, email, address, taluka, district, state, pincode, req.user_id]);
    }

    res.redirect("/houseowner/profile");
  });
  module.exports = router;
