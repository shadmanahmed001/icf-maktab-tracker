/**
 * Schema definition and migration runner.
 *
 * Every statement is idempotent, so this runs safely on every boot against
 * both a fresh file and an existing deployment. Additive changes to existing
 * tables go through `ensureColumn` rather than a destructive rebuild.
 */
const { exec, all, transaction } = require('./db');

const SCHEMA = `
-- ── People ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name            TEXT    NOT NULL,
  email                TEXT    NOT NULL UNIQUE,
  phone                TEXT,
  role                 TEXT    NOT NULL CHECK (role IN ('admin','teacher','parent')),
  password_hash        TEXT,
  pin_hash             TEXT,
  title                TEXT,
  is_active            INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  last_login_at        TEXT,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role, is_active);

-- ── Structure ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  grade         INTEGER NOT NULL,
  gender_track  TEXT    NOT NULL DEFAULT 'general' CHECK (gender_track IN ('general','boys','girls')),
  academic_year TEXT    NOT NULL DEFAULT '2026-2027',
  room          TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_classes_grade ON classes(grade, gender_track);

CREATE TABLE IF NOT EXISTS class_teachers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  role       TEXT    NOT NULL DEFAULT 'lead' CHECK (role IN ('lead','assistant','substitute')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (class_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_class_teachers_user ON class_teachers(user_id);

CREATE TABLE IF NOT EXISTS students (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  student_code  TEXT    NOT NULL UNIQUE,
  first_name    TEXT    NOT NULL,
  last_name     TEXT    NOT NULL,
  class_id      INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  gender        TEXT    CHECK (gender IN ('male','female')),
  date_of_birth TEXT,
  enrolled_on   TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  notes         TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id, is_active);

CREATE TABLE IF NOT EXISTS student_guardians (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  relationship TEXT    NOT NULL DEFAULT 'guardian',
  is_primary   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_guardians_user ON student_guardians(user_id);

-- ── Curriculum ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS terms (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  term_number  INTEGER NOT NULL,
  title        TEXT    NOT NULL,
  date_range   TEXT    NOT NULL,
  start_date   TEXT    NOT NULL,
  end_date     TEXT    NOT NULL,
  is_current   INTEGER NOT NULL DEFAULT 0,
  is_interlude INTEGER NOT NULL DEFAULT 0,
  description  TEXT
);

CREATE TABLE IF NOT EXISTS curriculum_topics (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  grade              INTEGER NOT NULL,
  gender_track       TEXT    NOT NULL DEFAULT 'general',
  term_number        INTEGER NOT NULL,
  day_of_week        TEXT    NOT NULL,
  subject            TEXT    NOT NULL,
  topic_title        TEXT    NOT NULL,
  expected_indicator TEXT    NOT NULL,
  sequence_order     INTEGER NOT NULL DEFAULT 1,
  is_active          INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_topics_lookup ON curriculum_topics(grade, term_number, gender_track);

CREATE TABLE IF NOT EXISTS memorization_standards (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  grade          INTEGER NOT NULL,
  term_number    INTEGER NOT NULL,
  surah          TEXT    NOT NULL,
  dua            TEXT    NOT NULL,
  names_of_allah TEXT    NOT NULL,
  UNIQUE (grade, term_number)
);

-- ── Daily practice ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lesson_logs (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id              INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  topic_id              INTEGER REFERENCES curriculum_topics(id) ON DELETE SET NULL,
  date                  TEXT    NOT NULL,
  day_of_week           TEXT    NOT NULL,
  subject               TEXT    NOT NULL,
  session_type          TEXT    NOT NULL DEFAULT 'standard_lesson',
  teacher_id            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  teacher_name          TEXT    NOT NULL,
  topic_covered         TEXT    NOT NULL,
  expected_indicator    TEXT,
  memorization_covered  TEXT,
  status                TEXT    NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','partial','not_taught')),
  class_mastery         TEXT    NOT NULL DEFAULT 'secure' CHECK (class_mastery IN ('emerging','developing','secure','mastered')),
  notes                 TEXT,
  handover_note         TEXT,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_logs_class_date ON lesson_logs(class_id, date);
CREATE INDEX IF NOT EXISTS idx_logs_date ON lesson_logs(date);

CREATE TABLE IF NOT EXISTS attendance (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id     INTEGER NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
  date         TEXT    NOT NULL,
  status       TEXT    NOT NULL CHECK (status IN ('present','late','absent','excused')),
  minutes_late INTEGER NOT NULL DEFAULT 0,
  note         TEXT,
  recorded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id, date);

CREATE TABLE IF NOT EXISTS assessments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  term_number   INTEGER NOT NULL,
  subject       TEXT    NOT NULL,
  mastery_level TEXT    NOT NULL CHECK (mastery_level IN ('emerging','developing','secure','mastered')),
  comment       TEXT,
  assessed_on   TEXT    NOT NULL,
  recorded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, term_number, subject)
);
CREATE INDEX IF NOT EXISTS idx_assessments_student ON assessments(student_id, term_number);

CREATE TABLE IF NOT EXISTS memorization_progress (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  term_number INTEGER NOT NULL,
  item_type   TEXT    NOT NULL CHECK (item_type IN ('surah','dua','names')),
  item_label  TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','mastered')),
  verified_on TEXT,
  recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, term_number, item_type)
);
CREATE INDEX IF NOT EXISTS idx_mem_progress_student ON memorization_progress(student_id, term_number);

CREATE TABLE IF NOT EXISTS homework (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id      INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject       TEXT    NOT NULL,
  title         TEXT    NOT NULL,
  instructions  TEXT,
  assigned_date TEXT    NOT NULL,
  due_date      TEXT,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_homework_class ON homework(class_id, assigned_date);

-- ── Communication ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL,
  audience   TEXT    NOT NULL DEFAULT 'all' CHECK (audience IN ('all','teachers','parents','class')),
  class_id   INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  is_pinned  INTEGER NOT NULL DEFAULT 0,
  publish_on TEXT    NOT NULL DEFAULT (date('now')),
  expires_on TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS message_threads (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id      INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  parent_id       INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  subject         TEXT    NOT NULL DEFAULT 'General',
  last_message_at TEXT    NOT NULL DEFAULT (datetime('now')),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, teacher_id, parent_id)
);
CREATE INDEX IF NOT EXISTS idx_threads_participants ON message_threads(teacher_id, parent_id);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id  INTEGER NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, id);

CREATE TABLE IF NOT EXISTS thread_reads (
  thread_id    INTEGER NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (thread_id, user_id)
);

-- ── Operations ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_name TEXT,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  detail     TEXT,
  ip         TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/** Add a column to an existing table only when it is missing. */
function ensureColumn(table, column, definition) {
  const tableExists = all(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, [table]
  ).length > 0;
  if (!tableExists) return;
  const columns = all(`PRAGMA table_info(${table})`).map((c) => c.name);
  if (columns.includes(column)) return;
  exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`[db] migrated: ${table}.${column} added`);
}

/**
 * Additive migrations for databases created by an earlier release. Listed
 * explicitly so an upgrade never silently depends on a column that a running
 * deployment does not have.
 */
const MIGRATIONS = [
  ['users', 'title', 'TEXT'],
  ['users', 'phone', 'TEXT'],
  ['users', 'pin_hash', 'TEXT'],
  ['users', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0'],
  ['users', 'last_login_at', 'TEXT'],
  ['classes', 'academic_year', "TEXT NOT NULL DEFAULT '2026-2027'"],
  ['classes', 'is_active', 'INTEGER NOT NULL DEFAULT 1'],
  ['lesson_logs', 'teacher_id', 'INTEGER'],
  ['lesson_logs', 'handover_note', 'TEXT'],
  ['lesson_logs', 'class_mastery', "TEXT NOT NULL DEFAULT 'secure'"],
  ['curriculum_topics', 'is_active', 'INTEGER NOT NULL DEFAULT 1'],
];

function migrate() {
  transaction(() => {
    exec(SCHEMA);
    for (const [table, column, definition] of MIGRATIONS) {
      ensureColumn(table, column, definition);
    }
  });
  console.log('[db] schema verified');
}

module.exports = { migrate, SCHEMA };
