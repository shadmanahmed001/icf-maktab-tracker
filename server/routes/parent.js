/**
 * Parent API. Every route is scoped by guardianship: a parent can reach the
 * records of children they are linked to and nothing else. assertStudentAccess
 * enforces that on each request rather than trusting an id from the client.
 */
const express = require('express');
const { all, get, run, transaction, value } = require('../db');
const { handler, ok, v, fields, ApiError } = require('../util/http');
const { assertStudentAccess, parentStudentIds, audit } = require('../auth');
const {
  getCurrentTerm, getTerm, getTerms, studentReportCard, studentLessonHistory,
  attendanceSummary, classProgress, MASTERY_ORDER,
} = require('../services/pacing');
const { todayISO, dayName, subjectForDate } = require('../util/dates');

const router = express.Router();

/** The caller's children, with class and teacher context attached. */
function myChildren(userId) {
  return all(
    `SELECT s.id, s.first_name, s.last_name, s.student_code, s.gender, s.date_of_birth,
            s.class_id, c.name AS class_name, c.grade, c.gender_track, c.room,
            sg.relationship, sg.is_primary
       FROM student_guardians sg
       JOIN students s ON s.id = sg.student_id
       LEFT JOIN classes c ON c.id = s.class_id
      WHERE sg.user_id = ? AND s.is_active = 1
      ORDER BY c.grade ASC, s.first_name ASC`,
    [userId]
  ).map((child) => ({
    ...child,
    teachers: child.class_id ? all(
      `SELECT u.id, u.full_name, u.email, ct.role
         FROM class_teachers ct JOIN users u ON u.id = ct.user_id
        WHERE ct.class_id = ? ORDER BY ct.role ASC`,
      [child.class_id]
    ) : [],
  }));
}

// ── Home ────────────────────────────────────────────────────────────────────

router.get('/home', handler((req, res) => {
  const today = todayISO();
  const term = getCurrentTerm(today);
  if (!term) throw ApiError.notFound('No academic terms are configured yet');

  const children = myChildren(req.user.id).map((child) => {
    const card = studentReportCard(child.id, term.term_number);
    const classRow = child.class_id ? get(`SELECT * FROM classes WHERE id = ?`, [child.class_id]) : null;
    const progress = classRow ? classProgress(classRow, term, today) : null;
    const lastLesson = child.class_id ? get(
      `SELECT date, subject, topic_covered, teacher_name FROM lesson_logs
        WHERE class_id = ? ORDER BY date DESC, id DESC LIMIT 1`,
      [child.class_id]
    ) : null;

    return {
      ...child,
      attendance: card?.attendance || null,
      overall: card?.overall || null,
      memorization: card?.memorization || [],
      memorizationStandard: card?.memorizationStandard || null,
      classProgress: progress ? {
        completionPercent: progress.completionPercent,
        expectedPercent: progress.expectedPercent,
        coveredCount: progress.coveredCount,
        requiredCount: progress.requiredCount,
      } : null,
      lastLesson,
      openHomework: child.class_id ? all(
        `SELECT id, subject, title, due_date FROM homework
          WHERE class_id = ? AND (due_date IS NULL OR due_date >= ?)
          ORDER BY assigned_date DESC LIMIT 5`,
        [child.class_id, today]
      ) : [],
    };
  });

  const unreadMessages = value(
    `SELECT COUNT(*) FROM messages m
       JOIN message_threads t ON t.id = m.thread_id
       LEFT JOIN thread_reads r ON r.thread_id = t.id AND r.user_id = ?
      WHERE t.parent_id = ? AND m.sender_id != ?
        AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)`,
    [req.user.id, req.user.id, req.user.id], 0
  );

  return ok(res, {
    date: today,
    dayName: dayName(today),
    expectedSubject: subjectForDate(today, term.term_number),
    term,
    terms: getTerms(),
    children,
    unreadMessages,
  });
}));

// ── One child ───────────────────────────────────────────────────────────────

router.get('/children/:id', handler((req, res) => {
  assertStudentAccess(req.user, req.params.id);
  const studentId = Number(req.params.id);
  const term = req.query.term_number ? getTerm(Number(req.query.term_number)) : getCurrentTerm();
  if (!term) throw ApiError.notFound('Term not found');

  const card = studentReportCard(studentId, term.term_number);
  if (!card) throw ApiError.notFound('Student not found');

  const classRow = card.student.class_id
    ? get(`SELECT * FROM classes WHERE id = ?`, [card.student.class_id])
    : null;

  return ok(res, {
    ...card,
    terms: getTerms(),
    classProgress: classRow ? classProgress(classRow, term, todayISO()) : null,
    teachers: classRow ? all(
      `SELECT u.id, u.full_name, u.email, ct.role
         FROM class_teachers ct JOIN users u ON u.id = ct.user_id
        WHERE ct.class_id = ? ORDER BY ct.role ASC`,
      [classRow.id]
    ) : [],
    lessons: studentLessonHistory(studentId, term, 40),
    homework: classRow ? all(
      `SELECT h.*, u.full_name AS author FROM homework h
         LEFT JOIN users u ON u.id = h.created_by
        WHERE h.class_id = ? ORDER BY h.assigned_date DESC LIMIT 20`,
      [classRow.id]
    ) : [],
  });
}));

router.get('/children/:id/attendance', handler((req, res) => {
  assertStudentAccess(req.user, req.params.id);
  const studentId = Number(req.params.id);
  const term = req.query.term_number ? getTerm(Number(req.query.term_number)) : getCurrentTerm();
  const from = req.query.from ? v.date()(req.query.from, 'from') : term.start_date;
  const to = req.query.to ? v.date()(req.query.to, 'to') : term.end_date;

  return ok(res, {
    from,
    to,
    summary: attendanceSummary({ studentId, from, to }),
    records: all(
      `SELECT date, status, minutes_late, note FROM attendance
        WHERE student_id = ? AND date BETWEEN ? AND ?
        ORDER BY date DESC LIMIT 120`,
      [studentId, from, to]
    ),
  });
}));

router.get('/children/:id/lessons', handler((req, res) => {
  assertStudentAccess(req.user, req.params.id);
  const term = req.query.term_number ? getTerm(Number(req.query.term_number)) : getCurrentTerm();
  return ok(res, {
    term,
    lessons: studentLessonHistory(Number(req.params.id), term, Number(req.query.limit) || 80),
  });
}));

/** The printable end-of-term report card. */
router.get('/children/:id/report-card', handler((req, res) => {
  assertStudentAccess(req.user, req.params.id);
  const term = req.query.term_number ? getTerm(Number(req.query.term_number)) : getCurrentTerm();
  if (!term) throw ApiError.notFound('Term not found');
  const card = studentReportCard(Number(req.params.id), term.term_number);
  if (!card) throw ApiError.notFound('Student not found');

  return ok(res, {
    ...card,
    masteryScale: MASTERY_ORDER,
    teachers: card.student.class_id ? all(
      `SELECT u.full_name, ct.role FROM class_teachers ct JOIN users u ON u.id = ct.user_id
        WHERE ct.class_id = ? ORDER BY ct.role ASC`,
      [card.student.class_id]
    ) : [],
    generatedAt: new Date().toISOString(),
  });
}));

// ── Messages ────────────────────────────────────────────────────────────────

router.get('/threads', handler((req, res) => ok(res, all(
  `SELECT t.*, s.first_name, s.last_name, te.full_name AS teacher_name, te.email AS teacher_email,
          (SELECT body FROM messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_body,
          (SELECT COUNT(*) FROM messages m
             LEFT JOIN thread_reads r ON r.thread_id = t.id AND r.user_id = ?
            WHERE m.thread_id = t.id AND m.sender_id != ?
              AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)) AS unread
     FROM message_threads t
     JOIN students s ON s.id = t.student_id
     JOIN users te ON te.id = t.teacher_id
    WHERE t.parent_id = ?
    ORDER BY t.last_message_at DESC LIMIT 50`,
  [req.user.id, req.user.id, req.user.id]
))));

router.get('/threads/:id', handler((req, res) => {
  const thread = get(
    `SELECT t.*, s.first_name, s.last_name, te.full_name AS teacher_name
       FROM message_threads t JOIN students s ON s.id = t.student_id
       JOIN users te ON te.id = t.teacher_id
      WHERE t.id = ? AND t.parent_id = ?`,
    [Number(req.params.id), req.user.id]
  );
  if (!thread) throw ApiError.notFound('Conversation not found');

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

router.post('/threads/:id/messages', handler((req, res) => {
  const thread = get(
    `SELECT * FROM message_threads WHERE id = ? AND parent_id = ?`,
    [Number(req.params.id), req.user.id]
  );
  if (!thread) throw ApiError.notFound('Conversation not found');
  const body = fields(req.body, { body: v.string({ max: 4000 }) });

  transaction(() => {
    run(`INSERT INTO messages (thread_id, sender_id, body) VALUES (?, ?, ?)`,
      [thread.id, req.user.id, body.body]);
    run(`UPDATE message_threads SET last_message_at = datetime('now') WHERE id = ?`, [thread.id]);
  });
  audit(req, 'message.sent', { entity: 'thread', entityId: thread.id });
  return ok(res, { sent: true });
}));

/** Open a conversation with one of a child's teachers. */
router.post('/threads', handler((req, res) => {
  const body = fields(req.body, {
    student_id: v.int({ min: 1 }),
    teacher_id: v.int({ min: 1 }),
    subject: v.string({ optional: true, default: 'General', max: 120 }),
    body: v.string({ max: 4000 }),
  });
  const student = assertStudentAccess(req.user, body.student_id);

  const teaches = get(
    `SELECT 1 AS ok FROM class_teachers WHERE class_id = ? AND user_id = ?`,
    [student.class_id, body.teacher_id]
  );
  if (!teaches) throw ApiError.badRequest("That teacher is not assigned to your child's class");

  const threadId = transaction(() => {
    const existing = get(
      `SELECT id FROM message_threads WHERE student_id = ? AND teacher_id = ? AND parent_id = ?`,
      [body.student_id, body.teacher_id, req.user.id]
    );
    const id = existing ? existing.id : run(
      `INSERT INTO message_threads (student_id, teacher_id, parent_id, subject) VALUES (?, ?, ?, ?)`,
      [body.student_id, body.teacher_id, req.user.id, body.subject]
    ).lastID;
    run(`INSERT INTO messages (thread_id, sender_id, body) VALUES (?, ?, ?)`, [id, req.user.id, body.body]);
    run(`UPDATE message_threads SET last_message_at = datetime('now') WHERE id = ?`, [id]);
    return id;
  });

  audit(req, 'message.sent', { entity: 'thread', entityId: threadId });
  return ok(res, { thread_id: threadId });
}));

/** Teachers a parent is allowed to contact, across all their children. */
router.get('/contacts', handler((req, res) => {
  const studentIds = parentStudentIds(req.user.id);
  if (!studentIds.length) return ok(res, []);
  const placeholders = studentIds.map(() => '?').join(',');
  return ok(res, all(
    `SELECT s.id AS student_id, s.first_name, s.last_name, c.name AS class_name,
            u.id AS teacher_id, u.full_name AS teacher_name, u.email, ct.role
       FROM students s
       JOIN classes c ON c.id = s.class_id
       JOIN class_teachers ct ON ct.class_id = c.id
       JOIN users u ON u.id = ct.user_id
      WHERE s.id IN (${placeholders}) AND u.is_active = 1
      ORDER BY s.first_name ASC, ct.role ASC`,
    studentIds
  ));
}));

module.exports = router;
