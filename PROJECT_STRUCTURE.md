# BuildTender — Project Structure

> **Source of truth.** Read this file before making any code changes.

## Overview

BuildTender is a construction tender marketplace. Users register as **houseowner**, **contractor**, or **vendor** and access role-specific dashboards. Admin staff manage tenders, user verification, and budgets.

**Stack:** Node.js, Express 5, EJS, MySQL (`mysql2`), JWT auth (partial), static assets in `public/`.

**Run:**
```bash
npm install
npm start
# http://localhost:3000 (or PORT from .env)
```

---

## Directory Layout

```
buld/
├── app.js                  # Express entry point — middleware, route mounting, inline admin APIs
├── package.json
├── database.sql            # MySQL schema (users, tenders)
├── .env                    # PORT, DB credentials (not committed)
│
├── config/
│   └── connection.js       # MySQL connection + promisified `exe` query helper
│
├── routes/                 # One router per role — render EJS views
│   ├── user.js             # /           — landing, register, login
│   ├── houseowner.js       # /houseowner — owner dashboard pages
│   ├── contractor.js       # /contractor — contractor dashboard pages
│   ├── vendor.js           # /vendor     — vendor dashboard pages
│   └── admin.js            # /admin      — admin dashboards & tools
│
├── views/
│   ├── index.ejs           # Landing / auth page
│   ├── partials/           # Shared layout fragments
│   │   ├── header.ejs
│   │   ├── footer.ejs
│   │   ├── navbar.ejs
│   │   └── sidebar.ejs
│   ├── houseowner/         # Owner role views
│   ├── contractor/         # Contractor role views
│   ├── vendor/             # Vendor role views
│   └── admin/              # Admin role views
│
└── public/                 # Static files served at /
    ├── css/styles.css
    ├── js/app.js           # Client-side logic, localStorage demo data, role UI
    └── images/
```

---

## Architecture

### Request flow

1. `app.js` sets up Express middleware (`body-parser`, `cors`, EJS, static files).
2. Role routers in `routes/` handle GET/POST and call `res.render('role/page', data)`.
3. EJS views include `partials/header`, `partials/sidebar`, etc., and load `/css/styles.css` + `/js/app.js`.

### Route mounting (`app.js`)

| Mount path      | Router file           | Purpose                          |
|-----------------|-----------------------|----------------------------------|
| `/`             | `routes/user.js`      | Home, registration, login        |
| `/houseowner`   | `routes/houseowner.js`| House owner pages                |
| `/contractor`   | `routes/contractor.js`| Contractor pages                 |
| `/vendor`       | `routes/vendor.js`    | Vendor pages                     |
| `/admin`        | `routes/admin.js`     | Admin dashboards                 |

### Inline APIs (`app.js`)

- `GET /api/admin/system-stats` — mock stats JSON
- `GET /api/admin/verified-users` — mock verified users JSON

Admin demo data also lives in `public/js/app.js` via `localStorage` (`working_tenders`, `working_pending_users`, etc.).

---

## Routes Reference

### `routes/user.js` (`/`)
| Method | Path        | Action                    |
|--------|-------------|---------------------------|
| GET    | `/`         | Render `index`            |
| POST   | `/register` | Register user (MySQL)     |
| POST   | `/login`    | Login (stub JSON response)|

**Auth helpers:** `hashPassword()` (SHA-256), JWT via `jsonwebtoken`, DB via `exe` from `config/connection.js`.

### `routes/houseowner.js` (`/houseowner`)
| Method | Path         | View                    |
|--------|--------------|-------------------------|
| GET    | `/overview`  | `houseowner/overview`   |
| GET    | `/post`      | `houseowner/post`       |
| POST   | `/create-order` | Create Razorpay order (₹5999 fee, no DB save) |
| POST   | `/verify-payment` | Verify Razorpay signature; save tender + payment **only if valid** |
| GET    | `/tenders`   | `houseowner/tenders`    |
| GET    | `/materials` | `houseowner/materials`  |
| GET    | `/payments`  | `houseowner/payments`   |
| GET    | `/profile`   | `houseowner/profile`    |

**Payment rule:** Order/tender and payment details are saved only after HMAC signature verification succeeds. On failure or dismiss, nothing is saved and form/cart data is kept.

`verifyToken` middleware exists but currently calls `next()` without validation.

### `routes/contractor.js` (`/contractor`)
`/dashboard`, `/marketplace`, `/materials`, `/bids`, `/profile`

### `routes/vendor.js` (`/vendor`)
`/dashboard`, `/inventory`, `/orders`, `/payments`, `/profile`

### `routes/admin.js` (`/admin`)
`/`, `/directory`, `/pending-users`, `/upload-tender`, `/verified`, `/verify-dashboard`, `/budget-dashboard`, `/tender-dashboard`, `/partner-dashboard`, `/quality-team-dashboard`, `/super-dashboard`, `/super-staff`, `/login`

---

## Database

**Config:** `config/connection.js` — `mysql2` connection to database `buld`, exports promisified `exe`.

**Schema:** `database.sql`

| Table    | Key columns                                              |
|----------|----------------------------------------------------------|
| `users`  | id, username, mobile, email, password_hash, role, created_at |
| `tenders`| tender_id, plot/requirements fields, payment_status, payment_amount, payment_transaction_id, razorpay_order_id |

**Roles enum:** `vendor`, `contractor`, `houseowner`

---

## Conventions

### Naming
- Route files: lowercase role name (`houseowner.js`, not `houseOwner.js`)
- Views: `views/<role>/<page>.ejs` matching route path
- Partials: `views/partials/<name>.ejs`, included as `<%- include('../partials/header') %>`

### Adding a new page
1. Create `views/<role>/<page>.ejs` using existing partials.
2. Add route in `routes/<role>.js` → `res.render('<role>/<page>')`.
3. If sidebar nav needed, update `views/partials/sidebar.ejs` and/or `public/js/app.js`.
4. Reuse `config/connection.js` `exe` for DB — do not create a second connection module.

### Adding API endpoints
- Prefer role-specific logic in `routes/<role>.js`.
- Admin mock APIs may go in `app.js` (existing pattern) or `routes/admin.js` for consistency.
- Client fetches in `public/js/app.js`.

### Auth
- JWT secret in `routes/user.js` (`JWT_SECRET`).
- `verifyToken` in `houseowner.js` is a stub — extend here for protected routes.
- Password hashing: SHA-256 via `crypto` in `user.js`.

### Styling
- Global styles: `public/css/styles.css`
- Fonts: Inter, Outfit (loaded in `header.ejs`)
- Icons: Lucide (`unpkg.com/lucide`)

---

## Do Not

- Create duplicate DB connection files — use `config/connection.js`
- Add new top-level folders without updating this document
- Duplicate route logic across role routers — extract shared helpers only when used by 2+ roles
- Commit `.env` or secrets

---

## Key Files Quick Reference

| File | Responsibility |
|------|----------------|
| `app.js` | Server bootstrap, route mounts, admin mock APIs |
| `config/connection.js` | MySQL `exe` query helper |
| `routes/user.js` | Registration, login, JWT |
| `public/js/app.js` | Frontend interactivity, localStorage demo state |
| `views/partials/sidebar.ejs` | Role-based navigation |
| `database.sql` | Schema definition |
