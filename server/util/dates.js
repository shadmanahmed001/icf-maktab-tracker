/**
 * Date and academic-calendar helpers.
 *
 * The maktab teaches Monday–Friday, one strand per weekday. All dates are
 * handled as plain `YYYY-MM-DD` strings in the school's local frame so a
 * timezone shift can never move a lesson onto the wrong day.
 */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Weekday → strand, with the mid-year strand switch applied per term. */
const STRAND_BY_DAY = {
  Monday: () => 'Fiqh',
  Tuesday: () => 'Aḥādīth',
  Wednesday: (term) => (term >= 3 ? 'Tārīkh' : 'Sīrah'),
  Thursday: () => "ʿAqā'id",
  Friday: (term) => (term >= 4 ? 'Ādāb' : 'Akhlāq'),
};

const TEACHING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const ALL_SUBJECTS = ['Fiqh', 'Aḥādīth', 'Sīrah', 'Tārīkh', "ʿAqā'id", 'Akhlāq', 'Ādāb'];

function todayISO(now = new Date()) {
  return toISO(now);
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse `YYYY-MM-DD` as a local-noon Date, immune to DST edge cases. */
function fromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function dayName(iso) {
  return DAY_NAMES[fromISO(iso).getDay()];
}

function isTeachingDay(iso) {
  return TEACHING_DAYS.includes(dayName(iso));
}

function addDays(iso, days) {
  const date = fromISO(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

function daysBetween(fromIso, toIso) {
  return Math.round((fromISO(toIso) - fromISO(fromIso)) / 86400000);
}

/** Strand expected for a date, given the term in effect. */
function subjectForDate(iso, termNumber = 1) {
  const day = dayName(iso);
  const resolver = STRAND_BY_DAY[day];
  return resolver ? resolver(termNumber) : null;
}

/** Every teaching day in an inclusive range, capped so a bad range can't spin. */
function teachingDaysBetween(startIso, endIso, cap = 400) {
  const out = [];
  let cursor = startIso;
  while (cursor <= endIso && out.length < cap) {
    if (isTeachingDay(cursor)) out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

/**
 * How far through a term a given date sits, 0–1. Used to judge whether a class
 * is keeping pace: 40% of the term elapsed should mean roughly 40% covered.
 */
function termElapsedFraction(term, iso = todayISO()) {
  if (!term) return 0;
  const total = daysBetween(term.start_date, term.end_date);
  if (total <= 0) return 1;
  const elapsed = daysBetween(term.start_date, iso);
  return Math.max(0, Math.min(1, elapsed / total));
}

/** Human-friendly short date, e.g. "Mon 10 Aug". */
function formatShort(iso) {
  if (!iso) return '';
  const date = fromISO(iso);
  return `${DAY_NAMES[date.getDay()].slice(0, 3)} ${date.getDate()} ${
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()]
  }`;
}

module.exports = {
  DAY_NAMES, TEACHING_DAYS, ALL_SUBJECTS, STRAND_BY_DAY,
  todayISO, toISO, fromISO, dayName, isTeachingDay, addDays, daysBetween,
  subjectForDate, teachingDaysBetween, termElapsedFraction, formatShort,
};
