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
import ReportsFacultySummary from './pages/ReportsFacultySummary';
import Unauthorized from './pages/Unauthorized';
import RequireAdmin from './components/RequireAdmin';
// DataProvider removed; using Redux directly
// VisitorProvider removed
import { useDispatch, useSelector } from 'react-redux';
import { loadAllSchedules, loadAcademicCalendar, loadHolidaysThunk } from './store/dataThunks';
// import { checkRoleThunk } from './store/authThunks';
import GlobalToaster from './components/GlobalToaster';

function App() {
  const bg = useColorModeValue('gray.50', 'gray.900');
  const dispatch = useDispatch();
  // const user = useSelector(s => s.auth.user);

  useEffect(() => {
    dispatch(loadAllSchedules());
    dispatch(loadAcademicCalendar());
    dispatch(loadHolidaysThunk(2025));
    // Per requirement: check role only on login (handled in loginThunk)
  }, [dispatch]);
  return (
        <Box bg={bg} minH="100vh">
          <Layout>
            <Routes>
              <Route path="/" element={<VisualMap />} />
              <Route path="/overview/calendar" element={<AcademicCalendar />} />
              <Route path="/faculty/:id" element={<RequireAdmin><FacultyDetail /></RequireAdmin>} />
              <Route path="/views/faculty" element={<RequireAdmin><Dashboard /></RequireAdmin>} />
              <Route path="/views/courses" element={<RequireAdmin><ViewsCourses /></RequireAdmin>} />
              <Route path="/views/departments" element={<ViewsDepartments />} />
              <Route path="/views/departments/:dept" element={<DepartmentSchedule />} />
              <Route path="/views/rooms" element={<ViewsRooms />} />
              <Route path="/views/rooms/:room" element={<RoomSchedule />} />
              <Route path="/views/rooms/:room/auto" element={<RoomScheduleAuto />} />
              <Route path="/views/session" element={<RequireAdmin><ViewsSession /></RequireAdmin>} />
              <Route path="/views/session/block/:block" element={<RequireAdmin><BlockSchedule /></RequireAdmin>} />
              <Route path="/admin/conflicts" element={<RequireAdmin><ConflictSchedules /></RequireAdmin>} />
              <Route path="/admin/unassigned" element={<RequireAdmin><UnassignedSchedules /></RequireAdmin>} />
              <Route path="/admin/faculty" element={<RequireAdmin><AdminFaculty /></RequireAdmin>} />
              <Route path="/admin/users" element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
              <Route path="/admin/guest-logs" element={<RequireAdmin><AdminGuestLogs /></RequireAdmin>} />
              <Route path="/reports/faculty-summary" element={<RequireAdmin><ReportsFacultySummary /></RequireAdmin>} />
              {/* Share/public routes (chrome-less) */}
              <Route path="/share/faculty/:id" element={<FacultyDetail />} />
              <Route path="/share/courses" element={<ViewsCourses />} />
              <Route path="/share/departments" element={<ViewsDepartments />} />
              <Route path="/share/departments/:dept" element={<DepartmentSchedule />} />
              <Route path="/share/rooms" element={<ViewsRooms />} />
              <Route path="/share/rooms/:room" element={<RoomSchedule />} />
              <Route path="/share/session" element={<ViewsSession />} />
              <Route path="/share/session/block/:block" element={<BlockSchedule />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
          <GlobalToaster />
        </Box>
  );
}

export default App;
