/** Shared HTTP helpers: typed errors, handler wrapping, and input validation. */

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
  static badRequest(message, details) { return new ApiError(400, message, details); }
  static unauthorized(message = 'Sign in to continue') { return new ApiError(401, message); }
  static forbidden(message = 'You do not have access to this record') { return new ApiError(403, message); }
  static notFound(message = 'Not found') { return new ApiError(404, message); }
  static conflict(message, details) { return new ApiError(409, message, details); }
}

/** Wrap a route handler so thrown errors (sync or async) reach the error middleware. */
const handler = (fn) => (req, res, next) => {
  try {
    const result = fn(req, res, next);
    if (result && typeof result.catch === 'function') result.catch(next);
  } catch (err) {
    next(err);
  }
};

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });

// ── Validation ──────────────────────────────────────────────────────────────
// Small hand-rolled validators. Every mutating endpoint runs its body through
// `fields()` so a malformed request fails with a 400 naming the field rather
// than a 500 from SQLite.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const v = {
  string: (opts = {}) => (value, field) => {
    if (value === undefined || value === null || value === '') {
      if (opts.optional) return opts.default ?? null;
      throw ApiError.badRequest(`"${field}" is required`);
    }
    const str = String(value).trim();
    if (opts.max && str.length > opts.max) {
      throw ApiError.badRequest(`"${field}" must be at most ${opts.max} characters`);
    }
    if (opts.min && str.length < opts.min) {
      throw ApiError.badRequest(`"${field}" must be at least ${opts.min} characters`);
    }
    return str;
  },
  email: (opts = {}) => (value, field) => {
    const str = v.string(opts)(value, field);
    if (str === null) return null;
    if (!EMAIL_RE.test(str)) throw ApiError.badRequest(`"${field}" must be a valid email address`);
    return str.toLowerCase();
  },
  int: (opts = {}) => (value, field) => {
    if (value === undefined || value === null || value === '') {
      if (opts.optional) return opts.default ?? null;
      throw ApiError.badRequest(`"${field}" is required`);
    }
    const num = Number(value);
    if (!Number.isInteger(num)) throw ApiError.badRequest(`"${field}" must be a whole number`);
    if (opts.min !== undefined && num < opts.min) throw ApiError.badRequest(`"${field}" must be at least ${opts.min}`);
    if (opts.max !== undefined && num > opts.max) throw ApiError.badRequest(`"${field}" must be at most ${opts.max}`);
    return num;
  },
  bool: (opts = {}) => (value, field) => {
    if (value === undefined || value === null || value === '') {
      if (opts.optional) return opts.default ?? 0;
      throw ApiError.badRequest(`"${field}" is required`);
    }
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value === 1 || value === '1' || value === 'true') return 1;
    if (value === 0 || value === '0' || value === 'false') return 0;
    throw ApiError.badRequest(`"${field}" must be true or false`);
  },
  date: (opts = {}) => (value, field) => {
    const str = v.string(opts)(value, field);
    if (str === null) return null;
    if (!DATE_RE.test(str)) throw ApiError.badRequest(`"${field}" must be a YYYY-MM-DD date`);
    return str;
  },
  enum: (values, opts = {}) => (value, field) => {
    const str = v.string(opts)(value, field);
    if (str === null) return null;
    if (!values.includes(str)) {
      throw ApiError.badRequest(`"${field}" must be one of: ${values.join(', ')}`);
    }
    return str;
  },
  array: (itemValidator, opts = {}) => (value, field) => {
    if (value === undefined || value === null) {
      if (opts.optional) return opts.default ?? [];
      throw ApiError.badRequest(`"${field}" is required`);
    }
    if (!Array.isArray(value)) throw ApiError.badRequest(`"${field}" must be an array`);
    if (opts.max && value.length > opts.max) {
      throw ApiError.badRequest(`"${field}" may contain at most ${opts.max} items`);
    }
    return value.map((item, i) => itemValidator(item, `${field}[${i}]`));
  },
  /** Nested object shape, validated with the same field map syntax. */
  shape: (map, opts = {}) => (value, field) => {
    if (value === undefined || value === null) {
      if (opts.optional) return opts.default ?? null;
      throw ApiError.badRequest(`"${field}" is required`);
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw ApiError.badRequest(`"${field}" must be an object`);
    }
    return fields(value, map, field);
  },
};

/** Apply a `{ field: validator }` map to a payload, returning a clean object. */
function fields(payload, map, prefix = '') {
  const source = payload && typeof payload === 'object' ? payload : {};
  const out = {};
  for (const [key, validator] of Object.entries(map)) {
    out[key] = validator(source[key], prefix ? `${prefix}.${key}` : key);
  }
  return out;
}

module.exports = { ApiError, handler, ok, v, fields };
