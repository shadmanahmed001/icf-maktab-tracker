/**
 * Capture the real API's responses as fixtures for the offline demo bundle.
 *
 * The demo published for review has no server behind it, so rather than
 * reimplementing the API in the browser — which would drift from the real one —
 * this boots the actual server against a freshly seeded database, signs in as
 * each role, and records the genuine response for every endpoint the client
 * calls. The demo then serves those recordings.
 *
 * Reads are therefore byte-identical to production. Writes are simulated in the
 * browser by the demo client.
 *
 * Run with: npm run demo:fixtures
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DB_FILE = path.join(os.tmpdir(), `maktab-fixtures-${process.pid}.db`);
process.env.DB_PATH = DB_FILE;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'fixture-capture';
process.env.DEMO_MODE = 'true';
process.env.API_RATE_LIMIT = '100000';
// This script signs in as every seeded account, well past the normal limit.
process.env.LOGIN_ATTEMPTS = '5000';

const OUT = path.join(__dirname, '..', 'client', 'src', 'demo', 'fixtures.json');
const PASSWORD = process.env.DEMO_PASSWORD || 'maktab2027';
const DEMO_TEACHERS = Number(process.env.DEMO_TEACHERS || 3);
const TERM_NUMBERS = [1, 2, 3, 0, 4];

async function main() {
  if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);

  const { initDb, flush } = require('../server/db');
  const seedDatabase = require('../server/seed');
  const { app } = require('../server/index');

  await initDb();
  seedDatabase();
  flush();

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const fixtures = { capturedAt: new Date().toISOString(), password: PASSWORD, accounts: [], responses: {} };
  let count = 0;
  // The date the server considers "today", so captured keys match what the
  // client will ask for when the demo is opened.
  const today = require('../server/util/dates').todayISO();
  fixtures.today = today;

  /** Sign in and return a fetch bound to that session. */
  async function session(email) {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email, secret: PASSWORD }),
    });
    if (!res.ok) throw new Error(`login failed for ${email}: ${await res.text()}`);
    const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    const login = await res.json();
    return {
      login: login.data,
      async get(urlPath) {
        const r = await fetch(`${base}/api${urlPath}`, { headers: { Cookie: cookie } });
        const body = await r.json();
        if (!r.ok) {
          console.warn(`  ! ${urlPath} → ${r.status} ${body.error}`);
          return null;
        }
        return body.data;
      },
    };
  }

  /**
   * Record one GET under `role|path`, plus a `role|pathWithoutQuery` alias.
   * The alias is what lets the demo answer a request whose query string it was
   * not given — a different date on the register, say — instead of erroring.
   */
  async function record(role, client, urlPath) {
    const data = await client.get(urlPath);
    if (data === null) return null;
    fixtures.responses[`${role}|${urlPath}`] = data;
    const pathOnly = urlPath.split('?')[0];
    if (pathOnly !== urlPath && !(`${role}|${pathOnly}` in fixtures.responses)) {
      fixtures.responses[`${role}|${pathOnly}`] = data;
    }
    count += 1;
    return data;
  }

  // ── Public ────────────────────────────────────────────────────────────────
  const demoAccounts = await (await fetch(`${base}/api/auth/demo-accounts`)).json();
  fixtures.responses['public|/auth/demo-accounts'] = demoAccounts.data;

  // ── Administration ────────────────────────────────────────────────────────
  console.log('Capturing administration…');
  const admin = await session('imamshadman@icfbayarea.com');
  fixtures.accounts.push({ ...admin.login.user, context: {} });

  const shared = [
    '/terms', '/today', '/announcements',
    '/curriculum?grade=1&term_number=1', '/curriculum?grade=2&term_number=1',
    '/curriculum?grade=3&term_number=1', '/curriculum?grade=4&term_number=1',
    '/curriculum?grade=5&term_number=1', '/curriculum?grade=6&term_number=1',
  ];

  for (const p of shared) await record('admin', admin, p);
  await record('admin', admin, '/admin/dashboard');
  const classes = await record('admin', admin, '/admin/classes');
  await record('admin', admin, '/admin/students');
  await record('admin', admin, '/admin/users?role=teacher&include_inactive=true');
  await record('admin', admin, '/admin/users?role=parent&include_inactive=true');
  await record('admin', admin, '/admin/users?role=admin&include_inactive=true');
  await record('admin', admin, '/admin/users?role=teacher');
  await record('admin', admin, '/admin/users?role=parent');
  await record('admin', admin, '/admin/announcements');
  await record('admin', admin, '/admin/reports/board-digest');
  for (const term of TERM_NUMBERS) {
    await record('admin', admin, `/admin/reports/board-digest?term_number=${term}`);
  }
  await record('admin', admin, '/admin/reports/attendance');
  await record('admin', admin, '/admin/audit?limit=150');

  // Per-class and a sample of per-student detail pages.
  for (const c of classes) {
    await record('admin', admin, `/admin/classes/${c.id}/detail`);
  }
  // One pupil per class — enough to reach the screen from every class page.
  const students = fixtures.responses['admin|/admin/students'];
  const seenClasses = new Set();
  for (const s of students) {
    if (seenClasses.has(s.class_id)) continue;
    seenClasses.add(s.class_id);
    await record('admin', admin, `/admin/students/${s.id}/detail`);
  }
  // Curriculum for every grade and term, so the browser can page through it.
  for (let grade = 1; grade <= 6; grade += 1) {
    for (const term of [1, 2, 3, 0, 4]) {
      await record('admin', admin, `/curriculum?grade=${grade}&term_number=${term}`);
    }
  }

  // ── Teaching ──────────────────────────────────────────────────────────────
  console.log('Capturing teaching…');
  // Only the accounts the demo's own sign-in list offers are captured — every
  // response is embedded in the page, so capturing all 149 accounts would make
  // the bundle many times larger for no reviewer benefit.
  const teacherEmails = fixtures.responses['admin|/admin/users?role=teacher']
    .filter((t) => t.classes.length > 0)
    .slice(0, DEMO_TEACHERS)
    .map((t) => t.email);

  for (const email of teacherEmails) {
    const teacher = await session(email);
    const role = `teacher:${email}`;
    fixtures.accounts.push({ ...teacher.login.user, context: { classes: teacher.login.classes } });

    for (const p of ['/terms', '/today', '/announcements']) await record(role, teacher, p);
    await record(role, teacher, '/teacher/home');
    const threads = await record(role, teacher, '/teacher/threads');

    for (const c of teacher.login.classes) {
      await record(role, teacher, `/teacher/classes/${c.id}/today`);
      await record(role, teacher, `/teacher/classes/${c.id}/today?date=${today}`);
      await record(role, teacher, `/teacher/classes/${c.id}/progress`);
      await record(role, teacher, `/teacher/classes/${c.id}/logs?limit=60`);
      await record(role, teacher, `/teacher/classes/${c.id}/attendance`);
      await record(role, teacher, `/teacher/classes/${c.id}/attendance?date=${today}`);
      await record(role, teacher, `/teacher/classes/${c.id}/roster`);
      await record(role, teacher, `/teacher/classes/${c.id}/homework`);
      await record(role, teacher, `/teacher/classes/${c.id}/guardians`);
      await record(role, teacher, `/curriculum?grade=${c.grade}&term_number=1&gender_track=${c.gender_track}`);

      const roster = fixtures.responses[`${role}|/teacher/classes/${c.id}/roster`] || [];
      for (const s of roster) await record(role, teacher, `/teacher/students/${s.id}`);
    }

    for (const t of threads || []) await record(role, teacher, `/teacher/threads/${t.id}`);
  }

  // ── Families ──────────────────────────────────────────────────────────────
  console.log('Capturing families…');
  const parents = fixtures.responses['admin|/admin/users?role=parent']
    .filter((p) => p.children.length > 0);
  // Every family with more than one child, plus a sample of single-child ones,
  // so the child switcher has something to switch between.
  const parentSample = [
    // A family with several children first, so the child switcher has a use.
    ...parents.filter((p) => p.children.length > 2).slice(0, 1),
    ...parents.filter((p) => p.children.length === 2).slice(0, 2),
    ...parents.filter((p) => p.children.length === 1).slice(0, 2),
  ];

  for (const parent of parentSample) {
    const client = await session(parent.email);
    const role = `parent:${parent.email}`;
    fixtures.accounts.push({ ...client.login.user, context: { children: client.login.children } });

    for (const p of ['/terms', '/today', '/announcements']) await record(role, client, p);
    await record(role, client, '/parent/home');
    await record(role, client, '/parent/contacts');
    const threads = await record(role, client, '/parent/threads');

    for (const child of client.login.children) {
      await record(role, client, `/parent/children/${child.id}`);
      await record(role, client, `/parent/children/${child.id}/attendance`);
      await record(role, client, `/parent/children/${child.id}/lessons`);
      await record(role, client, `/parent/children/${child.id}/report-card`);
      for (const term of TERM_NUMBERS) {
        await record(role, client, `/parent/children/${child.id}/attendance?term_number=${term}`);
        await record(role, client, `/parent/children/${child.id}/lessons?term_number=${term}`);
        await record(role, client, `/parent/children/${child.id}/report-card?term_number=${term}`);
      }
    }
    for (const t of threads || []) await record(role, client, `/parent/threads/${t.id}`);
  }

  server.close();
  if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);

  // Rebuild the sign-in list from the accounts actually captured, so the demo's
  // login screen can never offer one it has no data for.
  const hint = {
    admin: 'Full oversight of every grade',
    teacher: 'Daily check-off for their own class',
    parent: "Their own children's progress only",
  };
  fixtures.responses['public|/auth/demo-accounts'] = {
    enabled: true,
    password: PASSWORD,
    accounts: fixtures.accounts.map((a) => ({
      id: a.id,
      full_name: a.full_name,
      email: a.email,
      role: a.role,
      title: a.title,
      hint: hint[a.role],
    })),
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(fixtures));
  const sizeMb = (fs.statSync(OUT).size / 1048576).toFixed(2);
  console.log(`\nCaptured ${count} responses across ${fixtures.accounts.length} accounts → ${sizeMb} MB`);
  console.log(`Written to ${OUT}`);
}

main().catch((err) => {
  console.error('Fixture capture failed:', err);
  process.exit(1);
});
