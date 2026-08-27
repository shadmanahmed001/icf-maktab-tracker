/** Endpoints every signed-in role may read: calendar, curriculum, announcements. */
const express = require('express');
const { all, get, run } = require('../db');
const { handler, ok, v, fields, ApiError } = require('../util/http');
const { requireAuth, teacherClassIds } = require('../auth');
const { getTerms, getCurrentTerm } = require('../services/pacing');
const { todayISO, subjectForDate, dayName, ALL_SUBJECTS } = require('../util/dates');

const router = express.Router();
router.use(requireAuth);

router.get('/terms', handler((req, res) => ok(res, {
  terms: getTerms(),
  currentTerm: getCurrentTerm(),
  today: todayISO(),
  todayDayName: dayName(todayISO()),
})));

/** Curriculum browser, filterable by grade, track and term. */
router.get('/curriculum', handler((req, res) => {
  const clauses = ['is_active = 1'];
  const params = [];

  if (req.query.grade) {
    clauses.push('grade = ?');
    params.push(Number(req.query.grade));
  }
  if (req.query.term_number !== undefined && req.query.term_number !== '') {
    clauses.push('term_number = ?');
    params.push(Number(req.query.term_number));
  }
  if (req.query.gender_track) {
    clauses.push("(gender_track = 'general' OR gender_track = ?)");
    params.push(String(req.query.gender_track));
  }
  if (req.query.subject) {
    clauses.push('subject = ?');
    params.push(String(req.query.subject));
  }

  const topics = all(
    `SELECT * FROM curriculum_topics WHERE ${clauses.join(' AND ')}
      ORDER BY grade ASC, term_number ASC, sequence_order ASC, id ASC`,
    params
  );

  const memClauses = [];
  const memParams = [];
  if (req.query.grade) { memClauses.push('grade = ?'); memParams.push(Number(req.query.grade)); }
  if (req.query.term_number !== undefined && req.query.term_number !== '') {
    memClauses.push('term_number = ?');
    memParams.push(Number(req.query.term_number));
  }
  const memorization = all(
    `SELECT * FROM memorization_standards ${memClauses.length ? `WHERE ${memClauses.join(' AND ')}` : ''}
      ORDER BY grade ASC, term_number ASC`,
    memParams
  );

  const grades = all(`SELECT DISTINCT grade FROM curriculum_topics ORDER BY grade ASC`).map((r) => r.grade);

  return ok(res, { topics, memorization, grades, subjects: ALL_SUBJECTS });
}));

/**
 * Announcements filtered to what this role is allowed to see, with expired and
 * future-dated notices excluded.
 */
function visibleAnnouncements(user, limit = 40) {
  const today = todayISO();
  const SELECT = `
    SELECT a.*, u.full_name AS author, c.name AS class_name
      FROM announcements a
      LEFT JOIN users u ON u.id = a.created_by
      LEFT JOIN classes c ON c.id = a.class_id
     WHERE a.publish_on <= ? AND (a.expires_on IS NULL OR a.expires_on >= ?)
  `;
  const ORDER = `ORDER BY a.is_pinned DESC, a.publish_on DESC, a.id DESC LIMIT ?`;

  // Admins see every notice regardless of audience.
  if (user.role === 'admin') {
    return all(`${SELECT} ${ORDER}`, [today, today, limit]);
  }

  // Teachers are scoped by their class assignments, parents by their children's classes.
  const classIds = user.role === 'teacher'
    ? teacherClassIds(user.id)
    : childClassIds(user.id);

  const audienceForRole = user.role === 'teacher' ? 'teachers' : 'parents';
  const classClause = classIds.length
    ? `OR (a.audience = 'class' AND a.class_id IN (${classIds.map(() => '?').join(',')}))`
    : '';

  return all(
    `${SELECT} AND (a.audience = 'all' OR a.audience = ? ${classClause}) ${ORDER}`,
    [today, today, audienceForRole, ...classIds, limit]
  );
}

/** Distinct class ids across all of a parent's children. */
function childClassIds(parentUserId) {
  return all(
    `SELECT DISTINCT s.class_id
       FROM student_guardians sg
       JOIN students s ON s.id = sg.student_id
      WHERE sg.user_id = ? AND s.class_id IS NOT NULL`,
    [parentUserId]
  ).map((r) => r.class_id);
}

router.get('/announcements', handler((req, res) => ok(res, {
  announcements: visibleAnnouncements(req.user, Number(req.query.limit) || 40),
})));

/** What strand is expected today, for the header strip in every portal. */
router.get('/today', handler((req, res) => {
  const term = getCurrentTerm();
  const today = todayISO();
  return ok(res, {
    date: today,
    dayName: dayName(today),
    term,
    expectedSubject: term ? subjectForDate(today, term.term_number) : null,
  });
}));

/** Update the signed-in user's own contact details. */
router.patch('/profile', handler((req, res) => {
  const body = fields(req.body, {
    full_name: v.string({ max: 120 }),
    phone: v.string({ optional: true, max: 40 }),
  });
  run(
    `UPDATE users SET full_name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?`,
    [body.full_name, body.phone, req.user.id]
  );
  return ok(res, get(`SELECT id, full_name, email, phone, role, title FROM users WHERE id = ?`, [req.user.id]));
}));

module.exports = router;
module.exports.visibleAnnouncements = visibleAnnouncements;
