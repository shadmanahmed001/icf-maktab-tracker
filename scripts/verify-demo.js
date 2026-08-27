/**
 * Verify the static demo page before publishing it.
 *
 * Loads the artifact page from disk in a real browser, signs in as each demo
 * role, and walks the same screens the live application was tested against.
 * A console error, a failed lookup, or a missing heading fails the run — the
 * point is to never publish a demo that errors on the reviewer's first click.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const PAGE = path.join(__dirname, '..', 'client', 'dist-demo', 'artifact.html');
const SHOT_DIR = path.join(__dirname, '..', 'screenshots', 'demo');
const PASSWORD = 'maktab2027';

let failures = [];
let checks = 0;
const assertTrue = (cond, msg) => {
  if (cond) { checks += 1; console.log(`  ✓ ${msg}`); }
  else { failures.push(msg); console.log(`  ✗ ${msg}`); }
};

const ROUTES = {
  admin: [
    ['#/admin', ['Pacing radar', 'On track']],
    ['#/admin/pacing', ['Pacing radar']],
    ['#/admin/classes', ['Grade 1 Boys']],
    ['#/admin/students', ['pupils']],
    ['#/admin/people', ['Staff & families']],
    ['#/admin/curriculum', ['Memorization target']],
    ['#/admin/calendar', ['Active term']],
    ['#/admin/notices', ['Notices']],
    ['#/admin/reports', ['pacing digest']],
    ['#/admin/activity', ['Activity log']],
  ],
  teacher: [
    ['#/teacher', ['check-off', 'Where the class stands']],
    ['#/teacher/attendance', ['All present']],
    ['#/teacher/roster', ['Students & progress']],
    ['#/teacher/coverage', ['The five strands']],
    ['#/teacher/homework', ['Homework']],
    ['#/teacher/messages', ['Parent messages']],
    ['#/teacher/notices', ['Notices']],
    ['#/teacher/curriculum', ['Curriculum']],
  ],
  parent: [
    ['#/family', ['Overall attainment']],
    ['#/family/report', ['Attainment by strand']],
    ['#/family/memorization', ['Memorization']],
    ['#/family/lessons', ['Lessons covered']],
    ['#/family/attendance', ['Session by session']],
    ['#/family/homework', ['Homework']],
    ['#/family/messages', ['Messages']],
    ['#/family/notices', ['Notices']],
  ],
};

async function main() {
  if (!fs.existsSync(PAGE)) {
    console.error(`Demo page not found at ${PAGE}`);
    process.exit(1);
  }
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const launchOptions = { args: ['--no-sandbox'] };
  const pinned = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
  if (fs.existsSync(pinned)) launchOptions.executablePath = pinned;
  const browser = await chromium.launch(launchOptions);
  const url = `file://${PAGE}`;

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(900);

    // innerText reflects CSS text-transform, so match case-insensitively.
    const body = (await page.evaluate(() => document.body.innerText)).toLowerCase();
    assertTrue(body.includes('demonstration build'), 'the demo banner is shown');
    assertTrue(body.includes('sign in'), 'the sign-in screen renders');
    assertTrue(body.includes('demonstration accounts'), 'demo accounts are offered');

    // Collect the offered accounts once, while the sign-in screen is up — the
    // list is gone from the DOM as soon as a portal mounts.
    const accounts = await page.evaluate(
      () => Array.from(document.querySelectorAll('button[data-email]'), (b) => ({
        email: b.dataset.email, role: b.dataset.role,
      }))
    );
    assertTrue(accounts.length >= 3, `the page offers ${accounts.length} demo accounts`);
    for (const role of ['admin', 'teacher', 'parent']) {
      assertTrue(
        accounts.some((a) => a.role === role),
        `a ${role} account is offered on the sign-in screen`
      );
    }

    await page.screenshot({ path: path.join(SHOT_DIR, 'demo-login.png'), fullPage: true });

    const HOME = { admin: '#/admin', teacher: '#/teacher', parent: '#/family' };

    for (const [role, routes] of Object.entries(ROUTES)) {
      console.log(`\n── demo ${role} ──`);
      const account = accounts.find((a) => a.role === role);
      if (!account) { failures.push(`no ${role} account offered`); continue; }

      // Start from a clean session each time.
      await page.evaluate(() => sessionStorage.clear());
      await page.goto(`${url}#/login`, { waitUntil: 'load' });
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(800);

      await page.fill('input[name="email"]', account.email);
      await page.fill('input[name="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1100);

      const hash = await page.evaluate(() => window.location.hash);
      const signedIn = hash.startsWith(HOME[role]);
      assertTrue(signedIn, `${role} signed in as ${account.email} (landed on ${hash || '#/'})`);
      if (!signedIn) {
        const shown = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 400);
        console.log(`      page said: ${shown}`);
        continue;
      }

      for (const [routeHash, expected] of routes) {
        await page.goto(`${url}${routeHash}`, { waitUntil: 'load' });
        await page.waitForTimeout(650);
        const text = (await page.evaluate(() => document.body.innerText)).toLowerCase();
        const missing = expected.filter((e) => !text.includes(e.toLowerCase()));
        assertTrue(missing.length === 0, `${routeHash} rendered${missing.length ? ` — missing ${missing.join(', ')}` : ''}`);
        const resolved = !text.includes('no recorded data') && !text.includes('could not load this section');
        assertTrue(resolved, `${routeHash} resolved its data`);
        if (!resolved) {
          const snippet = text.replace(/\s+/g, ' ').slice(0, 300);
          console.log(`      page said: ${snippet}`);
        }
      }

      await page.screenshot({ path: path.join(SHOT_DIR, `demo-${role}.png`), fullPage: true });
    }

    // The viewer has three theme states: an explicit data-theme stamp either
    // way, and the default with no stamp at all. All three must resolve to a
    // complete palette — a page that reads tokens from only one of them renders
    // one theme's text on the other theme's ground.
    console.log('\n── Theme states ──');
    const themeCases = [
      { stamp: 'dark', prefers: 'light', wantDark: true },
      { stamp: 'light', prefers: 'dark', wantDark: false },
      { stamp: null, prefers: 'dark', wantDark: true },
      { stamp: null, prefers: 'light', wantDark: false },
    ];

    for (const testCase of themeCases) {
      await page.emulateMedia({ colorScheme: testCase.prefers });
      await page.goto(`${url}#/login`, { waitUntil: 'load' });
      await page.evaluate((stamp) => {
        if (stamp) document.documentElement.setAttribute('data-theme', stamp);
        else document.documentElement.removeAttribute('data-theme');
      }, testCase.stamp);
      await page.waitForTimeout(250);

      const seen = await page.evaluate(() => {
        const body = getComputedStyle(document.body);
        const parse = (value) => (value.match(/\d+/g) || []).slice(0, 3).map(Number);
        const [r, g, b] = parse(body.backgroundColor);
        const [tr, tg, tb] = parse(body.color);
        return {
          bgLuma: (0.299 * r + 0.587 * g + 0.114 * b) / 255,
          textLuma: (0.299 * tr + 0.587 * tg + 0.114 * tb) / 255,
          background: body.backgroundColor,
        };
      });

      const label = `data-theme=${testCase.stamp ?? 'none'} + prefers ${testCase.prefers}`;
      const isDark = seen.bgLuma < 0.5;
      assertTrue(
        isDark === testCase.wantDark,
        `${label} renders a ${testCase.wantDark ? 'dark' : 'light'} ground (${seen.background})`
      );
      // Text and ground must sit on opposite sides, or the page is unreadable.
      assertTrue(
        Math.abs(seen.textLuma - seen.bgLuma) > 0.3,
        `${label} keeps text and ground clearly apart`
      );
    }
    await page.emulateMedia({ colorScheme: 'light' });
    await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

    assertTrue(errors.length === 0, `no console errors${errors.length ? ` — ${errors.slice(0, 3).join(' | ')}` : ''}`);
    await context.close();
  } finally {
    await browser.close();
  }

  console.log(`\n${'─'.repeat(60)}`);
  if (failures.length) {
    console.log(`DEMO NOT READY — ${failures.length} checks failed:`);
    for (const f of failures) console.log(`  • ${f}`);
    process.exit(1);
  }
  console.log(`Demo verified: all ${checks} checks passed.`);
}

/** Read an email for the given role out of the page's own account list. */
async function accountEmailFor(page, role) {
  return page.evaluate(
    (wanted) => document.querySelector(`button[data-role="${wanted}"]`)?.dataset.email || null,
    role
  );
}

main().catch((err) => {
  console.error('Demo verification crashed:', err);
  process.exit(1);
});
