const express = require("express");
const router = express.Router();
const exe = require("../config/connection");
const {
  ROLES,
  PUBLIC_ROLES,
  hashPassword,
  signToken,
  setAuthCookie,
  clearAuth,
  dashboardForRole,
  profileForRole,
  verifyToken
} = require("../middleware/auth");

router.get("/", (req, res) => {
  res.render("index");
});

router.post("/register", async (req, res) => {
  try {
    const { mobile, email, password, role } = req.body;
    const username =
      req.body.username || (email && email.split("@")[0]) || "user_" + Date.now();
    const normalizedRole = String(role || "").toLowerCase();

    if (!email || !password || !mobile) {
      return res.json({ success: false, message: "Missing required fields." });
    }

    if (PUBLIC_ROLES.indexOf(normalizedRole) === -1) {
      return res.json({
        success: false,
        message: "Invalid role. Allowed: user, vendor, contractor, houseowner."
      });
    }

    const existing = await exe(`SELECT user_id FROM users WHERE email = ? AND role = ?`, [
      email,
      normalizedRole
    ]);
    if (Array.isArray(existing) && existing.length > 0) {
      return res.json({ success: false, message: "User already exists" });
    }

    const hashedPassword = hashPassword(password);
    const data = await exe(
      `INSERT INTO users(username, mobile, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
      [username, mobile, email, hashedPassword, normalizedRole]
    );

    const accessToken = signToken({
      email,
      role: normalizedRole,
      user_id: data.insertId
    });
    setAuthCookie(res, accessToken);

    return res.json({
      success: true,
      message: "User registered successfully",
      role: normalizedRole,
      redirect: dashboardForRole(normalizedRole)
    });
  } catch (err) {
    console.error(err);
    return res.json({ success: false, message: "Registration failed." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const normalizedRole = String(role || "").toLowerCase();
    const hashedPassword = hashPassword(password);

    if (!email || !password || !normalizedRole) {
      return res.json({ success: false, message: "Missing credentials." });
    }

    // Public login cannot use admin — use /admin/login
    if (normalizedRole === ROLES.ADMIN) {
      return res.json({
        success: false,
        message: "Please use the Master Admin login page."
      });
    }

    if (
      [ROLES.USER, ROLES.VENDOR, ROLES.CONTRACTOR, ROLES.HOUSEOWNER].indexOf(
        normalizedRole
      ) === -1
    ) {
      return res.json({ success: false, message: "Invalid role." });
    }

    const user = await exe(
      `SELECT * FROM users WHERE email = ? AND password_hash = ? AND role = ?`,
      [email, hashedPassword, normalizedRole]
    );

    if (!Array.isArray(user) || user.length === 0) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    const accessToken = signToken({
      email: user[0].email,
      role: user[0].role,
      user_id: user[0].user_id
    });
    setAuthCookie(res, accessToken);

    return res.json({
      success: true,
      message: "User logged in successfully",
      role: user[0].role,
      redirect: dashboardForRole(user[0].role)
    });
  } catch (err) {
    console.error(err);
    return res.json({ success: false, message: "Login failed." });
  }
});

router.get("/logout", async (req, res) => {
  try {
    const token = req.cookies && req.cookies.accessToken;
    if (token) {
      await exe(`INSERT INTO token_blacklist(token) VALUES (?)`, [token]);
    }
  } catch (err) {
    console.error(err);
  }
  clearAuth(res);
  res.redirect("/");
});

router.post("/update-profile", verifyToken, async (req, res) => {
  var d = req.body;
  var username = d.username;
  var mobile = d.mobile;
  var email = d.email;
  var address = d.address || "";
  var taluka = d.taluka || "";
  var district = d.district || "";
  var state = d.state || "";
  var pincode = d.pincode || "";

  if (d.password && d.password.trim() !== "") {
    var hashedPassword = hashPassword(d.password);
    await exe(
      `UPDATE users SET username = ?, mobile = ?, email = ?, address = ?, taluka = ?, district = ?, state = ?, pincode = ?, password_hash = ? WHERE user_id = ?`,
      [
        username,
        mobile,
        email,
        address,
        taluka,
        district,
        state,
        pincode,
        hashedPassword,
        req.user_id
      ]
    );
  } else {
    await exe(
      `UPDATE users SET username = ?, mobile = ?, email = ?, address = ?, taluka = ?, district = ?, state = ?, pincode = ? WHERE user_id = ?`,
      [username, mobile, email, address, taluka, district, state, pincode, req.user_id]
    );
  }

  res.redirect(profileForRole(req.role));
});

module.exports = router;
