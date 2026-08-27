/**
 * Verify the demo works the way GitHub Pages will actually serve it.
 *
 * Pages serves a project site from a subpath (/<repo>/), over HTTP, with no
 * server-side routing. That combination breaks single-page apps in three
 * predictable ways — absolute asset paths, path-based routing, and a hard
 * refresh on a deep link — so this assembles the site directory exactly as the
 * workflow does, serves it at a subpath, and drives it.
 *
 * Run with: npm run demo:verify-pages
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const BUILT = path.join(ROOT, 'client', 'dist-demo', 'index.demo.html');
const REPO_PATH = process.env.PAGES_PATH || 'icf-maktab-tracker';
const PASSWORD = 'maktab2027';

let failures = 0;
const assert = (ok, label) => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures += 1;
};

const MIME = { '.html': 'text/html', '.svg': 'image/svg+xml' };

/** Minimal static server that mimics Pages: no rewrites, real 404s. */
function serve(rootDir) {
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    let filePath = path.join(rootDir, decodeURIComponent(url));
    if (url.endsWith('/')) filePath = path.join(filePath, 'index.html');
    if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

async function main() {
  if (!fs.existsSync(BUILT)) {
    console.error(`Demo build not found at ${BUILT}. Run "npm run demo:build" first.`);
    process.exit(1);
  }

  // Assemble the site directory the workflow publishes.
  const siteRoot = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'maktab-pages-'));
  const siteDir = path.join(siteRoot, REPO_PATH);
  fs.mkdirSync(siteDir, { recursive: true });
  fs.copyFileSync(BUILT, path.join(siteDir, 'index.html'));
  fs.copyFileSync(path.join(ROOT, 'client', 'public', 'favicon.svg'), path.join(siteDir, 'favicon.svg'));
  fs.writeFileSync(path.join(siteDir, '.nojekyll'), '');

  const server = await serve(siteRoot);
  const base = `http://127.0.0.1:${server.address().port}/${REPO_PATH}/`;
  console.log(`\nServing the assembled site at ${base}`);

  const launchOptions = { args: ['--no-sandbox'] };
  const pinned = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
  if (fs.existsSync(pinned)) launchOptions.executablePath = pinned;
  const browser = await chromium.launch(launchOptions);

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('requestfailed', (req) => {
      // A navigation cancels whatever was still in flight — usually the icon.
      // That is not a hosting problem, so only real failures are collected.
      const reason = req.failure()?.errorText || '';
      if (reason.includes('ERR_ABORTED')) return;
      errors.push(`request failed: ${req.url()} (${reason})`);
    });
    page.on('response', (res) => {
      if (res.status() >= 400) errors.push(`${res.status()} for ${res.url()}`);
    });

    await page.goto(base, { waitUntil: 'load' });
    await page.waitForTimeout(1200);

    let text = await page.evaluate(() => document.body.innerText);
    assert(text.toLowerCase().includes('sign in'), 'sign-in screen renders from a subpath');
    assert(text.includes('Demonstration build'), 'the demo banner is present');

    const signIn = async (role) => {
      await page.evaluate(() => sessionStorage.clear());
      await page.goto(`${base}#/login`, { waitUntil: 'load' });
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(900);
      const email = await page.evaluate(
        (r) => document.querySelector(`button[data-role="${r}"]`)?.dataset.email,
        role
      );
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1200);
      return email;
    };

    for (const [role, home, expected] of [
      ['admin', '#/admin', 'Pacing radar'],
      ['teacher', '#/teacher', 'Where the class stands'],
      ['parent', '#/family', 'What the teacher says'],
    ]) {
      const email = await signIn(role);
      const hash = await page.evaluate(() => window.location.hash);
      assert(hash.startsWith(home), `${role} (${email}) lands on ${home}`);
      text = await page.evaluate(() => document.body.innerText);
      assert(text.includes(expected), `${role} portal renders — "${expected}"`);
    }

    // A hard refresh on a deep link is where path-based routing would 404.
    await signIn('admin');
    await page.goto(`${base}#/admin/pacing`, { waitUntil: 'load' });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1200);
    text = await page.evaluate(() => document.body.innerText);
    assert(text.toLowerCase().includes('pacing radar'), 'a deep link survives a hard refresh');

    assert(
      errors.length === 0,
      `no console errors, failed requests or 404s${errors.length ? ` — ${errors.slice(0, 3).join(' | ')}` : ''}`
    );
  } finally {
    await browser.close();
    server.close();
    fs.rmSync(siteRoot, { recursive: true, force: true });
  }

  console.log(`\n${'─'.repeat(60)}`);
  if (failures) {
    console.log(`NOT READY TO PUBLISH — ${failures} checks failed.`);
    process.exit(1);
  }
  console.log('Subpath hosting verified: the demo is safe to publish to GitHub Pages.');
}

main().catch((err) => {
  console.error('\nPages verification crashed:', err);
  process.exit(1);
});
