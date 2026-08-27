/**
 * Academic analytics shared by all three portals.
 *
 * Coverage is measured against the curriculum itself: a lesson log carries the
 * `topic_id` the teacher checked off, so "covered" means a completed log exists
 * for that standard. Logs written before topic linking existed fall back to a
 * subject match within the term, which keeps historical data meaningful without
 * letting a single Fiqh lesson mark the whole strand complete.
 */
const { all, get } = require('../db');
const {
  todayISO, termElapsedFraction, teachingDaysBetween, dayName,
  subjectForDate, addDays, TEACHING_DAYS,
} = require('../util/dates');

const MASTERY_ORDER = ['emerging', 'developing', 'secure', 'mastered'];
const MASTERY_LABEL = {
  emerging: 'Emerging',
  developing: 'Developing',
  secure: 'Secure',
  mastered: 'Mastered',
};

function getTerms() {
  return all(`SELECT * FROM terms ORDER BY start_date ASC`);
}

/** The term flagged current, else the term containing today, else the first. */
function getCurrentTerm(today = todayISO()) {
  return (
    get(`SELECT * FROM terms WHERE is_current = 1`) ||
    get(`SELECT * FROM terms WHERE ? BETWEEN start_date AND end_date ORDER BY is_interlude ASC LIMIT 1`, [today]) ||
    get(`SELECT * FROM terms ORDER BY start_date ASC LIMIT 1`)
  );
}

function getTerm(termNumber) {
  return get(`SELECT * FROM terms WHERE term_number = ?`, [termNumber]);
}

/** Curriculum standards that apply to one class in one term. */
function classCurriculum(classRow, termNumber) {
  return all(
    `SELECT * FROM curriculum_topics
      WHERE grade = ? AND term_number = ? AND is_active = 1
        AND (gender_track = 'general' OR gender_track = ?)
      ORDER BY sequence_order ASC, id ASC`,
    [classRow.grade, termNumber, classRow.gender_track]
  );
}

function classLogsInTerm(classId, term) {
  return all(
    `SELECT * FROM lesson_logs
      WHERE class_id = ? AND date BETWEEN ? AND ?
      ORDER BY date ASC, id ASC`,
    [classId, term.start_date, term.end_date]
  );
}

/**
 * Classify each standard as achieved, in progress, or untouched.
 *
 * A term holds five standards — one per strand — and each is taught across the
 * whole term, roughly nine sessions. So a completed lesson log does not by
 * itself finish a standard: the teacher's mastery judgement on that log is what
 * marks it achieved. Any log against a standard means teaching is under way.
 */
function coverageFor(topics, logs) {
  const ACHIEVED_MASTERY = new Set(['secure', 'mastered']);
  const byTopic = new Map();
  for (const log of logs) {
    if (!log.topic_id) continue;
    const bucket = byTopic.get(log.topic_id) || [];
    bucket.push(log);
    byTopic.set(log.topic_id, bucket);
  }
  const anyLinkedLogs = byTopic.size > 0;

  return topics.map((topic) => {
    const topicLogs = byTopic.get(topic.id)
      // Legacy fallback: logs written before topic linking, matched on strand.
      || (anyLinkedLogs ? [] : logs.filter((l) => l.subject === topic.subject));

    const achievedLog = topicLogs.find(
      (l) => l.status === 'completed' && ACHIEVED_MASTERY.has(l.class_mastery)
    );

    let state = 'pending';
    if (achievedLog) state = 'achieved';
    else if (topicLogs.length) state = 'in_progress';

    const lastLog = topicLogs.length ? topicLogs[topicLogs.length - 1] : null;

    return {
      ...topic,
      state,
      isCovered: state === 'achieved',
      sessionCount: topicLogs.length,
      log: achievedLog || lastLog || null,
    };
  });
}

const PACING_LABEL = {
  on_track: 'On track',
  watch: 'Needs attention',
  behind: 'Behind pace',
  not_started: 'Not started',
};

/**
 * Pacing combines two independent signals, and reports the worse of them:
 *
 *   Syllabus progress — standards achieved, with half credit for standards
 *   under way, measured against how much of the term has elapsed.
 *
 *   Logging discipline — sessions recorded against teaching days that have
 *   passed. A class can be teaching well and still be invisible to the office
 *   if nobody checks off; that is worth flagging on its own.
 */
function pacingStatus({ effectiveFraction, elapsedFraction, loggingRate, expectedSessions }) {
  if (expectedSessions === 0) return 'not_started';
  if (loggingRate < 0.5) return 'behind';

  const gap = elapsedFraction - effectiveFraction;
  if (gap > 0.3) return 'behind';
  if (gap > 0.12 || loggingRate < 0.8) return 'watch';
  return 'on_track';
}

/** Full progress picture for one class in one term. */
function classProgress(classRow, term, today = todayISO()) {
  const topics = classCurriculum(classRow, term.term_number);
  const logs = classLogsInTerm(classRow.id, term);
  const coverage = coverageFor(topics, logs);

  const requiredCount = coverage.length;
  const achievedCount = coverage.filter((t) => t.state === 'achieved').length;
  const inProgressCount = coverage.filter((t) => t.state === 'in_progress').length;

  // Half credit for a standard under way keeps mid-term pacing meaningful.
  const effectiveFraction = requiredCount
    ? (achievedCount + inProgressCount * 0.5) / requiredCount
    : 1;
  const elapsedFraction = termElapsedFraction(term, today);

  // Logging discipline against teaching days elapsed so far in the term.
  const rangeEnd = today < term.end_date ? today : term.end_date;
  const expectedSessions = today < term.start_date
    ? 0
    : teachingDaysBetween(term.start_date, rangeEnd).length;
  const loggedSessions = new Set(logs.map((l) => l.date)).size;
  const loggingRate = expectedSessions ? Math.min(1, loggedSessions / expectedSessions) : 0;

  // The Ramaḍān interlude introduces no new standards, so pacing is not judged.
  const status = term.is_interlude
    ? 'on_track'
    : pacingStatus({ effectiveFraction, elapsedFraction, loggingRate, expectedSessions });

  const nextTopic = coverage.find((t) => t.state === 'pending')
    || coverage.find((t) => t.state === 'in_progress')
    || null;
  const lastLog = logs.length ? logs[logs.length - 1] : null;

  const memorization = get(
    `SELECT * FROM memorization_standards WHERE grade = ? AND term_number = ?`,
    [classRow.grade, term.term_number]
  );

  const studentCount = get(
    `SELECT COUNT(*) AS n FROM students WHERE class_id = ? AND is_active = 1`, [classRow.id]
  ).n;

  const teachers = all(
    `SELECT u.id, u.full_name, u.email, ct.role
       FROM class_teachers ct JOIN users u ON u.id = ct.user_id
      WHERE ct.class_id = ? ORDER BY CASE ct.role WHEN 'lead' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END, u.full_name ASC`,
    [classRow.id]
  );

  return {
    class: { ...classRow, student_count: studentCount, teachers },
    term: { term_number: term.term_number, title: term.title },
    requiredCount,
    coveredCount: achievedCount,
    achievedCount,
    inProgressCount,
    pendingCount: requiredCount - achievedCount - inProgressCount,
    completionPercent: requiredCount ? Math.round((achievedCount / requiredCount) * 100) : 100,
    progressPercent: Math.round(effectiveFraction * 100),
    expectedPercent: Math.round(elapsedFraction * 100),
    expectedSessions,
    loggedSessions,
    loggingPercent: Math.round(loggingRate * 100),
    pacingStatus: status,
    pacingLabel: PACING_LABEL[status],
    logCount: logs.length,
    lastLoggedDate: lastLog?.date || null,
    nextTopic,
    memorizationStandard: memorization || null,
    coverage,
  };
}

/** Every active class, in grade order. */
function schoolPacing(term, today = todayISO()) {
  const classes = all(
    `SELECT * FROM classes WHERE is_active = 1 ORDER BY grade ASC, gender_track ASC`
  );
  return classes.map((c) => classProgress(c, term, today));
}

/**
 * The 5-strand week view: for each teaching day of the week, the strand that
 * should be taught and whether a log exists.
 */
function weeklyMatrix(classId, weekStartIso, termNumber) {
  const days = [];
  for (let i = 0; i < 5; i += 1) {
    const date = addDays(weekStartIso, i);
    const name = dayName(date);
    if (!TEACHING_DAYS.includes(name)) continue;
    const log = get(
      `SELECT * FROM lesson_logs WHERE class_id = ? AND date = ? ORDER BY id DESC LIMIT 1`,
      [classId, date]
    );
    days.push({
      date,
      dayName: name,
      expectedSubject: subjectForDate(date, termNumber),
      log: log || null,
      state: log ? log.status : 'pending',
    });
  }
  return days;
}

const WEEK_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Monday of the week containing `iso`; weekends look ahead to the next week. */
function weekStart(iso = todayISO()) {
  const index = WEEK_ORDER.indexOf(dayName(iso));
  if (index >= 5) return addDays(iso, 7 - index);
  return addDays(iso, -index);
}

// ── Attendance ──────────────────────────────────────────────────────────────

function attendanceSummary({ studentId, classId, from, to }) {
  const clauses = ['date BETWEEN ? AND ?'];
  const params = [from, to];
  if (studentId) { clauses.push('student_id = ?'); params.push(studentId); }
  if (classId) { clauses.push('class_id = ?'); params.push(classId); }

  const rows = all(
    `SELECT status, COUNT(*) AS n FROM attendance WHERE ${clauses.join(' AND ')} GROUP BY status`,
    params
  );
  const counts = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const row of rows) counts[row.status] = row.n;

  const recorded = counts.present + counts.late + counts.absent + counts.excused;
  // Excused absences do not count against a student's attendance rate.
  const assessable = counts.present + counts.late + counts.absent;
  const rate = assessable ? Math.round(((counts.present + counts.late) / assessable) * 100) : null;

  return { ...counts, recorded, rate, sessions: teachingDaysBetween(from, to).length };
}

// ── Student-level progress ──────────────────────────────────────────────────

/** Everything needed to render a term report card for one student. */
function studentReportCard(studentId, termNumber) {
  const student = get(
    `SELECT s.*, c.name AS class_name, c.grade, c.gender_track, c.room
       FROM students s LEFT JOIN classes c ON c.id = s.class_id
      WHERE s.id = ?`,
    [studentId]
  );
  if (!student) return null;

  const term = getTerm(termNumber) || getCurrentTerm();
  const assessments = all(
    `SELECT a.*, u.full_name AS assessor
       FROM assessments a LEFT JOIN users u ON u.id = a.recorded_by
      WHERE a.student_id = ? AND a.term_number = ?
      ORDER BY a.subject ASC`,
    [studentId, term.term_number]
  );
  const memorization = all(
    `SELECT * FROM memorization_progress WHERE student_id = ? AND term_number = ? ORDER BY item_type ASC`,
    [studentId, term.term_number]
  );
  const standard = get(
    `SELECT * FROM memorization_standards WHERE grade = ? AND term_number = ?`,
    [student.grade, term.term_number]
  );
  const attendance = attendanceSummary({
    studentId, from: term.start_date, to: term.end_date,
  });

  const scored = assessments.filter((a) => MASTERY_ORDER.includes(a.mastery_level));
  const averageIndex = scored.length
    ? scored.reduce((sum, a) => sum + MASTERY_ORDER.indexOf(a.mastery_level), 0) / scored.length
    : null;

  return {
    student,
    term,
    assessments,
    memorization,
    memorizationStandard: standard || null,
    attendance,
    overall: averageIndex === null ? null : {
      index: Number(averageIndex.toFixed(2)),
      level: MASTERY_ORDER[Math.round(averageIndex)],
      label: MASTERY_LABEL[MASTERY_ORDER[Math.round(averageIndex)]],
      percent: Math.round((averageIndex / (MASTERY_ORDER.length - 1)) * 100),
    },
  };
}

/** Lessons a student's class covered in a term — the parent-facing coverage view. */
function studentLessonHistory(studentId, term, limit = 60) {
  const student = get(`SELECT class_id FROM students WHERE id = ?`, [studentId]);
  if (!student?.class_id) return [];
  return all(
    `SELECT l.id, l.date, l.day_of_week, l.subject, l.session_type, l.topic_covered,
            l.expected_indicator, l.memorization_covered, l.status, l.class_mastery, l.teacher_name
       FROM lesson_logs l
      WHERE l.class_id = ? AND l.date BETWEEN ? AND ?
      ORDER BY l.date DESC, l.id DESC
      LIMIT ?`,
    [student.class_id, term.start_date, term.end_date, limit]
  );
}

module.exports = {
  MASTERY_ORDER, MASTERY_LABEL, PACING_LABEL,
  getTerms, getCurrentTerm, getTerm,
  classCurriculum, classProgress, schoolPacing, coverageFor,
  weeklyMatrix, weekStart,
  attendanceSummary, studentReportCard, studentLessonHistory,
};
