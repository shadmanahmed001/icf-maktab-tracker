import React from 'react';
import { BookOpen, CheckCircle, BarChart3, Printer, Users, Calendar, Sparkles } from 'lucide-react';

export default function Navbar({ 
  currentView, 
  setCurrentView, 
  currentTerm, 
  terms, 
  onTermChange, 
  currentUser, 
  users, 
  onUserChange 
}) {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-900/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                  ICF Maktab
                </span>
                <span className="text-xs text-slate-400">2026–2027</span>
              </div>
              <h1 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight flex items-center gap-1.5">
                Islamic Studies Tracker
              </h1>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            <button
              onClick={() => setCurrentView('teacher')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === 'teacher'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              Teacher Daily Log
            </button>

            <button
              onClick={() => setCurrentView('admin')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === 'admin'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Admin Pacing Radar
            </button>

            <button
              onClick={() => setCurrentView('curriculum')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === 'curriculum'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Syllabus & Standards
            </button>

            <button
              onClick={() => setCurrentView('reports')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === 'reports'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Printer className="w-4 h-4" />
              Printable Summary
            </button>
          </nav>

          {/* Right Controls: Term Selector & User Persona */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Active Term Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-emerald-400 hidden sm:block" />
              <select
                value={currentTerm?.id || ''}
                onChange={(e) => onTermChange(Number(e.target.value))}
                className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer"
                title="Switch Active Term"
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id} className="bg-slate-800 text-white">
                    {t.title} {t.is_interlude ? '(Interlude)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Persona Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs">
              <Users className="w-3.5 h-3.5 text-blue-400 hidden sm:block" />
              <select
                value={currentUser?.id || ''}
                onChange={(e) => {
                  const u = users.find(x => x.id === Number(e.target.value));
                  if (u) onUserChange(u);
                }}
                className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer"
                title="Switch Demo User"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id} className="bg-slate-800 text-white">
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

          </div>

        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-800 text-xs">
          <button
            onClick={() => setCurrentView('teacher')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded font-medium ${
              currentView === 'teacher' ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            Teacher
          </button>
          <button
            onClick={() => setCurrentView('admin')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded font-medium ${
              currentView === 'admin' ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Admin
          </button>
          <button
            onClick={() => setCurrentView('curriculum')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded font-medium ${
              currentView === 'curriculum' ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Syllabus
          </button>
          <button
            onClick={() => setCurrentView('reports')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded font-medium ${
              currentView === 'reports' ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <Printer className="w-4 h-4" />
            Reports
          </button>
        </div>

      </div>
    </header>
  );
}
