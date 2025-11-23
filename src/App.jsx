import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, useColorModeValue } from '@chakra-ui/react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import VisualMap from './pages/VisualMap';
import AcademicCalendar from './pages/AcademicCalendar';
import FacultyDetail from './pages/FacultyDetail';
import ViewsDepartments from './pages/ViewsDepartments';
import ViewsRooms from './pages/ViewsRooms';
import ViewsCourses from './pages/ViewsCourses';
import RoomSchedule from './pages/RoomSchedule';
import RoomScheduleAuto from './pages/RoomScheduleAuto';
import DepartmentSchedule from './pages/DepartmentSchedule';
import ViewsSession from './pages/ViewsSession';
import BlockSchedule from './pages/BlockSchedule';
import ConflictSchedules from './pages/ConflictSchedules';
import UnassignedSchedules from './pages/UnassignedSchedules';
import AdminFaculty from './pages/AdminFaculty';
import AdminUsers from './pages/AdminUsers';
import AdminGuestLogs from './pages/AdminGuestLogs';
import AdminBlockSettings from './pages/AdminBlockSettings';
import AdminAcademicCalendar from './pages/AdminAcademicCalendar';
import AdminGradesSubmission from './pages/AdminGradesSubmission';
import AdminProspectus from './pages/AdminProspectus';
import AdminUserDepartments from './pages/AdminUserDepartments';
import AdminSettings from './pages/AdminSettings';
import CourseLoading from './pages/CourseLoading';
import RequireCourseLoadingAccess from './components/RequireCourseLoadingAccess';
import ShareVisualMap from './pages/ShareVisualMap';
import ReportsFacultySummary from './pages/ReportsFacultySummary';
import Unauthorized from './pages/Unauthorized';
import RequireAdmin from './components/RequireAdmin';
import RequireAuth from './components/RequireAuth';
import RequireRole from './components/RequireRole';
import Attendance from './pages/Attendance';
import AttendancePrint from './pages/AttendancePrint';
import RoomAttendance from './pages/RoomAttendance';
// DataProvider removed; using Redux directly
// VisitorProvider removed
import { useDispatch, useSelector } from 'react-redux';
import { loadAllSchedules, loadAcademicCalendar, loadHolidaysThunk } from './store/dataThunks';
import { loadSettingsThunk } from './store/settingsThunks';
// import { checkRoleThunk } from './store/authThunks';
import GlobalToaster from './components/GlobalToaster';

function App() {
  const bg = useColorModeValue('gray.50', 'gray.900');
  const dispatch = useDispatch();
  const accessToken = useSelector(s => s.auth.accessToken);

  useEffect(() => {
    // Only fetch settings when authenticated to avoid 401 pre-login
    if (accessToken) {
      dispatch(loadSettingsThunk());
    }
    dispatch(loadAllSchedules());
    dispatch(loadAcademicCalendar());
    dispatch(loadHolidaysThunk(2025));
    // Per requirement: check role only on login (handled in loginThunk)
  }, [dispatch, accessToken]);
  return (
        <Box bg={bg} minH="100vh">
          <Layout>
            <Routes>
              <Route path="/" element={<VisualMap />} />
              <Route path="/overview/calendar" element={<AcademicCalendar />} />
              <Route path="/faculty/:id" element={<RequireAuth><FacultyDetail /></RequireAuth>} />
              <Route path="/views/faculty" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/views/courses" element={<RequireAuth><ViewsCourses /></RequireAuth>} />
              <Route path="/views/departments" element={<ViewsDepartments />} />
              <Route path="/views/departments/:dept" element={<DepartmentSchedule />} />
              <Route path="/views/rooms" element={<ViewsRooms />} />
              <Route path="/views/rooms/:room" element={<RoomSchedule />} />
              <Route path="/views/rooms/:room/auto" element={<RoomScheduleAuto />} />
              <Route path="/views/session" element={<RequireAuth><ViewsSession /></RequireAuth>} />
              <Route path="/views/session/block/:block" element={<RequireAuth><BlockSchedule /></RequireAuth>} />
              <Route path="/admin/conflicts" element={<RequireAdmin><ConflictSchedules /></RequireAdmin>} />
              <Route path="/admin/unassigned" element={<RequireAdmin><UnassignedSchedules /></RequireAdmin>} />
              <Route path="/admin/attendance" element={<RequireRole roles={['admin','manager','checker']}><Attendance /></RequireRole>} />
              <Route path="/admin/attendance/print" element={<RequireRole roles={['admin','manager','checker']}><AttendancePrint /></RequireRole>} />
              <Route path="/admin/room-attendance" element={<RequireRole roles={['admin','manager','checker']}><RoomAttendance /></RequireRole>} />
              <Route path="/admin/faculty" element={<RequireAdmin><AdminFaculty /></RequireAdmin>} />
              <Route path="/admin/prospectus" element={<RequireAdmin><AdminProspectus /></RequireAdmin>} />
              <Route path="/admin/academic-calendar" element={<RequireAdmin><AdminAcademicCalendar /></RequireAdmin>} />
              <Route path="/admin/settings" element={<RequireAdmin><AdminSettings /></RequireAdmin>} />
              <Route path="/admin/blocks" element={<RequireAdmin><AdminBlockSettings /></RequireAdmin>} />
              <Route path="/admin/grades-submission" element={<RequireRole roles={['admin','manager','registrar']}><AdminGradesSubmission /></RequireRole>} />
              <Route path="/admin/v2/grades-submission" element={<RequireRole roles={['admin','manager','registrar']}><AdminGradesSubmission /></RequireRole>} />
              <Route path="/admin/course-loading" element={<RequireAuth><RequireCourseLoadingAccess><CourseLoading /></RequireCourseLoadingAccess></RequireAuth>} />
              <Route path="/admin/users" element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
              <Route path="/admin/user-departments" element={<RequireAdmin><AdminUserDepartments /></RequireAdmin>} />
              <Route path="/admin/guest-logs" element={<RequireAdmin><AdminGuestLogs /></RequireAdmin>} />
              <Route path="/reports/faculty-summary" element={<RequireAuth><ReportsFacultySummary /></RequireAuth>} />
              {/* Share/public routes (chrome-less) */}
              <Route path="/share/faculty/:id" element={<FacultyDetail />} />
              <Route path="/share/courses" element={<ViewsCourses />} />
              <Route path="/share/departments" element={<ViewsDepartments />} />
              <Route path="/share/departments/:dept" element={<DepartmentSchedule />} />
              <Route path="/share/rooms" element={<ViewsRooms />} />
              <Route path="/share/rooms/:room" element={<RoomSchedule />} />
              <Route path="/share/session" element={<ViewsSession />} />
              <Route path="/share/session/block/:block" element={<BlockSchedule />} />
              <Route path="/share/visual-map" element={<ShareVisualMap />} />
              <Route path="/share/room-attendance" element={<RoomAttendance />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
          <GlobalToaster />
        </Box>
  );
}

export default App;
