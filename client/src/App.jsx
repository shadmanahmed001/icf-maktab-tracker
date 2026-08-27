/** Route map for the three portals. */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastHost } from './ui';
import { AdminPortal, ParentPortal, RequireRole, TeacherPortal } from './layout/portals';

import Login from './pages/Login';
import Account from './pages/Account';
import NotFound from './pages/NotFound';

import AdminDashboard from './pages/admin/Dashboard';
import AdminPacing from './pages/admin/Pacing';
import AdminClasses from './pages/admin/Classes';
import AdminClassDetail from './pages/admin/ClassDetail';
import AdminStudents from './pages/admin/Students';
import AdminStudentDetail from './pages/admin/StudentDetail';
import AdminPeople from './pages/admin/People';
import AdminCurriculum from './pages/admin/Curriculum';
import AdminCalendar from './pages/admin/Calendar';
import AdminNotices from './pages/admin/Notices';
import AdminReports from './pages/admin/Reports';
import AdminActivity from './pages/admin/Activity';

import TeacherToday from './pages/teacher/Today';
import TeacherAttendance from './pages/teacher/Attendance';
import TeacherMyClass from './pages/teacher/MyClass';
import TeacherStudent from './pages/teacher/StudentDetail';
import TeacherMessages from './pages/teacher/Messages';
import TeacherNotices from './pages/teacher/Notices';
import TeacherCurriculum from './pages/teacher/Curriculum';

import FamilyOverview from './pages/parent/Overview';
import FamilyReport from './pages/parent/ReportCard';
import FamilyMemorization from './pages/parent/Memorization';
import FamilyLessons from './pages/parent/Lessons';
import FamilyAttendance from './pages/parent/Attendance';
import FamilyHomework from './pages/parent/Homework';
import FamilyMessages from './pages/parent/Messages';
import FamilyNotices from './pages/parent/Notices';

/** Send a signed-in visitor to their own portal; everyone else to sign-in. */
function RootRedirect() {
  const { isLoading, isSignedIn, user } = useAuth();
  if (isLoading) return null;
  if (!isSignedIn) return <Navigate to="/login" replace />;
  const home = { admin: '/admin', teacher: '/teacher', parent: '/family' }[user.role];
  return <Navigate to={home || '/login'} replace />;
}

export default function App({ Router = BrowserRouter }) {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />

          <Route
            path="/account"
            element={<RequireRole><Account /></RequireRole>}
          />

          {/* Administration */}
          <Route
            path="/admin"
            element={<RequireRole roles={['admin']}><AdminPortal /></RequireRole>}
          >
            <Route index element={<AdminDashboard />} />
            <Route path="pacing" element={<AdminPacing />} />
            <Route path="classes" element={<AdminClasses />} />
            <Route path="classes/:classId" element={<AdminClassDetail />} />
            <Route path="students" element={<AdminStudents />} />
            <Route path="students/:studentId" element={<AdminStudentDetail />} />
            <Route path="people" element={<AdminPeople />} />
            <Route path="curriculum" element={<AdminCurriculum />} />
            <Route path="calendar" element={<AdminCalendar />} />
            <Route path="notices" element={<AdminNotices />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="activity" element={<AdminActivity />} />
          </Route>

          {/* Teaching — admins may enter to cover a class or fix a record */}
          <Route
            path="/teacher"
            element={<RequireRole roles={['teacher', 'admin']}><TeacherPortal /></RequireRole>}
          >
            <Route index element={<TeacherToday />} />
            <Route path="attendance" element={<TeacherAttendance />} />
            <Route path="roster" element={<TeacherMyClass />} />
            <Route path="roster/:studentId" element={<TeacherStudent />} />
            {/* The syllabus and homework are tabs of "My class" now; keep the
                old paths pointing at the right tab so existing links hold. */}
            <Route path="coverage" element={<Navigate to="/teacher/roster?tab=syllabus" replace />} />
            <Route path="homework" element={<Navigate to="/teacher/roster?tab=homework" replace />} />
            <Route path="messages" element={<TeacherMessages />} />
            <Route path="messages/:threadId" element={<TeacherMessages />} />
            <Route path="notices" element={<TeacherNotices />} />
            <Route path="curriculum" element={<TeacherCurriculum />} />
          </Route>

          {/* Families */}
          <Route
            path="/family"
            element={<RequireRole roles={['parent']}><ParentPortal /></RequireRole>}
          >
            <Route index element={<FamilyOverview />} />
            <Route path="report" element={<FamilyReport />} />
            <Route path="memorization" element={<FamilyMemorization />} />
            <Route path="lessons" element={<FamilyLessons />} />
            <Route path="attendance" element={<FamilyAttendance />} />
            <Route path="homework" element={<FamilyHomework />} />
            <Route path="messages" element={<FamilyMessages />} />
            <Route path="messages/:threadId" element={<FamilyMessages />} />
            <Route path="notices" element={<FamilyNotices />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
        <ToastHost />
      </AuthProvider>
    </Router>
  );
}
