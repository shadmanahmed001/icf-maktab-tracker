/**
 * Administrator API: school-wide oversight plus every management operation.
 * Mounted behind requireRole('admin'), so no handler here re-checks the role.
 */
const express = require('express');
const crypto = require('crypto');
const { all, get, run, transaction, value } = require('../db');
const { handler, ok, v, fields, ApiError } = require('../util/http');
const { hashSecret, audit, PUBLIC_USER_COLUMNS } = require('../auth');
const {
  getCurrentTerm, getTerm, getTerms, schoolPacing, classProgress,
  weeklyMatrix, weekStart, attendanceSummary, studentReportCard,
} = require('../services/pacing');
const { todayISO, addDays, dayName, subjectForDate, ALL_SUBJECTS } = require('../util/dates');

const router = express.Router();

// ── Dashboard ───────────────────────────────────────────────────────────────

router.get('/dashboard', handler((req, res) => {
  const today = todayISO();
  const term = getCurrentTerm(today);
  if (!term) throw ApiError.notFound('No academic terms are configured yet');

  const pacing = schoolPacing(term, today);
  const monday = weekStart(today);

  const stats = {
    classes: pacing.length,
    students: value(`SELECT COUNT(*) FROM students WHERE is_active = 1`, [], 0),
    teachers: value(`SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active = 1`, [], 0),
    parents: value(`SELECT COUNT(*) FROM users WHERE role = 'parent' AND is_active = 1`, [], 0),
    logsThisWeek: value(
      `SELECT COUNT(*) FROM lesson_logs WHERE date BETWEEN ? AND ?`, [monday, addDays(monday, 4)], 0
    ),
    logsTotal: value(`SELECT COUNT(*) FROM lesson_logs`, [], 0),
    onTrack: pacing.filter((p) => p.pacingStatus === 'on_track').length,
    watch: pacing.filter((p) => p.pacingStatus === 'watch').length,
    behind: pacing.filter((p) => p.pacingStatus === 'behind').length,
    notStarted: pacing.filter((p) => p.pacingStatus === 'not_started').length,
  };

  // Which classes have not logged today's strand yet — the actionable list.
  const expectedSubject = subjectForDate(today, term.term_number);
  const loggedTodayClassIds = new Set(
    all(`SELECT DISTINCT class_id FROM lesson_logs WHERE date = ?`, [today]).map((r) => r.class_id)
  );
  const missingToday = expectedSubject
    ? pacing
      .filter((p) => !loggedTodayClassIds.has(p.class.id))
      .map((p) => ({ id: p.class.id, name: p.class.name, teachers: p.class.teachers }))
    : [];

  const attendanceToday = attendanceSummary({ from: today, to: today });
  const attendanceTerm = attendanceSummary({ from: term.start_date, to: term.end_date });

  const recentActivity = all(
    `SELECT l.id, l.date, l.day_of_week, l.subject, l.session_type, l.topic_covered,
            l.status, l.class_mastery, l.teacher_name, l.notes, c.name AS class_name, c.grade
       FROM lesson_logs l JOIN classes c ON c.id = l.class_id
      ORDER BY l.date DESC, l.id DESC LIMIT 20`
  );

  const strandCoverage = ALL_SUBJECTS.map((subject) => ({
    subject,
    logged: value(
      `SELECT COUNT(*) FROM lesson_logs WHERE subject = ? AND date BETWEEN ? AND ?`,
      [subject, term.start_date, term.end_date], 0
    ),
  })).filter((s) => s.logged > 0 || ['Fiqh', 'Aḥādīth', "ʿAqā'id"].includes(s.subject));

  return ok(res, {
    today,
    dayName: dayName(today),
    expectedSubject,
    term,
    terms: getTerms(),
    stats,
    pacing,
    missingToday,
    attendanceToday,
    attendanceTerm,
    recentActivity,
    strandCoverage,
  });
}));

// ── Classes ─────────────────────────────────────────────────────────────────

router.get('/classes', handler((req, res) => {
  const classes = all(`SELECT * FROM classes ORDER BY grade ASC, gender_track ASC`);
  const enriched = classes.map((c) => ({
    ...c,
    student_count: value(`SELECT COUNT(*) FROM students WHERE class_id = ? AND is_active = 1`, [c.id], 0),
    log_count: value(`SELECT COUNT(*) FROM lesson_logs WHERE class_id = ?`, [c.id], 0),
    last_logged_date: value(`SELECT MAX(date) FROM lesson_logs WHERE class_id = ?`, [c.id]),
    teachers: all(
      `SELECT u.id, u.full_name, u.email, ct.role
         FROM class_teachers ct JOIN users u ON u.id = ct.user_id
        WHERE ct.class_id = ? ORDER BY CASE ct.role WHEN 'lead' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END, u.full_name ASC`,
      [c.id]
    ),
  }));
  return ok(res, enriched);
}));

const classFields = {
  name: v.string({ max: 80 }),
  grade: v.int({ min: 1, max: 12 }),
  gender_track: v.enum(['general', 'boys', 'girls'], { optional: true, default: 'general' }),
  academic_year: v.string({ optional: true, default: '2026-2027', max: 20 }),
  room: v.string({ optional: true, max: 40 }),
  is_active: v.bool({ optional: true, default: 1 }),
};

router.post('/classes', handler((req, res) => {
  const body = fields(req.body, classFields);
  const result = run(
    `INSERT INTO classes (name, grade, gender_track, academic_year, room, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [body.name, body.grade, body.gender_track, body.academic_year, body.room, body.is_active]
  );
  audit(req, 'class.created', { entity: 'class', entityId: result.lastID, detail: body.name });
  return ok(res, get(`SELECT * FROM classes WHERE id = ?`, [result.lastID]));
}));

router.patch('/classes/:id', handler((req, res) => {
  const id = Number(req.params.id);
  const existing = get(`SELECT * FROM classes WHERE id = ?`, [id]);
  if (!existing) throw ApiError.notFound('Class not found');
  const body = fields({ ...existing, ...req.body }, classFields);
  run(
    `UPDATE classes SET name = ?, grade = ?, gender_track = ?, academic_year = ?, room = ?, is_active = ?
      WHERE id = ?`,
    [body.name, body.grade, body.gender_track, body.academic_year, body.room, body.is_active, id]
  );
  audit(req, 'class.updated', { entity: 'class', entityId: id, detail: body.name });
  return ok(res, get(`SELECT * FROM classes WHERE id = ?`, [id]));
}));

/**
 * Classes are archived rather than deleted: lesson logs and attendance history
 * for previous years must stay intact and auditable.
 */
router.delete('/classes/:id', handler((req, res) => {
  const id = Number(req.params.id);
  if (!get(`SELECT id FROM classes WHERE id = ?`, [id])) throw ApiError.notFound('Class not found');
  const remaining = value(`SELECT COUNT(*) FROM students WHERE class_id = ? AND is_active = 1`, [id], 0);
  if (remaining > 0) {
    throw ApiError.conflict(
      `Move the ${remaining} enrolled student${remaining === 1 ? '' : 's'} to another class before archiving this one`
    );
  }
  run(`UPDATE classes SET is_active = 0 WHERE id = ?`, [id]);
  audit(req, 'class.archived', { entity: 'class', entityId: id });
  return ok(res, { archived: true });
}));

/** Class detail: progress, week matrix, roster and recent logs in one payload. */
router.get('/classes/:id/detail', handler((req, res) => {
  const id = Number(req.params.id);
  const classRow = get(`SELECT * FROM classes WHERE id = ?`, [id]);
  if (!classRow) throw ApiError.notFound('Class not found');

  const term = req.query.term_number ? getTerm(Number(req.query.term_number)) : getCurrentTerm();
  const today = todayISO();

  return ok(res, {
    progress: classProgress(classRow, term, today),
    week: weeklyMatrix(id, weekStart(today), term.term_number),
    roster: all(
      `SELECT s.*, 
              (SELECT status FROM attendance a WHERE a.student_id = s.id AND a.date = ?) AS attendance_today
         FROM students s WHERE s.class_id = ? AND s.is_active = 1
        ORDER BY s.first_name ASC`,
      [today, id]
    ),
    logs: all(
      `SELECT * FROM lesson_logs WHERE class_id = ? ORDER BY date DESC, id DESC LIMIT 40`, [id]
    ),
    attendance: attendanceSummary({ classId: id, from: term.start_date, to: term.end_date }),
    term,
  });
}));

router.post('/classes/:id/teachers', handler((req, res) => {
  const classId = Number(req.params.id);
  if (!get(`SELECT id FROM classes WHERE id = ?`, [classId])) throw ApiError.notFound('Class not found');
  const body = fields(req.body, {
    user_id: v.int({ min: 1 }),
    role: v.enum(['lead', 'assistant', 'substitute'], { optional: true, default: 'lead' }),
  });
  const teacher = get(`SELECT id, role, full_name FROM users WHERE id = ?`, [body.user_id]);
  if (!teacher) throw ApiError.notFound('Staff member not found');
  if (teacher.role !== 'teacher') throw ApiError.badRequest('Only teacher accounts can be assigned to a class');

  run(
    `INSERT INTO class_teachers (class_id, user_id, role) VALUES (?, ?, ?)
     ON CONFLICT(class_id, user_id) DO UPDATE SET role = excluded.role`,
    [classId, body.user_id, body.role]
  );
  audit(req, 'class.teacher_assigned', { entity: 'class', entityId: classId, detail: teacher.full_name });
  return ok(res, { assigned: true });
}));

router.delete('/classes/:id/teachers/:userId', handler((req, res) => {
  run(`DELETE FROM class_teachers WHERE class_id = ? AND user_id = ?`,
    [Number(req.params.id), Number(req.params.userId)]);
  audit(req, 'class.teacher_unassigned', { entity: 'class', entityId: req.params.id, detail: req.params.userId });
  return ok(res, { removed: true });
}));

// ── Students ────────────────────────────────────────────────────────────────

router.get('/students', handler((req, res) => {
  const clauses = [];
  const params = [];
  if (req.query.class_id) { clauses.push('s.class_id = ?'); params.push(Number(req.query.class_id)); }
  if (req.query.include_inactive !== 'true') clauses.push('s.is_active = 1');
  if (req.query.q) {
    clauses.push(`(s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_code LIKE ?)`);
    const like = `%${String(req.query.q)}%`;
    params.push(like, like, like);
  }

  const students = all(
    `SELECT s.*, c.name AS class_name, c.grade, c.gender_track
       FROM students s LEFT JOIN classes c ON c.id = s.class_id
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY c.grade ASC, s.first_name ASC
      LIMIT 500`,
    params
  );

  const withGuardians = students.map((s) => ({
    ...s,
    guardians: all(
      `SELECT u.id, u.full_name, u.email, u.phone, sg.relationship, sg.is_primary
         FROM student_guardians sg JOIN users u ON u.id = sg.user_id
        WHERE sg.student_id = ? ORDER BY sg.is_primary DESC`,
      [s.id]
    ),
  }));

  return ok(res, withGuardians);
}));

const studentFields = {
  first_name: v.string({ max: 60 }),
  last_name: v.string({ max: 60 }),
  class_id: v.int({ optional: true, min: 1 }),
  gender: v.enum(['male', 'female'], { optional: true }),
  date_of_birth: v.date({ optional: true }),
  enrolled_on: v.date({ optional: true }),
  notes: v.string({ optional: true, max: 1000 }),
  is_active: v.bool({ optional: true, default: 1 }),
};

/** Sequential student code, e.g. ICF-0043. */
function nextStudentCode() {
  const highest = value(
    `SELECT MAX(CAST(substr(student_code, 5) AS INTEGER)) FROM students WHERE student_code LIKE 'ICF-%'`,
    [], 0
  ) || 0;
  return `ICF-${String(highest + 1).padStart(4, '0')}`;
}

router.post('/students', handler((req, res) => {
  const body = fields(req.body, studentFields);
  if (body.class_id && !get(`SELECT id FROM classes WHERE id = ?`, [body.class_id])) {
    throw ApiError.badRequest('That class does not exist');
  }
  const code = req.body.student_code
    ? v.string({ max: 20 })(req.body.student_code, 'student_code')
    : nextStudentCode();
  if (get(`SELECT id FROM students WHERE student_code = ?`, [code])) {
    throw ApiError.conflict(`Student code ${code} is already in use`);
  }

  const result = run(
    `INSERT INTO students (student_code, first_name, last_name, class_id, gender, date_of_birth, enrolled_on, notes, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [code, body.first_name, body.last_name, body.class_id, body.gender,
      body.date_of_birth, body.enrolled_on || todayISO(), body.notes, body.is_active]
  );
  audit(req, 'student.created', {
    entity: 'student', entityId: result.lastID, detail: `${body.first_name} ${body.last_name}`,
  });
  return ok(res, get(`SELECT * FROM students WHERE id = ?`, [result.lastID]));
}));

router.patch('/students/:id', handler((req, res) => {
  const id = Number(req.params.id);
  const existing = get(`SELECT * FROM students WHERE id = ?`, [id]);
  if (!existing) throw ApiError.notFound('Student not found');
  const body = fields({ ...existing, ...req.body }, studentFields);
  run(
    `UPDATE students SET first_name = ?, last_name = ?, class_id = ?, gender = ?,
            date_of_birth = ?, enrolled_on = ?, notes = ?, is_active = ?, updated_at = datetime('now')
      WHERE id = ?`,
    [body.first_name, body.last_name, body.class_id, body.gender,
      body.date_of_birth, body.enrolled_on, body.notes, body.is_active, id]
  );
  audit(req, 'student.updated', { entity: 'student', entityId: id });
  return ok(res, get(`SELECT * FROM students WHERE id = ?`, [id]));
}));

/** Withdraw a student without discarding their academic record. */
router.delete('/students/:id', handler((req, res) => {
  const id = Number(req.params.id);
  if (!get(`SELECT id FROM students WHERE id = ?`, [id])) throw ApiError.notFound('Student not found');
  run(`UPDATE students SET is_active = 0, updated_at = datetime('now') WHERE id = ?`, [id]);
  audit(req, 'student.withdrawn', { entity: 'student', entityId: id });
  return ok(res, { withdrawn: true });
}));

router.get('/students/:id/detail', handler((req, res) => {
  const id = Number(req.params.id);
  const term = req.query.term_number ? getTerm(Number(req.query.term_number)) : getCurrentTerm();
  const card = studentReportCard(id, term.term_number);
  if (!card) throw ApiError.notFound('Student not found');
  return ok(res, {
    ...card,
    guardians: all(
      `SELECT u.id, u.full_name, u.email, u.phone, sg.relationship, sg.is_primary
         FROM student_guardians sg JOIN users u ON u.id = sg.user_id
        WHERE sg.student_id = ? ORDER BY sg.is_primary DESC`,
      [id]
    ),
    attendanceRecent: all(
      `SELECT date, status, minutes_late, note FROM attendance
        WHERE student_id = ? ORDER BY date DESC LIMIT 30`,
      [id]
    ),
  });
}));

router.post('/students/:id/guardians', handler((req, res) => {
  const studentId = Number(req.params.id);
  if (!get(`SELECT id FROM students WHERE id = ?`, [studentId])) throw ApiError.notFound('Student not found');
  const body = fields(req.body, {
    user_id: v.int({ min: 1 }),
    relationship: v.string({ optional: true, default: 'guardian', max: 40 }),
    is_primary: v.bool({ optional: true, default: 0 }),
  });
  const parent = get(`SELECT id, role, full_name FROM users WHERE id = ?`, [body.user_id]);
  if (!parent) throw ApiError.notFound('Parent account not found');
  if (parent.role !== 'parent') throw ApiError.badRequest('Only parent accounts can be linked as guardians');

  run(
    `INSERT INTO student_guardians (student_id, user_id, relationship, is_primary) VALUES (?, ?, ?, ?)
     ON CONFLICT(student_id, user_id) DO UPDATE SET relationship = excluded.relationship, is_primary = excluded.is_primary`,
    [studentId, body.user_id, body.relationship, body.is_primary]
  );
  audit(req, 'student.guardian_linked', { entity: 'student', entityId: studentId, detail: parent.full_name });
  return ok(res, { linked: true });
}));

router.delete('/students/:id/guardians/:userId', handler((req, res) => {
  run(`DELETE FROM student_guardians WHERE student_id = ? AND user_id = ?`,
    [Number(req.params.id), Number(req.params.userId)]);
  audit(req, 'student.guardian_unlinked', { entity: 'student', entityId: req.params.id });
  return ok(res, { removed: true });
}));

// ── Staff and parent accounts ───────────────────────────────────────────────

router.get('/users', handler((req, res) => {
  const clauses = [];
  const params = [];
  if (req.query.role) { clauses.push('u.role = ?'); params.push(String(req.query.role)); }
  if (req.query.include_inactive !== 'true') clauses.push('u.is_active = 1');
  if (req.query.q) {
    clauses.push('(u.full_name LIKE ? OR u.email LIKE ?)');
    const like = `%${String(req.query.q)}%`;
    params.push(like, like);
  }

  const users = all(
    `SELECT ${PUBLIC_USER_COLUMNS.split(',').map((c) => `u.${c.trim()}`).join(', ')}
       FROM users u ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY u.role ASC, u.full_name ASC LIMIT 500`,
    params
  );

  return ok(res, users.map((u) => ({
    ...u,
    classes: u.role === 'teacher' ? all(
      `SELECT c.id, c.name, ct.role FROM class_teachers ct JOIN classes c ON c.id = ct.class_id
        WHERE ct.user_id = ? ORDER BY c.grade ASC`, [u.id]
    ) : [],
    children: u.role === 'parent' ? all(
      `SELECT s.id, s.first_name, s.last_name, c.name AS class_name, sg.relationship
         FROM student_guardians sg JOIN students s ON s.id = sg.student_id
         LEFT JOIN classes c ON c.id = s.class_id
        WHERE sg.user_id = ? ORDER BY s.first_name ASC`, [u.id]
    ) : [],
  })));
}));

/** Readable temporary credential handed to the admin to pass on. */
function generateTempPassword() {
  const words = ['Fajr', 'Duha', 'Asr', 'Maghrib', 'Isha', 'Noor', 'Sabr', 'Amana', 'Hikma', 'Rahma'];
  const word = words[crypto.randomInt(words.length)];
  return `${word}-${crypto.randomInt(1000, 9999)}`;
}

router.post('/users', handler((req, res) => {
  const body = fields(req.body, {
    full_name: v.string({ max: 120 }),
    email: v.email({ max: 160 }),
    role: v.enum(['admin', 'teacher', 'parent']),
    phone: v.string({ optional: true, max: 40 }),
    title: v.string({ optional: true, max: 60 }),
    pin: v.string({ optional: true, min: 4, max: 12 }),
  });
  if (get(`SELECT id FROM users WHERE lower(email) = lower(?)`, [body.email])) {
    throw ApiError.conflict('An account with that email address already exists');
  }

  const tempPassword = req.body.password
    ? v.string({ min: 8, max: 200 })(req.body.password, 'password')
    : generateTempPassword();

  const result = run(
    `INSERT INTO users (full_name, email, phone, role, title, password_hash, pin_hash, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [body.full_name, body.email, body.phone, body.role, body.title,
      hashSecret(tempPassword), body.pin ? hashSecret(body.pin) : null]
  );
  audit(req, 'user.created', { entity: 'user', entityId: result.lastID, detail: `${body.role}: ${body.email}` });

  // The temporary password is shown once, here, and never stored in the clear.
  return ok(res, {
    user: get(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ?`, [result.lastID]),
    temporaryPassword: tempPassword,
  });
}));

router.patch('/users/:id', handler((req, res) => {
  const id = Number(req.params.id);
  const existing = get(`SELECT * FROM users WHERE id = ?`, [id]);
  if (!existing) throw ApiError.notFound('Account not found');
  const body = fields({ ...existing, ...req.body }, {
    full_name: v.string({ max: 120 }),
    email: v.email({ max: 160 }),
    phone: v.string({ optional: true, max: 40 }),
    title: v.string({ optional: true, max: 60 }),
    role: v.enum(['admin', 'teacher', 'parent']),
    is_active: v.bool({ optional: true, default: 1 }),
  });

  const clash = get(`SELECT id FROM users WHERE lower(email) = lower(?) AND id != ?`, [body.email, id]);
  if (clash) throw ApiError.conflict('Another account already uses that email address');

  // Guard against locking every administrator out of the system.
  if (existing.role === 'admin' && (body.role !== 'admin' || !body.is_active)) {
    const otherAdmins = value(
      `SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1 AND id != ?`, [id], 0
    );
    if (otherAdmins === 0) throw ApiError.conflict('At least one active administrator account must remain');
  }

  run(
    `UPDATE users SET full_name = ?, email = ?, phone = ?, title = ?, role = ?, is_active = ?,
            updated_at = datetime('now') WHERE id = ?`,
    [body.full_name, body.email, body.phone, body.title, body.role, body.is_active, id]
  );
  audit(req, 'user.updated', { entity: 'user', entityId: id, detail: body.email });
  return ok(res, get(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ?`, [id]));
}));

router.post('/users/:id/reset-password', handler((req, res) => {
  const id = Number(req.params.id);
  const account = get(`SELECT id, email FROM users WHERE id = ?`, [id]);
  if (!account) throw ApiError.notFound('Account not found');
  const tempPassword = generateTempPassword();
  run(
    `UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = datetime('now') WHERE id = ?`,
    [hashSecret(tempPassword), id]
  );
  audit(req, 'user.password_reset', { entity: 'user', entityId: id, detail: account.email });
  return ok(res, { temporaryPassword: tempPassword });
}));

router.post('/users/:id/set-pin', handler((req, res) => {
  const id = Number(req.params.id);
  const account = get(`SELECT id, role FROM users WHERE id = ?`, [id]);
  if (!account) throw ApiError.notFound('Account not found');
  const body = fields(req.body, { pin: v.string({ min: 4, max: 12 }) });
  if (!/^\d+$/.test(body.pin)) throw ApiError.badRequest('A PIN must contain digits only');
  run(`UPDATE users SET pin_hash = ?, updated_at = datetime('now') WHERE id = ?`,
    [hashSecret(body.pin), id]);
  audit(req, 'user.pin_set', { entity: 'user', entityId: id });
  return ok(res, { updated: true });
}));

// ── Terms ───────────────────────────────────────────────────────────────────

router.post('/terms/set-current', handler((req, res) => {
  const body = fields(req.body, { term_number: v.int({ min: 0, max: 8 }) });
  const term = getTerm(body.term_number);
  if (!term) throw ApiError.notFound('That term does not exist');
  transaction(() => {
    run(`UPDATE terms SET is_current = 0`);
    run(`UPDATE terms SET is_current = 1 WHERE term_number = ?`, [body.term_number]);
  });
  audit(req, 'term.set_current', { entity: 'term', entityId: term.id, detail: term.title });
  return ok(res, getCurrentTerm());
}));

router.patch('/terms/:id', handler((req, res) => {
  const id = Number(req.params.id);
  const existing = get(`SELECT * FROM terms WHERE id = ?`, [id]);
  if (!existing) throw ApiError.notFound('Term not found');
  const body = fields({ ...existing, ...req.body }, {
    title: v.string({ max: 80 }),
    date_range: v.string({ max: 120 }),
    start_date: v.date(),
    end_date: v.date(),
    description: v.string({ optional: true, max: 500 }),
    is_interlude: v.bool({ optional: true, default: 0 }),
  });
  if (body.end_date < body.start_date) {
    throw ApiError.badRequest('The term end date must fall on or after its start date');
  }
  run(
    `UPDATE terms SET title = ?, date_range = ?, start_date = ?, end_date = ?, description = ?, is_interlude = ?
      WHERE id = ?`,
    [body.title, body.date_range, body.start_date, body.end_date, body.description, body.is_interlude, id]
  );
  audit(req, 'term.updated', { entity: 'term', entityId: id, detail: body.title });
  return ok(res, get(`SELECT * FROM terms WHERE id = ?`, [id]));
}));

// ── Curriculum management ───────────────────────────────────────────────────

const topicFields = {
  grade: v.int({ min: 1, max: 12 }),
  gender_track: v.enum(['general', 'boys', 'girls'], { optional: true, default: 'general' }),
  term_number: v.int({ min: 0, max: 8 }),
  day_of_week: v.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], { optional: true, default: 'Monday' }),
  subject: v.string({ max: 40 }),
  topic_title: v.string({ max: 400 }),
  expected_indicator: v.string({ max: 400 }),
  sequence_order: v.int({ optional: true, default: 1, min: 1, max: 99 }),
  is_active: v.bool({ optional: true, default: 1 }),
};

router.post('/curriculum-topics', handler((req, res) => {
  const body = fields(req.body, topicFields);
  const result = run(
    `INSERT INTO curriculum_topics
       (grade, gender_track, term_number, day_of_week, subject, topic_title, expected_indicator, sequence_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [body.grade, body.gender_track, body.term_number, body.day_of_week, body.subject,
      body.topic_title, body.expected_indicator, body.sequence_order, body.is_active]
  );
  audit(req, 'curriculum.topic_created', { entity: 'topic', entityId: result.lastID, detail: body.topic_title });
  return ok(res, get(`SELECT * FROM curriculum_topics WHERE id = ?`, [result.lastID]));
}));

router.patch('/curriculum-topics/:id', handler((req, res) => {
  const id = Number(req.params.id);
  const existing = get(`SELECT * FROM curriculum_topics WHERE id = ?`, [id]);
  if (!existing) throw ApiError.notFound('Curriculum standard not found');
  const body = fields({ ...existing, ...req.body }, topicFields);
  run(
    `UPDATE curriculum_topics SET grade = ?, gender_track = ?, term_number = ?, day_of_week = ?,
            subject = ?, topic_title = ?, expected_indicator = ?, sequence_order = ?, is_active = ?
      WHERE id = ?`,
    [body.grade, body.gender_track, body.term_number, body.day_of_week, body.subject,
      body.topic_title, body.expected_indicator, body.sequence_order, body.is_active, id]
  );
  audit(req, 'curriculum.topic_updated', { entity: 'topic', entityId: id, detail: body.topic_title });
  return ok(res, get(`SELECT * FROM curriculum_topics WHERE id = ?`, [id]));
}));

/**
 * Retire a standard rather than deleting it, so lesson logs that reference it
 * keep their link and past terms still read correctly.
 */
router.delete('/curriculum-topics/:id', handler((req, res) => {
  const id = Number(req.params.id);
  if (!get(`SELECT id FROM curriculum_topics WHERE id = ?`, [id])) {
    throw ApiError.notFound('Curriculum standard not found');
  }
  run(`UPDATE curriculum_topics SET is_active = 0 WHERE id = ?`, [id]);
  audit(req, 'curriculum.topic_retired', { entity: 'topic', entityId: id });
  return ok(res, { retired: true });
}));

// ── Announcements ───────────────────────────────────────────────────────────

router.get('/announcements', handler((req, res) => ok(res, all(
  `SELECT a.*, u.full_name AS author, c.name AS class_name
     FROM announcements a
     LEFT JOIN users u ON u.id = a.created_by
     LEFT JOIN classes c ON c.id = a.class_id
    ORDER BY a.is_pinned DESC, a.publish_on DESC, a.id DESC LIMIT 100`
))));

const announcementFields = {
  title: v.string({ max: 160 }),
  body: v.string({ max: 4000 }),
  audience: v.enum(['all', 'teachers', 'parents', 'class'], { optional: true, default: 'all' }),
  class_id: v.int({ optional: true, min: 1 }),
  is_pinned: v.bool({ optional: true, default: 0 }),
  publish_on: v.date({ optional: true }),
  expires_on: v.date({ optional: true }),
};

router.post('/announcements', handler((req, res) => {
  const body = fields(req.body, announcementFields);
  if (body.audience === 'class' && !body.class_id) {
    throw ApiError.badRequest('Choose which class this notice is for');
  }
  const result = run(
    `INSERT INTO announcements (title, body, audience, class_id, is_pinned, publish_on, expires_on, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [body.title, body.body, body.audience, body.audience === 'class' ? body.class_id : null,
      body.is_pinned, body.publish_on || todayISO(), body.expires_on, req.user.id]
  );
  audit(req, 'announcement.created', { entity: 'announcement', entityId: result.lastID, detail: body.title });
  return ok(res, get(`SELECT * FROM announcements WHERE id = ?`, [result.lastID]));
}));

router.patch('/announcements/:id', handler((req, res) => {
  const id = Number(req.params.id);
  const existing = get(`SELECT * FROM announcements WHERE id = ?`, [id]);
  if (!existing) throw ApiError.notFound('Notice not found');
  const body = fields({ ...existing, ...req.body }, announcementFields);
  run(
    `UPDATE announcements SET title = ?, body = ?, audience = ?, class_id = ?, is_pinned = ?,
            publish_on = ?, expires_on = ? WHERE id = ?`,
    [body.title, body.body, body.audience, body.audience === 'class' ? body.class_id : null,
      body.is_pinned, body.publish_on, body.expires_on, id]
  );
  audit(req, 'announcement.updated', { entity: 'announcement', entityId: id, detail: body.title });
  return ok(res, get(`SELECT * FROM announcements WHERE id = ?`, [id]));
}));

router.delete('/announcements/:id', handler((req, res) => {
  run(`DELETE FROM announcements WHERE id = ?`, [Number(req.params.id)]);
  audit(req, 'announcement.deleted', { entity: 'announcement', entityId: req.params.id });
  return ok(res, { deleted: true });
}));

// ── Reports ─────────────────────────────────────────────────────────────────

/** The one-page summary read out at the weekly Shūrā / Maktab Board meeting. */
router.get('/reports/board-digest', handler((req, res) => {
  const term = req.query.term_number ? getTerm(Number(req.query.term_number)) : getCurrentTerm();
  if (!term) throw ApiError.notFound('No term available');
  const today = todayISO();
  const monday = weekStart(today);
  const pacing = schoolPacing(term, today);

  return ok(res, {
    generatedAt: new Date().toISOString(),
    term,
    weekOf: monday,
    rows: pacing.map((p) => ({
      classId: p.class.id,
      className: p.class.name,
      grade: p.class.grade,
      room: p.class.room,
      teachers: p.class.teachers.map((t) => t.full_name).join(', '),
      students: p.class.student_count,
      covered: p.coveredCount,
      required: p.requiredCount,
      inProgress: p.inProgressCount,
      completionPercent: p.completionPercent,
      // The blended measure the pacing status is actually derived from. Without
      // it the digest reads "0% covered — on track", which a reader cannot
      // reconcile.
      progressPercent: p.progressPercent,
      expectedPercent: p.expectedPercent,
      loggingPercent: p.loggingPercent,
      pacingStatus: p.pacingStatus,
      pacingLabel: p.pacingLabel,
      lastLoggedDate: p.lastLoggedDate,
      nextTopic: p.nextTopic ? `${p.nextTopic.subject}: ${p.nextTopic.topic_title}` : 'Term complete',
      attendance: attendanceSummary({ classId: p.class.id, from: term.start_date, to: term.end_date }),
      week: weeklyMatrix(p.class.id, monday, term.term_number),
    })),
    totals: {
      onTrack: pacing.filter((p) => p.pacingStatus === 'on_track').length,
      watch: pacing.filter((p) => p.pacingStatus === 'watch').length,
      behind: pacing.filter((p) => p.pacingStatus === 'behind').length,
      attendance: attendanceSummary({ from: term.start_date, to: term.end_date }),
    },
  });
}));

router.get('/reports/attendance', handler((req, res) => {
  const term = getCurrentTerm();
  const from = req.query.from ? v.date()(req.query.from, 'from') : term.start_date;
  const to = req.query.to ? v.date()(req.query.to, 'to') : todayISO();

  const byClass = all(`SELECT id, name, grade FROM classes WHERE is_active = 1 ORDER BY grade ASC`)
    .map((c) => ({ ...c, summary: attendanceSummary({ classId: c.id, from, to }) }));

  const concerns = all(
    `SELECT s.id, s.first_name, s.last_name, c.name AS class_name,
            SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absences,
            SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS lates,
            COUNT(a.id) AS recorded
       FROM students s
       JOIN attendance a ON a.student_id = s.id AND a.date BETWEEN ? AND ?
       LEFT JOIN classes c ON c.id = s.class_id
      WHERE s.is_active = 1
      GROUP BY s.id
     HAVING absences >= 2
      ORDER BY absences DESC, lates DESC LIMIT 25`,
    [from, to]
  );

  return ok(res, { from, to, overall: attendanceSummary({ from, to }), byClass, concerns });
}));

router.get('/audit', handler((req, res) => ok(res, all(
  `SELECT * FROM audit_log ORDER BY id DESC LIMIT ?`, [Number(req.query.limit) || 100]
))));

/** Cross-school lesson log stream, filterable for spot checks. */
router.get('/lesson-logs', handler((req, res) => {
  const clauses = [];
  const params = [];
  if (req.query.class_id) { clauses.push('l.class_id = ?'); params.push(Number(req.query.class_id)); }
  if (req.query.date) { clauses.push('l.date = ?'); params.push(String(req.query.date)); }
  if (req.query.subject) { clauses.push('l.subject = ?'); params.push(String(req.query.subject)); }
  if (req.query.status) { clauses.push('l.status = ?'); params.push(String(req.query.status)); }

  return ok(res, all(
    `SELECT l.*, c.name AS class_name, c.grade
       FROM lesson_logs l JOIN classes c ON c.id = l.class_id
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY l.date DESC, l.id DESC LIMIT ?`,
    [...params, Number(req.query.limit) || 100]
  ));
}));

module.exports = router;
