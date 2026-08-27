/**
 * Convert the single-file demo build into a page body suitable for publishing.
 *
 * The publishing target supplies its own document skeleton, so this strips the
 * <!doctype>, <html>, <head> and <body> tags and emits just the title, styles
 * and body content — everything still inline, nothing fetched from a host.
 *
 * Run with: npm run demo:artifact
 */
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.join(__dirname, '..', 'client', 'dist-demo', 'index.demo.html');
const OUT = path.join(__dirname, '..', 'client', 'dist-demo', 'artifact.html');

function extractAll(html, tag) {
  const matches = [];
  const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi');
  let match = re.exec(html);
  while (match) {
    matches.push(match[0]);
    match = re.exec(html);
  }
  return matches;
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Demo build not found at ${SOURCE}. Run "npm run build:demo" in client/ first.`);
    process.exit(1);
  }

  const html = fs.readFileSync(SOURCE, 'utf8');

  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || 'ICF Daily Maktab Demo';
  const styles = extractAll(html, 'style');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) {
    console.error('Could not find a <body> in the demo build.');
    process.exit(1);
  }

  // The bundler puts both the stylesheet and the module script in <head>, so
  // collect them from the whole document rather than from the body.
  const scripts = extractAll(html, 'script');
  let body = bodyMatch[1];
  for (const block of [...styles, ...scripts]) body = body.replace(block, '');

  if (!scripts.length) {
    console.error('No inline script found — the single-file plugin may not have run.');
    process.exit(1);
  }

  // Scripts go last so #root exists by the time the application mounts.
  const parts = [
    `<title>${title}</title>`,
    ...styles,
    body.trim(),
    ...scripts,
  ];

  fs.writeFileSync(OUT, parts.join('\n'));

  const sizeMb = (fs.statSync(OUT).size / 1048576).toFixed(2);
  console.log(`Artifact page written to ${OUT} (${sizeMb} MB)`);

  // Guard against the two mistakes that would break the published page.
  const written = fs.readFileSync(OUT, 'utf8');
  const forbidden = ['<!doctype', '<html', '<head', '<body'];
  for (const token of forbidden) {
    if (written.toLowerCase().includes(token)) {
      console.error(`Refusing to publish: output still contains "${token}".`);
      process.exit(1);
    }
  }
  if (/src\s*=\s*["']https?:/i.test(written) || /href\s*=\s*["']https?:\/\/(?!fonts\.googleapis)/i.test(written)) {
    console.error('Refusing to publish: output references an external host, which the viewer blocks.');
    process.exit(1);
  }
  console.log('Checks passed: no document wrapper, no external hosts.');
}

main();
