import React from 'react';
import {
  Box, Heading, Text, HStack, VStack, Button, useColorModeValue, Input, Select, Tag, TagLabel, TagCloseButton,
  SimpleGrid, IconButton, useDisclosure, useToast, Divider, Menu, MenuButton, MenuItem, MenuList, Wrap, WrapItem
} from '@chakra-ui/react';
import { FiRefreshCw, FiPlus, FiFilter, FiPrinter, FiExternalLink, FiChevronDown } from 'react-icons/fi';
import useAttendance from '../hooks/useAttendance';
import apiService from '../services/apiService';
import AttendanceTable from '../components/AttendanceTable';
import AttendanceFormModal from '../components/AttendanceFormModal';
import { Link as RouterLink } from 'react-router-dom';
import FacultySelect from '../components/FacultySelect';
import { useSelector } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
import { buildTable, printContent } from '../utils/printDesign';
import useFaculties from '../hooks/useFaculties';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'excused', label: 'Excused' },
];

const SUMMARY_STATUS_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'excused', label: 'Excuse' },
];

export default function Attendance() {
  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const [page, setPage] = React.useState(1);
  // default to 10 rows per page; 'all' will show everything
  const [limit, setLimit] = React.useState(10);
  const [filters, setFilters] = React.useState({ startDate: '', endDate: '', status: '', faculty: '', facultyId: '', term: '' });
  const schedules = useSelector(selectAllCourses);
  const { data, loading, error, refresh } = useAttendance({ page, limit, ...filters, schedules });
  const [stats, setStats] = React.useState({ total: 0, byStatus: {} });
  const [editing, setEditing] = React.useState(null);
  const modal = useDisclosure();
  const toast = useToast();
  const [sortKey, setSortKey] = React.useState('date'); // 'date' | 'status' | 'course' | 'instructor' | 'schedule'
  const [sortOrder, setSortOrder] = React.useState('desc'); // 'asc' | 'desc'

  // Faculty lookup for displaying instructor names by facultyId
  const { data: facultyOptions } = useFaculties();
  const facultyById = React.useMemo(() => {
    const map = new Map();
    (facultyOptions || []).forEach((opt) => {
      if (opt && opt.id != null) map.set(String(opt.id), opt.label);
    });
    return map;
  }, [facultyOptions]);

  const loadStats = React.useCallback(async () => {
    try {
      const f = { ...filters };
      // Use facultyId only for stats filtering to avoid name-based inconsistencies
      if ('faculty' in f) delete f.faculty;
      if (f.facultyId != null && f.facultyId !== '') f.faculty_id = f.facultyId;
      const s = await apiService.getAttendanceStats(f);
      setStats(s || { total: 0, byStatus: {} });
    } catch {}
  }, [filters]);

  React.useEffect(() => { loadStats(); }, [loadStats]);

  const onApply = () => { setPage(1); refresh(true); loadStats(); };
  const clearStatus = () => setFilters((f) => ({ ...f, status: '' }));

  const onDelete = async (row) => {
    try {
      await apiService.deleteAttendance(row.id);
      toast({ title: 'Deleted', status: 'success' });
      await refresh(true);
      await loadStats();
    } catch (e) {
      toast({ title: 'Failed to delete', description: e.message, status: 'error' });
    }
  };

  const onSaved = async () => { await refresh(true); await loadStats(); };

  const onPrint = React.useCallback(() => {
    const titleParts = ['Attendance Report'];
    if (filters.faculty) titleParts.push(`Faculty: ${filters.faculty}`);
    const title = titleParts.join(' • ');
    const subParts = [];
    if (filters.startDate || filters.endDate) {
      subParts.push(`Dates: ${filters.startDate || '…'} to ${filters.endDate || '…'}`);
    }
    if (filters.status) subParts.push(`Status: ${filters.status}`);
    if (filters.term) subParts.push(`Term: ${filters.term}`);
    const subtitle = subParts.join('  |  ');

    const headers = ['Date', 'Status', 'Course', 'Schedule', 'Remarks'];
    const rows = (Array.isArray(data) ? data : []).map((r) => {
      const sch = r.schedule || {};
      const course = [sch.programcode, sch.courseName].filter(Boolean).join(' Â· ');
      const schedule = [sch.day, sch.time].filter(Boolean).join(' ');
      const remarks = String(r.remarks || '').slice(0, 80);
      return [r.date || '', (r.status || '').toUpperCase(), course || '-', schedule || '-', remarks];
    });
    const q = new URLSearchParams();
    if (filters.startDate) q.set('startDate', filters.startDate);
    if (filters.endDate) q.set('endDate', filters.endDate);
    if (filters.term) q.set('term', filters.term);
    if (filters.facultyId) q.set('facultyId', filters.facultyId);
    if (filters.faculty) q.set('faculty', filters.faculty);
    q.set('type', 'all');
    const href = `${window.location.origin}${window.location.pathname}#/admin/attendance/print?${q.toString()}`;
    window.open(href, '_blank');
  }, [filters]);

  const buildSummaryGroups = React.useCallback((targetStatus) => {
    const list = Array.isArray(data) ? data : [];
    const by = new Map();
    const normTarget = String(targetStatus || '').toLowerCase();
    list.forEach((r) => {
      if (normTarget && String(r?.status || '').toLowerCase() !== normTarget) return;
      const sid = r?.schedule;
      const facId = sid?.facultyId ?? sid?.faculty_id;
      const name = facId != null ? (facultyById.get(String(facId)) || '') : '';
      const key = name || '(Unknown Faculty)';
      const arr = by.get(key) || [];
      const subj = [sid?.programcode, sid?.courseName, sid?.courseTitle].filter(Boolean).join(' - ');
      const tm = [sid?.day, sid?.time].filter(Boolean).join(' ');
      const term = sid?.term || '';
      arr.push({ date: r.date || '', subject: subj || '-', time: tm || '-', term: term || '' });
      by.set(key, arr);
    });
    // Sort rows within each faculty by date/time
    by.forEach((arr, k) => {
      arr.sort((a,b) => {
        const da = new Date(a.date || '1970-01-01').getTime();
        const db = new Date(b.date || '1970-01-01').getTime();
        if (da !== db) return da - db;
        return String(a.time).localeCompare(String(b.time));
      });
    });
    return by;
  }, [data, facultyById]);

  // Build Absent-only grouped summary by faculty (based on current filters)
  const absentGroups = React.useMemo(() => buildSummaryGroups('absent'), [buildSummaryGroups]);

  const onPrintSummary = React.useCallback((status) => {
    // Build a single printable page with sections per faculty
    const label = (SUMMARY_STATUS_OPTIONS.find(o => o.value === status)?.label) || 'Summary';
    const titleBits = [`${label} Summary (Per Faculty)`];
    const sub = [];
    if (filters.startDate || filters.endDate) sub.push(`Dates: ${filters.startDate || '-'} to ${filters.endDate || '-'}`);
    if (filters.term) sub.push(`Term: ${filters.term}`);
    const title = titleBits.join('');
    const subtitle = sub.join('  |  ');
    let bodyHtml = '';
    const groups = buildSummaryGroups(status);
    const facNames = Array.from(groups.keys()).sort((a,b)=>a.localeCompare(b));
    if (facNames.length === 0) {
      bodyHtml = '<p>No records match current filters.</p>';
    } else {
      facNames.forEach((name) => {
        const rows = groups.get(name) || [];
        const table = buildTable(['Date', 'Subject', 'Time', 'Term'], rows.map(r => [r.date, r.subject, r.time, r.term]));
        const section = `
          <div style="margin-bottom: 12px;">
            <h3 class="prt-fac-name">${name}</h3>
            ${table}
          </div>
        `;
        bodyHtml += section;
      });
    }
    const q = new URLSearchParams();
    if (filters.startDate) q.set('startDate', filters.startDate);
    if (filters.endDate) q.set('endDate', filters.endDate);
    if (filters.term) q.set('term', filters.term);
    if (filters.facultyId) q.set('facultyId', filters.facultyId);
    if (filters.faculty) q.set('faculty', filters.faculty);
    q.set('type', status || 'all');
    const href = `${window.location.origin}${window.location.pathname}#/admin/attendance/print?${q.toString()}`;
    window.open(href, '_blank');
  }, [buildSummaryGroups, filters]);

  const onOpenAbsentTabsPerFaculty = React.useCallback(() => {
    const facNames = Array.from(absentGroups.keys());
    if (facNames.length === 0) return;
    facNames.forEach((name) => {
      const rows = absentGroups.get(name) || [];
      const bodyHtml = buildTable(['Date', 'Subject', 'Time', 'Term'], rows.map(r => [r.date, r.subject, r.time, r.term]));
      const subtitle = [filters.startDate || filters.endDate ? `Dates: ${filters.startDate || '—'} to ${filters.endDate || '—'}` : '', filters.term ? `Term: ${filters.term}` : ''].filter(Boolean).join('  |  ');
      printContent({ title: `Faculty: ${name}`, subtitle, bodyHtml }, { pageSize: 'A4', orientation: 'portrait', compact: true, margin: '10mm' });
    });
  }, [absentGroups, filters]);

  const sortedItems = React.useMemo(() => {
    const items = Array.isArray(data)
      ? data.map((r) => {
          const facId = r?.schedule?.facultyId ?? r?.schedule?.faculty_id;
          const fname = facId != null ? (facultyById.get(String(facId)) || '') : '';
          return { ...r, facultyName: fname };
        })
      : [];
    const dir = sortOrder === 'asc' ? 1 : -1;
    const norm = (s) => String(s || '').trim().toLowerCase();
    const statusRank = (s) => {
      const v = norm(s);
      if (v === 'present') return 3;
      if (v === 'late') return 2;
      if (v === 'excused') return 1;
      if (v === 'absent') return 0;
      return -1;
    };
    const cmp = (a, b) => {
      const sa = a?.schedule || {};
      const sb = b?.schedule || {};
      const ida = Number(a?.id) || 0;
      const idb = Number(b?.id) || 0;
      switch (sortKey) {
        case 'date': {
          const da = new Date(a?.date || '1970-01-01').getTime();
          const db = new Date(b?.date || '1970-01-01').getTime();
          const p = (da === db ? 0 : da < db ? -1 : 1);
          return (p !== 0 ? p : (ida === idb ? 0 : ida < idb ? -1 : 1)) * dir;
        }
        case 'status': {
          const ra = statusRank(a?.status);
          const rb = statusRank(b?.status);
          const p = (ra === rb ? 0 : ra < rb ? -1 : 1);
          // tie-breaker by date then id
          if (p !== 0) return p * dir;
          const da = new Date(a?.date || '1970-01-01').getTime();
          const db = new Date(b?.date || '1970-01-01').getTime();
          const q = (da === db ? 0 : da < db ? -1 : 1);
          return (q !== 0 ? q : (ida === idb ? 0 : ida < idb ? -1 : 1)) * dir;
        }
        case 'course': {
          const ca = `${sa.programcode || ''} ${sa.courseName || ''}`;
          const cb = `${sb.programcode || ''} ${sb.courseName || ''}`;
          const p = ca.localeCompare(cb);
          return (p !== 0 ? p : (ida === idb ? 0 : ida < idb ? -1 : 1)) * dir;
        }
        case 'instructor': {
          const p = norm(a?.facultyName).localeCompare(norm(b?.facultyName));
          return (p !== 0 ? p : (ida === idb ? 0 : ida < idb ? -1 : 1)) * dir;
        }
        case 'schedule': {
          const ta = `${sa.day || ''} ${sa.time || ''}`;
          const tb = `${sb.day || ''} ${sb.time || ''}`;
          const p = norm(ta).localeCompare(norm(tb));
          return (p !== 0 ? p : (ida === idb ? 0 : ida < idb ? -1 : 1)) * dir;
        }
        default:
          return 0;
      }
    };
    items.sort(cmp);
    return items;
  }, [data, facultyById, sortKey, sortOrder]);

  // Client-side pagination
  const perPage = React.useMemo(() => {
    if (limit === '' || limit === 'all' || limit == null) return sortedItems.length || 1;
    const n = Number(limit);
    return Number.isFinite(n) && n > 0 ? n : 10;
  }, [limit, sortedItems.length]);
  const pageCount = Math.max(1, Math.ceil((sortedItems.length || 0) / perPage));
  React.useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const pagedItems = React.useMemo(() => {
    const start = (page - 1) * perPage;
    return sortedItems.slice(start, start + perPage);
  }, [sortedItems, page, perPage]);

  const handleSortChange = React.useCallback((key) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder(key === 'date' ? 'desc' : 'asc');
    }
  }, [sortKey]);

  return (
    <Box>
      <Box bg={cardBg} borderWidth="1px" borderColor={border} rounded="lg" p={4} mb={4}>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} alignItems="center">
          <VStack align="start" spacing={0}>
            <Heading size="md">Attendance</Heading>
            <Text fontSize="sm" color={useColorModeValue('gray.600','gray.400')}>Track attendance per schedule with quick filters.</Text>
          </VStack>
          <VStack align="stretch" spacing={2}>
            <Wrap spacing={2} justify={{ base: 'flex-start', md: 'flex-end' }}>
              <WrapItem>
                <Button leftIcon={<FiPlus />} colorScheme="blue" onClick={() => { setEditing(null); modal.onOpen(); }} w="full">Add Record</Button>
              </WrapItem>
              <WrapItem>
                <Menu>
                  <MenuButton as={Button} leftIcon={<FiPrinter />} rightIcon={<FiChevronDown />} colorScheme="blue" variant="outline" w="full">
                    Summary
                  </MenuButton>
                  <MenuList>
                    {SUMMARY_STATUS_OPTIONS.map(opt => (
                      <MenuItem key={opt.value} onClick={() => onPrintSummary(opt.value)}>{opt.label}</MenuItem>
                    ))}
                  </MenuList>
                </Menu>
              </WrapItem>
              <WrapItem>
                <Button leftIcon={<FiPrinter />} variant="outline" onClick={onPrint} w="full">Print All</Button>
              </WrapItem>
              <WrapItem>
                <IconButton aria-label="Refresh" icon={<FiRefreshCw />} onClick={refresh} />
              </WrapItem>
            </Wrap>
            <Wrap spacing={2} justify={{ base: 'flex-start', md: 'flex-end' }}>
              <WrapItem>
                <Button as={RouterLink} to="/admin/room-attendance" target="_blank" colorScheme="purple" variant="outline" w="full">Room Attendance</Button>
              </WrapItem>
              <WrapItem>
                <Button leftIcon={<FiExternalLink />} variant="ghost" onClick={onOpenAbsentTabsPerFaculty} title="Open absent summary in tabs per faculty">Open Absent Tabs</Button>
              </WrapItem>
            </Wrap>
          </VStack>
        </SimpleGrid>
      </Box>

      <Box bg={cardBg} borderWidth="1px" borderColor={border} rounded="lg" p={4} mb={4}>
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3}>
          <Box>
            <Text fontSize="xs" color="gray.500" mb={1}>Start Date</Text>
            <Input type="date" value={filters.startDate} onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))} />
          </Box>
          <Box>
            <Text fontSize="xs" color="gray.500" mb={1}>End Date</Text>
            <Input type="date" value={filters.endDate} onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))} />
          </Box>
          <Box>
            <Text fontSize="xs" color="gray.500" mb={1}>Status</Text>
            <Select placeholder="All" value={filters.status} onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Box>
          <Box>
            <Text fontSize="xs" color="gray.500" mb={1}>Term</Text>
            <Select placeholder="All" value={filters.term} onChange={(e) => setFilters(f => ({ ...f, term: e.target.value }))}>
              <option value="1st">1st</option>
              <option value="2nd">2nd</option>
              <option value="Sem">Sem</option>
            </Select>
          </Box>
          <Box minW={{ base: '220px', md: '260px' }}>
            <Text fontSize="xs" color="gray.500" mb={1}>Faculty</Text>
            <FacultySelect
              value={filters.faculty}
              onChange={(name) => setFilters(f => ({ ...f, faculty: name || '' }))}
              onChangeId={(id) => setFilters(f => ({ ...f, facultyId: id || '' }))}
              placeholder="All faculty"
              allowClear
            />
          </Box>
          <Box>
            <Text fontSize="xs" color="gray.500" mb={1}>Page Size</Text>
            <Select value={String(limit)} onChange={(e) => { const v = e.target.value; setLimit(v === 'all' ? 'all' : Number(v)); setPage(1); }}>
              {['10','20','50','all'].map(n => <option key={n} value={n}>{n === 'all' ? 'All' : `${n}/page`}</option>)}
            </Select>
          </Box>
        </SimpleGrid>
        <HStack spacing={3} mt={3} justify="flex-end" flexWrap="wrap">
          <Button leftIcon={<FiFilter />} onClick={onApply} colorScheme="blue">Apply</Button>
          <Button variant="ghost" onClick={() => { setFilters({ startDate: '', endDate: '', status: '', faculty: '', facultyId: '', term: '' }); setPage(1); }}>Reset</Button>
        </HStack>
        {(filters.status || filters.term) && (
          <HStack spacing={2} mt={3}>
            {filters.status ? (
              <Tag size="sm" colorScheme="blue">
                <TagLabel>Status: {filters.status}</TagLabel>
                <TagCloseButton onClick={clearStatus} />
              </Tag>
            ) : null}
            {filters.term ? (
              <Tag size="sm" colorScheme="purple">
                <TagLabel>Term: {filters.term}</TagLabel>
                <TagCloseButton onClick={() => setFilters(f => ({ ...f, term: '' }))} />
              </Tag>
            ) : null}
          </HStack>
        )}
      </Box>

      <Box bg={cardBg} borderWidth="1px" borderColor={border} rounded="lg" p={0}>
        <HStack spacing={3} px={4} py={3} borderBottomWidth="1px" borderColor={border} justify="space-between" flexWrap="wrap">
          <Text fontWeight="600">Attendance Records</Text>
          <Wrap spacing={2}>
            <WrapItem><Tag colorScheme="gray">Total: {stats.total || 0}</Tag></WrapItem>
            {Object.entries(stats.byStatus || {}).map(([k, v]) => (
              <WrapItem key={k}><Tag colorScheme={k==='present'?'green':k==='absent'?'red':k==='late'?'orange':'blue'} textTransform="capitalize">{k}: {v}</Tag></WrapItem>
            ))}
          </Wrap>
        </HStack>
        <AttendanceTable
          items={pagedItems}
          loading={loading}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          onEdit={(row) => { setEditing(row); modal.onOpen(); }}
          onDelete={onDelete}
        />
        <HStack justify="space-between" px={4} py={3} flexWrap="wrap" spacing={3}>
          <Text fontSize="sm" color={useColorModeValue('gray.600','gray.400')}>
            Showing {pagedItems.length ? (page - 1) * perPage + 1 : 0}-{pagedItems.length ? (page - 1) * perPage + pagedItems.length : 0} of {sortedItems.length}
          </Text>
          <HStack spacing={2}>
            <Select size="sm" value={String(limit)} onChange={(e) => { const v = e.target.value; setLimit(v === 'all' ? 'all' : Number(v)); setPage(1); }} maxW="110px">
              {['10','20','50','all'].map(n => <option key={n} value={n}>{n === 'all' ? 'All' : `${n}/page`}</option>)}
            </Select>
            <Button size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} isDisabled={page <= 1}>Prev</Button>
            <Button size="sm" onClick={() => setPage(p => Math.min(pageCount, p + 1))} isDisabled={page >= pageCount}>Next</Button>
            <Text fontSize="sm" color={useColorModeValue('gray.600','gray.400')}>Page {page} / {pageCount}</Text>
          </HStack>
        </HStack>
      </Box>

      <AttendanceFormModal isOpen={modal.isOpen} onClose={modal.onClose} initial={editing} onSaved={onSaved} />
    </Box>
  );
}
