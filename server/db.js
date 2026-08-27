/**
 * SQLite access layer built on sql.js (WebAssembly).
 *
 * sql.js keeps the whole database in memory and hands back a byte array on
 * export, so persistence is "serialise the file and replace it on disk". Two
 * things matter for that to be safe in production:
 *
 *   1. Writes are atomic — we render to a temp file in the same directory and
 *      rename it over the target, so a crash mid-write cannot truncate the
 *      live database.
 *   2. Bulk work does not pay per-statement serialisation cost — `transaction()`
 *      suspends persistence, runs inside a real SQL transaction, and flushes
 *      once at the end.
 *
 * The whole API is synchronous after `initDb()` resolves, which keeps route
 * handlers free of interleaving bugs.
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'maktab.db');

let db = null;
let dirty = false;
let suspendDepth = 0;

function assertReady() {
  if (!db) throw new Error('Database not initialised — await initDb() during startup');
  return db;
}

async function initDb() {
  if (db) return db;
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
    console.log(`[db] loaded ${DB_PATH}`);
  } else {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new SQL.Database();
    console.log(`[db] created new database, will persist to ${DB_PATH}`);
  }

  db.run('PRAGMA foreign_keys = ON');
  return db;
}

/** Serialise the in-memory database over the on-disk file, atomically. */
function flush() {
  if (!db || !dirty) return;
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, Buffer.from(db.export()));
    fs.renameSync(tmp, DB_PATH);
    dirty = false;
  } catch (err) {
    console.error('[db] failed to persist:', err.message);
    try { fs.unlinkSync(tmp); } catch { /* nothing to clean up */ }
  }
}

function markDirty() {
  dirty = true;
  if (suspendDepth === 0) flush();
}

/**
 * sql.js accepts either positional arrays or `:name` objects. Normalise both,
 * and coerce `undefined` to `null` so a missing optional field binds cleanly
 * instead of throwing.
 */
function bindParams(stmt, params) {
  if (params === undefined || params === null) return;
  if (Array.isArray(params)) {
    stmt.bind(params.map((val) => (val === undefined ? null : val)));
    return;
  }
  if (typeof params === 'object') {
    const named = {};
    for (const [key, val] of Object.entries(params)) {
      named[key.startsWith(':') ? key : `:${key}`] = val === undefined ? null : val;
    }
    stmt.bind(named);
    return;
  }
  stmt.bind([params]);
}

function all(sql, params) {
  const stmt = assertReady().prepare(sql);
  try {
    bindParams(stmt, params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

function get(sql, params) {
  return all(sql, params)[0] || null;
}

/** Single scalar value from the first column of the first row. */
function value(sql, params, fallback = null) {
  const row = get(sql, params);
  if (!row) return fallback;
  const first = Object.values(row)[0];
  return first === undefined ? fallback : first;
}

function run(sql, params) {
  const database = assertReady();
  const stmt = database.prepare(sql);
  try {
    bindParams(stmt, params);
    stmt.step();
  } finally {
    stmt.free();
  }
  const changes = database.getRowsModified();
  const lastID = value('SELECT last_insert_rowid() AS id', [], 0);
  markDirty();
  return { lastID, changes };
}

/** Multi-statement DDL / script execution. */
function exec(sql) {
  assertReady().exec(sql);
  markDirty();
}

/**
 * Run `fn` inside a SQL transaction with disk persistence suspended.
 * Nested calls join the outer transaction rather than opening a new one.
 */
function transaction(fn) {
  const database = assertReady();
  const outermost = suspendDepth === 0;
  suspendDepth += 1;
  if (outermost) database.run('BEGIN');
  try {
    const result = fn();
    if (outermost) database.run('COMMIT');
    return result;
  } catch (err) {
    if (outermost) {
      try { database.run('ROLLBACK'); } catch { /* transaction already unwound */ }
    }
    throw err;
  } finally {
    suspendDepth -= 1;
    if (suspendDepth === 0) flush();
  }
}

/** Flush pending writes before the process goes away. */
function installShutdownHooks() {
  let closing = false;
  const finish = (signal, code) => {
    if (closing) return;
    closing = true;
    flush();
    if (signal) {
      console.log(`[db] flushed on ${signal}`);
      process.exit(code ?? 0);
    }
  };
  process.on('exit', () => finish(null));
  process.on('SIGINT', () => finish('SIGINT', 130));
  process.on('SIGTERM', () => finish('SIGTERM', 143));
}

module.exports = {
  initDb, all, get, value, run, exec, transaction, flush, installShutdownHooks, DB_PATH,
};
