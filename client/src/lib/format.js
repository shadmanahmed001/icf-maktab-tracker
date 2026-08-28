/** Shared formatting, labels and status vocabulary. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Parse `YYYY-MM-DD` at local noon so no timezone can shift the calendar day. */
export function parseISO(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function shortDate(iso) {
  const date = parseISO(iso);
  if (!date) return '—';
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function mediumDate(iso) {
  const date = parseISO(iso);
  if (!date) return '—';
  return `${DAYS[date.getDay()].slice(0, 3)} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function longDate(iso) {
  const date = parseISO(iso);
  if (!date) return '—';
  return `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function dayName(iso) {
  const date = parseISO(iso);
  return date ? DAYS[date.getDay()] : '';
}

export function addDays(iso, days) {
  const date = parseISO(iso);
  if (!date) return iso;
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** "Today", "Yesterday", or a short date — used in activity streams. */
export function relativeDay(iso) {
  const today = todayISO();
  if (iso === today) return 'Today';
  if (iso === addDays(today, -1)) return 'Yesterday';
  if (iso > today) return mediumDate(iso);
  const gap = Math.round((parseISO(today) - parseISO(iso)) / 86400000);
  if (gap <= 6) return `${gap} days ago`;
  return mediumDate(iso);
}

/** Timestamps come back as SQLite `YYYY-MM-DD HH:MM:SS` in UTC. */
export function timeAgo(timestamp) {
  if (!timestamp) return '';
  const iso = String(timestamp).includes('T') ? timestamp : `${String(timestamp).replace(' ', 'T')}Z`;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const seconds = Math.max(0, (Date.now() - then.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  const days = Math.floor(seconds / 86400);
  if (days < 7) return `${days} d ago`;
  return mediumDate(String(timestamp).slice(0, 10));
}

// ── Vocabulary ──────────────────────────────────────────────────────────────

export const PACING = {
  on_track: { label: 'On track', tone: 'ok', description: 'Coverage and record-keeping are both where they should be.' },
  watch: { label: 'Needs attention', tone: 'warn', description: 'Slipping behind the term plan, or daily logs are being missed.' },
  behind: { label: 'Behind pace', tone: 'risk', description: 'Significantly behind the term plan, or the daily record has large gaps.' },
  not_started: { label: 'Not started', tone: 'neutral', description: 'The term has not begun for this class yet.' },
};

export const MASTERY = {
  emerging: { label: 'Emerging', tone: 'risk', short: 'E', index: 0 },
  developing: { label: 'Developing', tone: 'warn', short: 'D', index: 1 },
  secure: { label: 'Secure', tone: 'info', short: 'S', index: 2 },
  mastered: { label: 'Mastered', tone: 'ok', short: 'M', index: 3 },
};

export const MASTERY_ORDER = ['emerging', 'developing', 'secure', 'mastered'];

export const ATTENDANCE = {
  present: { label: 'Present', tone: 'ok', short: 'P' },
  late: { label: 'Late', tone: 'warn', short: 'L' },
  absent: { label: 'Absent', tone: 'risk', short: 'A' },
  excused: { label: 'Excused', tone: 'info', short: 'Ex' },
};

export const SESSION_TYPES = {
  standard_lesson: 'Regular lesson',
  practical_demo: 'Practical demonstration',
  oral_testing: 'Oral testing',
  revision: 'Revision',
};

export const LESSON_STATUS = {
  completed: { label: 'Completed', tone: 'ok' },
  partial: { label: 'Partly covered', tone: 'warn' },
  not_taught: { label: 'Not taught', tone: 'risk' },
};

export const MEMORIZATION_STATUS = {
  not_started: { label: 'Not started', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'warn' },
  mastered: { label: 'Mastered', tone: 'ok' },
};

export const COVERAGE_STATE = {
  achieved: { label: 'Achieved', tone: 'ok' },
  in_progress: { label: 'Being taught', tone: 'warn' },
  pending: { label: 'Not started', tone: 'neutral' },
};

export const MEMORIZATION_ITEM = {
  surah: 'Sūrah',
  dua: "Duʿā'",
  names: 'Names of Allāh',
};

export const AUDIENCE = {
  all: 'Everyone',
  teachers: 'Teachers only',
  parents: 'Parents only',
  class: 'One class',
};

export const GENDER_TRACK = {
  general: 'Mixed',
  boys: 'Boys',
  girls: 'Girls',
};

/** Human label for an audit action key like `lesson.logged`. */
export function auditLabel(action) {
  const map = {
    'auth.login': 'Signed in',
    'auth.login_failed': 'Failed sign-in attempt',
    'auth.logout': 'Signed out',
    'auth.password_changed': 'Changed their password',
    'lesson.logged': 'Logged a lesson',
    'lesson.updated': 'Updated a lesson log',
    'lesson.deleted': 'Deleted a lesson log',
    'attendance.recorded': 'Recorded attendance',
    'assessment.recorded': 'Recorded an assessment',
    'memorization.recorded': 'Recorded memorization progress',
    'homework.assigned': 'Assigned homework',
    'message.sent': 'Sent a message',
    'student.created': 'Enrolled a student',
    'student.updated': 'Updated a student record',
    'student.withdrawn': 'Withdrew a student',
    'student.guardian_linked': 'Linked a guardian',
    'student.guardian_unlinked': 'Unlinked a guardian',
    'class.created': 'Created a class',
    'class.updated': 'Updated a class',
    'class.archived': 'Archived a class',
    'class.teacher_assigned': 'Assigned a teacher',
    'class.teacher_unassigned': 'Unassigned a teacher',
    'user.created': 'Created an account',
    'user.updated': 'Updated an account',
    'user.password_reset': 'Reset a password',
    'user.pin_set': 'Set a sign-in PIN',
    'term.set_current': 'Changed the active term',
    'term.updated': 'Updated a term',
    'curriculum.topic_created': 'Added a curriculum standard',
    'curriculum.topic_updated': 'Edited a curriculum standard',
    'curriculum.topic_retired': 'Retired a curriculum standard',
    'announcement.created': 'Posted a notice',
    'announcement.updated': 'Edited a notice',
    'announcement.deleted': 'Deleted a notice',
  };
  return map[action] || action;
}

export const initials = (name = '') => name
  .replace(/^(Ustadh|Ustadha|Imam)\s+/i, '')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase())
  .join('');

export const fullName = (person) => (person
  ? `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || person.full_name || ''
  : '');

export const percent = (value) => (value === null || value === undefined ? '—' : `${Math.round(value)}%`);

export const pluralize = (count, singular, plural) =>
  `${count} ${count === 1 ? singular : (plural || `${singular}s`)}`;
