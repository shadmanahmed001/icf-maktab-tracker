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
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        
        {/* Main Header Bar */}
        <div className="flex items-center justify-between py-2.5 sm:py-3 gap-2 sm:gap-4 min-h-[64px]">
          
          {/* Brand & Title */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 flex-shrink-0">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-900/30 flex-shrink-0">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none mb-1">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/90 px-1.5 py-0.5 rounded border border-emerald-800/80">
                  ICF Maktab
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400 font-medium">2026–2027</span>
              </div>
              <h1 className="text-xs sm:text-sm md:text-base font-bold text-slate-100 tracking-tight leading-tight">
                Islamic Studies Tracker
              </h1>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden lg:flex items-center space-x-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700/70">
            <button
              onClick={() => setCurrentView('teacher')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentView === 'teacher'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Teacher Daily Log
            </button>

            <button
              onClick={() => setCurrentView('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentView === 'admin'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Admin Pacing Radar
            </button>

            <button
              onClick={() => setCurrentView('curriculum')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentView === 'curriculum'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Syllabus & Standards
            </button>

            <button
              onClick={() => setCurrentView('reports')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentView === 'reports'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              Printable Summary
            </button>
          </nav>

          {/* Right Controls: Term Selector & User Persona */}
          <div className="flex items-center gap-2 flex-shrink-0">
            
            {/* Active Term Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-emerald-400 hidden sm:block" />
              <select
                value={currentTerm?.id || ''}
                onChange={(e) => onTermChange(Number(e.target.value))}
                className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
                title="Switch Active Term"
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                    {t.title} {t.is_interlude ? '(Interlude)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Persona Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs shadow-xs">
              <Users className="w-3.5 h-3.5 text-blue-400 hidden sm:block" />
              <select
                value={currentUser?.id || ''}
                onChange={(e) => {
                  const u = users.find(x => x.id === Number(e.target.value));
                  if (u) onUserChange(u);
                }}
                className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer max-w-[120px] sm:max-w-none truncate"
                title="Switch Demo User"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

          </div>

        </div>

        {/* Mobile / Tablet Sub-Navbar */}
        <div className="lg:hidden flex items-center justify-around py-2 border-t border-slate-800/90 text-xs">
          <button
            onClick={() => setCurrentView('teacher')}
            className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
              currentView === 'teacher' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Teacher</span>
          </button>
          
          <button
            onClick={() => setCurrentView('admin')}
            className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
              currentView === 'admin' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>
          
          <button
            onClick={() => setCurrentView('curriculum')}
            className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
              currentView === 'curriculum' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Syllabus</span>
          </button>
          
          <button
            onClick={() => setCurrentView('reports')}
            className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
              currentView === 'reports' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Reports</span>
          </button>
        </div>

      </div>
    </header>
  );
}
