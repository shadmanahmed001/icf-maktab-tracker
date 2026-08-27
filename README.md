# ICF Daily Maktab — Academic Standards & Progress Tracker

Academic tracking for the Islamic Center of Fremont Daily Maktab, built around
the An-Nasīḥah syllabus for **2026–2027**. Three portals over one database:

| Portal | Who it is for | What they see |
| :--- | :--- | :--- |
| **Administration** | Maktab Director, standards coordinator | Everything. Pacing across every grade, classes and the roll, staff and family accounts, the curriculum, reports and the board digest |
| **Teacher** | Class teachers, assistants, substitutes | Only the classes they are assigned to: the daily check-off, the attendance register, their pupils' progress, homework, parent messages |
| **Family** | Parents and guardians | Only their own children: progress, attendance, and the teacher's comments |

### What each role can do

Each portal is deliberately short — four items in the sidebar, because each role
really has four jobs.

**Administration** is the only role that can change how the school is set up:
create classes and place pupils, **assign teachers to grades** (creating a
teacher's account in the same step if they are new), link guardians to children,
**edit the curriculum**, move the active term, post notices, and read every
report. The dashboard opens with a *Needs setting up* panel naming any class
with no teacher, pupil with no class, or child with no guardian linked — the
states where the system quietly stops working for somebody.

**Teachers** are scoped to their own classes and nothing else, enforced on the
server on every request. *Today's check-off* comes pre-filled from the
curriculum, the *Attendance register* starts everyone as present so only the
exceptions need marking, and *My class* holds their pupils, the syllabus and
homework behind three tabs. Notices from the office appear on the check-off
screen, where they will actually be read.

**Families** see attendance, progress, and what the teacher has written. *What
the teacher says* sits second on the page, quoting each strand's remark, because
that is what parents come looking for. Memorization, lessons covered and
homework are sections of the same page rather than competing nav items.

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

### What the curriculum contains

The full An-Nasīḥah sequence ships pre-loaded and is editable in the admin
portal:

| | |
| :--- | :--- |
| Terms | 4 teaching terms + the Ramaḍān interlude |
| Grades | 1–6 |
| Standards | **121**, each with its topic and its observable end-of-term indicator |
| Memorization targets | **24** — all 6 grades × 4 terms, with Sūrah, Duʿāʾ and Names of Allāh |
| Gender-track variants | Grade 6 Fiqh in Term 2 splits: boys' imāmah, adhān & iqāmah, Jumuʿah; girls' fiqh of ḥayḍ, nifās and istiḥāḍah |

Every standard has both a topic and an indicator — there are no blank entries.

**One known gap:** Grade 4, Term 2 has no Monday (Fiqh) standard, so that grade
has 19 standards where the others have 20 or 21. This gap is in the source data
the project started from, not something introduced since. The admin Curriculum
screen now detects gaps of this kind and shows a banner linking straight to the
term that needs filling — add the standard and the banner clears.

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

There are two useful meanings of "deploy this", and the repository supports both
from one push. Both are wired into
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) and run
automatically on any push to `main` or a `claude/**` branch; neither publishes
from a red build.

### 1. A public link for feedback — GitHub Pages

The workflow builds the self-contained demo and publishes it to GitHub Pages at:

```
https://shadmanahmed001.github.io/icf-maktab-tracker/
```

Anyone with the link can walk all three portals — no account, no install. The
sign-in screen lists the demo accounts and the password. Because it is a static
page there is **no server behind it**, so anything a reviewer types is kept in
their own browser for that visit and then gone. That is the right trade for
gathering feedback on the design and the workflow; it is not a pilot.

**One setting has to be switched on once, by a repository owner** — GitHub
refuses to let a workflow create a Pages site for itself:

1. **Settings → Pages**
2. **Build and deployment → Source → GitHub Actions**
3. Re-run the Deploy workflow

Every later push then publishes automatically. Until it is switched on, the
workflow still builds and verifies the page and attaches it to the run as the
**maktab-demo-page** artifact, so the demo is always obtainable — download it
and open it, or drop it on any static host.

One caveat: a repository has a single Pages site, so whichever branch pushed
last is what the link serves.

### 2. A real server for a pilot — container image

The same workflow publishes a container image to GitHub Container Registry, so
the real application with a working database is one command away on any machine:

```bash
docker run -d --name maktab -p 3000:3000 \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e DEMO_MODE=true \
  -v maktab_data:/app/data \
  ghcr.io/shadmanahmed001/icf-maktab-tracker:claude-portals-admin-teacher-parent-bxjw1q
```

The tag is the branch name with slashes replaced by dashes; `:latest` exists
only once a build has run on `main`. Data lives on the `maktab_data` volume and
survives upgrades — pull a new image, recreate the container, and the database
is untouched.

For a pilot where testers sign themselves in, keep `DEMO_MODE=true` as above so
the account list stays on the sign-in screen. Set it to `false` — and reseed
with your own roll — once real families are using it.

### Building it yourself

```bash
git clone <repo-url> /opt/maktab-tracker
cd /opt/maktab-tracker
JWT_SECRET="$(openssl rand -hex 32)" DEMO_MODE=false docker compose up -d --build
```

Or without Docker:

```bash
npm install && npm run build
JWT_SECRET="$(openssl rand -hex 32)" DEMO_MODE=false \
  PORT=3000 pm2 start server/index.js --name icf-maktab-tracker
pm2 save
```

### Hosting the branch for testers — Fly.io

[`fly.toml`](fly.toml) deploys the **prebuilt GHCR image** onto a machine with a
**persistent volume**, which is what makes it usable for a pilot rather than a
click-through. The whole record is one SQLite file, so the volume mounted at
`/data` *is* the database, and it survives both a redeploy and a machine
stopping and restarting.

```bash
fly apps create icf-maktab-tracker
fly volumes create maktab_data --size 1 --region sjc --yes
fly secrets set JWT_SECRET="$(openssl rand -hex 32)"
fly deploy --image ghcr.io/shadmanahmed001/icf-maktab-tracker:claude-portals-admin-teacher-parent-bxjw1q
```

`DB_PATH=/data/maktab.db` in `fly.toml` is the setting that puts the database on
the volume instead of in the image layer — without it, every deploy starts from
a fresh seed. Machines idle down and start again on the next request, so a first
request after a quiet spell costs a few seconds of latency but **not** data.

Keep it to **one machine**: a volume attaches to a single machine, and SQLite
wants a single writer. Scaling past 1 needs the database moved first.

### Render — why not, on the free plan

`render.yaml` is a working blueprint (now pointing at the same prebuilt image
rather than building from source), but the free plan **cannot keep data**. The
filesystem is ephemeral and the instance is destroyed not only on redeploy but
every time it **wakes from sleep** after ~15 minutes idle — so anything a tester
enters is gone by the next cold start, and the sign-in screen greets them with a
freshly reseeded school. It also costs 30–60 seconds on that first request.

That is fine for gathering reactions to the design, and wrong for a pilot where
somebody enters attendance and expects to find it tomorrow. Persistence on
Render needs a paid instance **and** an attached disk — the `disk:` block and
`DB_PATH` are commented in the file for that.

### Behind a reverse proxy

```caddy
maktab.fremontmasjid.org {
    reverse_proxy localhost:3000
}
```

The server trusts one proxy hop, so `secure` cookies and per-IP rate limiting
work correctly behind TLS termination.

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
