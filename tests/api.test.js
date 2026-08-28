/**
 * End-to-end API tests.
 *
 * Boots the real server against a throwaway database seeded with demo data,
 * then drives it over HTTP exactly as the browser does — cookie sessions, CSRF
 * header and all. Run with: npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DB_FILE = path.join(os.tmpdir(), `maktab-test-${process.pid}.db`);
process.env.DB_PATH = DB_FILE;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-in-production';
process.env.DEMO_MODE = 'true';
process.env.API_RATE_LIMIT = '100000';
process.env.LOGIN_ATTEMPTS = '1000';

const { initDb, flush } = require('../server/db');
const seedDatabase = require('../server/seed');
const { app } = require('../server/index');

let baseUrl;
let server;

/** Minimal cookie-jar HTTP client mirroring the browser's behavior. */
function createClient() {
  const jar = new Map();

  const readCookies = (res) => {
    for (const raw of res.headers.getSetCookie?.() || []) {
      const [pair] = raw.split(';');
      const idx = pair.indexOf('=');
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (value === '') jar.delete(name);
      else jar.set(name, value);
    }
  };

  async function request(method, urlPath, body, { csrf = true } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (jar.size) {
      headers.Cookie = [...jar.entries()].map(([k, val]) => `${k}=${val}`).join('; ');
    }
    // The browser reads the readable CSRF cookie and echoes it back on writes.
    if (csrf && jar.has('maktab_csrf')) headers['X-Maktab-CSRF'] = jar.get('maktab_csrf');

    const res = await fetch(`${baseUrl}${urlPath}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    readCookies(res);
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON response */ }
    return { status: res.status, body: json, text };
  }

  return {
    get: (p) => request('GET', p),
    post: (p, b, o) => request('POST', p, b ?? {}, o),
    put: (p, b) => request('PUT', p, b ?? {}),
    patch: (p, b) => request('PATCH', p, b ?? {}),
    del: (p) => request('DELETE', p),
    jar,
    async login(email, password = 'maktab2027') {
      const res = await request('POST', '/api/auth/login', { identifier: email, secret: password });
      assert.equal(res.status, 200, `login failed for ${email}: ${res.text}`);
      return res.body.data;
    },
  };
}

test.before(async () => {
  if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);
  await initDb();
  seedDatabase();
  flush();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(() => {
  server?.close();
  if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);
});

// ── Public surface ──────────────────────────────────────────────────────────

test('health endpoint reports ok', async () => {
  const res = await createClient().get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('protected endpoints reject anonymous callers', async () => {
  const anon = createClient();
  for (const p of ['/api/terms', '/api/admin/dashboard', '/api/teacher/home', '/api/parent/home']) {
    const res = await anon.get(p);
    assert.equal(res.status, 401, `${p} should require authentication`);
  }
});

test('login rejects a wrong password without revealing whether the account exists', async () => {
  const client = createClient();
  const bad = await client.post('/api/auth/login', { identifier: 'imamshadman@icfbayarea.com', secret: 'wrong' });
  const missing = await client.post('/api/auth/login', { identifier: 'nobody@example.com', secret: 'wrong' });
  assert.equal(bad.status, 401);
  assert.equal(missing.status, 401);
  assert.equal(bad.body.error, missing.body.error);
});

test('login validates its input', async () => {
  const res = await createClient().post('/api/auth/login', { identifier: '' });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /identifier/);
});

// ── Admin ───────────────────────────────────────────────────────────────────

test('admin signs in and the session survives subsequent requests', async () => {
  const admin = createClient();
  const data = await admin.login('imamshadman@icfbayarea.com');
  assert.equal(data.user.role, 'admin');

  const session = await admin.get('/api/auth/session');
  assert.equal(session.body.data.user.email, 'imamshadman@icfbayarea.com');
});

test('admin dashboard returns school-wide pacing', async () => {
  const admin = createClient();
  await admin.login('imamshadman@icfbayarea.com');
  const res = await admin.get('/api/admin/dashboard');
  assert.equal(res.status, 200);

  const d = res.body.data;
  assert.equal(d.pacing.length, 12, 'every class should appear in the pacing radar');
  assert.ok(d.stats.students > 100, 'seeded roll should be populated');
  assert.ok(d.term, 'a current term must be resolved');
  assert.ok(Array.isArray(d.recentActivity));

  for (const row of d.pacing) {
    assert.ok(['on_track', 'watch', 'behind', 'not_started'].includes(row.pacingStatus));
    assert.ok(row.progressPercent >= 0 && row.progressPercent <= 100);
    assert.ok(row.loggingPercent >= 0 && row.loggingPercent <= 100);
  }

  // The seed deliberately under-logs two classes; the radar must surface that.
  assert.ok(
    d.pacing.some((p) => p.pacingStatus !== 'on_track'),
    'pacing should distinguish classes that are behind'
  );
});

test('admin can create, read back and archive a class', async () => {
  const admin = createClient();
  await admin.login('imamshadman@icfbayarea.com');

  const created = await admin.post('/api/admin/classes', {
    name: 'Grade 1 Evening', grade: 1, gender_track: 'boys', room: 'Room 110',
  });
  assert.equal(created.status, 200);
  const id = created.body.data.id;

  const list = await admin.get('/api/admin/classes');
  assert.ok(list.body.data.some((c) => c.id === id));

  const archived = await admin.del(`/api/admin/classes/${id}`);
  assert.equal(archived.status, 200);
});

test('admin cannot archive a class that still has students enrolled', async () => {
  const admin = createClient();
  await admin.login('imamshadman@icfbayarea.com');
  const classes = await admin.get('/api/admin/classes');
  const populated = classes.body.data.find((c) => c.student_count > 0);

  const res = await admin.del(`/api/admin/classes/${populated.id}`);
  assert.equal(res.status, 409);
  assert.match(res.body.error, /students?/i);
});

test('admin creating a user gets a one-time temporary password that works', async () => {
  const admin = createClient();
  await admin.login('imamshadman@icfbayarea.com');

  const res = await admin.post('/api/admin/users', {
    full_name: 'Ustadha Test Teacher', email: 'test.teacher@icfbayarea.com', role: 'teacher',
  });
  assert.equal(res.status, 200);
  const temp = res.body.data.temporaryPassword;
  assert.ok(temp && temp.length >= 6);

  const fresh = createClient();
  const login = await fresh.post('/api/auth/login', {
    identifier: 'test.teacher@icfbayarea.com', secret: temp,
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.data.user.must_change_password, 1);
});

test('admin cannot create two accounts with the same email', async () => {
  const admin = createClient();
  await admin.login('imamshadman@icfbayarea.com');
  const res = await admin.post('/api/admin/users', {
    full_name: 'Duplicate', email: 'imamshadman@icfbayarea.com', role: 'admin',
  });
  assert.equal(res.status, 409);
});

test('the last active administrator cannot be demoted or deactivated', async () => {
  const admin = createClient();
  await admin.login('imamshadman@icfbayarea.com');
  const users = await admin.get('/api/admin/users?role=admin');
  const admins = users.body.data;

  // Deactivate all but one, then confirm the final one is protected.
  for (const a of admins.slice(1)) {
    const res = await admin.patch(`/api/admin/users/${a.id}`, { is_active: false });
    assert.equal(res.status, 200);
  }
  const res = await admin.patch(`/api/admin/users/${admins[0].id}`, { is_active: false });
  assert.equal(res.status, 409);
  assert.match(res.body.error, /administrator/i);

  // Restore the others so later tests see a normal school.
  for (const a of admins.slice(1)) {
    await admin.patch(`/api/admin/users/${a.id}`, { is_active: true });
  }
});

test('board digest report covers every class with a week matrix', async () => {
  const admin = createClient();
  await admin.login('imamshadman@icfbayarea.com');
  const res = await admin.get('/api/admin/reports/board-digest');
  assert.equal(res.status, 200);

  const d = res.body.data;
  assert.ok(d.rows.length >= 12);
  for (const row of d.rows) {
    assert.ok(row.className);
    assert.ok(Array.isArray(row.week) && row.week.length === 5, 'five teaching days per week');
    assert.ok(row.nextTopic);
  }
  assert.ok(d.totals.attendance.rate === null || d.totals.attendance.rate >= 0);
});

test('attendance report flags students with repeated absences', async () => {
  const admin = createClient();
  await admin.login('imamshadman@icfbayarea.com');
  const res = await admin.get('/api/admin/reports/attendance');
  assert.equal(res.status, 200);
  assert.ok(res.body.data.byClass.length >= 12);
  assert.ok(Array.isArray(res.body.data.concerns));
});

// ── Teacher ─────────────────────────────────────────────────────────────────

async function teacherClient() {
  const client = createClient();
  const data = await client.login('ahmad.sulaiman@icfbayarea.com');
  return { client, classes: data.classes };
}

test('teacher signs in with a PIN as well as a password', async () => {
  const client = createClient();
  const res = await client.post('/api/auth/login', {
    identifier: 'ahmad.sulaiman@icfbayarea.com', secret: '1001',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.role, 'teacher');
});

test('teacher home lists only their own classes', async () => {
  const { client, classes } = await teacherClient();
  assert.equal(classes.length, 1, 'Grade 1 Boys teacher has one class');

  const res = await client.get('/api/teacher/home');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.classes.length, 1);
  assert.equal(res.body.data.classes[0].class.name, 'Grade 1 Boys');
  assert.ok(res.body.data.expectedSubject, 'the expected subject for today should be resolved');
});

test('teacher daily log screen suggests the next uncovered standard', async () => {
  const { client, classes } = await teacherClient();
  const res = await client.get(`/api/teacher/classes/${classes[0].id}/today`);
  assert.equal(res.status, 200);

  const d = res.body.data;
  assert.ok(d.suggestedTopic, 'a standard should be suggested');
  assert.ok(d.roster.length > 0, 'the roster should be populated');
  assert.ok(d.memorizationStandard, 'the term memorization target should be present');
  assert.equal(d.coverage.length, 5, 'five subjects per term');
});

test('the daily log endpoint returns every progress field the screen renders', async () => {
  const { client, classes } = await teacherClient();
  const res = await client.get(`/api/teacher/classes/${classes[0].id}/today`);
  assert.equal(res.status, 200);

  // A missing field here renders as "0%" next to a non-zero count, which is
  // how this was caught the first time.
  for (const field of [
    'completionPercent', 'progressPercent', 'expectedPercent', 'pacingStatus',
    'pacingLabel', 'coveredCount', 'requiredCount', 'loggedSessions',
    'expectedSessions', 'loggingPercent',
  ]) {
    assert.notEqual(
      res.body.data.progress[field], undefined,
      `progress.${field} must be present`
    );
  }

  const p = res.body.data.progress;
  assert.ok(
    p.coveredCount === 0 || p.progressPercent > 0,
    'a class with achieved standards must not report 0% progress'
  );
});

test('the lead teacher is listed before assistants', async () => {
  const admin = createClient();
  await admin.login('imamshadman@icfbayarea.com');
  const classes = (await admin.get('/api/admin/classes')).body.data;
  const shared = classes.find((c) => c.teachers.length > 1);
  assert.ok(shared, 'the seed should include a class with more than one teacher');
  assert.equal(shared.teachers[0].role, 'lead', 'the lead teacher comes first');
});

test('logging a lesson updates coverage and re-saving the same day does not double count', async () => {
  const { client, classes } = await teacherClient();
  const classId = classes[0].id;

  const before = await client.get(`/api/teacher/classes/${classId}/progress`);
  const topic = before.body.data.coverage.find((t) => t.state !== 'achieved');

  const first = await client.post('/api/teacher/lesson-logs', {
    class_id: classId,
    topic_id: topic.id,
    date: '2026-08-26',
    subject: topic.subject,
    topic_covered: topic.topic_title,
    expected_indicator: topic.expected_indicator,
    status: 'completed',
    class_mastery: 'mastered',
    notes: 'Recorded by the automated test suite.',
  });
  assert.equal(first.status, 200);

  const after = await client.get(`/api/teacher/classes/${classId}/progress`);
  const covered = after.body.data.coverage.find((t) => t.id === topic.id);
  assert.equal(covered.state, 'achieved', 'a mastered completed log achieves the standard');

  // Saving again for the same class, date and subject must update in place.
  const logsBefore = (await client.get(`/api/teacher/classes/${classId}/logs`)).body.data.length;
  const second = await client.post('/api/teacher/lesson-logs', {
    class_id: classId,
    topic_id: topic.id,
    date: '2026-08-26',
    subject: topic.subject,
    topic_covered: `${topic.topic_title} (revised)`,
    status: 'completed',
    class_mastery: 'mastered',
  });
  assert.equal(second.status, 200);
  assert.equal(second.body.data.created, false, 'the second save should update, not insert');
  const logsAfter = (await client.get(`/api/teacher/classes/${classId}/logs`)).body.data.length;
  assert.equal(logsAfter, logsBefore, 'no duplicate log row');
});

test('a lesson cannot be logged for a future date', async () => {
  const { client, classes } = await teacherClient();
  const res = await client.post('/api/teacher/lesson-logs', {
    class_id: classes[0].id,
    date: '2027-12-31',
    subject: 'Fiqh',
    topic_covered: 'Future lesson',
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /future/i);
});

test('teacher cannot touch a class they are not assigned to', async () => {
  const { client, classes } = await teacherClient();
  const mine = classes[0].id;
  const notMine = mine === 1 ? 2 : 1;

  const read = await client.get(`/api/teacher/classes/${notMine}/today`);
  assert.equal(read.status, 403);

  const write = await client.post('/api/teacher/lesson-logs', {
    class_id: notMine, date: '2026-08-26', subject: 'Fiqh', topic_covered: 'Should be refused',
  });
  assert.equal(write.status, 403);
});

test('teacher records attendance for the whole class in one request', async () => {
  const { client, classes } = await teacherClient();
  const classId = classes[0].id;

  const today = await client.get(`/api/teacher/classes/${classId}/today`);
  const roster = today.body.data.roster;

  const entries = roster.map((s, i) => ({
    student_id: s.id,
    status: i === 0 ? 'absent' : (i === 1 ? 'late' : 'present'),
    minutes_late: i === 1 ? 10 : 0,
  }));

  const res = await client.post(`/api/teacher/classes/${classId}/attendance`, {
    date: '2026-08-26', entries,
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.saved, entries.length);
  assert.equal(res.body.data.summary.absent, 1);
  assert.equal(res.body.data.summary.late, 1);

  // Re-submitting corrects the record rather than duplicating it.
  const corrected = await client.post(`/api/teacher/classes/${classId}/attendance`, {
    date: '2026-08-26',
    entries: [{ student_id: roster[0].id, status: 'excused', note: 'Parent called' }],
  });
  assert.equal(corrected.status, 200);
  const check = await client.get(`/api/teacher/classes/${classId}/attendance?date=2026-08-26`);
  const first = check.body.data.roster.find((s) => s.id === roster[0].id);
  assert.equal(first.status, 'excused');
});

test('attendance is refused for a student in another class', async () => {
  const { client, classes } = await teacherClient();
  const otherStudent = 9999;
  const res = await client.post(`/api/teacher/classes/${classes[0].id}/attendance`, {
    date: '2026-08-26',
    entries: [{ student_id: otherStudent, status: 'present' }],
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /not enrolled/i);
});

test('teacher records an assessment and a memorization verification', async () => {
  const { client, classes } = await teacherClient();
  const roster = (await client.get(`/api/teacher/classes/${classes[0].id}/roster`)).body.data;
  const student = roster[0];

  const assessed = await client.put(`/api/teacher/students/${student.id}/assessments`, {
    term_number: 1, subject: 'Fiqh', mastery_level: 'mastered', comment: 'Recites confidently.',
  });
  assert.equal(assessed.status, 200);
  assert.equal(assessed.body.data.mastery_level, 'mastered');

  const mem = await client.put(`/api/teacher/students/${student.id}/memorization`, {
    term_number: 1, item_type: 'surah', item_label: 'Al-Lahab', status: 'mastered',
  });
  assert.equal(mem.status, 200);
  assert.ok(mem.body.data.verified_on, 'mastering an item stamps the verification date');

  const detail = await client.get(`/api/teacher/students/${student.id}`);
  assert.equal(detail.status, 200);
  assert.ok(detail.body.data.overall, 'an overall mastery index should be computed');
});

test('an invalid mastery level is rejected with a helpful message', async () => {
  const { client, classes } = await teacherClient();
  const roster = (await client.get(`/api/teacher/classes/${classes[0].id}/roster`)).body.data;
  const res = await client.put(`/api/teacher/students/${roster[0].id}/assessments`, {
    term_number: 1, subject: 'Fiqh', mastery_level: 'brilliant',
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /mastery_level/);
});

test('teacher cannot reach admin management endpoints', async () => {
  const { client } = await teacherClient();
  for (const p of ['/api/admin/dashboard', '/api/admin/users', '/api/admin/reports/board-digest']) {
    const res = await client.get(p);
    assert.equal(res.status, 403, `${p} must be admin-only`);
  }
});

// ── Parent ──────────────────────────────────────────────────────────────────

/** Find a seeded parent who has at least one child, plus that child's id. */
async function parentWithChild() {
  const admin = createClient();
  await admin.login('imamshadman@icfbayarea.com');
  const parents = (await admin.get('/api/admin/users?role=parent')).body.data;
  const withKids = parents.find((p) => p.children.length > 0);
  const client = createClient();
  const data = await client.login(withKids.email);
  return { client, parent: withKids, children: data.children };
}

test('parent home shows only their own children', async () => {
  const { client, parent, children } = await parentWithChild();
  assert.ok(children.length > 0);

  const res = await client.get('/api/parent/home');
  assert.equal(res.status, 200);
  const ids = res.body.data.children.map((c) => c.id).sort();
  assert.deepEqual(ids, parent.children.map((c) => c.id).sort());

  for (const child of res.body.data.children) {
    assert.ok(child.class_name, 'each child should show their class');
    assert.ok(child.attendance, 'attendance summary should be present');
  }
});

test('parent cannot read a child who is not theirs', async () => {
  const { client, children } = await parentWithChild();
  const mine = new Set(children.map((c) => c.id));

  const admin = createClient();
  await admin.login('imamshadman@icfbayarea.com');
  const allStudents = (await admin.get('/api/admin/students')).body.data;
  const stranger = allStudents.find((s) => !mine.has(s.id));

  const res = await client.get(`/api/parent/children/${stranger.id}`);
  assert.equal(res.status, 403);
});

test('parent report card includes assessments, attendance and memorization', async () => {
  const { client, children } = await parentWithChild();
  const res = await client.get(`/api/parent/children/${children[0].id}/report-card`);
  assert.equal(res.status, 200);

  const d = res.body.data;
  assert.ok(d.student.first_name);
  assert.ok(d.term.title);
  assert.ok(Array.isArray(d.assessments));
  assert.ok(d.attendance.recorded > 0, 'the term should have attendance recorded');
  assert.ok(Array.isArray(d.masteryScale) && d.masteryScale.length === 4);
});

test('parent sees the lessons their child\'s class actually covered', async () => {
  const { client, children } = await parentWithChild();
  const res = await client.get(`/api/parent/children/${children[0].id}/lessons`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data.lessons));
  for (const lesson of res.body.data.lessons) {
    assert.ok(lesson.date && lesson.subject && lesson.topic_covered);
  }
});

test('parent cannot reach teacher or admin endpoints', async () => {
  const { client } = await parentWithChild();
  const teacher = await client.get('/api/teacher/home');
  assert.equal(teacher.status, 403);
  const admin = await client.get('/api/admin/dashboard');
  assert.equal(admin.status, 403);
});

// ── Messaging ───────────────────────────────────────────────────────────────

test('a teacher can open a conversation and the parent can reply to it', async () => {
  const admin = createClient();
  await admin.login('imamshadman@icfbayarea.com');

  // Pick a student in Grade 1 Boys along with a linked guardian.
  const teacher = createClient();
  const teacherData = await teacher.login('ahmad.sulaiman@icfbayarea.com');
  const classId = teacherData.classes[0].id;
  const contacts = (await teacher.get(`/api/teacher/classes/${classId}/guardians`)).body.data;
  const contact = contacts[0];

  const opened = await teacher.post('/api/teacher/threads', {
    student_id: contact.student_id,
    parent_id: contact.parent_id,
    subject: 'Automated test thread',
    body: 'Assalāmu ʿalaykum — a note from the test suite.',
  });
  assert.equal(opened.status, 200);
  const threadId = opened.body.data.thread_id;

  const parent = createClient();
  await parent.login(contact.email);
  const threads = (await parent.get('/api/parent/threads')).body.data;
  const found = threads.find((t) => t.id === threadId);
  assert.ok(found, 'the parent should see the new conversation');

  const reply = await parent.post(`/api/parent/threads/${threadId}/messages`, {
    body: 'Wa ʿalaykum assalām — received, jazākum Allāhu khayran.',
  });
  assert.equal(reply.status, 200);

  const conversation = (await teacher.get(`/api/teacher/threads/${threadId}`)).body.data;
  assert.equal(conversation.messages.length, 2);
  assert.equal(conversation.messages[1].sender_role, 'parent');
});

test('a parent cannot post into a conversation that is not theirs', async () => {
  const teacher = createClient();
  const teacherData = await teacher.login('ahmad.sulaiman@icfbayarea.com');
  const contacts = (await teacher.get(`/api/teacher/classes/${teacherData.classes[0].id}/guardians`)).body.data;

  const opened = await teacher.post('/api/teacher/threads', {
    student_id: contacts[0].student_id,
    parent_id: contacts[0].parent_id,
    subject: 'Private',
    body: 'Only for this family.',
  });
  const threadId = opened.body.data.thread_id;

  // A different parent, from a different family.
  const other = contacts.find((c) => c.parent_id !== contacts[0].parent_id);
  const intruder = createClient();
  await intruder.login(other.email);
  const res = await intruder.post(`/api/parent/threads/${threadId}/messages`, { body: 'Let me in' });
  assert.equal(res.status, 404, 'a thread belonging to another family must not be addressable');
});

// ── Session hardening ───────────────────────────────────────────────────────

test('a cookie session write without the CSRF header is refused', async () => {
  const client = createClient();
  await client.login('ahmad.sulaiman@icfbayarea.com');
  const res = await client.post('/api/teacher/lesson-logs', {
    class_id: 1, date: '2026-08-26', subject: 'Fiqh', topic_covered: 'No CSRF token',
  }, { csrf: false });
  assert.equal(res.status, 403);
  assert.match(res.body.error, /session token/i);
});

test('signing out clears the session', async () => {
  const client = createClient();
  await client.login('imamshadman@icfbayarea.com');
  assert.equal((await client.get('/api/admin/dashboard')).status, 200);

  await client.post('/api/auth/logout');
  assert.equal((await client.get('/api/admin/dashboard')).status, 401);
});

test('changing a password invalidates the old one and accepts the new one', async () => {
  const admin = createClient();
  await admin.login('imamshadman@icfbayarea.com');
  const created = await admin.post('/api/admin/users', {
    full_name: 'Rotate Me', email: 'rotate.me@icfbayarea.com', role: 'teacher',
  });
  const temp = created.body.data.temporaryPassword;

  const client = createClient();
  await client.login('rotate.me@icfbayarea.com', temp);
  const changed = await client.post('/api/auth/change-password', {
    current_password: temp, new_password: 'a-much-longer-passphrase',
  });
  assert.equal(changed.status, 200);

  const withOld = createClient();
  const oldAttempt = await withOld.post('/api/auth/login', {
    identifier: 'rotate.me@icfbayarea.com', secret: temp,
  });
  assert.equal(oldAttempt.status, 401);

  const withNew = createClient();
  const newAttempt = await withNew.post('/api/auth/login', {
    identifier: 'rotate.me@icfbayarea.com', secret: 'a-much-longer-passphrase',
  });
  assert.equal(newAttempt.status, 200);
});

test('a short new password is rejected', async () => {
  const client = createClient();
  await client.login('ahmad.sulaiman@icfbayarea.com');
  const res = await client.post('/api/auth/change-password', {
    current_password: 'maktab2027', new_password: 'short',
  });
  assert.equal(res.status, 400);
});

test('announcement visibility follows the audience rules', async () => {
  const admin = createClient();
  await admin.login('imamshadman@icfbayarea.com');
  const created = await admin.post('/api/admin/announcements', {
    title: 'Teachers only briefing', body: 'Staff meeting after class.', audience: 'teachers',
  });
  assert.equal(created.status, 200);

  const teacher = createClient();
  await teacher.login('ahmad.sulaiman@icfbayarea.com');
  const teacherFeed = (await teacher.get('/api/announcements')).body.data.announcements;
  assert.ok(teacherFeed.some((a) => a.title === 'Teachers only briefing'));

  const { client: parent } = await parentWithChild();
  const parentFeed = (await parent.get('/api/announcements')).body.data.announcements;
  assert.ok(
    !parentFeed.some((a) => a.title === 'Teachers only briefing'),
    'a teachers-only notice must not reach parents'
  );
});

test('unknown API routes return a JSON 404', async () => {
  const client = createClient();
  await client.login('imamshadman@icfbayarea.com');
  const res = await client.get('/api/does-not-exist');
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
});
