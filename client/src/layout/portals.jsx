/**
 * Portal layouts.
 *
 * Teachers and parents both work "one subject at a time" — one class, one
 * child — so rather than threading an id through every route, each portal holds
 * the current selection in a context with a switcher in the header. The
 * selection persists between visits, which matters for a teacher who opens the
 * app on a phone twice a day.
 */
import { createContext, useContext, useEffect, useMemo } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, School, Users, GraduationCap, BookOpen, CalendarDays,
  Megaphone, FileText, Activity, ClipboardCheck, UserCheck,
  MessageSquare, Home, ScrollText, Award,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useApi, useStickyState } from '../lib/hooks';
import { api } from '../lib/api';
import { AppShell } from './AppShell';
import { LoadingBlock, EmptyState, Select, cx } from '../ui';

// ── Admin ───────────────────────────────────────────────────────────────────

export function AdminPortal() {
  const location = useLocation();
  const nav = [
    {
      items: [
        { to: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard },
        { to: '/admin/pacing', label: 'Pacing radar', icon: Activity },
      ],
    },
    {
      title: 'School',
      items: [
        { to: '/admin/classes', label: 'Classes', icon: School },
        { to: '/admin/students', label: 'Students', icon: GraduationCap },
        { to: '/admin/people', label: 'Staff & families', icon: Users },
      ],
    },
    {
      title: 'Academic',
      items: [
        { to: '/admin/curriculum', label: 'Curriculum', icon: BookOpen },
        { to: '/admin/calendar', label: 'Terms & calendar', icon: CalendarDays },
      ],
    },
    {
      title: 'Communication & records',
      items: [
        { to: '/admin/notices', label: 'Notices', icon: Megaphone },
        { to: '/admin/reports', label: 'Reports', icon: FileText },
        { to: '/admin/activity', label: 'Activity log', icon: ScrollText },
      ],
    },
  ];

  const TITLES = {
    '/admin': 'Dashboard',
    '/admin/pacing': 'Pacing radar',
    '/admin/classes': 'Classes',
    '/admin/students': 'Students',
    '/admin/people': 'Staff & families',
    '/admin/curriculum': 'Curriculum',
    '/admin/calendar': 'Terms & calendar',
    '/admin/notices': 'Notices',
    '/admin/reports': 'Reports',
    '/admin/activity': 'Activity log',
  };

  const title = TITLES[location.pathname]
    || Object.entries(TITLES).find(([path]) => path !== '/admin' && location.pathname.startsWith(path))?.[1]
    || 'Administration';

  return (
    <AppShell
      portal="admin"
      nav={nav}
      title={title}
      subtitle="Islamic Center of Fremont · Daily Maktab"
      bottomNav={[
        { to: '/admin', end: true, label: 'Home', icon: LayoutDashboard },
        { to: '/admin/pacing', label: 'Pacing', icon: Activity },
        { to: '/admin/students', label: 'Students', icon: GraduationCap },
        { to: '/admin/reports', label: 'Reports', icon: FileText },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}

// ── Teacher ─────────────────────────────────────────────────────────────────

const ClassContext = createContext(null);

export function useSelectedClass() {
  const ctx = useContext(ClassContext);
  if (!ctx) throw new Error('useSelectedClass must be used inside the teacher portal');
  return ctx;
}

/** Header control for teachers who cover more than one class. */
function ClassSwitcher({ classes, selectedId, onSelect }) {
  if (classes.length <= 1) return null;
  return (
    <Select
      value={selectedId ?? ''}
      onChange={(e) => onSelect(Number(e.target.value))}
      className="max-w-56"
      aria-label="Choose a class"
    >
      {classes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}{c.role !== 'lead' ? ` — ${c.role}` : ''}
        </option>
      ))}
    </Select>
  );
}

export function TeacherPortal() {
  const { classes, user } = useAuth();
  const location = useLocation();
  const [storedId, setStoredId] = useStickyState('teacher.classId', null);

  // An admin visiting the teacher portal, or a teacher whose assignment
  // changed, needs the class list resolved from the server.
  const classQuery = useApi(
    () => api.teacher.home(),
    [],
    { skip: classes.length > 0 }
  );

  const available = useMemo(() => {
    if (classes.length) return classes;
    return (classQuery.data?.classes || []).map((c) => ({ ...c.class, role: c.role }));
  }, [classes, classQuery.data]);

  const selectedId = available.some((c) => c.id === storedId) ? storedId : available[0]?.id ?? null;

  useEffect(() => {
    if (selectedId && selectedId !== storedId) setStoredId(selectedId);
  }, [selectedId, storedId, setStoredId]);

  const selected = available.find((c) => c.id === selectedId) || null;

  // Four items, in the order a teacher's day runs. Anything that is not part of
  // the daily job sits under Reference, and notices appear on the check-off
  // screen rather than as a nav item nobody visits.
  const nav = [
    {
      items: [
        { to: '/teacher', end: true, label: "Today's check-off", icon: ClipboardCheck },
        { to: '/teacher/attendance', label: 'Attendance register', icon: UserCheck },
        { to: '/teacher/roster', label: 'My class', icon: GraduationCap },
        { to: '/teacher/messages', label: 'Parent messages', icon: MessageSquare },
      ],
    },
    {
      title: 'Reference',
      items: [
        { to: '/teacher/curriculum', label: 'Curriculum', icon: BookOpen },
        { to: '/teacher/notices', label: 'Office notices', icon: Megaphone },
      ],
    },
  ];

  if (classQuery.loading && !available.length) {
    return (
      <div className="mx-auto max-w-md px-6 py-20"><LoadingBlock rows={4} /></div>
    );
  }

  if (!available.length) {
    return (
      <AppShell portal="teacher" nav={[]} title="Teacher Portal">
        <EmptyState
          title="No class assigned yet"
          description="Your account is not linked to a class. Ask the maktab office to assign you, and this portal will fill in."
        />
      </AppShell>
    );
  }

  const TITLES = {
    '/teacher': "Today's check-off",
    '/teacher/attendance': 'Attendance register',
    '/teacher/roster': 'My class',
    '/teacher/messages': 'Parent messages',
    '/teacher/notices': 'Notices',
    '/teacher/curriculum': 'Curriculum',
  };
  const title = TITLES[location.pathname]
    || Object.entries(TITLES).find(([p]) => p !== '/teacher' && location.pathname.startsWith(p))?.[1]
    || 'Teacher Portal';

  return (
    <ClassContext.Provider value={{ classes: available, selected, selectedId, setSelectedId: setStoredId }}>
      <AppShell
        portal="teacher"
        nav={nav}
        title={title}
        subtitle={selected ? `${selected.name}${selected.room ? ` · ${selected.room}` : ''}` : user.full_name}
        bottomNav={[
          { to: '/teacher', end: true, label: 'Check-off', icon: ClipboardCheck },
          { to: '/teacher/attendance', label: 'Register', icon: UserCheck },
          { to: '/teacher/roster', label: 'My class', icon: GraduationCap },
          { to: '/teacher/messages', label: 'Messages', icon: MessageSquare },
        ]}
      >
        {available.length > 1 && (
          <div className="mb-4 flex items-center gap-2 print:hidden">
            <span className="text-[0.78rem] font-semibold" style={{ color: 'var(--text-muted)' }}>
              Class
            </span>
            <ClassSwitcher classes={available} selectedId={selectedId} onSelect={setStoredId} />
          </div>
        )}
        <Outlet />
      </AppShell>
    </ClassContext.Provider>
  );
}

// ── Parent ──────────────────────────────────────────────────────────────────

const ChildContext = createContext(null);

export function useSelectedChild() {
  const ctx = useContext(ChildContext);
  if (!ctx) throw new Error('useSelectedChild must be used inside the family portal');
  return ctx;
}

/** Children shown as tappable cards rather than a dropdown — usually 1–3. */
function ChildSwitcher({ options, selectedId, onSelect }) {
  if (options.length <= 1) return null;
  return (
    <div className="mb-5 flex flex-wrap gap-2 print:hidden" role="tablist" aria-label="Choose a child">
      {options.map((child) => {
        const active = child.id === selectedId;
        return (
          <button
            key={child.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(child.id)}
            className={cx(
              'rounded-xl px-3.5 py-2 text-left transition-colors',
              !active && 'hover:brightness-[0.98]'
            )}
            style={active
              ? { background: 'var(--accent-soft)', border: '1px solid var(--accent)', color: 'var(--accent-text)' }
              : { background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-body)' }}
          >
            <span className="block text-[0.85rem] font-semibold">
              {child.first_name} {child.last_name}
            </span>
            <span className="block text-[0.72rem] opacity-80">{child.class_name}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ParentPortal() {
  const { children: sessionChildren } = useAuth();
  const location = useLocation();
  const [storedId, setStoredId] = useStickyState('parent.childId', null);

  const available = sessionChildren || [];
  const selectedId = available.some((c) => c.id === storedId) ? storedId : available[0]?.id ?? null;

  useEffect(() => {
    if (selectedId && selectedId !== storedId) setStoredId(selectedId);
  }, [selectedId, storedId, setStoredId]);

  const selected = available.find((c) => c.id === selectedId) || null;

  // Parents want three things: how their child is doing, whether they have been
  // attending, and what the teacher has said. Memorization, lessons covered and
  // homework are all part of "how they are doing", so they are sections of the
  // progress page reached by a link, not competing nav items.
  const nav = [
    {
      items: [
        { to: '/family', end: true, label: 'Progress', icon: Home },
        { to: '/family/attendance', label: 'Attendance', icon: UserCheck },
        { to: '/family/messages', label: 'Messages', icon: MessageSquare },
        { to: '/family/report', label: 'Term report card', icon: Award },
      ],
    },
  ];

  if (!available.length) {
    return (
      <AppShell portal="parent" nav={[]} title="Family Portal">
        <EmptyState
          title="No children linked to this account"
          description="Ask the maktab office to link your children to your account, and their progress will appear here."
        />
      </AppShell>
    );
  }

  const TITLES = {
    '/family': 'Progress',
    '/family/report': 'Term report card',
    '/family/memorization': 'Memorization',
    '/family/lessons': 'Lessons covered',
    '/family/attendance': 'Attendance',
    '/family/homework': 'Homework',
    '/family/messages': 'Messages',
    '/family/notices': 'Notices',
  };
  const title = TITLES[location.pathname]
    || Object.entries(TITLES).find(([p]) => p !== '/family' && location.pathname.startsWith(p))?.[1]
    || 'Family Portal';

  return (
    <ChildContext.Provider value={{ children: available, selected, selectedId, setSelectedId: setStoredId }}>
      <AppShell
        portal="parent"
        nav={nav}
        title={title}
        subtitle={selected ? `${selected.first_name} ${selected.last_name} · ${selected.class_name || ''}` : undefined}
        bottomNav={[
          { to: '/family', end: true, label: 'Progress', icon: Home },
          { to: '/family/attendance', label: 'Attendance', icon: UserCheck },
          { to: '/family/messages', label: 'Messages', icon: MessageSquare },
          { to: '/family/report', label: 'Report', icon: Award },
        ]}
      >
        <ChildSwitcher options={available} selectedId={selectedId} onSelect={setStoredId} />
        <Outlet />
      </AppShell>
    </ChildContext.Provider>
  );
}

/** Route guard: signed in, and holding one of the allowed roles. */
export function RequireRole({ roles, children }) {
  const { user, isLoading, isSignedIn } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm"><LoadingBlock rows={3} /></div>
      </div>
    );
  }
  if (!isSignedIn) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(user.role)) {
    // Signed in, wrong portal — send them to their own.
    const home = { admin: '/admin', teacher: '/teacher', parent: '/family' }[user.role];
    return <Navigate to={home || '/login'} replace />;
  }
  return children;
}
