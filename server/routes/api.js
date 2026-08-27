const express = require('express');
const router = express.Router();
const { query, get, run } = require('../db');

// --- 1. Classes & Teachers ---
router.get('/classes', async (req, res) => {
  try {
    const classes = await query(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM lesson_logs l WHERE l.class_id = c.id) AS total_logs_count,
        (SELECT date FROM lesson_logs l WHERE l.class_id = c.id ORDER BY date DESC, id DESC LIMIT 1) AS last_logged_date
      FROM classes c
      ORDER BY c.grade ASC, c.gender_track ASC
    `);
    res.json({ success: true, data: classes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 2. Terms ---
router.get('/terms', async (req, res) => {
  try {
    const terms = await query(`SELECT * FROM terms ORDER BY term_number ASC`);
    res.json({ success: true, data: terms });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/terms/set-current', async (req, res) => {
  const { term_id } = req.body;
  try {
    await run(`UPDATE terms SET is_current = 0`);
    await run(`UPDATE terms SET is_current = 1 WHERE id = ?`, [term_id]);
    res.json({ success: true, message: 'Current term updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 3. Users / Quick Auth ---
router.get('/users', async (req, res) => {
  try {
    const users = await query(`
      SELECT u.id, u.name, u.email, u.role, u.assigned_class_id, u.pin, c.name AS class_name
      FROM users u
      LEFT JOIN classes c ON u.assigned_class_id = c.id
      ORDER BY u.role ASC, u.id ASC
    `);
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 4. Curriculum & Memorization Standards ---
router.get('/curriculum', async (req, res) => {
  const { grade, gender_track, term_number } = req.query;
  try {
    let sql = `SELECT * FROM curriculum_topics WHERE 1=1`;
    const params = [];

    if (grade) {
      sql += ` AND grade = ?`;
      params.push(grade);
    }
    if (gender_track && gender_track !== 'general') {
      sql += ` AND (gender_track = ? OR gender_track = 'general')`;
      params.push(gender_track);
    } else if (gender_track === 'general') {
      sql += ` AND gender_track = 'general'`;
    }
    if (term_number !== undefined && term_number !== '') {
      sql += ` AND term_number = ?`;
      params.push(term_number);
    }

    sql += ` ORDER BY grade ASC, term_number ASC, sequence_order ASC, id ASC`;
    const topics = await query(sql, params);

    // Memorization standards
    let memSql = `SELECT * FROM memorization_standards WHERE 1=1`;
    const memParams = [];
    if (grade) {
      memSql += ` AND grade = ?`;
      memParams.push(grade);
    }
    if (term_number !== undefined && term_number !== '') {
      memSql += ` AND term_number = ?`;
      memParams.push(term_number);
    }
    memSql += ` ORDER BY grade ASC, term_number ASC`;
    const memorization = await query(memSql, memParams);

    res.json({
      success: true,
      data: {
        topics,
        memorization
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 5. Daily Lesson Logs ---
router.get('/logs', async (req, res) => {
  const { class_id, date, limit = 50 } = req.query;
  try {
    let sql = `
      SELECT l.*, c.name as class_name, c.grade, c.gender_track, c.teacher_name as default_teacher
      FROM lesson_logs l
      JOIN classes c ON l.class_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (class_id) {
      sql += ` AND l.class_id = ?`;
      params.push(class_id);
    }
    if (date) {
      sql += ` AND l.date = ?`;
      params.push(date);
    }

    sql += ` ORDER BY l.date DESC, l.id DESC LIMIT ?`;
    params.push(parseInt(limit, 10));

    const logs = await query(sql, params);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/logs', async (req, res) => {
  const {
    class_id,
    topic_id,
    date,
    day_of_week,
    subject,
    session_type = 'standard_lesson',
    teacher_name,
    topic_covered,
    expected_indicator = '',
    memorization_covered = '',
    status = 'completed',
    mastery_level = 'mastered',
    notes = ''
  } = req.body;

  if (!class_id || !date || !day_of_week || !subject || !topic_covered || !teacher_name) {
    return res.status(400).json({ success: false, error: 'Missing required lesson fields' });
  }

  try {
    const result = await run(
      `INSERT INTO lesson_logs 
       (class_id, topic_id, date, day_of_week, subject, session_type, teacher_name, topic_covered, expected_indicator, memorization_covered, status, mastery_level, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        class_id,
        topic_id || null,
        date,
        day_of_week,
        subject,
        session_type,
        teacher_name,
        topic_covered,
        expected_indicator,
        memorization_covered,
        status,
        mastery_level,
        notes
      ]
    );

    const newLog = await get(
      `SELECT l.*, c.name as class_name, c.grade 
       FROM lesson_logs l 
       JOIN classes c ON l.class_id = c.id 
       WHERE l.id = ?`,
      [result.lastID]
    );

    res.json({ success: true, data: newLog, message: 'Daily lesson log recorded successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/logs/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await run(`DELETE FROM lesson_logs WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Log deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 6. Admin Dashboard & Pacing Analytics ---
router.get('/admin/dashboard', async (req, res) => {
  try {
    const currentTerm = (await get(`SELECT * FROM terms WHERE is_current = 1`)) || (await get(`SELECT * FROM terms ORDER BY term_number ASC LIMIT 1`));
    const classes = await query(`SELECT * FROM classes ORDER BY grade ASC, gender_track ASC`);
    const allTopics = await query(`SELECT * FROM curriculum_topics WHERE term_number = ?`, [currentTerm.term_number]);
    const memorizationStandards = await query(`SELECT * FROM memorization_standards WHERE term_number = ?`, [currentTerm.term_number]);

    // Aggregate progress per class for the current term
    const classPacing = [];

    for (const c of classes) {
      // Find required topics for this class grade & gender track in this term
      const classTopics = allTopics.filter(t => 
        t.grade === c.grade && 
        (t.gender_track === 'general' || t.gender_track === c.gender_track)
      );

      const totalRequired = classTopics.length; // usually 5 strands per term (Fiqh, Hadith, Sirah/Tarikh, Aqa'id, Akhlaq/Adab)

      // Find completed topics in this term
      const logs = await query(
        `SELECT * FROM lesson_logs WHERE class_id = ? AND date >= ? AND date <= ?`,
        [c.id, currentTerm.start_date, currentTerm.end_date]
      );

      // Check which topics are completed
      const completedTopicsCount = classTopics.filter(ct => {
        return logs.some(l => 
          (l.topic_id && l.topic_id === ct.id) ||
          (l.subject.toLowerCase() === ct.subject.toLowerCase() && l.topic_covered.toLowerCase().includes(ct.topic_title.substring(0, 15).toLowerCase())) ||
          (l.subject.toLowerCase() === ct.subject.toLowerCase() && l.status === 'completed')
        );
      }).length;

      const completionPercent = totalRequired > 0 ? Math.min(100, Math.round((completedTopicsCount / totalRequired) * 100)) : 100;

      // Pacing status calculation
      // For term 1, if we are in early term and completed >= 2, On Track
      let pacingStatus = 'on_track';
      if (completionPercent >= 50) {
        pacingStatus = 'on_track';
      } else if (completionPercent >= 20) {
        pacingStatus = 'in_progress';
      } else {
        pacingStatus = 'behind';
      }

      // Next upcoming topic for this class
      const remainingTopics = classTopics.filter(ct => {
        return !logs.some(l => l.topic_id === ct.id || (l.subject === ct.subject && l.status === 'completed'));
      });

      const nextTopic = remainingTopics[0] || null;
      const classMem = memorizationStandards.find(m => m.grade === c.grade);

      classPacing.push({
        class: c,
        totalRequired,
        completedCount: completedTopicsCount,
        completionPercent,
        pacingStatus,
        totalLogs: logs.length,
        nextTopic,
        memorizationStandard: classMem,
        topics: classTopics.map(ct => {
          const matchingLog = logs.find(l => l.topic_id === ct.id || (l.subject === ct.subject && l.status === 'completed'));
          return {
            ...ct,
            isCompleted: !!matchingLog,
            completedLog: matchingLog || null
          };
        })
      });
    }

    // Recent activity across maktab (latest 15 logs)
    const recentActivity = await query(`
      SELECT l.*, c.name as class_name, c.grade 
      FROM lesson_logs l
      JOIN classes c ON l.class_id = c.id
      ORDER BY l.date DESC, l.id DESC
      LIMIT 15
    `);

    // Total stats
    const totalStudents = classes.reduce((sum, c) => sum + (c.student_count || 0), 0);
    const totalLogsRecorded = (await get(`SELECT COUNT(*) as count FROM lesson_logs`)).count;

    res.json({
      success: true,
      data: {
        currentTerm,
        stats: {
          totalClasses: classes.length,
          totalStudents,
          totalLogsRecorded,
          classesOnTrack: classPacing.filter(cp => cp.pacingStatus === 'on_track').length,
          classesBehind: classPacing.filter(cp => cp.pacingStatus === 'behind').length
        },
        classPacing,
        recentActivity
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
