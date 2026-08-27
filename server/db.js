const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'maktab.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
  } else {
    console.log('Connected to SQLite database at', DB_PATH);
  }
});

// Promisified database helpers
const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const exec = (sql) => {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
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
      role TEXT NOT NULL, -- 'admin' or 'teacher'
      assigned_class_id INTEGER,
      pin TEXT DEFAULT '1234'
    );
  `;
  await exec(schema);
  console.log('Database schema verified/created successfully.');
}

module.exports = {
  db,
  query,
  get,
  run,
  exec,
  initSchema
};
