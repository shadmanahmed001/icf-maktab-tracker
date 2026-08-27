/**
 * Teacher API. Mounted behind requireRole('teacher','admin') — an admin may
 * act on any class (covering a session, correcting a record), a teacher only
 * on classes they are assigned to. Every handler that touches a class or
 * student routes through assertClassAccess / assertStudentAccess.
 */
const express = require('express');
const { all, get, run, transaction, value } = require('../db');
const { handler, ok, v, fields, ApiError } = require('../util/http');
const { assertClassAccess, assertStudentAccess, teacherClassIds, audit } = require('../auth');
const {
  getCurrentTerm, getTerm, classProgress, weeklyMatrix, weekStart,
  attendanceSummary, studentReportCard, MASTERY_ORDER,
} = require('../services/pacing');
const { todayISO, dayName, subjectForDate, addDays } = require('../util/dates');

const router = express.Router();

/** Classes this account may act on: assigned classes, or all of them for an admin. */
function myClasses(user) {
  if (user.role === 'admin') {
    return all(`SELECT c.*, 'lead' AS role FROM classes c WHERE c.is_active = 1 ORDER BY c.grade ASC`);
  }
  return all(
    `SELECT c.*, ct.role FROM class_teachers ct JOIN classes c ON c.id = ct.class_id
      WHERE ct.user_id = ? AND c.is_active = 1 ORDER BY c.grade ASC`,
    [user.id]
  );
}

// ── Home ────────────────────────────────────────────────────────────────────

router.get('/home', handler((req, res) => {
  const today = req.query.date ? v.date()(req.query.date, 'date') : todayISO();
  const term = getCurrentTerm(today);
  if (!term) throw ApiError.notFound('No academic terms are configured yet');

  const classes = myClasses(req.user);
  const expectedSubject = subjectForDate(today, term.term_number);

  const cards = classes.map((c) => {
    const progress = classProgress(c, term, today);
    const todaysLog = get(
      `SELECT * FROM lesson_logs WHERE class_id = ? AND date = ? ORDER BY id DESC LIMIT 1`,
      [c.id, today]
    );
    const attendanceRecorded = value(
      `SELECT COUNT(*) FROM attendance WHERE class_id = ? AND date = ?`, [c.id, today], 0
    );
    return {
      class: progress.class,
      role: c.role,
      completionPercent: progress.completionPercent,
      expectedPercent: progress.expectedPercent,
      pacingStatus: progress.pacingStatus,
      pacingLabel: progress.pacingLabel,
      coveredCount: progress.coveredCount,
      requiredCount: progress.requiredCount,
      nextTopic: progress.nextTopic,
      memorizationStandard: progress.memorizationStandard,
      todaysLog: todaysLog || null,
      attendanceRecorded,
      studentCount: progress.class.student_count,
      week: weeklyMatrix(c.id, weekStart(today), term.term_number),
    };
  });

  const unreadMessages = value(
    `SELECT COUNT(*) FROM messages m
       JOIN message_threads t ON t.id = m.thread_id
       LEFT JOIN thread_reads r ON r.thread_id = t.id AND r.user_id = ?
      WHERE t.teacher_id = ? AND m.sender_id != ?
        AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)`,
    [req.user.id, req.user.id, req.user.id], 0
  );

  return ok(res, {
    date: today,
    dayName: dayName(today),
    expectedSubject,
    term,
    classes: cards,
    unreadMessages,
    pendingCheckoffs: cards.filter((c) => !c.todaysLog).length,
  });
}));

// ── Daily check-off ─────────────────────────────────────────────────────────

/**
 * Everything the check-off screen needs for one class on one date: the
 * curriculum standard due next, any log already saved, the roster with
 * attendance pre-filled, and the term's memorization target.
 */
router.get('/classes/:id/today', handler((req, res) => {
  const classId = assertClassAccess(req.user, req.params.id);
  const date = req.query.date ? v.date()(req.query.date, 'date') : todayISO();
  const term = getCurrentTerm(date);
  const classRow = get(`SELECT * FROM classes WHERE id = ?`, [classId]);
  const progress = classProgress(classRow, term, date);
  const expectedSubject = subjectForDate(date, term.term_number);

  // Prefer the next uncovered standard for today's strand; fall back to the
  // next uncovered standard of any strand so the screen is never empty.
  const suggested = progress.coverage.find((t) => !t.isCovered && t.subject === expectedSubject)
    || progress.coverage.find((t) => !t.isCovered)
    || null;

  const existingLog = get(
    `SELECT * FROM lesson_logs WHERE class_id = ? AND date = ? ORDER BY id DESC LIMIT 1`,
    [classId, date]
  );

  const roster = all(
    `SELECT s.id, s.first_name, s.last_name, s.student_code,
            a.status AS attendance_status, a.minutes_late, a.note AS attendance_note
       FROM students s
       LEFT JOIN attendance a ON a.student_id = s.id AND a.date = ?
      WHERE s.class_id = ? AND s.is_active = 1
      ORDER BY s.first_name ASC`,
    [date, classId]
  );

  return ok(res, {
    date,
    dayName: dayName(date),
    expectedSubject,
    term,
    class: progress.class,
    progress: {
      completionPercent: progress.completionPercent,
      progressPercent: progress.progressPercent,
      expectedPercent: progress.expectedPercent,
      pacingStatus: progress.pacingStatus,
      pacingLabel: progress.pacingLabel,
      coveredCount: progress.coveredCount,
      requiredCount: progress.requiredCount,
      loggedSessions: progress.loggedSessions,
      expectedSessions: progress.expectedSessions,
      loggingPercent: progress.loggingPercent,
    },
    suggestedTopic: suggested,
    coverage: progress.coverage,
    memorizationStandard: progress.memorizationStandard,
    existingLog: existingLog || null,
    roster,
    recentHandovers: all(
      `SELECT date, subject, teacher_name, handover_note, notes FROM lesson_logs
        WHERE class_id = ? AND (handover_note IS NOT NULL AND handover_note != '')
        ORDER BY date DESC LIMIT 3`,
      [classId]
    ),
  });
}));

const logFields = {
  class_id: v.int({ min: 1 }),
  topic_id: v.int({ optional: true, min: 1 }),
  date: v.date(),
  subject: v.string({ max: 40 }),
  session_type: v.enum(
    ['standard_lesson', 'practical_demo', 'oral_testing', 'revision'],
    { optional: true, default: 'standard_lesson' }
  ),
  topic_covered: v.string({ max: 500 }),
  expected_indicator: v.string({ optional: true, max: 500 }),
  memorization_covered: v.string({ optional: true, max: 300 }),
  status: v.enum(['completed', 'partial', 'not_taught'], { optional: true, default: 'completed' }),
  class_mastery: v.enum(MASTERY_ORDER, { optional: true, default: 'secure' }),
  notes: v.string({ optional: true, max: 1000 }),
  handover_note: v.string({ optional: true, max: 1000 }),
};

/**
 * Save the daily check-off. Keyed on (class, date, strand) so a second strand
 * taught the same day creates its own record while a correction to the same
 * lesson updates in place instead of double-counting coverage.
 */
router.post('/lesson-logs', handler((req, res) => {
  const body = fields(req.body, logFields);
  assertClassAccess(req.user, body.class_id);

  const term = getCurrentTerm(body.date);
  if (body.date > addDays(todayISO(), 1)) {
    throw ApiError.badRequest('A lesson cannot be logged for a future date');
  }
  if (body.topic_id) {
    const topic = get(`SELECT id FROM curriculum_topics WHERE id = ?`, [body.topic_id]);
    if (!topic) throw ApiError.badRequest('That curriculum standard does not exist');
  }

  const existing = get(
    `SELECT id FROM lesson_logs WHERE class_id = ? AND date = ? AND subject = ?`,
    [body.class_id, body.date, body.subject]
  );

  const params = [
    body.topic_id, dayName(body.date), body.subject, body.session_type,
    req.user.id, req.user.full_name, body.topic_covered, body.expected_indicator,
    body.memorization_covered, body.status, body.class_mastery, body.notes, body.handover_note,
  ];

  let logId;
  if (existing) {
    run(
      `UPDATE lesson_logs SET topic_id = ?, day_of_week = ?, subject = ?, session_type = ?,
              teacher_id = ?, teacher_name = ?, topic_covered = ?, expected_indicator = ?,
              memorization_covered = ?, status = ?, class_mastery = ?, notes = ?, handover_note = ?,
              updated_at = datetime('now')
        WHERE id = ?`,
      [...params, existing.id]
    );
    logId = existing.id;
  } else {
    const result = run(
      `INSERT INTO lesson_logs
         (class_id, topic_id, date, day_of_week, subject, session_type, teacher_id, teacher_name,
          topic_covered, expected_indicator, memorization_covered, status, class_mastery, notes, handover_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [body.class_id, body.topic_id, body.date, ...params.slice(1)]
    );
    logId = result.lastID;
  }

  audit(req, existing ? 'lesson.updated' : 'lesson.logged', {
    entity: 'lesson_log', entityId: logId, detail: `${body.subject} — ${body.date}`,
  });

  const classRow = get(`SELECT * FROM classes WHERE id = ?`, [body.class_id]);
  const progress = classProgress(classRow, term, todayISO());

  return ok(res, {
    log: get(`SELECT * FROM lesson_logs WHERE id = ?`, [logId]),
    created: !existing,
    progress: {
      completionPercent: progress.completionPercent,
      progressPercent: progress.progressPercent,
      expectedPercent: progress.expectedPercent,
      coveredCount: progress.coveredCount,
      requiredCount: progress.requiredCount,
      pacingStatus: progress.pacingStatus,
      pacingLabel: progress.pacingLabel,
      nextTopic: progress.nextTopic,
    },
  });
}));

router.delete('/lesson-logs/:id', handler((req, res) => {
  const log = get(`SELECT * FROM lesson_logs WHERE id = ?`, [Number(req.params.id)]);
  if (!log) throw ApiError.notFound('Lesson log not found');
  assertClassAccess(req.user, log.class_id);
  run(`DELETE FROM lesson_logs WHERE id = ?`, [log.id]);
  audit(req, 'lesson.deleted', { entity: 'lesson_log', entityId: log.id, detail: `${log.subject} — ${log.date}` });
  return ok(res, { deleted: true });
}));

router.get('/classes/:id/logs', handler((req, res) => {
  const classId = assertClassAccess(req.user, req.params.id);
  return ok(res, all(
    `SELECT * FROM lesson_logs WHERE class_id = ? ORDER BY date DESC, id DESC LIMIT ?`,
    [classId, Number(req.query.limit) || 60]
  ));
}));

/** Coverage view: every standard for the term with its state. */
router.get('/classes/:id/progress', handler((req, res) => {
  const classId = assertClassAccess(req.user, req.params.id);
  const classRow = get(`SELECT * FROM classes WHERE id = ?`, [classId]);
  const term = req.query.term_number ? getTerm(Number(req.query.term_number)) : getCurrentTerm();
  const today = todayISO();
  return ok(res, {
    ...classProgress(classRow, term, today),
    week: weeklyMatrix(classId, weekStart(today), term.term_number),
  });
}));

// ── Attendance ──────────────────────────────────────────────────────────────

router.get('/classes/:id/attendance', handler((req, res) => {
  const classId = assertClassAccess(req.user, req.params.id);
  const term = getCurrentTerm();
  const date = req.query.date ? v.date()(req.query.date, 'date') : todayISO();
  const from = req.query.from ? v.date()(req.query.from, 'from') : term.start_date;
  const to = req.query.to ? v.date()(req.query.to, 'to') : todayISO();

  return ok(res, {
    date,
    roster: all(
      `SELECT s.id, s.first_name, s.last_name, s.student_code,
              a.status, a.minutes_late, a.note
         FROM students s
         LEFT JOIN attendance a ON a.student_id = s.id AND a.date = ?
        WHERE s.class_id = ? AND s.is_active = 1
        ORDER BY s.first_name ASC`,
      [date, classId]
    ),
    summary: attendanceSummary({ classId, from, to }),
    history: all(
      `SELECT date,
              SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present,
              SUM(CASE WHEN status = 'late'    THEN 1 ELSE 0 END) AS late,
              SUM(CASE WHEN status = 'absent'  THEN 1 ELSE 0 END) AS absent,
              SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) AS excused
         FROM attendance WHERE class_id = ? AND date BETWEEN ? AND ?
        GROUP BY date ORDER BY date DESC LIMIT 30`,
      [classId, from, to]
    ),
  });
}));

/** Bulk save for a whole class on one date — one tap per student, one request. */
router.post('/classes/:id/attendance', handler((req, res) => {
  const classId = assertClassAccess(req.user, req.params.id);
  const body = fields(req.body, {
    date: v.date(),
    entries: v.array(v.shape({
      student_id: v.int({ min: 1 }),
      status: v.enum(['present', 'late', 'absent', 'excused']),
      minutes_late: v.int({ optional: true, default: 0, min: 0, max: 240 }),
      note: v.string({ optional: true, max: 300 }),
    }), { max: 200 }),
  });

  if (body.date > todayISO()) throw ApiError.badRequest('Attendance cannot be recorded for a future date');

  // Confirm every student really belongs to this class before writing anything.
  const validIds = new Set(
    all(`SELECT id FROM students WHERE class_id = ? AND is_active = 1`, [classId]).map((r) => r.id)
  );
  const stranger = body.entries.find((e) => !validIds.has(e.student_id));
  if (stranger) throw ApiError.badRequest(`Student ${stranger.student_id} is not enrolled in this class`);

  transaction(() => {
    for (const entry of body.entries) {
      run(
        `INSERT INTO attendance (student_id, class_id, date, status, minutes_late, note, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(student_id, date) DO UPDATE SET
           status = excluded.status, minutes_late = excluded.minutes_late, note = excluded.note,
           class_id = excluded.class_id, recorded_by = excluded.recorded_by, updated_at = datetime('now')`,
        [entry.student_id, classId, body.date, entry.status,
          entry.status === 'late' ? entry.minutes_late : 0, entry.note, req.user.id]
      );
    }
  });

  audit(req, 'attendance.recorded', {
    entity: 'class', entityId: classId, detail: `${body.entries.length} students on ${body.date}`,
  });

  return ok(res, {
    saved: body.entries.length,
    summary: attendanceSummary({ classId, from: body.date, to: body.date }),
  });
}));

// ── Roster and student records ──────────────────────────────────────────────

router.get('/classes/:id/roster', handler((req, res) => {
  const classId = assertClassAccess(req.user, req.params.id);
  const term = getCurrentTerm();
  const students = all(
    `SELECT s.* FROM students s WHERE s.class_id = ? AND s.is_active = 1 ORDER BY s.first_name ASC`,
    [classId]
  );
  return ok(res, students.map((s) => {
    const attendance = attendanceSummary({ studentId: s.id, from: term.start_date, to: term.end_date });
    const assessed = value(
      `SELECT COUNT(*) FROM assessments WHERE student_id = ? AND term_number = ?`,
      [s.id, term.term_number], 0
    );
    const memorized = value(
      `SELECT COUNT(*) FROM memorization_progress
        WHERE student_id = ? AND term_number = ? AND status = 'mastered'`,
      [s.id, term.term_number], 0
    );
    return {
      ...s,
      guardians: all(
        `SELECT u.id, u.full_name, u.email, u.phone, sg.relationship
           FROM student_guardians sg JOIN users u ON u.id = sg.user_id
          WHERE sg.student_id = ? ORDER BY sg.is_primary DESC`,
        [s.id]
      ),
      attendanceRate: attendance.rate,
      absences: attendance.absent,
      assessedCount: assessed,
      memorizedCount: memorized,
    };
  }));
}));

router.get('/students/:id', handler((req, res) => {
  assertStudentAccess(req.user, req.params.id);
  const term = req.query.term_number ? getTerm(Number(req.query.term_number)) : getCurrentTerm();
  const card = studentReportCard(Number(req.params.id), term.term_number);
  if (!card) throw ApiError.notFound('Student not found');
  return ok(res, {
    ...card,
    guardians: all(
      `SELECT u.id, u.full_name, u.email, u.phone, sg.relationship
         FROM student_guardians sg JOIN users u ON u.id = sg.user_id
        WHERE sg.student_id = ?`,
      [Number(req.params.id)]
    ),
    attendanceRecent: all(
      `SELECT date, status, minutes_late, note FROM attendance
        WHERE student_id = ? ORDER BY date DESC LIMIT 20`,
      [Number(req.params.id)]
    ),
  });
}));

/** Record or revise a strand assessment for one student. */
router.put('/students/:id/assessments', handler((req, res) => {
  assertStudentAccess(req.user, req.params.id);
  const studentId = Number(req.params.id);
  const body = fields(req.body, {
    term_number: v.int({ min: 0, max: 8 }),
    subject: v.string({ max: 40 }),
    mastery_level: v.enum(MASTERY_ORDER),
    comment: v.string({ optional: true, max: 600 }),
    assessed_on: v.date({ optional: true }),
  });

  run(
    `INSERT INTO assessments (student_id, term_number, subject, mastery_level, comment, assessed_on, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(student_id, term_number, subject) DO UPDATE SET
       mastery_level = excluded.mastery_level, comment = excluded.comment,
       assessed_on = excluded.assessed_on, recorded_by = excluded.recorded_by,
       updated_at = datetime('now')`,
    [studentId, body.term_number, body.subject, body.mastery_level, body.comment,
      body.assessed_on || todayISO(), req.user.id]
  );
  audit(req, 'assessment.recorded', {
    entity: 'student', entityId: studentId, detail: `${body.subject}: ${body.mastery_level}`,
  });
  return ok(res, get(
    `SELECT * FROM assessments WHERE student_id = ? AND term_number = ? AND subject = ?`,
    [studentId, body.term_number, body.subject]
  ));
}));

/** Record memorization progress against the term's Sūrah / Duʿā' / Names target. */
router.put('/students/:id/memorization', handler((req, res) => {
  assertStudentAccess(req.user, req.params.id);
  const studentId = Number(req.params.id);
  const body = fields(req.body, {
    term_number: v.int({ min: 0, max: 8 }),
    item_type: v.enum(['surah', 'dua', 'names']),
    item_label: v.string({ max: 300 }),
    status: v.enum(['not_started', 'in_progress', 'mastered']),
  });

  run(
    `INSERT INTO memorization_progress (student_id, term_number, item_type, item_label, status, verified_on, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(student_id, term_number, item_type) DO UPDATE SET
       item_label = excluded.item_label, status = excluded.status,
       verified_on = excluded.verified_on, recorded_by = excluded.recorded_by,
       updated_at = datetime('now')`,
    [studentId, body.term_number, body.item_type, body.item_label, body.status,
      body.status === 'mastered' ? todayISO() : null, req.user.id]
  );
  audit(req, 'memorization.recorded', {
    entity: 'student', entityId: studentId, detail: `${body.item_type}: ${body.status}`,
  });
  return ok(res, get(
    `SELECT * FROM memorization_progress WHERE student_id = ? AND term_number = ? AND item_type = ?`,
    [studentId, body.term_number, body.item_type]
  ));
}));

// ── Homework ────────────────────────────────────────────────────────────────

router.get('/classes/:id/homework', handler((req, res) => {
  const classId = assertClassAccess(req.user, req.params.id);
  return ok(res, all(
    `SELECT h.*, u.full_name AS author FROM homework h
       LEFT JOIN users u ON u.id = h.created_by
      WHERE h.class_id = ? ORDER BY h.assigned_date DESC, h.id DESC LIMIT 50`,
    [classId]
  ));
}));

router.post('/classes/:id/homework', handler((req, res) => {
  const classId = assertClassAccess(req.user, req.params.id);
  const body = fields(req.body, {
    subject: v.string({ max: 40 }),
    title: v.string({ max: 200 }),
    instructions: v.string({ optional: true, max: 2000 }),
    assigned_date: v.date({ optional: true }),
    due_date: v.date({ optional: true }),
  });
  const result = run(
    `INSERT INTO homework (class_id, subject, title, instructions, assigned_date, due_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [classId, body.subject, body.title, body.instructions,
      body.assigned_date || todayISO(), body.due_date, req.user.id]
  );
  audit(req, 'homework.assigned', { entity: 'class', entityId: classId, detail: body.title });
  return ok(res, get(`SELECT * FROM homework WHERE id = ?`, [result.lastID]));
}));

router.delete('/homework/:id', handler((req, res) => {
  const item = get(`SELECT * FROM homework WHERE id = ?`, [Number(req.params.id)]);
  if (!item) throw ApiError.notFound('Homework not found');
  assertClassAccess(req.user, item.class_id);
  run(`DELETE FROM homework WHERE id = ?`, [item.id]);
  return ok(res, { deleted: true });
}));

// ── Messages with parents ───────────────────────────────────────────────────

router.get('/threads', handler((req, res) => {
  const scope = req.user.role === 'admin' ? null : req.user.id;
  const threads = all(
    `SELECT t.*, s.first_name, s.last_name, c.name AS class_name,
            p.full_name AS parent_name, p.email AS parent_email,
            te.full_name AS teacher_name,
            (SELECT body FROM messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_body,
            (SELECT COUNT(*) FROM messages m
               LEFT JOIN thread_reads r ON r.thread_id = t.id AND r.user_id = ?
              WHERE m.thread_id = t.id AND m.sender_id != ?
                AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)) AS unread
       FROM message_threads t
       JOIN students s ON s.id = t.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       JOIN users p ON p.id = t.parent_id
       JOIN users te ON te.id = t.teacher_id
      ${scope ? 'WHERE t.teacher_id = ?' : ''}
      ORDER BY t.last_message_at DESC LIMIT 100`,
    scope ? [req.user.id, req.user.id, scope] : [req.user.id, req.user.id]
  );
  return ok(res, threads);
}));

/** Load one conversation and mark it read for the caller. */
router.get('/threads/:id', handler((req, res) => {
  const thread = get(
    `SELECT t.*, s.first_name, s.last_name, p.full_name AS parent_name
       FROM message_threads t JOIN students s ON s.id = t.student_id
       JOIN users p ON p.id = t.parent_id WHERE t.id = ?`,
    [Number(req.params.id)]
  );
  if (!thread) throw ApiError.notFound('Conversation not found');
  if (req.user.role !== 'admin' && thread.teacher_id !== req.user.id) {
    throw ApiError.forbidden('This conversation belongs to another teacher');
  }

  run(
    `INSERT INTO thread_reads (thread_id, user_id, last_read_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(thread_id, user_id) DO UPDATE SET last_read_at = datetime('now')`,
    [thread.id, req.user.id]
  );

  return ok(res, {
    thread,
    messages: all(
      `SELECT m.*, u.full_name AS sender_name, u.role AS sender_role
         FROM messages m JOIN users u ON u.id = m.sender_id
        WHERE m.thread_id = ? ORDER BY m.id ASC`,
      [thread.id]
    ),
  });
}));

/** Start a conversation with a student's guardian, or reuse the existing one. */
router.post('/threads', handler((req, res) => {
  const body = fields(req.body, {
    student_id: v.int({ min: 1 }),
    parent_id: v.int({ min: 1 }),
    subject: v.string({ optional: true, default: 'General', max: 120 }),
    body: v.string({ max: 4000 }),
  });
  assertStudentAccess(req.user, body.student_id);

  const linked = get(
    `SELECT 1 AS ok FROM student_guardians WHERE student_id = ? AND user_id = ?`,
    [body.student_id, body.parent_id]
  );
  if (!linked) throw ApiError.badRequest('That parent is not listed as a guardian for this student');

  const threadId = transaction(() => {
    const existing = get(
      `SELECT id FROM message_threads WHERE student_id = ? AND teacher_id = ? AND parent_id = ?`,
      [body.student_id, req.user.id, body.parent_id]
    );
    const id = existing ? existing.id : run(
      `INSERT INTO message_threads (student_id, teacher_id, parent_id, subject) VALUES (?, ?, ?, ?)`,
      [body.student_id, req.user.id, body.parent_id, body.subject]
    ).lastID;

    run(`INSERT INTO messages (thread_id, sender_id, body) VALUES (?, ?, ?)`,
      [id, req.user.id, body.body]);
    run(`UPDATE message_threads SET last_message_at = datetime('now') WHERE id = ?`, [id]);
    return id;
  });

  audit(req, 'message.sent', { entity: 'thread', entityId: threadId });
  return ok(res, { thread_id: threadId });
}));

router.post('/threads/:id/messages', handler((req, res) => {
  const thread = get(`SELECT * FROM message_threads WHERE id = ?`, [Number(req.params.id)]);
  if (!thread) throw ApiError.notFound('Conversation not found');
  if (req.user.role !== 'admin' && thread.teacher_id !== req.user.id) {
    throw ApiError.forbidden('This conversation belongs to another teacher');
  }
  const body = fields(req.body, { body: v.string({ max: 4000 }) });

  transaction(() => {
    run(`INSERT INTO messages (thread_id, sender_id, body) VALUES (?, ?, ?)`,
      [thread.id, req.user.id, body.body]);
    run(`UPDATE message_threads SET last_message_at = datetime('now') WHERE id = ?`, [thread.id]);
  });

  audit(req, 'message.sent', { entity: 'thread', entityId: thread.id });
  return ok(res, { sent: true });
}));

/** Guardians reachable for a class, to populate the "message a parent" picker. */
router.get('/classes/:id/guardians', handler((req, res) => {
  const classId = assertClassAccess(req.user, req.params.id);
  return ok(res, all(
    `SELECT u.id AS parent_id, u.full_name AS parent_name, u.email, u.phone,
            s.id AS student_id, s.first_name, s.last_name, sg.relationship
       FROM students s
       JOIN student_guardians sg ON sg.student_id = s.id
       JOIN users u ON u.id = sg.user_id
      WHERE s.class_id = ? AND s.is_active = 1 AND u.is_active = 1
      ORDER BY s.first_name ASC, sg.is_primary DESC`,
    [classId]
  ));
}));

module.exports = router;
module.exports.myClasses = myClasses;
