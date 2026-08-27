/**
 * Browser walkthrough of all three portals.
 *
 * Boots the real server against a temporary seeded database, then drives the
 * built client with Chromium: signs in as each role, exercises the screens a
 * user actually reaches, and captures screenshots at desktop and phone widths.
 *
 * Any console error or failed request fails the run — a page that renders but
 * logs a React error is not working.
 *
 * Run with: npm run test:e2e
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const DB_FILE = path.join(os.tmpdir(), `maktab-browser-${process.pid}.db`);
process.env.DB_PATH = DB_FILE;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'browser-test-secret';
process.env.DEMO_MODE = 'true';
process.env.API_RATE_LIMIT = '100000';

const SHOT_DIR = process.env.SHOT_DIR || path.join(__dirname, '..', 'screenshots');
const PASSWORD = 'maktab2027';

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 414, height: 896 };

let failures = [];
let checks = 0;

const log = (msg) => console.log(msg);
const ok = (msg) => { checks += 1; log(`  ✓ ${msg}`); };
const fail = (msg) => { failures.push(msg); log(`  ✗ ${msg}`); };

function assertTrue(condition, msg) {
  if (condition) ok(msg); else fail(msg);
}

async function main() {
  if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);
  fs.mkdirSync(SHOT_DIR, { recursive: true });

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
  log(`\nServer listening on ${base}`);

  // This environment ships a pinned Chromium that may not match the browser
  // build Playwright expects, so point at it explicitly rather than downloading.
  const launchOptions = { args: ['--no-sandbox'] };
  const pinned = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
  if (fs.existsSync(pinned)) launchOptions.executablePath = pinned;
  const browser = await chromium.launch(launchOptions);

  try {
    await runRole(browser, base, 'admin', 'imamshadman@icfbayarea.com', ADMIN_STEPS);
    await runRole(browser, base, 'teacher', 'ahmad.sulaiman@icfbayarea.com', TEACHER_STEPS);
    const parentEmail = await findParentEmail(base);
    await runRole(browser, base, 'parent', parentEmail, PARENT_STEPS);
    await runResponsive(browser, base);
    await runAccessGuards(browser, base);
  } finally {
    await browser.close();
    server.close();
    if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);
  }

  log(`\n${'─'.repeat(60)}`);
  if (failures.length) {
    log(`FAILED — ${failures.length} of ${checks + failures.length} checks failed:`);
    for (const f of failures) log(`  • ${f}`);
    process.exit(1);
  }
  log(`All ${checks} browser checks passed. Screenshots in ${SHOT_DIR}`);
}

/** Find a seeded parent who has children, via the API. */
async function findParentEmail(base) {
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'imamshadman@icfbayarea.com', secret: PASSWORD }),
  });
  const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const res = await fetch(`${base}/api/admin/users?role=parent`, { headers: { Cookie: cookie } });
  const body = await res.json();
  const withKids = body.data.find((p) => p.children.length > 1) || body.data.find((p) => p.children.length > 0);
  return withKids.email;
}

/** Fresh page with console/network error capture attached. */
async function newPage(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Favicon 404s and similar noise are not app errors.
    if (text.includes('favicon')) return;
    errors.push(`console: ${text}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => {
    if (req.url().includes('favicon')) return;
    errors.push(`request failed: ${req.method()} ${req.url()}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 500) errors.push(`server ${res.status()}: ${res.url()}`);
  });

  return { page, context, errors };
}

async function signIn(page, base, email) {
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

const ADMIN_STEPS = [
  { path: '/admin', name: 'dashboard', expect: ['Pacing radar', 'On track'] },
  { path: '/admin/pacing', name: 'pacing', expect: ['Pacing radar'] },
  { path: '/admin/classes', name: 'classes', expect: ['Grade 1 Boys', 'Track'] },
  { path: '/admin/students', name: 'students', expect: ['pupils'] },
  { path: '/admin/people', name: 'people', expect: ['Teachers', 'Staff & families'] },
  { path: '/admin/curriculum', name: 'curriculum', expect: ['Curriculum', 'Memorization target'] },
  { path: '/admin/calendar', name: 'calendar', expect: ['Terms & calendar', 'Active term'] },
  { path: '/admin/notices', name: 'notices', expect: ['Notices'] },
  { path: '/admin/reports', name: 'reports', expect: ['pacing digest'] },
  { path: '/admin/activity', name: 'activity', expect: ['Activity log'] },
];

const TEACHER_STEPS = [
  { path: '/teacher', name: 'checkoff', expect: ['check-off', 'Where the class stands', 'Memorization target'] },
  { path: '/teacher/attendance', name: 'attendance', expect: ['Attendance', 'All present'] },
  { path: '/teacher/roster', name: 'roster', expect: ['Students & progress'] },
  { path: '/teacher/coverage', name: 'coverage', expect: ['Syllabus coverage', 'The five strands'] },
  { path: '/teacher/homework', name: 'homework', expect: ['Homework'] },
  { path: '/teacher/messages', name: 'messages', expect: ['Parent messages'] },
  { path: '/teacher/notices', name: 'notices', expect: ['Notices'] },
  { path: '/teacher/curriculum', name: 'curriculum', expect: ['Curriculum'] },
];

const PARENT_STEPS = [
  { path: '/family', name: 'overview', expect: ['progress', 'Overall attainment', 'Attendance'] },
  { path: '/family/report', name: 'report-card', expect: ['Report card', 'Attainment by strand'] },
  { path: '/family/memorization', name: 'memorization', expect: ['Memorization'] },
  { path: '/family/lessons', name: 'lessons', expect: ['Lessons covered'] },
  { path: '/family/attendance', name: 'attendance', expect: ['Attendance', 'Session by session'] },
  { path: '/family/homework', name: 'homework', expect: ['Homework'] },
  { path: '/family/messages', name: 'messages', expect: ['Messages'] },
  { path: '/family/notices', name: 'notices', expect: ['Notices'] },
];

async function runRole(browser, base, role, email, steps) {
  log(`\n── ${role.toUpperCase()} portal (${email}) ──`);
  const { page, context, errors } = await newPage(browser, DESKTOP);

  try {
    await signIn(page, base, email);
    ok(`signed in as ${role}`);

    for (const step of steps) {
      await page.goto(`${base}${step.path}`, { waitUntil: 'networkidle' });
      // Wait for the loading skeletons to resolve.
      await page.waitForTimeout(350);

      // innerText is rendered text only (textContent would include script
      // source), and reflects CSS text-transform — so match case-insensitively.
      const body = (await page.evaluate(() => document.body.innerText)).toLowerCase();
      const missing = step.expect.filter((text) => !body.includes(text.toLowerCase()));
      assertTrue(
        missing.length === 0,
        `${step.path} rendered${missing.length ? ` — missing: ${missing.join(', ')}` : ''}`
      );

      // A page showing an error block is a failure even if text matched.
      assertTrue(
        !body.includes('could not load this section'),
        `${step.path} loaded without an error block`
      );

      await page.screenshot({
        path: path.join(SHOT_DIR, `${role}-${step.name}.png`),
        fullPage: true,
      });
    }

    assertTrue(errors.length === 0, `${role} portal produced no console or network errors${
      errors.length ? ` — ${errors.slice(0, 4).join(' | ')}` : ''}`);
  } finally {
    await context.close();
  }
}

/** The teacher check-off and register are the two flows that must work on a phone. */
async function runResponsive(browser, base) {
  log('\n── Mobile layout ──');
  const { page, context, errors } = await newPage(browser, PHONE);

  try {
    await signIn(page, base, 'ahmad.sulaiman@icfbayarea.com');

    await page.goto(`${base}/teacher`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);

    // The bottom tab bar is the mobile navigation and must be present.
    const bottomNav = await page.locator('nav[aria-label="Quick navigation"]').isVisible();
    assertTrue(bottomNav, 'mobile bottom navigation is visible');

    // No horizontal overflow — the most common mobile layout defect.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    assertTrue(!overflow, 'check-off page does not scroll horizontally on a phone');

    await page.screenshot({ path: path.join(SHOT_DIR, 'mobile-teacher-checkoff.png'), fullPage: true });

    await page.goto(`${base}/teacher/attendance`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);
    const attendanceOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    assertTrue(!attendanceOverflow, 'register does not scroll horizontally on a phone');
    await page.screenshot({ path: path.join(SHOT_DIR, 'mobile-teacher-register.png'), fullPage: true });

    // The drawer menu opens. Scoped to the drawer, since the desktop sidebar is
    // present in the DOM but hidden at this width.
    await page.click('button[aria-label="Open menu"]');
    await page.waitForTimeout(300);
    const drawer = page.locator('aside[aria-label="Portal menu"]');
    assertTrue(await drawer.isVisible(), 'mobile navigation drawer opens');
    assertTrue(
      await drawer.getByText('Students & progress').isVisible(),
      'drawer lists the portal navigation'
    );
    await page.screenshot({ path: path.join(SHOT_DIR, 'mobile-teacher-drawer.png') });

    assertTrue(errors.length === 0, `mobile layout produced no errors${
      errors.length ? ` — ${errors.slice(0, 3).join(' | ')}` : ''}`);
  } finally {
    await context.close();
  }
}

/** A signed-in user must not be able to reach another role's portal. */
async function runAccessGuards(browser, base) {
  log('\n── Portal access guards ──');
  const { page, context } = await newPage(browser, DESKTOP);

  try {
    await signIn(page, base, 'ahmad.sulaiman@icfbayarea.com');

    await page.goto(`${base}/admin`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    assertTrue(
      !page.url().includes('/admin'),
      `a teacher visiting /admin is redirected away (landed on ${new URL(page.url()).pathname})`
    );

    await page.goto(`${base}/family`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    assertTrue(
      !page.url().includes('/family'),
      `a teacher visiting /family is redirected away (landed on ${new URL(page.url()).pathname})`
    );

    // Signing out returns to the login screen and protects the portal.
    await page.goto(`${base}/teacher`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    await page.click('button[aria-haspopup="menu"]');
    await page.waitForTimeout(200);
    await page.click('text=Sign out');
    await page.waitForTimeout(600);

    await page.goto(`${base}/teacher`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    assertTrue(page.url().includes('/login'), 'after signing out, the portal redirects to sign-in');
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error('\nBrowser test run crashed:', err);
  process.exit(1);
});
