/**
 * The light / dark switch, across every screen of all three portals.
 *
 * "It toggles" is not the claim worth testing — a toggle that flips a class and
 * changes nothing visible would pass that. So this measures the rendered
 * pixels: the page ground has to actually move between light and dark, the body
 * text has to keep a real contrast ratio against whatever it lands on, and no
 * screen may be left painting one scheme's text on the other scheme's ground.
 *
 * It walks every route in the route table rather than a sample, because the
 * defect this guards against — a color hard-coded in one component — shows up
 * on exactly one screen and nowhere else.
 *
 * Run with: node tests/theme.test.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.THEME_TEST_PORT || 3411);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = 'maktab2027';
const DB = path.join(ROOT, 'server', `theme-test-${process.pid}.db`);

let failures = 0;
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { failures += 1; console.log(`  ✗ ${m}`); };
const check = (ok, m) => (ok ? pass(m) : fail(m));

/** Every screen a signed-in user can reach, per role. */
const ROUTES = {
  admin: [
    '/admin', '/admin/pacing', '/admin/classes', '/admin/students',
    '/admin/people', '/admin/curriculum', '/admin/calendar', '/admin/notices',
    '/admin/reports', '/admin/activity', '/account',
  ],
  teacher: [
    '/teacher', '/teacher/attendance', '/teacher/roster', '/teacher/messages',
    '/teacher/notices', '/teacher/curriculum', '/account',
  ],
  parent: [
    '/family', '/family/report', '/family/memorization', '/family/lessons',
    '/family/attendance', '/family/homework', '/family/messages',
    '/family/notices', '/account',
  ],
};

// ── color maths, so "legible" is a number and not an opinion ────────────────

function parseColor(value) {
  const m = String(value).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  const [r, g, b] = parts;
  const a = parts.length > 3 ? parts[3] : 1;
  return { r, g, b, a };
}

/** WCAG relative luminance. */
function luminance({ r, g, b }) {
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// ── server ──────────────────────────────────────────────────────────────────

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
      env: {
        ...process.env,
        PORT: String(PORT),
        DB_PATH: DB,
        JWT_SECRET: 'theme-test-secret-not-used-anywhere-else',
        DEMO_MODE: 'true',
        NODE_ENV: 'production',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const onData = (buf) => {
      out += buf.toString();
      if (/listening|ready|http/i.test(out)) resolve(child);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => reject(new Error(`server exited early (${code})\n${out}`)));
    setTimeout(() => resolve(child), 6000);
  });
}

async function waitForHealth() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server never became healthy');
}

// ── the run ─────────────────────────────────────────────────────────────────

async function main() {
  const server = await startServer();
  await waitForHealth();

  const launchOptions = { args: ['--no-sandbox'] };
  const pinned = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
  if (fs.existsSync(pinned)) launchOptions.executablePath = pinned;
  const browser = await chromium.launch(launchOptions);

  try {
    // ── 1. The device setting decides before anyone chooses ─────────────────
    console.log('\n── Follows the device until told otherwise ──');
    for (const scheme of ['dark', 'light']) {
      const ctx = await browser.newContext({ colorScheme: scheme });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/login`, { waitUntil: 'load' });
      await page.waitForTimeout(600);
      const state = await page.evaluate(() => ({
        stamp: document.documentElement.getAttribute('data-theme'),
        bg: getComputedStyle(document.body).backgroundColor,
      }));
      const lum = luminance(parseColor(state.bg));
      const wantsDark = scheme === 'dark';
      check(state.stamp === null, `device set to ${scheme}: no data-theme stamp is forced`);
      check(
        wantsDark ? lum < 0.2 : lum > 0.6,
        `device set to ${scheme}: page renders ${wantsDark ? 'dark' : 'light'} (luminance ${lum.toFixed(3)})`
      );
      await ctx.close();
    }

    // ── 2. The switch is reachable before sign-in ──────────────────────────
    console.log('\n── Reachable on the sign-in screen ──');
    {
      const ctx = await browser.newContext({ colorScheme: 'dark' });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/login`, { waitUntil: 'load' });
      await page.waitForTimeout(600);
      const toggle = page.locator('[data-theme-toggle]');
      check(await toggle.count() > 0, 'the switch is present without signing in');
      const before = luminance(parseColor(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)));
      await toggle.first().click();
      await page.waitForTimeout(500);
      const after = luminance(parseColor(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)));
      check(after > before + 0.4, `pressing it lightens the sign-in screen (${before.toFixed(3)} → ${after.toFixed(3)})`);
      const label = await toggle.first().getAttribute('aria-label');
      check(/dark mode$/.test(label || ''), `it then offers the way back ("${label}")`);
      await ctx.close();
    }

    // ── 3. Every screen, in both schemes ───────────────────────────────────
    const accountsRes = await fetch(`${BASE}/api/auth/demo-accounts`);
    const accountsBody = await accountsRes.json();
    const accounts = accountsBody.data?.accounts || [];
    const emailFor = (role) => accounts.find((a) => a.role === role)?.email;

    for (const role of ['admin', 'teacher', 'parent']) {
      const email = emailFor(role);
      console.log(`\n── ${role} portal — every screen, both schemes (${email}) ──`);

      const ctx = await browser.newContext({ colorScheme: 'dark' });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

      await page.goto(`${BASE}/login`, { waitUntil: 'load' });
      await page.waitForTimeout(500);
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1500);

      for (const route of ROUTES[role]) {
        const readings = {};
        let toggleSeen = true;

        for (const want of ['dark', 'light']) {
          // Set the theme explicitly, then land on the route, so each reading
          // is of a fully painted page rather than a transition.
          await page.evaluate((t) => {
            document.documentElement.setAttribute('data-theme', t);
            try { window.localStorage.setItem('maktab_theme', t); } catch { /* ignore */ }
          }, want);
          await page.goto(`${BASE}${route}`, { waitUntil: 'load' });
          await page.waitForTimeout(700);

          readings[want] = await page.evaluate(() => {
            const body = getComputedStyle(document.body);
            // Sample the real text nodes rather than a token, so a component
            // that hard-codes a color is caught.
            const nodes = [...document.querySelectorAll('p, td, th, h1, h2, h3, span, label, li')]
              .filter((el) => {
                const t = (el.textContent || '').trim();
                if (t.length < 3) return false;
                const r = el.getBoundingClientRect();
                return r.width > 4 && r.height > 4 && getComputedStyle(el).visibility !== 'hidden';
              })
              .slice(0, 60)
              .map((el) => {
                const cs = getComputedStyle(el);
                return { color: cs.color, text: (el.textContent || '').trim().slice(0, 30) };
              });
            return { bg: body.backgroundColor, nodes, count: nodes.length };
          });

          if (!(await page.locator('[data-theme-toggle]').count())) toggleSeen = false;
        }

        const darkLum = luminance(parseColor(readings.dark.bg));
        const lightLum = luminance(parseColor(readings.light.bg));

        // The ground genuinely moves.
        if (!(darkLum < 0.2 && lightLum > 0.6)) {
          fail(`${route} — ground does not switch (dark ${darkLum.toFixed(3)}, light ${lightLum.toFixed(3)})`);
          continue;
        }

        // Nothing is left illegible in either scheme.
        let worst = { ratio: 99, scheme: null, text: null };
        for (const scheme of ['dark', 'light']) {
          const bg = parseColor(readings[scheme].bg);
          for (const node of readings[scheme].nodes) {
            const fg = parseColor(node.color);
            if (!fg || fg.a === 0) continue;
            const ratio = contrast(fg, bg);
            if (ratio < worst.ratio) worst = { ratio, scheme, text: node.text };
          }
        }

        // 4.5:1 is the AA floor for body text. Sampling includes small muted
        // labels, so anything at or above it on every node is a good signal.
        const legible = worst.ratio >= 4.5;
        const sampled = readings.dark.count;
        if (legible && toggleSeen) {
          pass(`${route} — switches, ${sampled} text nodes checked, worst contrast ${worst.ratio.toFixed(2)}:1`);
        } else if (!toggleSeen) {
          fail(`${route} — the switch is missing from this screen`);
        } else {
          fail(`${route} — "${worst.text}" only ${worst.ratio.toFixed(2)}:1 in ${worst.scheme} (needs 4.5:1)`);
        }
      }

      check(errors.length === 0, `${role}: no console errors across ${ROUTES[role].length} screens${errors.length ? ` — ${errors.slice(0, 2).join(' | ')}` : ''}`);
      await ctx.close();
    }

    // ── 4. The choice sticks ───────────────────────────────────────────────
    console.log('\n── The choice is remembered ──');
    {
      const ctx = await browser.newContext({ colorScheme: 'dark' });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/login`, { waitUntil: 'load' });
      await page.waitForTimeout(600);
      await page.locator('[data-theme-toggle]').first().click();
      await page.waitForTimeout(400);

      const stored = await page.evaluate(() => window.localStorage.getItem('maktab_theme'));
      check(stored === 'light', `the choice is stored (maktab_theme=${stored})`);

      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(700);
      const afterReload = await page.evaluate(() => ({
        stamp: document.documentElement.getAttribute('data-theme'),
        lum: getComputedStyle(document.body).backgroundColor,
      }));
      check(afterReload.stamp === 'light', 'it survives a reload even though the device asks for dark');
      check(
        luminance(parseColor(afterReload.lum)) > 0.6,
        'and the page is still light after the reload'
      );

      // Signing in must not throw the preference away.
      const res = await fetch(`${BASE}/api/auth/demo-accounts`);
      const email = (await res.json()).data.accounts.find((a) => a.role === 'teacher').email;
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1800);
      const afterSignIn = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      check(afterSignIn === 'light', 'and it carries through sign-in into the portal');
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.kill();
    for (const suffix of ['', '-shm', '-wal']) {
      try { fs.unlinkSync(DB + suffix); } catch { /* nothing to remove */ }
    }
  }

  console.log(`\n${'─'.repeat(62)}`);
  if (failures) {
    console.log(`${failures} theme check(s) FAILED`);
    process.exit(1);
  }
  console.log('Light and dark verified on every screen of all three portals.');
}

main().catch((err) => {
  console.error('\ntheme test crashed:', err);
  process.exit(1);
});
