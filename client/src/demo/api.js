/**
 * Demo API client — a drop-in replacement for lib/api.js used only in the
 * static demo bundle.
 *
 * Reads are answered from fixtures recorded off the real server, so every
 * screen shows exactly what the live application returns rather than a
 * hand-written approximation. Writes cannot reach a server, so they are applied
 * to the in-memory copy of the fixtures and reported honestly to the user.
 *
 * The exported shape matches lib/api.js exactly; the app is unaware of it.
 */
import fixtures from './fixtures.json';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const SESSION_KEY = 'maktab.demo.session';

/** Working copy, so simulated writes persist for the length of the visit. */
const responses = { ...fixtures.responses };

/** Which capture bucket a signed-in account reads from. */
function roleKey(user) {
  if (!user) return 'public';
  if (user.role === 'admin') return 'admin';
  return `${user.role}:${user.email}`;
}

let currentUser = null;
let currentContext = {};

// Restore across a page reload so the demo behaves like the real app.
try {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    currentUser = parsed.user;
    currentContext = parsed.context || {};
  }
} catch {
  // Storage blocked — the visitor simply signs in again.
}

function persist() {
  try {
    if (currentUser) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: currentUser, context: currentContext }));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Not fatal; the session just won't survive a reload.
  }
}

/** A short delay so loading states are visible rather than flashing. */
const settle = (value) => new Promise((resolve) => setTimeout(() => resolve(value), 90));

/**
 * Resolve a path for the current account: exact key, then the same path with
 * its query string dropped (a different date or term falls back to what was
 * captured), then the public bucket.
 */
function lookup(path) {
  const key = roleKey(currentUser);
  const pathOnly = path.split('?')[0];
  const candidates = [`${key}|${path}`, `${key}|${pathOnly}`, `public|${path}`, `public|${pathOnly}`];
  for (const candidate of candidates) {
    if (candidate in responses) return responses[candidate];
  }
  return undefined;
}

function read(path) {
  if (!currentUser && !path.startsWith('/auth/')) {
    throw new ApiError(401, 'Sign in to continue');
  }
  const found = lookup(path);
  if (found === undefined) {
    throw new ApiError(
      404,
      'This part of the demo has no recorded data. Sign in with one of the listed demo accounts, '
      + 'or run the full application to browse every record.'
    );
  }
  // Hand back a copy so a screen mutating its own data cannot corrupt the store.
  return settle(structuredClone(found));
}

/** Overwrite a cached response so a simulated write is visible on reload. */
function patch(path, updater) {
  const key = roleKey(currentUser);
  for (const candidate of [`${key}|${path}`, `${key}|${path.split('?')[0]}`]) {
    if (candidate in responses) {
      responses[candidate] = updater(structuredClone(responses[candidate]));
    }
  }
}

const query = (params = {}) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

/** Writes are local to this browser; say so rather than implying persistence. */
const DEMO_WRITE_NOTE = 'Saved in this demo only — it runs without a server, so nothing is stored.';

function simulate(result = {}) {
  return settle({ ...result, demoNote: DEMO_WRITE_NOTE });
}

// ── Session ─────────────────────────────────────────────────────────────────

function signIn(identifier, secret) {
  const email = String(identifier || '').trim().toLowerCase();
  const account = fixtures.accounts.find((a) => a.email.toLowerCase() === email);

  if (!account || secret !== fixtures.password) {
    throw new ApiError(401, 'Those sign-in details do not match a demo account');
  }

  currentUser = {
    id: account.id,
    full_name: account.full_name,
    email: account.email,
    phone: account.phone,
    role: account.role,
    title: account.title,
    is_active: 1,
    must_change_password: 0,
    last_login_at: null,
  };
  currentContext = account.context || {};
  persist();
  return settle({ user: currentUser, ...currentContext });
}

export const demoApi = {
  login: (identifier, secret) => signIn(identifier, secret),

  logout: () => {
    currentUser = null;
    currentContext = {};
    persist();
    return settle({ signedOut: true });
  },

  session: () => settle(currentUser ? { user: currentUser, ...currentContext } : { user: null }),

  demoAccounts: () => settle(structuredClone(responses['public|/auth/demo-accounts'])),

  changePassword: () => {
    throw new ApiError(400, 'Passwords cannot be changed in the demo. Run the application to try this.');
  },

  updateProfile: (payload) => {
    currentUser = { ...currentUser, ...payload };
    persist();
    return settle(currentUser);
  },

  // ── Shared ────────────────────────────────────────────────────────────────
  terms: () => read('/terms'),
  today: () => read('/today'),
  curriculum: (params) => read(`/curriculum${query(params)}`),
  announcements: (params) => read(`/announcements${query(params)}`),

  // ── Admin ─────────────────────────────────────────────────────────────────
  admin: {
    dashboard: () => read('/admin/dashboard'),
    classes: () => read('/admin/classes'),
    classDetail: (id, params) => read(`/admin/classes/${id}/detail${query(params)}`),
    createClass: () => simulate({ id: -1 }),
    updateClass: () => simulate(),
    archiveClass: () => simulate({ archived: true }),
    assignTeacher: () => simulate({ assigned: true }),
    unassignTeacher: () => simulate({ removed: true }),

    /** Search is applied to the recorded list, so filtering really works. */
    students: async (params = {}) => {
      const all = await read('/admin/students');
      let rows = all;
      if (params.class_id) rows = rows.filter((s) => s.class_id === Number(params.class_id));
      if (params.q) {
        const needle = String(params.q).toLowerCase();
        rows = rows.filter((s) => `${s.first_name} ${s.last_name} ${s.student_code}`
          .toLowerCase().includes(needle));
      }
      return rows;
    },
    studentDetail: (id, params) => read(`/admin/students/${id}/detail${query(params)}`),
    createStudent: () => simulate({ id: -1 }),
    updateStudent: () => simulate(),
    withdrawStudent: () => simulate({ withdrawn: true }),
    linkGuardian: () => simulate({ linked: true }),
    unlinkGuardian: () => simulate({ removed: true }),

    users: async (params = {}) => {
      const path = `/admin/users${query({ role: params.role, include_inactive: params.include_inactive })}`;
      const rows = await read(path);
      if (!params.q) return rows;
      const needle = String(params.q).toLowerCase();
      return rows.filter((u) => `${u.full_name} ${u.email}`.toLowerCase().includes(needle));
    },
    createUser: () => simulate({
      user: { id: -1, full_name: 'New account', email: 'new@icfbayarea.com', role: 'teacher' },
      temporaryPassword: 'Sabr-4821',
    }),
    updateUser: () => simulate(),
    resetPassword: () => simulate({ temporaryPassword: 'Noor-7310' }),
    setPin: () => simulate({ updated: true }),

    setCurrentTerm: () => simulate(),
    updateTerm: () => simulate(),
    curriculumGaps: () => read('/admin/curriculum-gaps'),
    createTopic: () => simulate({ id: -1 }),
    updateTopic: () => simulate(),
    retireTopic: () => simulate({ retired: true }),

    allAnnouncements: () => read('/admin/announcements'),
    createAnnouncement: (payload) => {
      // Notices are cheap to simulate convincingly, so the screen updates.
      patch('/admin/announcements', (rows) => [{
        id: -Date.now(),
        ...payload,
        is_pinned: payload.is_pinned ? 1 : 0,
        author: currentUser?.full_name,
        created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      }, ...rows]);
      return simulate();
    },
    updateAnnouncement: () => simulate(),
    deleteAnnouncement: (id) => {
      patch('/admin/announcements', (rows) => rows.filter((r) => r.id !== id));
      return simulate({ deleted: true });
    },

    boardDigest: (params) => read(`/admin/reports/board-digest${query(params)}`),
    attendanceReport: (params) => read(`/admin/reports/attendance${query(params)}`),
    audit: (params) => read(`/admin/audit${query(params)}`),
    lessonLogs: (params) => read(`/admin/lesson-logs${query(params)}`),
  },

  // ── Teacher ───────────────────────────────────────────────────────────────
  teacher: {
    home: (params) => read(`/teacher/home${query(params)}`),
    today: (classId, params) => read(`/teacher/classes/${classId}/today${query(params)}`),
    progress: (classId, params) => read(`/teacher/classes/${classId}/progress${query(params)}`),
    logs: (classId, params) => read(`/teacher/classes/${classId}/logs${query(params)}`),

    /** Reflect the saved lesson back into the daily log screen's cached payload. */
    saveLesson: (payload) => {
      const path = `/teacher/classes/${payload.class_id}/today`;
      patch(path, (data) => ({
        ...data,
        existingLog: {
          id: -Date.now(),
          ...payload,
          day_of_week: data.dayName,
          teacher_name: currentUser?.full_name || 'Demo teacher',
        },
      }));
      return simulate({
        log: { id: -Date.now(), ...payload },
        created: true,
        progress: null,
      });
    },
    deleteLesson: () => simulate({ deleted: true }),

    attendance: (classId, params) => read(`/teacher/classes/${classId}/attendance${query(params)}`),
    saveAttendance: (classId, payload) => {
      patch(`/teacher/classes/${classId}/attendance`, (data) => ({
        ...data,
        roster: data.roster.map((student) => {
          const entry = payload.entries.find((e) => e.student_id === student.id);
          return entry ? { ...student, ...entry } : student;
        }),
      }));
      const counts = { present: 0, late: 0, absent: 0, excused: 0 };
      for (const e of payload.entries) counts[e.status] += 1;
      return simulate({
        saved: payload.entries.length,
        summary: { ...counts, recorded: payload.entries.length, rate: null, sessions: 0 },
      });
    },

    roster: (classId) => read(`/teacher/classes/${classId}/roster`),
    student: (id, params) => read(`/teacher/students/${id}${query(params)}`),
    saveAssessment: (studentId, payload) => {
      patch(`/teacher/students/${studentId}`, (data) => {
        const rest = data.assessments.filter((a) => a.subject !== payload.subject);
        return {
          ...data,
          assessments: [...rest, {
            id: -Date.now(), ...payload,
            assessed_on: fixtures.today,
            assessor: currentUser?.full_name,
          }].sort((a, b) => a.subject.localeCompare(b.subject)),
        };
      });
      return simulate(payload);
    },
    saveMemorization: (studentId, payload) => {
      patch(`/teacher/students/${studentId}`, (data) => ({
        ...data,
        memorization: [
          ...data.memorization.filter((m) => m.item_type !== payload.item_type),
          { id: -Date.now(), ...payload, verified_on: payload.status === 'mastered' ? fixtures.today : null },
        ],
      }));
      return simulate(payload);
    },

    homework: (classId) => read(`/teacher/classes/${classId}/homework`),
    createHomework: (classId, payload) => {
      patch(`/teacher/classes/${classId}/homework`, (rows) => [{
        id: -Date.now(), class_id: classId, ...payload, author: currentUser?.full_name,
      }, ...rows]);
      return simulate();
    },
    deleteHomework: () => simulate({ deleted: true }),

    threads: () => read('/teacher/threads'),
    thread: (id) => read(`/teacher/threads/${id}`),
    startThread: () => simulate({ thread_id: -1 }),
    reply: (id, body) => {
      patch(`/teacher/threads/${id}`, (data) => ({
        ...data,
        messages: [...data.messages, {
          id: -Date.now(),
          thread_id: id,
          sender_id: currentUser?.id,
          sender_name: currentUser?.full_name,
          sender_role: currentUser?.role,
          body,
          created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        }],
      }));
      return simulate({ sent: true });
    },
    guardians: (classId) => read(`/teacher/classes/${classId}/guardians`),
  },

  // ── Parent ────────────────────────────────────────────────────────────────
  parent: {
    home: () => read('/parent/home'),
    child: (id, params) => read(`/parent/children/${id}${query(params)}`),
    attendance: (id, params) => read(`/parent/children/${id}/attendance${query(params)}`),
    lessons: (id, params) => read(`/parent/children/${id}/lessons${query(params)}`),
    reportCard: (id, params) => read(`/parent/children/${id}/report-card${query(params)}`),
    threads: () => read('/parent/threads'),
    thread: (id) => read(`/parent/threads/${id}`),
    startThread: () => simulate({ thread_id: -1 }),
    reply: (id, body) => {
      patch(`/parent/threads/${id}`, (data) => ({
        ...data,
        messages: [...data.messages, {
          id: -Date.now(),
          thread_id: id,
          sender_id: currentUser?.id,
          sender_name: currentUser?.full_name,
          sender_role: 'parent',
          body,
          created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        }],
      }));
      return simulate({ sent: true });
    },
    contacts: () => read('/parent/contacts'),
  },
};

export const api = demoApi;
export const isDemo = true;
export const demoCapturedAt = fixtures.capturedAt;
