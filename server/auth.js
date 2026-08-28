/**
 * Authentication and authorization.
 *
 * Sessions are stateless JWTs delivered in an httpOnly cookie, with a Bearer
 * header accepted as an alternative for scripted clients. Cookie-authenticated
 * mutations additionally require a double-submit CSRF token, since a SameSite
 * cookie alone is not a guarantee across every browser in use at a masjid.
 *
 * Two credential styles are supported on one login form, because teachers sign
 * in on phones between classes: a full password, or a short numeric PIN. Both
 * are stored only as bcrypt hashes.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { get, run, all } = require('./db');
const { ApiError } = require('./util/http');

const SESSION_COOKIE = 'maktab_session';
const CSRF_COOKIE = 'maktab_csrf';
const CSRF_HEADER = 'x-maktab-csrf';
const SESSION_HOURS = Number(process.env.SESSION_HOURS || 12);
const BCRYPT_ROUNDS = 10;

let cachedSecret = null;

/**
 * Resolve the signing secret. An explicit JWT_SECRET always wins. Failing
 * that we generate one and persist it in the settings table so sessions
 * survive a restart — a deployment with no configuration still behaves
 * correctly, and the log says what to set for a multi-instance setup.
 */
function sessionSecret() {
  if (cachedSecret) return cachedSecret;
  if (process.env.JWT_SECRET) {
    cachedSecret = process.env.JWT_SECRET;
    return cachedSecret;
  }
  const stored = get(`SELECT value FROM settings WHERE key = 'jwt_secret'`);
  if (stored?.value) {
    cachedSecret = stored.value;
    return cachedSecret;
  }
  cachedSecret = crypto.randomBytes(48).toString('hex');
  run(
    `INSERT INTO settings (key, value, updated_at) VALUES ('jwt_secret', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [cachedSecret]
  );
  console.warn('[auth] JWT_SECRET not set — generated one and stored it in the database. Set JWT_SECRET explicitly when running more than one instance.');
  return cachedSecret;
}

const hashSecret = (plain) => bcrypt.hashSync(plain, BCRYPT_ROUNDS);
const verifySecret = (plain, hash) => (hash ? bcrypt.compareSync(plain, hash) : false);

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.full_name },
    sessionSecret(),
    { expiresIn: `${SESSION_HOURS}h` }
  );
}

function isSecureRequest(req) {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

/** Issue session + CSRF cookies. The CSRF cookie is deliberately readable by JS. */
function startSession(req, res, user) {
  const token = signToken(user);
  const maxAge = SESSION_HOURS * 3600 * 1000;
  const secure = isSecureRequest(req);
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, maxAge, path: '/' });
  res.cookie(CSRF_COOKIE, crypto.randomBytes(24).toString('hex'), {
    httpOnly: false, sameSite: 'lax', secure, maxAge, path: '/',
  });
  return token;
}

function endSession(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.clearCookie(CSRF_COOKIE, { path: '/' });
}

const PUBLIC_USER_COLUMNS = `
  id, full_name, email, phone, role, title, is_active, must_change_password, last_login_at, created_at
`;

function loadUser(id) {
  return get(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ? AND is_active = 1`, [id]);
}

/**
 * Attach `req.user` when a valid session is present. Does not reject — route
 * guards decide what an anonymous request is allowed to do.
 */
function authenticate(req, _res, next) {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = bearer || req.cookies?.[SESSION_COOKIE];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, sessionSecret());
    const user = loadUser(payload.sub);
    if (user) {
      req.user = user;
      req.usedBearer = Boolean(bearer);
    }
  } catch {
    // Expired or tampered token — treated as anonymous.
  }
  return next();
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF check for cookie-based sessions. Bearer tokens are exempt
 * because they are never attached automatically by a browser.
 */
function csrfGuard(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!req.user || req.usedBearer) return next();
  if (process.env.DISABLE_CSRF === 'true') return next();
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(new ApiError(403, 'Your session token expired. Refresh the page and try again.'));
  }
  return next();
}

const requireAuth = (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  return next();
};

const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden('This area is not available for your account type'));
  }
  return next();
};

// ── Record-level scoping ────────────────────────────────────────────────────
// A teacher only ever sees their own classes; a parent only their own children.
// These helpers are the single gate every scoped query passes through.

function teacherClassIds(userId) {
  return all(`SELECT class_id FROM class_teachers WHERE user_id = ?`, [userId]).map((r) => r.class_id);
}

function parentStudentIds(userId) {
  return all(`SELECT student_id FROM student_guardians WHERE user_id = ?`, [userId]).map((r) => r.student_id);
}

/** Admins pass through; teachers must be assigned to the class. */
function assertClassAccess(user, classId) {
  const id = Number(classId);
  if (!Number.isInteger(id)) throw ApiError.badRequest('A valid class is required');
  if (user.role === 'admin') return id;
  if (user.role === 'teacher' && teacherClassIds(user.id).includes(id)) return id;
  throw ApiError.forbidden('You are not assigned to this class');
}

/** Admins pass through; teachers via the student's class; parents via guardianship. */
function assertStudentAccess(user, studentId) {
  const id = Number(studentId);
  if (!Number.isInteger(id)) throw ApiError.badRequest('A valid student is required');
  const student = get(`SELECT id, class_id FROM students WHERE id = ?`, [id]);
  if (!student) throw ApiError.notFound('Student not found');
  if (user.role === 'admin') return student;
  if (user.role === 'teacher' && teacherClassIds(user.id).includes(student.class_id)) return student;
  if (user.role === 'parent' && parentStudentIds(user.id).includes(student.id)) return student;
  throw ApiError.forbidden('You do not have access to this student');
}

/** Append an entry to the audit trail. Never allowed to break the request. */
function audit(req, action, { entity, entityId, detail } = {}) {
  try {
    run(
      `INSERT INTO audit_log (user_id, actor_name, action, entity, entity_id, detail, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user?.id ?? null,
        req.user?.full_name ?? 'anonymous',
        action,
        entity ?? null,
        entityId !== undefined && entityId !== null ? String(entityId) : null,
        detail ?? null,
        req.ip ?? null,
      ]
    );
  } catch (err) {
    console.error('[audit] failed to record entry:', err.message);
  }
}

module.exports = {
  SESSION_COOKIE, CSRF_COOKIE, CSRF_HEADER, PUBLIC_USER_COLUMNS,
  hashSecret, verifySecret, startSession, endSession, loadUser,
  authenticate, csrfGuard, requireAuth, requireRole,
  teacherClassIds, parentStudentIds, assertClassAccess, assertStudentAccess, audit,
};
