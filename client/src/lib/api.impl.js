/**
 * API client.
 *
 * Wraps fetch with the two things every call needs: the CSRF token the server
 * expects on cookie-authenticated writes, and error normalization so screens
 * can show the server's own message instead of a status code.
 */

const BASE = '/api';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function request(method, path, body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  // The server issues a readable CSRF cookie at sign-in; echo it on writes.
  if (!['GET', 'HEAD'].includes(method)) {
    const token = readCookie('maktab_csrf');
    if (token) headers['X-Maktab-CSRF'] = token;
  }

  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { /* not JSON */ }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error || `Request failed (${response.status})`,
      payload?.details
    );
  }
  return payload?.data;
}

const query = (params = {}) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

const http = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body ?? {}),
  put: (path, body) => request('PUT', path, body ?? {}),
  patch: (path, body) => request('PATCH', path, body ?? {}),
  del: (path) => request('DELETE', path),
};

export const api = {
  // ── Session ──────────────────────────────────────────────────────────────
  login: (identifier, secret) => http.post('/auth/login', { identifier, secret }),
  logout: () => http.post('/auth/logout'),
  session: () => http.get('/auth/session'),
  demoAccounts: () => http.get('/auth/demo-accounts'),
  changePassword: (current_password, new_password) =>
    http.post('/auth/change-password', { current_password, new_password }),
  updateProfile: (payload) => http.patch('/profile', payload),

  // ── Shared ───────────────────────────────────────────────────────────────
  terms: () => http.get('/terms'),
  today: () => http.get('/today'),
  curriculum: (params) => http.get(`/curriculum${query(params)}`),
  announcements: (params) => http.get(`/announcements${query(params)}`),

  // ── Admin ────────────────────────────────────────────────────────────────
  admin: {
    dashboard: () => http.get('/admin/dashboard'),
    classes: () => http.get('/admin/classes'),
    classDetail: (id, params) => http.get(`/admin/classes/${id}/detail${query(params)}`),
    createClass: (payload) => http.post('/admin/classes', payload),
    updateClass: (id, payload) => http.patch(`/admin/classes/${id}`, payload),
    archiveClass: (id) => http.del(`/admin/classes/${id}`),
    assignTeacher: (classId, payload) => http.post(`/admin/classes/${classId}/teachers`, payload),
    unassignTeacher: (classId, userId) => http.del(`/admin/classes/${classId}/teachers/${userId}`),

    students: (params) => http.get(`/admin/students${query(params)}`),
    studentDetail: (id, params) => http.get(`/admin/students/${id}/detail${query(params)}`),
    createStudent: (payload) => http.post('/admin/students', payload),
    updateStudent: (id, payload) => http.patch(`/admin/students/${id}`, payload),
    withdrawStudent: (id) => http.del(`/admin/students/${id}`),
    linkGuardian: (studentId, payload) => http.post(`/admin/students/${studentId}/guardians`, payload),
    unlinkGuardian: (studentId, userId) => http.del(`/admin/students/${studentId}/guardians/${userId}`),

    users: (params) => http.get(`/admin/users${query(params)}`),
    createUser: (payload) => http.post('/admin/users', payload),
    updateUser: (id, payload) => http.patch(`/admin/users/${id}`, payload),
    resetPassword: (id) => http.post(`/admin/users/${id}/reset-password`),
    setPin: (id, pin) => http.post(`/admin/users/${id}/set-pin`, { pin }),

    setCurrentTerm: (term_number) => http.post('/admin/terms/set-current', { term_number }),
    updateTerm: (id, payload) => http.patch(`/admin/terms/${id}`, payload),

    curriculumGaps: () => http.get('/admin/curriculum-gaps'),
    createTopic: (payload) => http.post('/admin/curriculum-topics', payload),
    updateTopic: (id, payload) => http.patch(`/admin/curriculum-topics/${id}`, payload),
    retireTopic: (id) => http.del(`/admin/curriculum-topics/${id}`),

    allAnnouncements: () => http.get('/admin/announcements'),
    createAnnouncement: (payload) => http.post('/admin/announcements', payload),
    updateAnnouncement: (id, payload) => http.patch(`/admin/announcements/${id}`, payload),
    deleteAnnouncement: (id) => http.del(`/admin/announcements/${id}`),

    boardDigest: (params) => http.get(`/admin/reports/board-digest${query(params)}`),
    attendanceReport: (params) => http.get(`/admin/reports/attendance${query(params)}`),
    audit: (params) => http.get(`/admin/audit${query(params)}`),
    lessonLogs: (params) => http.get(`/admin/lesson-logs${query(params)}`),
  },

  // ── Teacher ──────────────────────────────────────────────────────────────
  teacher: {
    home: (params) => http.get(`/teacher/home${query(params)}`),
    today: (classId, params) => http.get(`/teacher/classes/${classId}/today${query(params)}`),
    progress: (classId, params) => http.get(`/teacher/classes/${classId}/progress${query(params)}`),
    logs: (classId, params) => http.get(`/teacher/classes/${classId}/logs${query(params)}`),
    saveLesson: (payload) => http.post('/teacher/lesson-logs', payload),
    deleteLesson: (id) => http.del(`/teacher/lesson-logs/${id}`),

    attendance: (classId, params) => http.get(`/teacher/classes/${classId}/attendance${query(params)}`),
    saveAttendance: (classId, payload) => http.post(`/teacher/classes/${classId}/attendance`, payload),

    roster: (classId) => http.get(`/teacher/classes/${classId}/roster`),
    student: (id, params) => http.get(`/teacher/students/${id}${query(params)}`),
    saveAssessment: (studentId, payload) => http.put(`/teacher/students/${studentId}/assessments`, payload),
    saveMemorization: (studentId, payload) => http.put(`/teacher/students/${studentId}/memorization`, payload),

    homework: (classId) => http.get(`/teacher/classes/${classId}/homework`),
    createHomework: (classId, payload) => http.post(`/teacher/classes/${classId}/homework`, payload),
    deleteHomework: (id) => http.del(`/teacher/homework/${id}`),

    threads: () => http.get('/teacher/threads'),
    thread: (id) => http.get(`/teacher/threads/${id}`),
    startThread: (payload) => http.post('/teacher/threads', payload),
    reply: (id, body) => http.post(`/teacher/threads/${id}/messages`, { body }),
    guardians: (classId) => http.get(`/teacher/classes/${classId}/guardians`),
  },

  // ── Parent ───────────────────────────────────────────────────────────────
  parent: {
    home: () => http.get('/parent/home'),
    child: (id, params) => http.get(`/parent/children/${id}${query(params)}`),
    attendance: (id, params) => http.get(`/parent/children/${id}/attendance${query(params)}`),
    lessons: (id, params) => http.get(`/parent/children/${id}/lessons${query(params)}`),
    reportCard: (id, params) => http.get(`/parent/children/${id}/report-card${query(params)}`),
    threads: () => http.get('/parent/threads'),
    thread: (id) => http.get(`/parent/threads/${id}`),
    startThread: (payload) => http.post('/parent/threads', payload),
    reply: (id, body) => http.post(`/parent/threads/${id}/messages`, { body }),
    contacts: () => http.get('/parent/contacts'),
  },
};
