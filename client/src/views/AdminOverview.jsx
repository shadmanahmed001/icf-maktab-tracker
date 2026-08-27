import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Users, 
  BookOpen, 
  Calendar, 
  Filter, 
  Search, 
  Sparkles, 
  Flame, 
  Check, 
  XCircle,
  BellRing,
  UserCheck
} from 'lucide-react';
import { api } from '../api';

export default function AdminOverview({ currentTerm, onRefresh }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState('all'); // 'all', 'boys', 'girls'
  const [pacingFilter, setPacingFilter] = useState('all'); // 'all', 'behind', 'on_track'
  const [selectedTeacher, setSelectedTeacher] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminDashboard();
      if (res.success) {
        setDashboardData(res.data);
      }
    } catch (err) {
      console.error('Error loading admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [currentTerm?.id]);

  if (loading && !dashboardData) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto mb-3" />
        Loading Maktab Academic Standards & Pacing Dashboard...
      </div>
    );
  }

  const { stats, classPacing, recentActivity } = dashboardData || {
    stats: {},
    classPacing: [],
    recentActivity: []
  };

  // Determine today's log status across all 12 classes
  const todayStr = new Date().toISOString().split('T')[0];
  const loggedTodayClassIds = new Set(
    (recentActivity || []).filter(l => l.date === todayStr).map(l => l.class_id)
  );

  // Filter classes
  const filteredClasses = classPacing.filter((cp) => {
    const c = cp.class;
    
    // Gender filter
    if (genderFilter !== 'all' && c.gender_track !== genderFilter) return false;

    // Teacher filter
    if (selectedTeacher !== 'all' && c.teacher_name !== selectedTeacher) return false;

    // Pacing filter
    if (pacingFilter === 'on_track' && cp.pacingStatus !== 'on_track') return false;
    if (pacingFilter === 'behind' && cp.pacingStatus === 'on_track') return false;

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matches = c.name.toLowerCase().includes(q) || c.teacher_name.toLowerCase().includes(q);
      if (!matches) return false;
    }

    return true;
  });

  // Extract unique teacher list for dropdown
  const allTeachers = Array.from(new Set(classPacing.map(cp => cp.class.teacher_name)));

  // Missing classes calculation
  const missingClasses = classPacing.filter(cp => !loggedTodayClassIds.has(cp.class.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-5 sm:p-6 text-white shadow-lg border border-slate-700/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                ICF Daily Maktab 2026–2027
              </span>
              <span className="text-xs text-slate-400">Boys & Girls Sections</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Admin Academic Standards & Pacing Dashboard
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Real-time delivery oversight across 12 classes (Grades 1–6 Boys & Girls). Monitor syllabus milestones and daily opening memorization.
            </p>
          </div>

          {/* Active Term Pill */}
          <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-xl text-xs space-y-0.5 self-start md:self-auto">
            <div className="text-slate-400">Active Term:</div>
            <div className="font-bold text-emerald-400 text-sm">{currentTerm?.title}</div>
            <div className="text-slate-300 text-[11px]">{currentTerm?.date_range}</div>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Classes */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{stats.totalClasses || 12} Classes</div>
            <div className="text-xs text-slate-500 font-medium">{stats.totalStudents || 178} Enrolled Students</div>
          </div>
        </div>

        {/* On Track */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-700">{stats.classesOnTrack || 0} Grades</div>
            <div className="text-xs text-slate-500 font-medium">On Target Pace</div>
          </div>
        </div>

        {/* Needs Attention */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-amber-700">{stats.classesBehind || 0} Grades</div>
            <div className="text-xs text-slate-500 font-medium">Lags / Needs Recap</div>
          </div>
        </div>

        {/* Total Lesson Logs */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-purple-700">{stats.totalLogsRecorded || 0}</div>
            <div className="text-xs text-slate-500 font-medium">Total Lesson Logs Recorded</div>
          </div>
        </div>

      </div>

      {/* 3. Daily Logging Attendance Check (Admins see missing classes today) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Today's Teacher Log Submissions ({todayStr})
            </h3>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
            {loggedTodayClassIds.size} of {classPacing.length} Logged Today
          </span>
        </div>

        {/* Quick Grid of all classes showing logged vs pending */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-1">
          {classPacing.map((cp) => {
            const isLogged = loggedTodayClassIds.has(cp.class.id);
            return (
              <div 
                key={cp.class.id}
                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                  isLogged 
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 font-bold' 
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <div className="truncate">
                  <div className="font-bold truncate">{cp.class.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{cp.class.teacher_name.split(' ')[1] || cp.class.teacher_name}</div>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                  isLogged ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {isLogged ? '✓ Logged' : 'Pending'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Filter Bar (Gender Section, Teacher Dropdown, Pacing Filter) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Gender Section Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-emerald-600" />
            Section:
          </span>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs">
            <button
              onClick={() => setGenderFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                genderFilter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Sections
            </button>
            <button
              onClick={() => setGenderFilter('boys')}
              className={`px-3 py-1 rounded-lg font-bold text-xs flex items-center gap-1 transition-all ${
                genderFilter === 'boys' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              👦 Boys (Gr 1-6)
            </button>
            <button
              onClick={() => setGenderFilter('girls')}
              className={`px-3 py-1 rounded-lg font-bold text-xs flex items-center gap-1 transition-all ${
                genderFilter === 'girls' ? 'bg-pink-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              👧 Girls (Gr 1-6)
            </button>
          </div>
        </div>

        {/* Teacher Dropdown & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Teacher Dropdown */}
          <select
            value={selectedTeacher}
            onChange={(e) => setSelectedTeacher(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="all">👨‍🏫 All Teachers (12)</option>
            {allTeachers.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2" />
            <input
              type="text"
              placeholder="Search grade / room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1 text-xs text-slate-700 font-medium focus:bg-white focus:ring-1 focus:ring-emerald-500 w-44"
            />
          </div>

        </div>

      </div>

      {/* 5. Class Pacing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
        {filteredClasses.map((cp) => {
          const c = cp.class;
          const isOnTrack = cp.pacingStatus === 'on_track';
          const isInProgress = cp.pacingStatus === 'in_progress';
          const isBoys = c.gender_track === 'boys';

          return (
            <div 
              key={c.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-3.5 hover:shadow-md transition-shadow"
            >
              {/* Header: Class Name + Gender badge + Teacher */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">{c.name}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      isBoys ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                    }`}>
                      {isBoys ? '👦 Boys' : '👧 Girls'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Teacher: <strong className="text-slate-800">{c.teacher_name}</strong> • {c.student_count} Students ({c.room || 'Main Hall'})
                  </p>
                </div>

                {/* Status Badge */}
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  isOnTrack 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : isInProgress 
                      ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {isOnTrack ? '🟢 On Track' : isInProgress ? '🟡 In Progress' : '🔴 Behind'}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Term 1 Progress</span>
                  <span className="font-bold text-slate-800">{cp.completionPercent}% ({cp.completedCount}/{cp.totalRequired} strands)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${
                      isOnTrack ? 'bg-emerald-500' : isInProgress ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${cp.completionPercent}%` }}
                  />
                </div>
              </div>

              {/* 5-Strand Matrix Checkmarks */}
              <div className="space-y-1">
                <div className="grid grid-cols-5 gap-1 text-center text-[10px]">
                  {cp.topics.map((top) => (
                    <div 
                      key={top.id}
                      title={`${top.day_of_week} (${top.subject}): ${top.topic_title}\nStatus: ${top.isCompleted ? 'Completed' : 'Pending'}`}
                      className={`p-1.5 rounded-lg border font-bold ${
                        top.isCompleted 
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      <div>{top.day_of_week.substring(0, 3)}</div>
                      <div className="text-[8px] font-medium opacity-75 truncate">{top.subject.substring(0, 4)}</div>
                      <div className="text-[10px] mt-0.5">{top.isCompleted ? '✓' : '•'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Required Lesson Topic */}
              <div className="pt-2 border-t border-slate-100 text-xs">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Next Required Topic:
                </span>
                <p className="text-slate-800 font-medium truncate mt-0.5">
                  {cp.nextTopic 
                    ? `${cp.nextTopic.day_of_week} (${cp.nextTopic.subject}): ${cp.nextTopic.topic_title}` 
                    : '🎉 All term strands completed!'}
                </p>
              </div>

            </div>
          );
        })}
      </div>

      {/* 6. Live Activity Stream */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            Live Madrasah Daily Log Activity Stream
          </h3>
          <button
            onClick={fetchDashboard}
            className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {recentActivity.map((log) => (
            <div key={log.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                    {log.class_name}
                  </span>
                  <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded text-[10px]">
                    {log.day_of_week} ({log.subject})
                  </span>
                  <span className="text-[10px] text-slate-400">{log.date}</span>
                </div>
                <p className="text-slate-800 font-medium mt-1">{log.topic_covered}</p>
                {log.notes && <p className="text-[11px] text-slate-500 italic mt-0.5">"{log.notes}"</p>}
              </div>

              <div className="text-[11px] text-slate-500 sm:text-right">
                <div>Teacher: <strong className="text-slate-700">{log.teacher_name}</strong></div>
                <span className="text-[10px] font-semibold text-emerald-700">{log.mastery_level || 'mastered'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
