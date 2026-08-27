# ICF Daily Maktab — Academic Standards & Progress Tracker

> **Academic Year 2026–2027**  
> Custom digital tracking and academic pacing platform for the Islamic Center of Fremont (ICF) Daily Maktab, built to replace physical binders with < 30-second daily teacher check-offs and real-time administrator pacing oversight.

---

## 🌟 Key Features

1. **Teacher Daily 30-Second Check-off**:
   - Touch-optimized for smartphones & tablets.
   - Pre-selects today's day & strand:
     - **Monday**: Fiqh
     - **Tuesday**: Aḥādīth
     - **Wednesday**: Sīrah (Terms 1–2) $\rightarrow$ Tārīkh (Terms 3–4)
     - **Thursday**: ʿAqā'id
     - **Friday**: Akhlāq (Terms 1–3) $\rightarrow$ Ādāb (Terms 3–4)
   - Daily **Opening Memorization Track** (Sūrah, Duʿā', Names of Allāh).
   - "Expected by End of Term" observable indicator highlight.
   - Session types: Regular Lesson, Practical Demonstration, Oral Testing, Revision.
   - Quick handover notes for substitute teachers & admins.

2. **Admin Standards & Pacing Radar**:
   - Real-time term progress percentage across Grades 1–6 (including Grade 6 Boys & Girls tracks).
   - Instant visual pacing flags: 🟢 On Track, 🟡 In Progress, 🔴 Behind Pace.
   - 5-Strand Weekly Matrix showing completed vs pending subjects.
   - "What Needs To Be Done Next" indicator for every grade.
   - Live stream of all teacher submissions across the madrasah.

3. **Complete Pre-Seeded 2026–2027 An-Nasīḥah Curriculum**:
   - Grades 1 through 6 with full topic sequence and learning outcomes.
   - 4 Terms + Ramaḍān interlude (reduced schedule revision rules).
   - Grade 6 gender tracks (Boys: imāmah, adhān/iqāmah, Jumuʿah vs Girls: fiqh of ḥayḍ, nifās, istiḥāḍah).

4. **Printable / PDF Board Digest**:
   - Single-click clean, print-formatted summary table for weekly Shura / Maktab Board meetings.

---

## 🚀 Quick Start (Local Development)

### 1. Install & Seed
```bash
# From project directory
npm install
npm --prefix client install
npm run seed
```

### 2. Run the App
```bash
npm run dev
# OR for production preview:
npm run build && npm start
```
Open **`http://localhost:3001`** in your web browser.

---

## 🌐 Deploying to your VPS / Masjid Server

### Method A: Single Command with Docker Compose (Recommended)
```bash
# On your VPS:
git clone <your-repo-url> /opt/maktab-tracker
cd /opt/maktab-tracker
docker compose up -d --build
```
Your app will run on port `3000` with data persisted in the `maktab_data` volume.

### Method B: Direct Node.js + PM2 on VPS
```bash
# 1. Install PM2
npm install -g pm2

# 2. Build frontend and start backend
npm install
npm --prefix client install
npm run build
PORT=3000 pm2 start server/index.js --name "icf-maktab-tracker"
pm2 save
```

### Method C: SSL / Reverse Proxy (Caddy Example)
Add this to `/etc/caddy/Caddyfile`:
```caddy
maktab.fremontmasjid.org {
    reverse_proxy localhost:3000
}
```

---

## 💾 Automated SQLite Database Backups

Because the entire curriculum and all lesson logs are stored in a single SQLite database file (`server/maktab.db` or `/app/data/maktab.db`), backups are effortless.

### Setup Daily Cron Backup
```bash
# Edit crontab
crontab -e

# Backup daily at 11 PM to a backup directory:
0 23 * * * sqlite3 /opt/maktab-tracker/server/maktab.db ".backup '/var/backups/maktab_$(date +\%Y\%m\%d).db'"
```

---

## 📊 Comparison: Digital vs Physical Folders

| Metric | Physical Paper Binders | Digital Maktab Tracker |
| :--- | :--- | :--- |
| **Teacher Daily Effort** | 2–5 min handwriting, easily forgotten | **< 30 seconds** (1-tap on phone) |
| **Admin Visibility** | Manual weekly binder collection & audit | **Real-time instant dashboard** |
| **Substitute Continuity**| Substitute lacks context if binder misplaced | Instant access to yesterday's logs & notes |
| **Pacing Alerts** | Unnoticed until end of term | Automatic flags when grade falls behind |
