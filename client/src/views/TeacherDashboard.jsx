import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Calendar, 
  BookOpen, 
  Sparkles, 
  Clock, 
  Check, 
  RotateCcw, 
  FileText, 
  AlertCircle, 
  Trash2, 
  Star,
  ChevronRight,
  ShieldCheck,
  Zap,
  SlidersHorizontal,
  ChevronDown,
  User,
  Users
} from 'lucide-react';
import { api } from '../api';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const QUICK_NOTES = [
  'All students grasped the core concept well.',
  'Need 5 minutes quick recap at start of next class.',
  'Practical demonstration completed.',
  'Oral recitation assessed individually with correct tajwīd.',
  'Completed topic vocabulary & meaning.'
];

export default function TeacherDashboard({ classes, currentTerm, currentUser, onLogAdded }) {
  // Retrieve saved class preference from localStorage for persistent mobile opening
  const savedClassId = localStorage.getItem('icf_maktab_teacher_class_id');
  const initialClassId = savedClassId 
    ? Number(savedClassId) 
    : (currentUser?.assigned_class_id || (classes.length > 0 ? classes[0].id : 1));

  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [genderFilter, setGenderFilter] = useState('all'); // 'all', 'boys', 'girls'

  // Today's day detection
  const getInitialDay = () => {
    const dayIndex = new Date().getDay();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentName = days[dayIndex];
    return WEEKDAYS.includes(currentName) ? currentName : 'Monday';
  };

  const [selectedDay, setSelectedDay] = useState(getInitialDay());
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Data states
  const [curriculumTopics, setCurriculumTopics] = useState([]);
  const [memorizationStandard, setMemorizationStandard] = useState(null);
  const [classLogs, setClassLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justLogged, setJustLogged] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form states
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [customTopicTitle, setCustomTopicTitle] = useState('');
  const [customIndicator, setCustomIndicator] = useState('');
  const [sessionType, setSessionType] = useState('standard_lesson');
  const [masteryLevel, setMasteryLevel] = useState('mastered');
  const [teacherNotes, setTeacherNotes] = useState('');
  
  // Memorization quick chips
  const [memSurahChecked, setMemSurahChecked] = useState(true);
  const [memDuaChecked, setMemDuaChecked] = useState(true);
  const [memNamesChecked, setMemNamesChecked] = useState(true);

  const activeClass = classes.find(c => c.id === Number(selectedClassId)) || classes[0];

  // Save selected class to localStorage whenever teacher changes it
  const handleClassChange = (classId) => {
    setSelectedClassId(classId);
    localStorage.setItem('icf_maktab_teacher_class_id', classId.toString());
    setJustLogged(false);
  };

  // Determine current subject name based on selected day and term
  const getSubjectForDay = (day) => {
    switch (day) {
      case 'Monday': return 'Fiqh';
      case 'Tuesday': return 'Aḥādīth';
      case 'Wednesday': return currentTerm?.term_number >= 3 ? 'Tārīkh' : 'Sīrah';
      case 'Thursday': return 'ʿAqā\'id';
      case 'Friday': return currentTerm?.term_number >= 4 ? 'Ādāb' : 'Akhlāq';
      default: return 'Islamic Studies';
    }
  };

  // Fetch curriculum & logs
  useEffect(() => {
    if (!activeClass || !currentTerm) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const curRes = await api.getCurriculum({
          grade: activeClass.grade,
          gender_track: activeClass.gender_track,
          term_number: currentTerm.term_number
        });

        if (curRes.success) {
          setCurriculumTopics(curRes.data.topics || []);
          setMemorizationStandard(curRes.data.memorization?.[0] || null);
        }

        const logsRes = await api.getLogs({
          class_id: activeClass.id,
          limit: 20
        });

        if (logsRes.success) {
          setClassLogs(logsRes.data || []);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeClass?.id, currentTerm?.id]);

  // Set default topic whenever day of week or topics change
  useEffect(() => {
    if (curriculumTopics.length > 0) {
      const topicForDay = curriculumTopics.find(t => t.day_of_week === selectedDay);
      if (topicForDay) {
        setSelectedTopicId(topicForDay.id);
        setCustomTopicTitle(topicForDay.topic_title);
        setCustomIndicator(topicForDay.expected_indicator);
      } else {
        setSelectedTopicId('');
        setCustomTopicTitle('');
        setCustomIndicator('');
      }
    }
  }, [selectedDay, curriculumTopics]);

  // Check if today's lesson has already been logged
  const todayLog = classLogs.find(l => l.date === logDate && l.day_of_week === selectedDay);

  // 1-Tap Fast Submit
  const handleQuickSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!customTopicTitle.trim()) {
      alert('Please enter or select a topic title.');
      return;
    }

    setSaving(true);
    try {
      const memParts = [];
      if (memSurahChecked && memorizationStandard?.surah) memParts.push(`Sūrah: ${memorizationStandard.surah}`);
      if (memDuaChecked && memorizationStandard?.dua) memParts.push(`Duʿā': ${memorizationStandard.dua}`);
      if (memNamesChecked && memorizationStandard?.names_of_allah) memParts.push(`Names: ${memorizationStandard.names_of_allah}`);

      const payload = {
        class_id: activeClass.id,
        topic_id: selectedTopicId ? Number(selectedTopicId) : null,
        date: logDate,
        day_of_week: selectedDay,
        subject: getSubjectForDay(selectedDay),
        session_type: sessionType,
        teacher_name: currentUser?.name || activeClass.teacher_name,
        topic_covered: customTopicTitle,
        expected_indicator: customIndicator,
        memorization_covered: memParts.join(' | ') || 'Daily Memorization Track Practiced',
        status: masteryLevel === 'needs_revision' ? 'needs_revision' : 'completed',
        mastery_level: masteryLevel,
        notes: teacherNotes
      };

      const res = await api.createLog(payload);
      if (res.success) {
        setJustLogged(true);
        
        // Refresh logs list
        const updatedLogs = await api.getLogs({ class_id: activeClass.id, limit: 20 });
        if (updatedLogs.success) setClassLogs(updatedLogs.data);

        setTeacherNotes('');
        if (onLogAdded) onLogAdded();
      }
    } catch (err) {
      console.error('Failed to save log:', err);
      alert('Failed to save log. Please check server connection.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLog = async (id) => {
    if (confirm('Delete this log entry?')) {
      await api.deleteLog(id);
      setClassLogs(prev => prev.filter(l => l.id !== id));
      setJustLogged(false);
      if (onLogAdded) onLogAdded();
    }
  };

  // Filter classes list by gender tab
  const filteredClasses = classes.filter(c => {
    if (genderFilter === 'all') return true;
    return c.gender_track === genderFilter;
  });

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 space-y-4 pb-20">
      
      {/* 1. Mobile-First Sticky Class & Teacher Switcher */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-sm space-y-2.5">
        
        {/* Gender Section Pills */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Section / Gender:
          </span>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setGenderFilter('all')}
              className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-all ${
                genderFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              All (12)
            </button>
            <button
              type="button"
              onClick={() => setGenderFilter('boys')}
              className={`px-2.5 py-1 rounded-md font-semibold text-[11px] flex items-center gap-1 transition-all ${
                genderFilter === 'boys' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              👦 Boys
            </button>
            <button
              type="button"
              onClick={() => setGenderFilter('girls')}
              className={`px-2.5 py-1 rounded-md font-semibold text-[11px] flex items-center gap-1 transition-all ${
                genderFilter === 'girls' ? 'bg-pink-600 text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              👧 Girls
            </button>
          </div>
        </div>

        {/* Large Prominent Class & Teacher Dropdown */}
        <div className="relative">
          <select
            value={activeClass?.id || ''}
            onChange={(e) => handleClassChange(Number(e.target.value))}
            className="w-full appearance-none bg-slate-50 hover:bg-slate-100 border-2 border-emerald-600/60 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
          >
            {filteredClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.gender_track === 'boys' ? '👦' : '👧'} {c.name} — Teacher: {c.teacher_name} ({c.room || 'Main Hall'})
              </option>
            ))}
          </select>
          <ChevronDown className="w-5 h-5 text-emerald-700 absolute right-3.5 top-3.5 pointer-events-none" />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5 px-1">
          <span>Teacher: <strong className="text-slate-800">{activeClass?.teacher_name}</strong></span>
          <span>{currentTerm?.title} • {activeClass?.student_count} Students</span>
        </div>
      </div>

      {/* 2. Fast Weekday Strand Picker (Touch Pills) */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-xs pb-1">
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-600" />
            Select Day & Strand:
          </span>
          <input 
            type="date"
            value={logDate}
            onChange={(e) => {
              setLogDate(e.target.value);
              setJustLogged(false);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-700 font-medium"
          />
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {WEEKDAYS.map((day) => {
            const isDaySelected = selectedDay === day;
            const subjectName = getSubjectForDay(day);
            const isDone = classLogs.some(l => l.day_of_week === day && l.status === 'completed');

            return (
              <button
                type="button"
                key={day}
                onClick={() => {
                  setSelectedDay(day);
                  setJustLogged(false);
                }}
                className={`py-2 px-1 rounded-xl text-center border transition-all cursor-pointer ${
                  isDaySelected
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-700/20 scale-[1.02]'
                    : isDone
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-medium'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 font-medium'
                }`}
              >
                <div className="text-xs font-bold">{day.substring(0, 3)}</div>
                <div className={`text-[10px] truncate ${isDaySelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                  {subjectName}
                </div>
                {isDone && !isDaySelected && (
                  <div className="text-[9px] text-emerald-700 font-bold">✓ Logged</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. ULTRA FAST 10-SECOND LOG CARD */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-emerald-500/80 shadow-md space-y-4 relative overflow-hidden">
        
        {/* Top Strand Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 font-bold text-xs">
              {selectedDay} — {getSubjectForDay(selectedDay)}
            </span>
            <span className="text-xs font-semibold text-slate-600">
              {activeClass?.name}
            </span>
          </div>

          <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            An-Nasīḥah Syllabus
          </span>
        </div>

        {/* Today's Topic Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Today's Coursebook Lesson:
          </div>
          <div className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
            {customTopicTitle || 'Select or enter topic below...'}
          </div>
          
          {customIndicator && (
            <div className="pt-2 border-t border-slate-200/80 mt-2 text-xs text-amber-950 font-medium flex items-start gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-900">Expected Outcome:</strong> {customIndicator}
              </div>
            </div>
          )}
        </div>

        {/* Fast Opening Memorization Chips (Pre-checked for fast 1-tap) */}
        {memorizationStandard && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-700 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Opening 15-Min Memorization Track:
              </span>
              <span className="text-slate-400">(Tap to toggle)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Surah chip */}
              <button
                type="button"
                onClick={() => setMemSurahChecked(!memSurahChecked)}
                className={`p-2 rounded-xl text-left border text-xs transition-all cursor-pointer ${
                  memSurahChecked 
                    ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 font-semibold ring-1 ring-emerald-500/20' 
                    : 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                }`}
              >
                <div className="text-[10px] text-slate-500">📖 Sūrah:</div>
                <div className="truncate font-bold">{memorizationStandard.surah}</div>
              </button>

              {/* Dua chip */}
              <button
                type="button"
                onClick={() => setMemDuaChecked(!memDuaChecked)}
                className={`p-2 rounded-xl text-left border text-xs transition-all cursor-pointer ${
                  memDuaChecked 
                    ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 font-semibold ring-1 ring-emerald-500/20' 
                    : 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                }`}
              >
                <div className="text-[10px] text-slate-500">🤲 Duʿā':</div>
                <div className="truncate font-bold">{memorizationStandard.dua}</div>
              </button>

              {/* Names chip */}
              <button
                type="button"
                onClick={() => setMemNamesChecked(!memNamesChecked)}
                className={`p-2 rounded-xl text-left border text-xs transition-all cursor-pointer ${
                  memNamesChecked 
                    ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 font-semibold ring-1 ring-emerald-500/20' 
                    : 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                }`}
              >
                <div className="text-[10px] text-slate-500">✨ Names:</div>
                <div className="truncate font-bold">{memorizationStandard.names_of_allah}</div>
              </button>
            </div>
          </div>
        )}

        {/* Quick Mastery Level Selector */}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs font-bold text-slate-700">Mastery:</span>
          <div className="flex-1 grid grid-cols-3 gap-1.5 text-xs">
            {[
              { id: 'mastered', label: '⭐ Mastered' },
              { id: 'developing', label: '🌱 Developing' },
              { id: 'needs_revision', label: '⚠️ Recap Needed' }
            ].map((m) => (
              <button
                type="button"
                key={m.id}
                onClick={() => setMasteryLevel(m.id)}
                className={`py-1.5 px-2 rounded-lg border text-center font-bold text-xs transition-all ${
                  masteryLevel === m.id
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* BIG 1-TAP ACTION BUTTON */}
        <button
          type="button"
          onClick={handleQuickSubmit}
          disabled={saving}
          className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2 text-base sm:text-lg transition-all cursor-pointer"
        >
          {saving ? (
            <span>Saving Log...</span>
          ) : (
            <>
              <Zap className="w-5 h-5 fill-amber-300 text-amber-300" />
              <span>1-Tap: Mark Completed & Save Log</span>
            </>
          )}
        </button>

        {/* Success Banner if just logged */}
        {justLogged && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 text-emerald-900 flex items-center justify-between text-xs animate-fade-in shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <strong className="block font-bold">Saved! Lesson recorded for {selectedDay}.</strong>
                <span className="text-[11px] text-emerald-700">Class pacing updated in real-time.</span>
              </div>
            </div>
            <button
              onClick={() => setJustLogged(false)}
              className="text-xs font-semibold text-emerald-700 hover:underline ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Advanced Options Toggle (Custom topic, notes, session type) */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1.5 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {showAdvanced ? 'Hide Custom Options' : '+ Custom Topic / Session Type / Teacher Notes'}
          </button>

          {showAdvanced && (
            <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs animate-fade-in">
              
              {/* Session Type */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Session Type:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: 'standard_lesson', label: '📘 Standard' },
                    { id: 'revision', label: '🔄 Revision' },
                    { id: 'practical_demo', label: '🧪 Practical' },
                    { id: 'weekly_test', label: '📝 Testing' }
                  ].map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setSessionType(t.id)}
                      className={`py-1 px-2 rounded-lg border text-center font-medium ${
                        sessionType === t.id ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Topic override */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Edit Topic Title:</label>
                <input
                  type="text"
                  value={customTopicTitle}
                  onChange={(e) => setCustomTopicTitle(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                />
              </div>

              {/* Teacher Remarks & Presets */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Teacher Handover Remarks:</label>
                <textarea
                  value={teacherNotes}
                  onChange={(e) => setTeacherNotes(e.target.value)}
                  placeholder="Notes for substitute teacher or admin..."
                  rows={2}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {QUICK_NOTES.map((preset, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setTeacherNotes(prev => prev ? `${prev} ${preset}` : preset)}
                      className="text-[10px] bg-white text-slate-600 px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-100"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

      </div>

      {/* 4. Term Strands Completion Overview for this Class */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            {activeClass?.name} • {currentTerm?.title} Progress
          </h3>
          <span className="text-xs font-bold text-emerald-700">
            {classLogs.filter(l => l.status === 'completed').length} Lessons Completed
          </span>
        </div>

        <div className="space-y-2">
          {curriculumTopics.map((t) => {
            const matchingLog = classLogs.find(l => l.topic_id === t.id || (l.subject === t.subject && l.status === 'completed'));
            const isDone = !!matchingLog;

            return (
              <div 
                key={t.id}
                className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                  isDone 
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' 
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isDone ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {isDone ? '✓' : t.day_of_week.substring(0, 1)}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{t.day_of_week} ({t.subject})</div>
                    <div className="text-[11px] text-slate-600 truncate max-w-[220px] sm:max-w-md">{t.topic_title}</div>
                  </div>
                </div>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0 ${
                  isDone ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {isDone ? 'Done' : 'Pending'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Past Log History with Quick Undo */}
      {classLogs.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Class Log History ({classLogs.length})
          </h3>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {classLogs.map((log) => (
              <div key={log.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[10px]">
                    {log.day_of_week} ({log.subject}) • {log.date}
                  </span>
                  <button
                    onClick={() => handleDeleteLog(log.id)}
                    className="text-slate-400 hover:text-rose-600 text-[11px] font-medium"
                  >
                    Delete
                  </button>
                </div>
                <div className="font-semibold text-slate-800">{log.topic_covered}</div>
                {log.notes && (
                  <p className="text-[11px] text-slate-500 italic">"{log.notes}"</p>
                )}
                <div className="text-[10px] text-slate-400">Teacher: {log.teacher_name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
