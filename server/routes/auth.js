/** Sign-in, sign-out, session introspection and password changes. */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { get, run, all } = require('../db');
const { handler, ok, v, fields, ApiError } = require('../util/http');
const {
  hashSecret, verifySecret, startSession, endSession,
  requireAuth, loadUser, audit, PUBLIC_USER_COLUMNS,
} = require('../auth');

const router = express.Router();

/** Demo mode exposes the seeded sign-in list on the login screen. */
const DEMO_MODE = process.env.DEMO_MODE !== 'false';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'maktab2027';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_ATTEMPTS || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many sign-in attempts. Please wait a few minutes and try again.' },
});

/** Extra context the client needs immediately after sign-in. */
function sessionContext(user) {
  if (user.role === 'teacher') {
    const classes = all(
      `SELECT c.id, c.name, c.grade, c.gender_track, c.room, ct.role
         FROM class_teachers ct JOIN classes c ON c.id = ct.class_id
        WHERE ct.user_id = ? AND c.is_active = 1
        ORDER BY c.grade ASC`,
      [user.id]
    );
    return { classes };
  }
  if (user.role === 'parent') {
    const children = all(
      `SELECT s.id, s.first_name, s.last_name, s.student_code, c.name AS class_name, c.grade
         FROM student_guardians sg
         JOIN students s ON s.id = sg.student_id
         LEFT JOIN classes c ON c.id = s.class_id
        WHERE sg.user_id = ? AND s.is_active = 1
        ORDER BY c.grade ASC, s.first_name ASC`,
      [user.id]
    );
    return { children };
  }
  return {};
}

router.post('/login', loginLimiter, handler((req, res) => {
  const body = fields(req.body, {
    identifier: v.string({ max: 160 }),
    secret: v.string({ max: 200 }),
  });

  const account = get(
    `SELECT * FROM users WHERE lower(email) = lower(?)`, [body.identifier]
  );

  // A single generic message for "no such user" and "wrong secret" so the form
  // cannot be used to enumerate which emails have accounts.
  const rejection = ApiError.unauthorized('Those sign-in details do not match an account');
  if (!account || !account.is_active) throw rejection;

  const matched = verifySecret(body.secret, account.password_hash)
    || verifySecret(body.secret, account.pin_hash);
  if (!matched) {
    audit(req, 'auth.login_failed', { entity: 'user', entityId: account.id });
    throw rejection;
  }

  run(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`, [account.id]);
  startSession(req, res, account);
  const user = loadUser(account.id);
  audit(req, 'auth.login', { entity: 'user', entityId: account.id });
  return ok(res, { user, ...sessionContext(user) });
}));

router.post('/logout', handler((req, res) => {
  if (req.user) audit(req, 'auth.logout', { entity: 'user', entityId: req.user.id });
  endSession(res);
  return ok(res, { signedOut: true });
}));

/** Called on every page load to restore the session without a round of guessing. */
router.get('/session', handler((req, res) => {
  if (!req.user) return ok(res, { user: null });
  return ok(res, { user: req.user, ...sessionContext(req.user) });
}));

router.post('/change-password', requireAuth, handler((req, res) => {
  const body = fields(req.body, {
    current_password: v.string({ max: 200 }),
    new_password: v.string({ min: 8, max: 200 }),
  });

  const account = get(`SELECT * FROM users WHERE id = ?`, [req.user.id]);
  const matched = verifySecret(body.current_password, account.password_hash)
    || verifySecret(body.current_password, account.pin_hash);
  if (!matched) throw ApiError.badRequest('Your current password is not correct');

  run(
    `UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now')
      WHERE id = ?`,
    [hashSecret(body.new_password), req.user.id]
  );
  audit(req, 'auth.password_changed', { entity: 'user', entityId: req.user.id });
  return ok(res, { updated: true });
}));

/**
 * Sign-in shortcuts for the demonstration deployment. Returns one example
 * account per role plus the shared demo password, and is disabled entirely by
 * setting DEMO_MODE=false for a real rollout.
 */
router.get('/demo-accounts', handler((req, res) => {
  if (!DEMO_MODE) return ok(res, { enabled: false, accounts: [] });

  const pick = (role, limit) => all(
    `SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE role = ? AND is_active = 1 ORDER BY id ASC LIMIT ?`,
    [role, limit]
  );

  const accounts = [
    ...pick('admin', 1).map((u) => ({ ...u, hint: 'Full oversight of every grade' })),
    ...pick('teacher', 2).map((u) => ({ ...u, hint: 'Daily check-off for their own class' })),
    ...pick('parent', 2).map((u) => ({ ...u, hint: "Their own children's progress only" })),
  ];

  return ok(res, { enabled: true, password: DEMO_PASSWORD, accounts });
}));

module.exports = router;
module.exports.DEMO_MODE = DEMO_MODE;
module.exports.DEMO_PASSWORD = DEMO_PASSWORD;
