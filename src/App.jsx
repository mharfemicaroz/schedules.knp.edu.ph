import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, useColorModeValue } from '@chakra-ui/react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import FacultyDetail from './pages/FacultyDetail';
import ViewsDepartments from './pages/ViewsDepartments';
import ViewsRooms from './pages/ViewsRooms';
import RoomSchedule from './pages/RoomSchedule';
import DepartmentSchedule from './pages/DepartmentSchedule';
import ViewsSession from './pages/ViewsSession';
import BlockSchedule from './pages/BlockSchedule';
import { DataProvider } from './context/DataContext';

function App() {
  const bg = useColorModeValue('gray.50', 'gray.900');
  return (
    <DataProvider>
      <Box bg={bg} minH="100vh">
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/faculty/:id" element={<FacultyDetail />} />
            <Route path="/views/departments" element={<ViewsDepartments />} />
            <Route path="/views/departments/:dept" element={<DepartmentSchedule />} />
            <Route path="/views/rooms" element={<ViewsRooms />} />
            <Route path="/views/rooms/:room" element={<RoomSchedule />} />
            <Route path="/views/session" element={<ViewsSession />} />
            <Route path="/views/session/block/:block" element={<BlockSchedule />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Box>
    </DataProvider>
  );
}

export default App;
