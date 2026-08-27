const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'maktab.db');

let dbInstance = null;

async function getDb() {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const filebuffer = fs.readFileSync(DB_PATH);
    dbInstance = new SQL.Database(filebuffer);
    console.log('Loaded existing SQLite database from', DB_PATH);
  } else {
    dbInstance = new SQL.Database();
    console.log('Created new SQLite database in memory, will persist to', DB_PATH);
  }
  return dbInstance;
}

function saveDb() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Failed to persist database to disk:', err);
  }
}

// Convert params to array format for sql.js
function formatParams(params) {
  if (!params) return [];
  if (Array.isArray(params)) return params;
  return [params];
}

const query = async (sql, params = []) => {
  const db = await getDb();
  const stmt = db.prepare(sql);
  stmt.bind(formatParams(params));
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
};

const get = async (sql, params = []) => {
  const rows = await query(sql, params);
  return rows[0] || null;
};

const run = async (sql, params = []) => {
  const db = await getDb();
  db.run(sql, formatParams(params));
  saveDb();
  // Get last insert rowid
  const lastIdRes = db.exec("SELECT last_insert_rowid() AS id");
  const lastID = lastIdRes.length > 0 && lastIdRes[0].values.length > 0 ? lastIdRes[0].values[0][0] : 0;
  return { lastID, changes: 1 };
};

const exec = async (sql) => {
  const db = await getDb();
  db.exec(sql);
  saveDb();
};

async function initSchema() {
  const schema = `
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      grade INTEGER NOT NULL,
      gender_track TEXT DEFAULT 'general',
      teacher_name TEXT NOT NULL,
      room TEXT,
      student_count INTEGER DEFAULT 15,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS terms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      date_range TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_current INTEGER DEFAULT 0,
      is_interlude INTEGER DEFAULT 0,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS curriculum_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grade INTEGER NOT NULL,
      gender_track TEXT DEFAULT 'general',
      term_number INTEGER NOT NULL,
      day_of_week TEXT NOT NULL,
      subject TEXT NOT NULL,
      topic_title TEXT NOT NULL,
      expected_indicator TEXT NOT NULL,
      sequence_order INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS memorization_standards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grade INTEGER NOT NULL,
      term_number INTEGER NOT NULL,
      surah TEXT NOT NULL,
      dua TEXT NOT NULL,
      names_of_allah TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lesson_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      topic_id INTEGER,
      date TEXT NOT NULL,
      day_of_week TEXT NOT NULL,
      subject TEXT NOT NULL,
      session_type TEXT DEFAULT 'standard_lesson',
      teacher_name TEXT NOT NULL,
      topic_covered TEXT NOT NULL,
      expected_indicator TEXT,
      memorization_covered TEXT,
      status TEXT DEFAULT 'completed',
      mastery_level TEXT DEFAULT 'mastered',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (topic_id) REFERENCES curriculum_topics(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      role TEXT NOT NULL,
      assigned_class_id INTEGER,
      pin TEXT DEFAULT '1234'
    );
  `;
  await exec(schema);
  console.log('Database schema verified/created successfully via pure WASM SQLite.');
}

module.exports = {
  getDb,
  query,
  get,
  run,
  exec,
  initSchema
};
