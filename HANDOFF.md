# Handoff — ICF Daily Maktab Academic Tracker

**Status: working proof of concept, deployed and testable. Not yet a pilot.**

Last updated 27 August 2026.

---

## What exists today

A working three-portal academic tracker for the ICF Daily Maktab, built on the
An-Nasīḥah syllabus for 2026–2027. One Node process serves an Express API, a
SQLite database (WebAssembly, via sql.js) and a Vite React client.

| Portal | For | What they do |
| :--- | :--- | :--- |
| Administration | Director, standards coordinator | Pacing across every grade, classes and enrolment, staff and family accounts, the curriculum, reports, board digest |
| Teacher | Class teachers, assistants, substitutes | Only their own classes: the daily log, attendance, their students' progress, homework, parent messages |
| Family | Parents and guardians | Only their own children: progress, attendance, and the teacher's comments |

### Where to see it

**Clickable demo:** <https://shadmanahmed.info/icf-maktab-tracker/>
Password for every demo account: `maktab2027`. The sign-in screen lists nine
accounts (1 administrator, 3 teachers, 5 parents) as one-click buttons.

**This is a static demo.** It is the real client with real recorded API
responses, so every screen shows exactly what the live application returns, and
a tester can walk every workflow. But there is no server behind it: anything a
tester types stays in their own browser for that visit, nobody sees anyone
else's entries, and a reload clears it. It is right for *"does this fit how you
teach?"* and wrong for *"start recording attendance."*

**Real server, with a database:** the container image runs anywhere Docker does.

```bash
docker run -d --name maktab -p 3000:3000 \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e DEMO_MODE=true \
  -v maktab_data:/app/data \
  ghcr.io/shadmanahmed001/icf-maktab-tracker:latest
```

---

## The curriculum is now complete and verified against the source document

Checked row by row against
`ICF_Maktab_Islamic_Studies_Standards_2026-2027_Sirah-then-Tarikh_2.pdf`:

| | |
| :--- | :--- |
| Standards in the PDF | **120** (6 grades × 4 terms × 5 weekday subjects) |
| Standards in the PDF missing from the system | **0** |
| Standards in the system not in the PDF | **0** |
| Total stored | **121** — the 120 above plus the Grade 6 Term 2 boys'/girls' Fiqh variant |
| Memorization targets | **24** — all 6 grades × 4 terms, Sūrah · Duʿā' · Names of Allāh |

**One real data defect was found and fixed in this pass.** The Grade 4 Term 2
Monday (Fiqh) standard — *"Nawāqiḍ of masaḥ; masaḥ on a wound; the wājib acts
of ṣalāh"* → *"List the wājibāt of ṣalāh"* — had been entered with `grade: 2`
instead of `grade: 4`. It sat physically inside the Grade 4 block, so Grade 4
appeared to be missing a Fiqh standard while Grade 2 carried a duplicate
Monday. Counts were 21 for Grade 2 and 19 for Grade 4; both are now 20.

Earlier documentation described this as a gap in the source data the project
started from. That was wrong, and this document supersedes it: the standard was
always in the syllabus, and the fault was a one-character data-entry error on
our side.

---

## How pacing is judged

A term holds five standards, one per subject, each taught across roughly nine
weeks — so "standards completed" says almost nothing in week three. Pacing
combines two independent signals and reports the worse of them:

1. **Syllabus progress** — standards achieved, with half credit for one
   currently being taught, measured against how much of the term has elapsed.
2. **Logging discipline** — daily logs recorded against teaching days that have
   passed. A class can be teaching well and still be invisible to the office if
   nobody logs; that is worth flagging on its own.

A standard counts as achieved when a teacher records it taught in full *and*
judges the class `secure` or `mastered`. Flags are **On track**, **Needs
attention**, **Behind pace**, with tolerance bands so one missed week does not
raise an alarm. The Ramaḍān interlude introduces no standards and is excluded.

---

## Verification

Everything below runs against a throwaway database and drives the real server
over HTTP, cookie sessions and CSRF included.

```bash
npm test           # 39 API tests — auth, RBAC boundaries, CSRF, upserts
npm run test:e2e   # 75 browser checks across all three portals
npm run test:theme # light/dark on all 27 screens, contrast measured
npm run demo       # capture → build → page → verify the static demo
npm run lint
npm run test:all   # the first three
```

Record-level scoping is enforced per request, not inferred from the client: a
teacher can only reach classes they are assigned to, a parent only children
they are a listed guardian of, and both are covered by tests asserting `403`.

`test:theme` measures rendered pixels rather than CSS classes — the page ground
must move between the light and dark luminance bands, and every visible text
node must hold at least 4.5:1 contrast against whatever ground it lands on.

**Known flake:** on roughly one run in five, one of the 75 browser checks fails
and does not reproduce on retry. It is a timing issue in the test, not a defect
in the application, and it has not been chased down.

---

## What is deliberately not done

- **No persistence on the public demo.** By design — see above. Real
  persistence needs a server with a disk; `fly.toml` in this repo deploys the
  container image onto a Fly machine with a volume, at well under $1/month, and
  is tested but has never been run because it needs a payment method.
- **`DEMO_MODE` is on**, so the seeded account list is advertised on the sign-in
  screen. That is correct for testing and must be turned off before real
  families use it.
- **The roll is generated demonstration data** — 147 students with plausible
  names, attendance and assessments. None of it is real.
- **No email or SMS.** Parent messages live inside the app only.
- **No attendance for the memorization track** as a separate register.
- **Single writer.** The database is one SQLite file, so this runs as one
  instance. That is ample for a maktab of this size but it is not horizontally
  scalable without moving the database.

---

## If the proof of concept is accepted — next steps, in order

### 1. Decide the hosting question (half a day)

The demo cannot hold data, and that is the single thing blocking a real pilot.
Options, cheapest first:

- **Fly.io with a volume** — `fly.toml` is committed and tested. Needs a card
  on the org; realistic cost is cents per month with the machine idling down.
- **A machine at the masjid** — the container needs one port and one volume. No
  ongoing cost, but somebody has to own backups and uptime.
- **Render or similar on a paid instance** — `render.yaml` is committed. Needs a
  paid plan *and* an attached disk; the free plan cannot keep data.

### 2. Replace the demonstration roll with the real one (1–2 days)

Set `DEMO_MODE=false`, then enter the actual classes, teachers, students and
guardians. The admin portal does all of this without touching the database, and
the dashboard's *Needs setting up* panel names every class with no teacher,
student with no class, and child with no guardian — work the list until it is
empty. Budget time for collecting guardian contact details; that is usually the
slow part, not the data entry.

### 3. Train two teachers, not twelve (1 week)

Pick the two most willing teachers and run them for a full week. The daily log
is meant to take under a minute — if it does not, that is the finding, and it is
worth fixing before the other ten ever see it. Watch specifically whether they
log on a phone between classes or defer to a laptop later; the design assumes
the former.

### 4. Then the rest of the staff (2–3 weeks)

Roll out class by class rather than all at once. Keep paper binders running in
parallel for the first month so nothing is lost if the system is abandoned.

### 5. Before any parent sees it

- Set `JWT_SECRET` explicitly and store it somewhere recoverable.
- Turn on nightly backups. The whole record is one SQLite file and writes are
  atomic, so a copy taken at any moment is consistent — one cron line.
- Have somebody other than the author read the family portal. Parents are the
  only audience who cannot ask a colleague what a screen means.
- Decide the retention policy for withdrawn students. Records are archived,
  never deleted, which is right for auditing and needs a stated policy.

### 6. Worth building only once the above works

In rough order of value per unit of effort:

- **Report cards as PDF** for the twice-yearly parent meeting. The print
  stylesheet already produces a usable page; this is mostly polish.
- **Email or SMS on absence**, so a parent hears the same day.
- **A substitute view** that does not need an account — a per-class link valid
  for one day.
- **Bulk enrolment from a spreadsheet**, if the roll turns over enough to make
  hand entry annoying.
- **Arabic or Urdu interface**, if guardians ask for it.

Deliberately *not* on this list: multi-campus support, a mobile app, and an
online parent-payment flow. Each is a much larger project than this one, and
none of them makes the daily log faster.

---

## Repository orientation

```
server/
  index.js            Express app: security headers, rate limits, static client
  db.js               SQLite via WebAssembly, atomic writes, transactions
  schema.js           Schema + idempotent additive migrations
  auth.js             bcrypt credentials, JWT cookie sessions, CSRF, role scoping
  services/pacing.js  All progress, attendance and report-card computation
  routes/             auth · shared · admin · teacher · parent
  seed/curriculum.js  The real syllabus — 121 standards, 24 memorization targets
  seed/index.js       The generated demonstration school
client/src/
  lib/theme.jsx       Light/dark, stored per browser
  features/           Shared pieces, including the appearance switch
  layout/             App shell and the three portal layouts
  pages/              admin/ · teacher/ · parent/
  demo/               Fixture-backed API client for the offline demo build
tests/                api · browser · theme
scripts/              Demo capture, page build and verification
```

Deployment configuration lives in `Dockerfile`, `docker-compose.yml`,
`fly.toml`, `render.yaml` and `.github/workflows/deploy.yml`. The workflow
publishes the container image to GHCR and the static demo to GitHub Pages on
every push, and publishes neither from a red build.

Two settings had to be set by hand once, and both fail silently if done in the
wrong order: the repository must be **public** before a GitHub Pages source can
be saved (on the free plan Pages is unavailable for private repositories, and
choosing a source while private appears to succeed without saving), and the
`github-pages` environment restricts deployment to the default branch until
other branches are allowed. See the Deployment section of the README.

The live demo is served from `https://shadmanahmed.info/icf-maktab-tracker/`
rather than `shadmanahmed001.github.io`, because the account's user site carries
a `CNAME` for that domain and GitHub serves every project site beneath it.
