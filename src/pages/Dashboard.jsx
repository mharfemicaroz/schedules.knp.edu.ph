import React, { useMemo } from 'react';
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

  // Merge helper mirroring FacultyDetail semantics
  const mergeCourses = (courses) => {
    const map = new Map();
    const dayOrder = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const normalizeRooms = (val) => String(val || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const parseSimpleDays = (val) => String(val || '')
      .split(/[\/,;&\s]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        const u = s.toUpperCase();
        if (u.startsWith('MON')) return 'Mon';
        if (u.startsWith('TUE')) return 'Tue';
        if (u.startsWith('WED')) return 'Wed';
        if (u.startsWith('THU')) return 'Thu';
        if (u.startsWith('FRI')) return 'Fri';
        if (u.startsWith('SAT')) return 'Sat';
        if (u.startsWith('SUN')) return 'Sun';
        return '';
      })
      .filter(Boolean);
    (courses || []).forEach(c => {
      const key = [c.code, c.section, c.scheduleKey || c.schedule || '', c.semester || '', c.day || ''].join('|');
      const prev = map.get(key);
      if (prev) {
        // Merge rooms
        const roomSet = new Set([...normalizeRooms(prev.room), ...normalizeRooms(c.room)]);
        prev.room = Array.from(roomSet).join(',');
        // Merge F2F
        const prevDays = Array.isArray(prev.f2fDays) ? prev.f2fDays : [];
        const currDays = Array.isArray(c.f2fDays) ? c.f2fDays : [];
        if (prevDays.length || currDays.length) {
          const dset = new Set([...prevDays, ...currDays].filter(Boolean));
          const days = dayOrder.filter(d => dset.has(d));
          prev.f2fDays = days;
          const f2f = days.join(',');
          prev.f2fSched = f2f; prev.f2fsched = f2f;
        } else {
          const a = parseSimpleDays(prev.f2fSched || prev.f2fsched || prev.f2f);
          const b = parseSimpleDays(c.f2fSched || c.f2fsched || c.f2f);
          if (a.length || b.length) {
            const dset2 = new Set([...a, ...b]);
            const days2 = dayOrder.filter(d => dset2.has(d));
            prev.f2fDays = days2;
            const f2f2 = days2.join(',');
            prev.f2fSched = f2f2; prev.f2fsched = f2f2;
          } else {
            const sSet = new Set([prev.f2fSched, prev.f2fsched, c.f2fSched, c.f2fsched].map(x => String(x || '').trim()).filter(Boolean));
            if (sSet.size > 0) { const s = Array.from(sSet).join(','); prev.f2fSched = s; prev.f2fsched = s; }
          }
        }
      } else {
        map.set(key, { ...c });
      }
    });
    return Array.from(map.values());
  };

  // Project merged stats per faculty
  const mergedFaculties = useMemo(() => {
    return faculties.map(f => {
      const mergedCourses = mergeCourses(f.courses || []);
      const mergedLoadUnits = mergedCourses.reduce((sum, c) => sum + (Number.isFinite(c.unit) ? c.unit : (Number.isFinite(c.hours) ? c.hours : 0)), 0);
      const baseline = Math.max(0, 24 - (Number(f.loadReleaseUnits) || 0));
      const mergedOverloadUnits = Math.max(0, mergedLoadUnits - baseline);
      return {
        ...f,
        courses: mergedCourses,
        stats: { ...(f.stats || {}), loadHours: mergedLoadUnits, overloadHours: mergedOverloadUnits, courseCount: mergedCourses.length }
      };
    });
  }, [faculties]);

  const mergedTotals = useMemo(() => {
    const totalFaculty = mergedFaculties.length;
    let totalLoad = 0, totalOverload = 0, totalCourses = 0;
    mergedFaculties.forEach(f => {
      totalLoad += f.stats?.loadHours || 0;
      totalOverload += f.stats?.overloadHours || 0;
      totalCourses += f.stats?.courseCount || (f.courses?.length || 0);
    });
    return { totalFaculty, totalLoad, totalOverload, totalCourses };
  }, [mergedFaculties]);

  function onPrint() {
    const headers = ['Faculty', 'Units', 'Overload', 'Courses'];
    const rows = mergedFaculties.map(f => [
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
        <GridItem><StatCard icon={FiUsers} label="Faculty" value={mergedTotals.totalFaculty} accent="brand" /></GridItem>
        <GridItem><StatCard icon={FiClock} label="Total Load Units" value={mergedTotals.totalLoad} accent="purple" /></GridItem>
        <GridItem><StatCard icon={FiTrendingUp} label="Overload Units" value={mergedTotals.totalOverload} accent="pink" /></GridItem>
        <GridItem><StatCard icon={FiBookOpen} label="Total Courses" value={mergedTotals.totalCourses} accent="orange" /></GridItem>
      </Grid>

      <Box>
        {(() => {
          const byId = new Map(mergedFaculties.map(f => [String(f.id), f]));
          const pagedMerged = paged.map(f => byId.get(String(f.id)) || f);
          return <FacultyTable items={pagedMerged} />;
        })()}
      </Box>

      <Pagination page={page} pageCount={pageCount} onPage={(p)=>dispatch(setPage(p))} pageSize={pageSize} onPageSize={(ps)=>dispatch(setPageSize(ps))} />

      <Charts />
    </VStack>
  );
}
