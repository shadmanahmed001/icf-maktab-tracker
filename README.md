# ICF Daily Maktab — Academic Standards & Progress Tracker

Academic tracking for the Islamic Center of Fremont Daily Maktab, built around
the An-Nasīḥah syllabus for **2026–2027**. Three portals over one database:

| Portal | Who it is for | What it does |
| :--- | :--- | :--- |
| **Administration** | Maktab Director, standards coordinator | Pacing across every grade, class and student records, staff and family accounts, curriculum, printable board digest |
| **Teacher** | Class teachers, assistants, substitutes | The daily check-off, the register, per-pupil attainment and memorization, homework, parent messages |
| **Family** | Parents and guardians | Their own children only: progress, memorization targets, lessons covered, attendance, homework, term report card, messages |

---

## Quick start

```bash
npm install
npm run build          # installs and builds the client
npm start              # http://localhost:3001
```

The database is created and seeded automatically on first boot — there is no
separate setup step. To develop with hot reload:

```bash
npm run dev            # API on :3001, client on :5173 with a proxy
```

### Signing in

Seeded demonstration accounts all share the password **`maktab2027`**, and the
sign-in screen lists them so you can enter any portal in one click.

| Role | Email | Also accepts |
| :--- | :--- | :--- |
| Administrator | `imamshadman@icfbayarea.com` | PIN `9999` |
| Teacher (Grade 1 Boys) | `ahmad.sulaiman@icfbayarea.com` | PIN `1001` |
| Teacher (Grade 1 Girls) | `maryam.haque@icfbayarea.com` | PIN `1002` |
| Parent | any `*.father@example.com` / `*.mother@example.com` from the sign-in list | — |

Teachers can sign in with a short numeric PIN instead of a password, which
matters on a phone between classes.

> **Before the real rollout:** set `DEMO_MODE=false` so the seeded account list
> stops being advertised, set `JWT_SECRET`, and reseed with your own roll.

---

## What the system tracks

### The weekly pattern

One strand per teaching day, with the mid-year switches built in:

| Day | Strand |
| :--- | :--- |
| Monday | Fiqh |
| Tuesday | Aḥādīth |
| Wednesday | Sīrah → **Tārīkh** from Term 3 |
| Thursday | ʿAqāʾid |
| Friday | Akhlāq → **Ādāb** in Term 4 |

Every lesson also opens with the memorization track — the term's Sūrah, Duʿāʾ
and Names of Allāh, set per grade.

The year runs as four teaching terms plus the **Ramaḍān interlude**, which
introduces no new standards and is excluded from pacing judgements.

### How pacing is judged

A term holds five standards, one per strand, each taught across roughly nine
weeks. So "standards completed" on its own says almost nothing in week three.
Pacing therefore combines two independent signals and reports the worse:

1. **Syllabus progress** — standards achieved, with **half credit** for a
   standard currently being taught, measured against how much of the term has
   elapsed. A class 40% through the term is expected to be roughly 40% through
   its standards.
2. **Logging discipline** — daily check-offs recorded against teaching days that
   have passed. A class can be teaching well and still be invisible to the
   office if nobody checks off; that is worth flagging on its own.

A standard counts as **achieved** when a teacher records it as taught in full
*and* judges the class `secure` or `mastered`. Until then it reads as *being
taught* — which still counts towards pacing.

Flags are **On track**, **Needs attention** and **Behind pace**, with tolerance
bands so one missed week does not raise an alarm.

---

## Architecture

```
server/
  index.js            Express app: security headers, rate limits, static client
  db.js               SQLite via WebAssembly (sql.js), atomic writes, transactions
  schema.js           Schema + idempotent additive migrations
  auth.js             bcrypt credentials, JWT cookie sessions, CSRF, role scoping
  services/pacing.js  All progress, attendance and report-card computation
  routes/             auth · shared · admin · teacher · parent
  seed/               The real curriculum, plus a generated demonstration school
client/src/
  lib/                API client, session context, hooks, formatting
  ui/                 The component kit
  charts/             Hand-rolled figures
  features/           Progress and messaging pieces shared across portals
  layout/             App shell and the three portal layouts
  pages/              admin/ · teacher/ · parent/
  demo/               Fixture-backed API client for the offline demo build
tests/                API suite (39 tests) and browser walkthrough (67 checks)
scripts/              Demo capture, page build and verification
```

### Security

- Passwords and PINs are stored only as bcrypt hashes — nobody, including the
  office, can read them. A reset issues a new temporary password shown once.
- Sessions are JWTs in `httpOnly`, `SameSite=Lax` cookies, with a double-submit
  CSRF token required on every cookie-authenticated write.
- Rate limits on sign-in (per IP, per 15 minutes) and on the API as a whole.
- Strict Content-Security-Policy; no external asset hosts.
- **Record-level scoping is enforced per request, not inferred from the client:**
  a teacher can only reach classes they are assigned to; a parent only children
  they are a listed guardian of. Both are covered by tests that assert a `403`.
- Every change is written to an audit log, readable in the admin portal.

### Data model

Classes and students are **archived, never deleted**, so previous years' lesson
logs, registers and reports stay intact and auditable. `attendance`,
`assessments` and `memorization_progress` carry uniqueness constraints, so
re-submitting a register or an assessment corrects the record in place instead
of creating a duplicate.

---

## Testing

```bash
npm test               # 39 API tests: auth, RBAC boundaries, CSRF, upserts
npm run test:e2e       # drives all three portals in Chromium, with screenshots
npm run test:all
npm run lint
```

The API suite runs the real server against a throwaway database and drives it
over HTTP exactly as the browser does — cookie sessions and CSRF header
included. The browser suite fails on any console error or failed request, not
just on a missing heading, and checks that the teacher screens do not scroll
sideways on a phone.

---

## The offline demo

`npm run demo` produces a single self-contained HTML file for review — useful
for sharing the portals with the board before there is a server to point at.

It works by **recording the real API's responses** rather than reimplementing
them, so every screen shows exactly what the live application returns:

```bash
npm run demo           # capture → build → page → verify
```

| Step | What it does |
| :--- | :--- |
| `demo:fixtures` | Boots the real server on a fresh seed, signs in as each role, records every endpoint the client calls |
| `demo:build` | Builds the client with the API client aliased to a fixture-backed one, inlined into one file |
| `demo:page` | Strips the document wrapper for publishing, and refuses to emit a page referencing an external host |
| `demo:verify` | Loads the page in a browser, signs in as each role, walks every screen, and checks all four theme states |

Writes in the demo are applied in the browser and labelled as such — it has no
server behind it and says so.

---

## Deployment

### Docker Compose (recommended for a masjid server)

```bash
git clone <repo-url> /opt/maktab-tracker
cd /opt/maktab-tracker
JWT_SECRET="$(openssl rand -hex 32)" DEMO_MODE=false docker compose up -d --build
```

Runs on port 3000 with the database on the `maktab_data` volume.

### Node with PM2

```bash
npm install && npm run build
JWT_SECRET="$(openssl rand -hex 32)" DEMO_MODE=false \
  PORT=3000 pm2 start server/index.js --name icf-maktab-tracker
pm2 save
```

### Render

`render.yaml` is set up for one-click deploy and generates `JWT_SECRET` for you.
Note that the **free plan has no persistent disk**, so the database is reseeded
on every deploy — fine for a demonstration, not for real records. For a real
rollout, attach a disk and point `DB_PATH` at it (both are commented in the
file).

### Behind a reverse proxy

```caddy
maktab.fremontmasjid.org {
    reverse_proxy localhost:3000
}
```

The server trusts one proxy hop, so `secure` cookies and per-IP rate limiting
work correctly behind TLS termination.

---

## Backups

The entire record — curriculum, roll, registers, assessments, reports — is one
SQLite file. Writes are atomic (rendered to a temp file and renamed), so a
copy taken at any moment is consistent.

```bash
# Nightly at 11pm
0 23 * * * sqlite3 /opt/maktab-tracker/server/maktab.db \
  ".backup '/var/backups/maktab_$(date +\%Y\%m\%d).db'"
```

Restoring is putting the file back and restarting.

---

## Configuration

Every setting has a working default; see [`.env.example`](.env.example). The two
worth setting for a real deployment:

| Variable | Why |
| :--- | :--- |
| `JWT_SECRET` | Required when running more than one instance, or sessions will not carry between them. Otherwise one is generated and stored in the database. |
| `DEMO_MODE=false` | Stops the sign-in screen advertising the seeded demonstration accounts. |

---

## Digital vs. paper binders

| | Paper binders | This system |
| :--- | :--- | :--- |
| Teacher effort per day | 2–5 minutes of handwriting, easily forgotten | Under a minute; the standard, indicator and memorization target are pre-filled |
| Admin visibility | Collect and audit binders weekly | Live, and it names the classes that have not checked off today |
| Substitute continuity | Depends on finding the binder | Yesterday's log and any handover note are on the screen |
| Pacing alerts | Noticed at end of term | Flagged as soon as coverage or record-keeping slips |
| Parents | A report card twice a year | Every lesson, the indicator behind it, attendance and memorization, live |
| Backup | Photocopying | One file, one cron line |
