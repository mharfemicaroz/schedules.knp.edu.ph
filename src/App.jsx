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
import RoomSchedule from './pages/RoomSchedule';
import RoomScheduleAuto from './pages/RoomScheduleAuto';
import DepartmentSchedule from './pages/DepartmentSchedule';
import ViewsSession from './pages/ViewsSession';
import BlockSchedule from './pages/BlockSchedule';
import ConflictSchedules from './pages/ConflictSchedules';
import UnassignedSchedules from './pages/UnassignedSchedules';
import AdminFaculty from './pages/AdminFaculty';
import ReportsFacultySummary from './pages/ReportsFacultySummary';
// DataProvider removed; using Redux directly
// VisitorProvider removed
import { useDispatch } from 'react-redux';
import { loadAllSchedules, loadAcademicCalendar, loadHolidaysThunk } from './store/dataThunks';
import { checkRoleThunk } from './store/authThunks';
import GlobalToaster from './components/GlobalToaster';

function App() {
  const bg = useColorModeValue('gray.50', 'gray.900');
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(loadAllSchedules());
    dispatch(loadAcademicCalendar());
    dispatch(loadHolidaysThunk(2025));
    dispatch(checkRoleThunk());
  }, [dispatch]);
  return (
        <Box bg={bg} minH="100vh">
          <Layout>
            <Routes>
              <Route path="/" element={<VisualMap />} />
              <Route path="/overview/calendar" element={<AcademicCalendar />} />
              <Route path="/faculty/:id" element={<FacultyDetail />} />
              <Route path="/views/faculty" element={<Dashboard />} />
              <Route path="/views/departments" element={<ViewsDepartments />} />
              <Route path="/views/departments/:dept" element={<DepartmentSchedule />} />
              <Route path="/views/rooms" element={<ViewsRooms />} />
              <Route path="/views/rooms/:room" element={<RoomSchedule />} />
              <Route path="/views/rooms/:room/auto" element={<RoomScheduleAuto />} />
              <Route path="/views/session" element={<ViewsSession />} />
              <Route path="/views/session/block/:block" element={<BlockSchedule />} />
              <Route path="/admin/conflicts" element={<ConflictSchedules />} />
              <Route path="/admin/unassigned" element={<UnassignedSchedules />} />
              <Route path="/admin/faculty" element={<AdminFaculty />} />
              <Route path="/reports/faculty-summary" element={<ReportsFacultySummary />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
          <GlobalToaster />
        </Box>
  );
}

export default App;
