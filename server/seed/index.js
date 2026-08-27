/**
 * Seeds the database with the real 2026–2027 curriculum plus a full,
 * self-consistent demonstration school: staff, families, a roll of students,
 * and the lesson, attendance and assessment history a live term would have
 * accumulated by today.
 *
 * Everything is generated from a fixed pseudo-random seed, so the same data
 * appears on every install and screenshots stay comparable.
 */
const { run, exec, get, all, transaction, value } = require('../db');
const { migrate } = require('../schema');
const { hashSecret } = require('../auth');
const { TERMS, CURRICULUM_TOPICS, MEMORIZATION_STANDARDS } = require('./curriculum');
const { BOYS, GIRLS, FAMILY, FATHER_FIRST, MOTHER_FIRST } = require('./names');
const {
  todayISO, teachingDaysBetween, dayName, subjectForDate, addDays,
} = require('../util/dates');

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'maktab2027';

/** Deterministic 32-bit PRNG (mulberry32) so a reseed reproduces exactly. */
function makeRandom(seed = 20262027) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = makeRandom();
const pick = (list) => list[Math.floor(rnd() * list.length)];
const chance = (probability) => rnd() < probability;
const between = (min, max) => min + Math.floor(rnd() * (max - min + 1));

const TEACHERS = [
  { name: 'Ustadh Ahmad Sulaiman', grade: 1, track: 'boys', pin: '1001' },
  { name: 'Ustadha Maryam Haque', grade: 1, track: 'girls', pin: '1002' },
  { name: 'Ustadh Bilal Farooqi', grade: 2, track: 'boys', pin: '1003' },
  { name: 'Ustadha Zainab Ansari', grade: 2, track: 'girls', pin: '1004' },
  { name: 'Ustadh Tariq Mahmood', grade: 3, track: 'boys', pin: '1005' },
  { name: 'Ustadha Aisha Siddiqui', grade: 3, track: 'girls', pin: '1006' },
  { name: 'Ustadh Zayd Qureshi', grade: 4, track: 'boys', pin: '1007' },
  { name: 'Ustadha Khadijah Patel', grade: 4, track: 'girls', pin: '1008' },
  { name: 'Ustadh Hamza Iqbal', grade: 5, track: 'boys', pin: '1009' },
  { name: 'Ustadha Fatima Rahman', grade: 5, track: 'girls', pin: '1010' },
  { name: 'Ustadh Umar Chaudhry', grade: 6, track: 'boys', pin: '1011' },
  { name: 'Ustadha Safiyyah Khan', grade: 6, track: 'girls', pin: '1012' },
];

/**
 * Per-class behaviour profiles, so the pacing dashboard shows a realistic
 * spread instead of every class sitting at the same number. `diligence` drives
 * how reliably the class logs its daily check-off.
 */
const CLASS_PROFILES = {
  'Grade 1 Boys': { diligence: 0.97, mastery: 'high' },
  'Grade 1 Girls': { diligence: 1.0, mastery: 'high' },
  'Grade 2 Boys': { diligence: 0.93, mastery: 'mid' },
  'Grade 2 Girls': { diligence: 0.96, mastery: 'high' },
  'Grade 3 Boys': { diligence: 0.62, mastery: 'mid' },
  'Grade 3 Girls': { diligence: 0.9, mastery: 'mid' },
  'Grade 4 Boys': { diligence: 0.88, mastery: 'mid' },
  'Grade 4 Girls': { diligence: 0.98, mastery: 'high' },
  'Grade 5 Boys': { diligence: 0.42, mastery: 'low' },
  'Grade 5 Girls': { diligence: 0.94, mastery: 'mid' },
  'Grade 6 Boys': { diligence: 0.85, mastery: 'mid' },
  'Grade 6 Girls': { diligence: 0.99, mastery: 'high' },
};

const slug = (name) => name
  .toLowerCase()
  .replace(/^(ustadh|ustadha)\s+/, '')
  .replace(/[^a-z\s]/g, '')
  .trim()
  .split(/\s+/)
  .join('.');

function seedTerms() {
  for (const t of TERMS) {
    run(
      `INSERT INTO terms (term_number, title, date_range, start_date, end_date, is_current, is_interlude, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.term_number, t.title, t.date_range, t.start_date, t.end_date, t.is_current, t.is_interlude, t.description]
    );
  }
}

function seedCurriculum() {
  for (const t of CURRICULUM_TOPICS) {
    run(
      `INSERT INTO curriculum_topics
         (grade, gender_track, term_number, day_of_week, subject, topic_title, expected_indicator, sequence_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.grade, t.gender_track, t.term, t.day, t.subject, t.topic, t.indicator, t.seq]
    );
  }
  for (const m of MEMORIZATION_STANDARDS) {
    run(
      `INSERT INTO memorization_standards (grade, term_number, surah, dua, names_of_allah)
       VALUES (?, ?, ?, ?, ?)`,
      [m.grade, m.term, m.surah, m.dua, m.names]
    );
  }
}

function seedStaff() {
  const passwordHash = hashSecret(DEMO_PASSWORD);

  const adminIds = [];
  const admins = [
    { name: 'Imam Shadman Ahmed', email: 'imamshadman@icfbayarea.com', title: 'Maktab Director' },
    { name: 'Ustadha Ruqayyah Nur', email: 'standards@icfbayarea.com', title: 'Academic Standards Coordinator' },
  ];
  for (const a of admins) {
    const result = run(
      `INSERT INTO users (full_name, email, role, title, password_hash, pin_hash, phone)
       VALUES (?, ?, 'admin', ?, ?, ?, ?)`,
      [a.name, a.email, a.title, passwordHash, hashSecret('9999'), '(510) 555-0100']
    );
    adminIds.push(result.lastID);
  }

  const classIds = {};
  const teacherIds = {};

  for (const t of TEACHERS) {
    const key = `Grade ${t.grade} ${t.track === 'boys' ? 'Boys' : 'Girls'}`;
    const classResult = run(
      `INSERT INTO classes (name, grade, gender_track, academic_year, room)
       VALUES (?, ?, ?, '2026-2027', ?)`,
      // Lower grades on the first floor, upper grades on the second; boys odd,
      // girls even — matching how the rooms are actually numbered at the centre.
      [key, t.grade, t.track, `Room ${t.grade < 4 ? 1 : 2}${t.grade}${t.track === 'boys' ? 1 : 2}`]
    );
    classIds[key] = classResult.lastID;

    const teacherResult = run(
      `INSERT INTO users (full_name, email, role, title, password_hash, pin_hash, phone)
       VALUES (?, ?, 'teacher', ?, ?, ?, ?)`,
      [t.name, `${slug(t.name)}@icfbayarea.com`, `${key} Teacher`, passwordHash,
        hashSecret(t.pin), `(510) 555-${String(between(1000, 9999))}`]
    );
    teacherIds[key] = teacherResult.lastID;

    run(`INSERT INTO class_teachers (class_id, user_id, role) VALUES (?, ?, 'lead')`,
      [classIds[key], teacherResult.lastID]);
  }

  // A floating assistant who covers across the upper grades — exercises the
  // multi-class teacher case in the portal.
  const assistant = run(
    `INSERT INTO users (full_name, email, role, title, password_hash, pin_hash, phone)
     VALUES (?, ?, 'teacher', ?, ?, ?, ?)`,
    ['Ustadh Yusuf Amin', 'yusuf.amin@icfbayarea.com', 'Relief & Assistant Teacher',
      passwordHash, hashSecret('1013'), '(510) 555-0177']
  ).lastID;
  for (const key of ['Grade 5 Boys', 'Grade 6 Boys']) {
    run(`INSERT INTO class_teachers (class_id, user_id, role) VALUES (?, ?, 'assistant')`,
      [classIds[key], assistant]);
  }

  return { adminIds, classIds, teacherIds, assistant, passwordHash };
}

/**
 * Build families: siblings share a surname and guardians, which makes the
 * parent portal's multi-child switcher real rather than theoretical.
 */
function seedStudentsAndFamilies(classIds, passwordHash) {
  const classKeys = Object.keys(classIds);
  const families = [];
  let studentSeq = 0;
  let parentSeq = 0;

  // Each family has 1–3 children spread across grades.
  const usedSurnames = new Set();
  const targetFamilies = 78;

  for (let f = 0; f < targetFamilies; f += 1) {
    let surname = pick(FAMILY);
    let attempts = 0;
    while (usedSurnames.has(surname) && attempts < 12) { surname = pick(FAMILY); attempts += 1; }
    usedSurnames.add(surname);

    const fatherName = `${pick(FATHER_FIRST)} ${surname}`;
    const motherName = `${pick(MOTHER_FIRST)} ${surname}`;
    parentSeq += 1;
    const emailBase = `${surname.toLowerCase()}${parentSeq}`;

    const father = run(
      `INSERT INTO users (full_name, email, role, title, password_hash, phone)
       VALUES (?, ?, 'parent', 'Parent / Guardian', ?, ?)`,
      [fatherName, `${emailBase}.father@example.com`, passwordHash, `(510) 555-${String(between(1000, 9999))}`]
    ).lastID;

    // Not every family registers both parents, which is true to life.
    const mother = chance(0.72) ? run(
      `INSERT INTO users (full_name, email, role, title, password_hash, phone)
       VALUES (?, ?, 'parent', 'Parent / Guardian', ?, ?)`,
      [motherName, `${emailBase}.mother@example.com`, passwordHash, `(510) 555-${String(between(1000, 9999))}`]
    ).lastID : null;

    const childCount = chance(0.25) ? 3 : (chance(0.55) ? 2 : 1);
    const children = [];

    for (let c = 0; c < childCount; c += 1) {
      const classKey = classKeys[Math.floor(rnd() * classKeys.length)];
      const isBoys = classKey.endsWith('Boys');
      const grade = Number(classKey.match(/Grade (\d)/)[1]);
      const firstName = isBoys ? pick(BOYS) : pick(GIRLS);

      studentSeq += 1;
      const code = `ICF-${String(studentSeq).padStart(4, '0')}`;
      // Grade 1 pupils are about six years old at the start of the year.
      const birthYear = 2026 - (grade + 5);

      const studentId = run(
        `INSERT INTO students (student_code, first_name, last_name, class_id, gender, date_of_birth, enrolled_on)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [code, firstName, surname, classIds[classKey], isBoys ? 'male' : 'female',
          `${birthYear}-${String(between(1, 12)).padStart(2, '0')}-${String(between(1, 28)).padStart(2, '0')}`,
          '2026-08-10']
      ).lastID;

      run(
        `INSERT INTO student_guardians (student_id, user_id, relationship, is_primary) VALUES (?, ?, 'father', 1)`,
        [studentId, father]
      );
      if (mother) {
        run(
          `INSERT INTO student_guardians (student_id, user_id, relationship, is_primary) VALUES (?, ?, 'mother', 0)`,
          [studentId, mother]
        );
      }
      children.push({ id: studentId, classKey, firstName, surname });
    }

    families.push({ father, mother, surname, children });
  }

  return families;
}

const MASTERY_BY_PROFILE = {
  high: ['secure', 'mastered', 'mastered', 'secure'],
  mid: ['developing', 'secure', 'secure', 'developing'],
  low: ['emerging', 'developing', 'developing', 'emerging'],
};

const SESSION_TYPES = ['standard_lesson', 'standard_lesson', 'standard_lesson', 'revision', 'practical_demo', 'oral_testing'];

/**
 * Generate lesson logs for every teaching day from the start of the current
 * term up to today, following each class's diligence profile.
 */
function seedLessonHistory(classIds, teacherIds, assistant, today) {
  const term = get(`SELECT * FROM terms WHERE is_current = 1`);
  const days = teachingDaysBetween(term.start_date, today < term.end_date ? today : term.end_date);

  for (const [key, classId] of Object.entries(classIds)) {
    const classRow = get(`SELECT * FROM classes WHERE id = ?`, [classId]);
    const profile = CLASS_PROFILES[key] || { diligence: 0.9, mastery: 'mid' };
    const teacherId = teacherIds[key];
    const teacher = get(`SELECT full_name FROM users WHERE id = ?`, [teacherId]);
    const topics = all(
      `SELECT * FROM curriculum_topics
        WHERE grade = ? AND term_number = ? AND (gender_track = 'general' OR gender_track = ?)
        ORDER BY sequence_order ASC, id ASC`,
      [classRow.grade, term.term_number, classRow.gender_track]
    );
    const memorization = get(
      `SELECT * FROM memorization_standards WHERE grade = ? AND term_number = ?`,
      [classRow.grade, term.term_number]
    );
    if (!topics.length) continue;

    // Track how many sessions each strand has had, so mastery ratchets up.
    const sessionsPerTopic = new Map();

    for (const date of days) {
      if (!chance(profile.diligence)) continue;

      const subject = subjectForDate(date, term.term_number);
      const topic = topics.find((t) => t.subject === subject) || topics[0];
      const seen = (sessionsPerTopic.get(topic.id) || 0) + 1;
      sessionsPerTopic.set(topic.id, seen);

      // Mastery is judged only once a strand has had a few sessions.
      const scale = MASTERY_BY_PROFILE[profile.mastery];
      const mastery = seen <= 2
        ? (profile.mastery === 'low' ? 'emerging' : 'developing')
        : pick(scale);

      const isSubstitute = chance(0.05) && assistant;
      const loggedByName = isSubstitute ? 'Ustadh Yusuf Amin' : teacher.full_name;
      const loggedById = isSubstitute ? assistant : teacherId;

      const sessionType = seen % 5 === 0 ? 'oral_testing' : pick(SESSION_TYPES);
      const status = chance(0.06) ? 'partial' : 'completed';

      run(
        `INSERT INTO lesson_logs
           (class_id, topic_id, date, day_of_week, subject, session_type, teacher_id, teacher_name,
            topic_covered, expected_indicator, memorization_covered, status, class_mastery, notes, handover_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          classId, topic.id, date, dayName(date), subject, sessionType, loggedById, loggedByName,
          topic.topic_title, topic.expected_indicator,
          memorization ? `${memorization.surah} • ${memorization.names_of_allah}` : null,
          status, mastery,
          buildLessonNote(sessionType, status, subject),
          isSubstitute ? 'Covered for the class teacher today; the register and workbook are on the desk.' : null,
        ]
      );
    }
  }

  return term;
}

function buildLessonNote(sessionType, status, subject) {
  if (status === 'partial') {
    return `Ran short on time — the second half of the ${subject} lesson carries over to the next session.`;
  }
  switch (sessionType) {
    case 'oral_testing':
      return 'Oral testing round: most of the class recited confidently, a few need another week.';
    case 'practical_demo':
      return 'Practical demonstration in the ablution area; every pupil took a turn.';
    case 'revision':
      return 'Revision session before moving on; recall was noticeably stronger than last week.';
    default:
      return chance(0.5)
        ? 'Good engagement; the class answered the recall questions well.'
        : 'Lesson delivered as planned. Workbook pages completed in class.';
  }
}

/** Attendance for every teaching day, per student, with plausible patterns. */
function seedAttendance(term, today) {
  const days = teachingDaysBetween(term.start_date, today < term.end_date ? today : term.end_date);
  const students = all(`SELECT id, class_id FROM students WHERE is_active = 1`);

  // A few students have a genuinely poor pattern so the concern list is real.
  const attendanceProfile = new Map();
  for (const s of students) {
    const roll = rnd();
    attendanceProfile.set(s.id, roll < 0.06 ? 'poor' : (roll < 0.2 ? 'patchy' : 'good'));
  }

  for (const date of days) {
    for (const s of students) {
      const profile = attendanceProfile.get(s.id);
      const absentChance = profile === 'poor' ? 0.28 : (profile === 'patchy' ? 0.1 : 0.03);
      const lateChance = profile === 'poor' ? 0.2 : (profile === 'patchy' ? 0.12 : 0.05);

      let status = 'present';
      let minutesLate = 0;
      let note = null;

      if (chance(absentChance)) {
        // Some absences are called in ahead of time and marked excused.
        if (chance(0.35)) {
          status = 'excused';
          note = pick(['Family travel — notified in advance', 'Unwell, parent called the office', 'Family commitment']);
        } else {
          status = 'absent';
        }
      } else if (chance(lateChance)) {
        status = 'late';
        minutesLate = between(5, 25);
      }

      run(
        `INSERT INTO attendance (student_id, class_id, date, status, minutes_late, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [s.id, s.class_id, date, status, minutesLate, note]
      );
    }
  }
}

const STRANDS_BY_TERM = {
  1: ['Fiqh', 'Aḥādīth', 'Sīrah', "ʿAqā'id", 'Akhlāq'],
  2: ['Fiqh', 'Aḥādīth', 'Sīrah', "ʿAqā'id", 'Akhlāq'],
  3: ['Fiqh', 'Aḥādīth', 'Tārīkh', "ʿAqā'id", 'Akhlāq'],
  4: ['Fiqh', 'Aḥādīth', 'Tārīkh', "ʿAqā'id", 'Ādāb'],
};

/** Per-student strand assessments and memorization progress for the term. */
function seedStudentProgress(term, classIds, teacherIds, today) {
  const strands = STRANDS_BY_TERM[term.term_number] || STRANDS_BY_TERM[1];

  for (const [key, classId] of Object.entries(classIds)) {
    const profile = CLASS_PROFILES[key] || { mastery: 'mid' };
    const scale = MASTERY_BY_PROFILE[profile.mastery];
    const teacherId = teacherIds[key];
    const classRow = get(`SELECT grade FROM classes WHERE id = ?`, [classId]);
    const standard = get(
      `SELECT * FROM memorization_standards WHERE grade = ? AND term_number = ?`,
      [classRow.grade, term.term_number]
    );
    const students = all(`SELECT id FROM students WHERE class_id = ? AND is_active = 1`, [classId]);

    for (const s of students) {
      // Not every strand is formally assessed this early in the term.
      for (const subject of strands) {
        if (!chance(0.72)) continue;
        const level = chance(0.15)
          ? pick(['emerging', 'developing', 'secure', 'mastered'])
          : pick(scale);
        run(
          `INSERT INTO assessments (student_id, term_number, subject, mastery_level, comment, assessed_on, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [s.id, term.term_number, subject, level, assessmentComment(level, subject),
            addDays(today, -between(1, 12)), teacherId]
        );
      }

      if (!standard) continue;
      for (const [itemType, label] of [
        ['surah', standard.surah], ['dua', standard.dua], ['names', standard.names_of_allah],
      ]) {
        const roll = rnd();
        const status = roll < 0.32 ? 'mastered' : (roll < 0.82 ? 'in_progress' : 'not_started');
        run(
          `INSERT INTO memorization_progress
             (student_id, term_number, item_type, item_label, status, verified_on, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [s.id, term.term_number, itemType, label, status,
            status === 'mastered' ? addDays(today, -between(1, 15)) : null, teacherId]
        );
      }
    }
  }
}

function assessmentComment(level, subject) {
  const byLevel = {
    mastered: [`Recites and explains the ${subject} material confidently and unprompted.`,
      `Excellent grasp of this term's ${subject} standard.`],
    secure: [`Meets the ${subject} standard reliably.`, `Solid understanding; answers recall questions correctly.`],
    developing: [`Making steady progress in ${subject}; benefits from repetition at home.`,
      `Understands the main points, still consolidating the detail.`],
    emerging: [`Needs support with the ${subject} standard — please revise together at home.`,
      `Beginning to grasp the material; extra practice recommended.`],
  };
  return pick(byLevel[level] || byLevel.developing);
}

function seedAnnouncements(adminIds, classIds, today) {
  const notices = [
    {
      title: 'Parent–Teacher Meetings: Term 1',
      body: 'Term 1 parent–teacher meetings will be held on Saturday after Ẓuhr in the main hall. '
        + 'Each family will have a ten-minute slot with their child\'s teacher to review the term report. '
        + 'Please sign up at the office desk or reply to your teacher through the portal.',
      audience: 'all', pinned: 1, offset: -4,
    },
    {
      title: 'Memorization Assembly — Friday',
      body: 'This Friday\'s assembly will feature recitation from each grade of the Sūrah set for Term 1. '
        + 'Please help your child revise at home this week.',
      audience: 'parents', pinned: 0, offset: -2,
    },
    {
      title: 'Daily check-off reminder',
      body: 'A reminder to all teachers: please complete the daily check-off before leaving the building. '
        + 'The board reviews pacing every Sunday and gaps in the record make a class look behind when it is not.',
      audience: 'teachers', pinned: 1, offset: -6,
    },
    {
      title: 'Ṭahārah practical demonstration',
      body: 'Grade 2 will hold the wuḍūʾ practical demonstration next Monday. Please send a small towel with your child.',
      audience: 'class', classKey: 'Grade 2 Boys', pinned: 0, offset: -1,
    },
    {
      title: 'Term 1 report cards',
      body: 'Term 1 report cards will be published in the parent portal at the end of the term. '
        + 'You will be able to view and print your child\'s report from the Report Card tab.',
      audience: 'parents', pinned: 0, offset: -9,
    },
    {
      title: 'Ramaḍān interlude schedule',
      body: 'The Ramaḍān interlude runs on a reduced schedule with no new standards introduced — '
        + 'the focus is consolidation and revision. Detailed timings will follow closer to the date.',
      audience: 'all', pinned: 0, offset: -12,
    },
  ];

  for (const n of notices) {
    run(
      `INSERT INTO announcements (title, body, audience, class_id, is_pinned, publish_on, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [n.title, n.body, n.audience, n.classKey ? classIds[n.classKey] : null,
        n.pinned, addDays(today, n.offset), adminIds[0]]
    );
  }
}

function seedHomework(classIds, teacherIds, today) {
  const items = [
    { subject: 'Aḥādīth', title: 'Recite this week\'s ḥadīth with its meaning', days: -3, due: 2 },
    { subject: 'Fiqh', title: 'Revise the farāʾiḍ of wuḍūʾ', days: -5, due: 1 },
    { subject: "ʿAqā'id", title: 'Learn the two Names of Allāh set this week', days: -2, due: 3 },
  ];
  for (const [key, classId] of Object.entries(classIds)) {
    for (const item of items) {
      if (!chance(0.7)) continue;
      run(
        `INSERT INTO homework (class_id, subject, title, instructions, assigned_date, due_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [classId, item.subject, item.title,
          'Please practise with your child at home and sign the workbook page.',
          addDays(today, item.days), addDays(today, item.due), teacherIds[key]]
      );
    }
  }
}

/** A handful of teacher↔parent conversations so the inbox is not empty. */
function seedMessages(families, classIds, teacherIds, today) {
  const withChildren = families.filter((f) => f.children.length > 0).slice(0, 14);

  for (const family of withChildren) {
    const child = family.children[0];
    const teacherId = teacherIds[child.classKey];
    if (!teacherId) continue;

    const threadId = run(
      `INSERT INTO message_threads (student_id, teacher_id, parent_id, subject, last_message_at)
       VALUES (?, ?, ?, ?, ?)`,
      [child.id, teacherId, family.father,
        pick(['Memorization at home', 'Attendance last week', 'Term 1 progress', 'Homework question']),
        `${addDays(today, -between(0, 6))} 18:${String(between(10, 59))}:00`]
    ).lastID;

    const opener = chance(0.5);
    const exchange = opener
      ? [
        [teacherId, `Assalāmu ʿalaykum. ${child.firstName} did very well in the oral testing round this week — the recitation was clear and confident. Please keep up the revision at home.`],
        [family.father, `Wa ʿalaykum assalām, jazākum Allāhu khayran for letting us know. We will keep going over it after Maghrib.`],
      ]
      : [
        [family.father, `Assalāmu ʿalaykum. ${child.firstName} found this week's memorization difficult. Is there anything specific we should focus on at home?`],
        [teacherId, `Wa ʿalaykum assalām. Start with the first three āyāt only until they are fluent, then add the rest. Ten minutes a day is plenty at this stage — I will check again on Thursday.`],
      ];

    for (const [senderId, body] of exchange) {
      run(`INSERT INTO messages (thread_id, sender_id, body) VALUES (?, ?, ?)`, [threadId, senderId, body]);
    }

    // Leave some threads unread for the teacher so the badge is meaningful.
    if (chance(0.6)) {
      run(
        `INSERT INTO thread_reads (thread_id, user_id, last_read_at) VALUES (?, ?, datetime('now'))`,
        [threadId, teacherId]
      );
    }
  }
}

function seedDatabase({ today = todayISO() } = {}) {
  migrate();

  transaction(() => {
    // Order matters: children before parents, for foreign keys.
    exec(`
      DELETE FROM thread_reads;
      DELETE FROM messages;
      DELETE FROM message_threads;
      DELETE FROM announcements;
      DELETE FROM homework;
      DELETE FROM memorization_progress;
      DELETE FROM assessments;
      DELETE FROM attendance;
      DELETE FROM lesson_logs;
      DELETE FROM student_guardians;
      DELETE FROM students;
      DELETE FROM class_teachers;
      DELETE FROM classes;
      DELETE FROM memorization_standards;
      DELETE FROM curriculum_topics;
      DELETE FROM terms;
      DELETE FROM users;
      DELETE FROM audit_log;
    `);

    seedTerms();
    seedCurriculum();
    const { adminIds, classIds, teacherIds, assistant, passwordHash } = seedStaff();
    const families = seedStudentsAndFamilies(classIds, passwordHash);
    const term = seedLessonHistory(classIds, teacherIds, assistant, today);
    seedAttendance(term, today);
    seedStudentProgress(term, classIds, teacherIds, today);
    seedAnnouncements(adminIds, classIds, today);
    seedHomework(classIds, teacherIds, today);
    seedMessages(families, classIds, teacherIds, today);
  });

  const counts = {
    users: value(`SELECT COUNT(*) FROM users`, [], 0),
    classes: value(`SELECT COUNT(*) FROM classes`, [], 0),
    students: value(`SELECT COUNT(*) FROM students`, [], 0),
    topics: value(`SELECT COUNT(*) FROM curriculum_topics`, [], 0),
    lessonLogs: value(`SELECT COUNT(*) FROM lesson_logs`, [], 0),
    attendance: value(`SELECT COUNT(*) FROM attendance`, [], 0),
    assessments: value(`SELECT COUNT(*) FROM assessments`, [], 0),
    messages: value(`SELECT COUNT(*) FROM messages`, [], 0),
  };
  console.log('[seed] complete:', JSON.stringify(counts));
  return counts;
}

if (require.main === module) {
  const { initDb, flush } = require('../db');
  initDb()
    .then(() => { seedDatabase(); flush(); process.exit(0); })
    .catch((err) => { console.error('[seed] failed:', err); process.exit(1); });
}

module.exports = seedDatabase;
