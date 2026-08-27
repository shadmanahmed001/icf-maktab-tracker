import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import TeacherDashboard from './views/TeacherDashboard';
import AdminOverview from './views/AdminOverview';
import CurriculumExplorer from './views/CurriculumExplorer';
import ReportsView from './views/ReportsView';
import { api } from './api';

export default function App() {
  const [currentView, setCurrentView] = useState('teacher'); // 'teacher', 'admin', 'curriculum', 'reports'
  const [classes, setClasses] = useState([]);
  const [terms, setTerms] = useState([]);
  const [currentTerm, setCurrentTerm] = useState(null);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadInitialData = async () => {
    try {
      const [classesRes, termsRes, usersRes] = await Promise.all([
        api.getClasses(),
        api.getTerms(),
        api.getUsers()
      ]);

      if (classesRes.success) setClasses(classesRes.data);
      if (termsRes.success) {
        setTerms(termsRes.data);
        const active = termsRes.data.find(t => t.is_current === 1) || termsRes.data[0];
        setCurrentTerm(active);
      }
      if (usersRes.success) {
        setUsers(usersRes.data);
        // Default to a teacher user first, or admin
        const defaultUser = usersRes.data.find(u => u.role === 'teacher') || usersRes.data[0];
        setCurrentUser(defaultUser);
      }
    } catch (err) {
      console.error('Error initializing application data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleTermChange = async (termId) => {
    const selected = terms.find(t => t.id === termId);
    if (selected) {
      setCurrentTerm(selected);
      await api.setCurrentTerm(termId);
      // Refresh terms
      const termsRes = await api.getTerms();
      if (termsRes.success) setTerms(termsRes.data);
    }
  };

  const handleUserChange = (user) => {
    setCurrentUser(user);
    if (user.role === 'admin') {
      // Optional auto-switch or let user switch views
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold">Islamic Center of Fremont — Daily Maktab</h2>
        <p className="text-xs text-slate-400 mt-1">Loading academic standards & curriculum engine...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Navigation */}
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        currentTerm={currentTerm}
        terms={terms}
        onTermChange={handleTermChange}
        currentUser={currentUser}
        users={users}
        onUserChange={handleUserChange}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-12">
        {currentView === 'teacher' && (
          <TeacherDashboard
            classes={classes}
            currentTerm={currentTerm}
            currentUser={currentUser}
            onLogAdded={async () => {
              const res = await api.getClasses();
              if (res.success) setClasses(res.data);
            }}
          />
        )}

        {currentView === 'admin' && (
          <AdminOverview
            currentTerm={currentTerm}
            onRefresh={async () => {
              const res = await api.getClasses();
              if (res.success) setClasses(res.data);
            }}
          />
        )}

        {currentView === 'curriculum' && (
          <CurriculumExplorer
            terms={terms}
          />
        )}

        {currentView === 'reports' && (
          <ReportsView
            currentTerm={currentTerm}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>ICF Daily Maktab • Islamic Studies Standards (An-Nasīḥah Syllabus 2026–2027)</span>
          <span>Proof of Concept Prototype • SQLite Single-File Engine</span>
        </div>
      </footer>
    </div>
  );
}
