import React from 'react';
import { Box, Grid, GridItem, Heading, HStack, VStack, Button } from '@chakra-ui/react';
import { FiUsers, FiClock, FiTrendingUp, FiBookOpen, FiPrinter } from 'react-icons/fi';
import Charts from '../components/Charts';
import SearchBar from '../components/SearchBar';
import FilterBar from '../components/FilterBar';
import StatCard from '../components/StatCard';
import FacultyTable from '../components/FacultyTable';
import Pagination from '../components/Pagination';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { useDispatch, useSelector } from 'react-redux';
import { selectFilteredFaculties, selectPagedFaculties, selectPageCount, selectStats } from '../store/dataSlice';
import { setPage, setPageSize } from '../store/dataSlice';
import { buildTable, printContent } from '../utils/printDesign';

export default function Dashboard() {
  const dispatch = useDispatch();
  const loading = useSelector(s => s.data.loading);
  const error = useSelector(s => s.data.error);
  const paged = useSelector(selectPagedFaculties);
  const page = useSelector(s => s.data.page);
  const pageCount = useSelector(selectPageCount);
  const pageSize = useSelector(s => s.data.pageSize);
  const stats = useSelector(selectStats);
  const faculties = useSelector(selectFilteredFaculties);

  function onPrint() {
    const headers = ['Faculty', 'Units', 'Overload', 'Courses'];
    const rows = faculties.map(f => [
      f.name,
      String(f.stats?.loadHours ?? 0),
      String((() => { const rel = Number(f.loadReleaseUnits) || 0; const base = Math.max(0, 24 - rel); return f.stats?.overloadHours ?? Math.max(0, (f.stats?.loadHours || 0) - base); })()),
      String(f.stats?.courseCount ?? (f.courses?.length || 0)),
    ]);
    const table = buildTable(headers, rows);
    printContent({ title: 'Faculty Load Summary', subtitle: 'Kolehiyo ng Pantukan • Filtered Faculty', bodyHtml: table });
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <VStack align="stretch" spacing={6}>
      <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
        <Heading size="md">Dashboard</Heading>
        <HStack gap={2}>
          <SearchBar />
          <Button leftIcon={<FiPrinter />} onClick={onPrint} variant="outline" size="sm">Print</Button>
        </HStack>
      </HStack>

      <FilterBar />

      <Grid templateColumns={{ base: '1fr', md: 'repeat(4, 1fr)' }} gap={4}>
        <GridItem><StatCard icon={FiUsers} label="Faculty" value={stats.totalFaculty} accent="brand" /></GridItem>
        <GridItem><StatCard icon={FiClock} label="Total Load Units" value={stats.totalLoad} accent="purple" /></GridItem>
        <GridItem><StatCard icon={FiTrendingUp} label="Overload Units" value={stats.totalOverload} accent="pink" /></GridItem>
        <GridItem><StatCard icon={FiBookOpen} label="Total Courses" value={stats.totalCourses} accent="orange" /></GridItem>
      </Grid>

      <Box>
        <FacultyTable items={paged} />
      </Box>

      <Pagination page={page} pageCount={pageCount} onPage={(p)=>dispatch(setPage(p))} pageSize={pageSize} onPageSize={(ps)=>dispatch(setPageSize(ps))} />

      <Charts />
    </VStack>
  );
}
