import React from 'react';
import { Box, VStack, Text, useColorModeValue, HStack, Icon, Image, Badge } from '@chakra-ui/react';
import { NavLink, useLocation } from 'react-router-dom';
import { FiGrid, FiLayers, FiMapPin, FiSun, FiUsers, FiCalendar, FiUserX, FiFileText, FiBook, FiUser, FiActivity, FiSettings, FiCheckSquare, FiBarChart2, FiCpu } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { FiAlertTriangle } from 'react-icons/fi';
import { selectAllCourses } from '../store/dataSlice';
import { selectSettings } from '../store/settingsSlice';
import { getUserDepartmentsByUserThunk } from '../store/userDeptThunks';
import { selectUserDeptItems } from '../store/userDeptSlice';
import { buildConflicts, buildCrossFacultyOverlaps, parseTimeBlockToMinutes } from '../utils/conflicts';

function NavItem({ to, icon, children, onClick, badgeCount, chipLabel }) {
  const { pathname } = useLocation();
  const active = pathname === to;
  const color = useColorModeValue(active ? 'brand.700' : 'gray.600', active ? 'brand.200' : 'gray.300');
  const bg = useColorModeValue(active ? 'brand.50' : 'transparent', active ? 'whiteAlpha.200' : 'transparent');
  return (
    <HStack as={NavLink} to={to} spacing={3} px={3} py={2} rounded="md" cursor="pointer" _hover={{ bg: useColorModeValue('gray.100','whiteAlpha.100') }} bg={bg} color={color} w="full" style={{ textDecoration: 'none' }} onClick={onClick}>
      <Icon as={icon} />
      <Box flex="1" minW={0}>
        <Text fontWeight={active ? '700' : '500'} noOfLines={1}>{children}</Text>
        {(chipLabel || (typeof badgeCount === 'number' && badgeCount > 0)) && (
          <HStack mt={1} spacing={2} align="center">
            {chipLabel && (
              <Badge colorScheme="purple" fontSize="0.6rem" rounded="full" px={2} whiteSpace="nowrap" flexShrink={0}>{chipLabel}</Badge>
            )}
            {typeof badgeCount === 'number' && badgeCount > 0 && (
              <Badge colorScheme="red" fontSize="0.65rem" rounded="full" px={2} flexShrink={0}>{badgeCount}</Badge>
            )}
          </HStack>
        )}
      </Box>
    </HStack>
  );
}

export default function Sidebar({ mobile = false, onNavigate }) {
  const dispatch = useDispatch();
  const authUser = useSelector(s => s.auth.user);
  const allCourses = useSelector(selectAllCourses);
  const raw = useSelector(s => Array.isArray(s.data.raw) ? s.data.raw : []);
  const userDeptItems = useSelector(selectUserDeptItems);
  const bg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  // Call color mode hooks unconditionally to keep hook order stable
  const sectionHeaderColor = useColorModeValue('gray.700','gray.300');

  const roleStr = String(authUser?.role || '').toLowerCase();
  const isAdmin = !!authUser && (roleStr === 'admin' || roleStr === 'manager');
  const isRegistrar = !!authUser && roleStr === 'registrar';
  const isChecker = !!authUser && roleStr === 'checker';
  const isOsas = !!authUser && roleStr === 'osas';
  const isUser = !!authUser && !isAdmin && !isChecker && !isOsas;

  // Load current user's department mappings (used to gate Course Loading visibility for non-admins)
  React.useEffect(() => {
    try {
      if (!!authUser?.id && !isAdmin) {
        dispatch(getUserDepartmentsByUserThunk(authUser.id));
      }
    } catch {}
  }, [dispatch, authUser?.id, isAdmin]);

  const hasDeptMapping = React.useMemo(() => Array.isArray(userDeptItems) && userDeptItems.length > 0, [userDeptItems]);

  // Compute conflict count similar to page logic (lightweight but consistent)
  const conflictCount = React.useMemo(() => {
    try {
      const isUnknownFaculty = (val) => {
        const s = String(val || '').trim();
        if (!s) return true;
        const n = s.toLowerCase();
        if (/(unknown|unassigned|no\s*faculty|not\s*assigned)/i.test(n)) return true;
        if (/^n\/?a$/.test(n)) return true;
        if (/^t\.?b\.?a\.?$/.test(n) || n === 'tba') return true;
        if (n === '-' || n === '--') return true;
        return false;
      };
      const normalizeName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g,'');
      const termOf = (r) => String(r.term || '').trim().toLowerCase();
      const timeStrOf = (r) => String(r.scheduleKey || r.schedule || r.time || '').trim();
      const timeKeyOf = (r) => {
        const s = timeStrOf(r);
        const start = Number.isFinite(r.timeStartMinutes) ? r.timeStartMinutes : undefined;
        const end = Number.isFinite(r.timeEndMinutes) ? r.timeEndMinutes : undefined;
        if (Number.isFinite(start) && Number.isFinite(end)) return `${start}-${end}`;
        const tr = parseTimeBlockToMinutes(s);
        return (Number.isFinite(tr.start) && Number.isFinite(tr.end)) ? `${tr.start}-${tr.end}` : s.toLowerCase();
      };
      const sectionOf = (r) => normalizeName(r.section || '');
      const codeOf = (r) => String(r.code || r.courseName || '').trim().toLowerCase();
      const facIdOf = (r) => (r.facultyId != null ? String(r.facultyId) : (r.faculty_id != null ? String(r.faculty_id) : ''));
      const facKeyOf = (r) => facIdOf(r) || normalizeName(r.facultyName || r.faculty || r.instructor);

      const seen = new Set();
      const filtered = (allCourses || []).filter(r => {
        const k = ['merged', facKeyOf(r), termOf(r), timeKeyOf(r), sectionOf(r), codeOf(r)].join('|');
        if (seen.has(k)) return false; seen.add(k); return true;
      });
      const toKey = (start, end) => `${start}-${end}`;
      const sanitized = filtered.map(r => {
        const tStr = String(r.scheduleKey || r.schedule || r.time || '').trim();
        const hasNums = Number.isFinite(r.timeStartMinutes) && Number.isFinite(r.timeEndMinutes);
        if (hasNums) return { ...r, scheduleKey: toKey(r.timeStartMinutes, r.timeEndMinutes) };
        const tr = parseTimeBlockToMinutes(tStr);
        const valid = Number.isFinite(tr.start) && Number.isFinite(tr.end);
        return valid ? { ...r, scheduleKey: toKey(tr.start, tr.end) } : { ...r, scheduleKey: '', schedule: '', time: '' };
      });
      const base = buildConflicts(sanitized);
      const cross = buildCrossFacultyOverlaps(sanitized);
      const allGroups = [...base, ...cross];
      const groupsSorted = allGroups
        .map(g => ({
          ...g,
          _ids: Array.from(new Set((g.items || []).map(it => String(it.id)).filter(Boolean))).sort(),
          _reason: String(g.reason || ''),
        }))
        .filter(g => g._ids.length >= 2)
        .sort((a, b) => b._ids.length - a._ids.length);
      const kept = [];
      const perReason = new Map();
      for (const g of groupsSorted) {
        const r = g._reason; const ids = g._ids; const sets = perReason.get(r) || [];
        let redundant = false;
        for (const s of sets) { let isSubset = true; for (const id of ids) { if (!s.has(id)) { isSubset = false; break; } } if (isSubset) { redundant = true; break; } }
        if (redundant) continue; sets.push(new Set(ids)); perReason.set(r, sets); kept.push(g);
      }
      const facFiltered = kept.filter(g => { const rep = g.items?.[0] || {}; const fac = rep.facultyName || rep.faculty || rep.instructor || ''; return !isUnknownFaculty(fac); });
      return facFiltered.length;
    } catch { return 0; }
  }, [allCourses]);

  const unassignedCount = React.useMemo(() => {
    try {
      const isInvalidFacultyName = (s) => {
        const fac = String(s || '').trim();
        if (!fac) return true;
        return /^(unknown|unassigned|n\/?a|none|no\s*faculty|not\s*assigned|tba|-)?$/i.test(fac);
      };
      return (raw || []).filter(r => (r.facultyId == null) && isInvalidFacultyName(r.instructor)).length;
    } catch { return 0; }
  }, [raw]);

  // Settings chip (current SY • Sem)
  const settings = useSelector(selectSettings);
  const chip = React.useMemo(() => {
    const sy = settings?.schedulesView?.school_year || '';
    const sem = settings?.schedulesView?.semester || '';
    if (!sy && !sem) return '';
    return `${sy || '—'} • ${sem || '—'}`;
  }, [settings]);

  return (
    <Box as="nav" w={mobile ? '100%' : { base: '60px', md: '280px', lg: '320px' }} h={mobile ? 'auto' : '100%'} display={mobile ? 'block' : { base: 'none', md: 'block' }} borderRightWidth={mobile ? '0' : '1px'} borderColor={border} bg={bg} px={4} py={6} overflowY={mobile ? 'visible' : 'auto'}>
      <VStack align="stretch" spacing={2}>
        <HStack px={2} mb={4} spacing={3}>
          <Image src="/logo.png" alt="Logo" boxSize="28px" rounded="md" />
          <Text fontWeight="800" fontSize="sm">Kolehiyo ng Pantukan</Text>
        </HStack>

        {/* Overview section - always visible */}
        <HStack px={2} mb={1} spacing={2}>
          <Text fontSize="sm" fontWeight="700" color={sectionHeaderColor}>Overview</Text>
          {chip && <Badge colorScheme="purple" fontSize="0.6rem" rounded="full" px={2}>{chip}</Badge>}
        </HStack>
        <NavItem to="/" icon={FiGrid} onClick={onNavigate}>Classroom Assigment</NavItem>
        <NavItem to="/overview/calendar" icon={FiCalendar} onClick={onNavigate}>Academic Calendar</NavItem>

        {/* Views */}
        <HStack px={2} mt={4} mb={1} spacing={2}>
          <Text fontSize="sm" fontWeight="700" color={sectionHeaderColor}>Views</Text>
          {chip && <Badge colorScheme="purple" fontSize="0.6rem" rounded="full" px={2}>{chip}</Badge>}
        </HStack>
        {(isAdmin || isUser) && <NavItem to="/views/faculty" icon={FiUsers} onClick={onNavigate}>By Faculty</NavItem>}
        {(isAdmin || isUser) && <NavItem to="/views/courses" icon={FiBook} onClick={onNavigate}>By Courses</NavItem>}
        <NavItem to="/views/departments" icon={FiLayers} onClick={onNavigate}>By Department</NavItem>
        {!isOsas && <NavItem to="/views/rooms" icon={FiMapPin} onClick={onNavigate}>By Rooms</NavItem>}
        {(isAdmin || isUser) && <NavItem to="/views/session" icon={FiSun} onClick={onNavigate}>By Session</NavItem>}
        {(isAdmin || isUser) && (
          <>
            <HStack px={2} mt={4} mb={1} spacing={2}>
              <Text fontSize="sm" fontWeight="700" color={sectionHeaderColor}>Reports</Text>
              {chip && <Badge colorScheme="purple" fontSize="0.6rem" rounded="full" px={2}>{chip}</Badge>}
            </HStack>
            <NavItem to="/reports/faculty-summary" icon={FiFileText} onClick={onNavigate}>Faculty Summary</NavItem>
          </>
        )}
        {(isAdmin || isChecker || isRegistrar || hasDeptMapping || isOsas) && (
          <>
            <Text fontSize="sm" fontWeight="700" color={sectionHeaderColor} px={2} mt={4} mb={1}>Admin</Text>
            {(isAdmin || isChecker) && (
              <NavItem to="/admin/attendance" icon={FiCheckSquare} onClick={onNavigate} chipLabel={chip}>Attendance</NavItem>
            )}
            {(isAdmin || isRegistrar || hasDeptMapping) && (
              <NavItem to="/admin/grades-submission" icon={FiFileText} onClick={onNavigate} chipLabel={chip}>Grades Submission</NavItem>
            )}
            {(isAdmin || isRegistrar || (!isAdmin && hasDeptMapping)) && (
              <NavItem
                to="/admin/course-loading"
                icon={FiLayers}
                onClick={onNavigate}
                chipLabel={(function(){
                  try {
                    const sy = (settings && settings.schedulesLoad && settings.schedulesLoad.school_year) || '';
                    const sem = (settings && settings.schedulesLoad && settings.schedulesLoad.semester) || '';
                    return (sy || sem) ? `${sy || '—'} · ${sem || '—'}` : '';
                  } catch { return ''; }
                })()}
              >
                Course Loading
              </NavItem>
            )}
            {(isAdmin || isOsas) && (
              <NavItem to="/admin/evaluations" icon={FiBarChart2} onClick={onNavigate}>Evaluations</NavItem>
            )}
            {isAdmin && (
              <>
                <NavItem to="/admin/faculty" icon={FiUsers} onClick={onNavigate}>Faculty</NavItem>
                <NavItem to="/admin/prospectus" icon={FiBook} onClick={onNavigate}>Prospectus</NavItem>
                <NavItem to="/admin/user-departments" icon={FiBook} onClick={onNavigate}>User Departments</NavItem>
                <NavItem to="/admin/academic-calendar" icon={FiCalendar} onClick={onNavigate}>Academic Calendar</NavItem>
                <NavItem to="/admin/blocks" icon={FiSettings} onClick={onNavigate}>Block Settings</NavItem>
                <NavItem to="/admin/settings" icon={FiSettings} onClick={onNavigate}>System Settings</NavItem>
                <NavItem to="/admin/ai-labs" icon={FiCpu} onClick={onNavigate}>AI Labs</NavItem>
                <NavItem to="/admin/users" icon={FiUser} onClick={onNavigate}>User Management</NavItem>
                <NavItem to="/admin/guest-logs" icon={FiActivity} onClick={onNavigate}>Guest Logs</NavItem>
                <NavItem to="/admin/conflicts" icon={FiAlertTriangle} onClick={onNavigate} badgeCount={conflictCount} chipLabel={chip}>Conflict Schedules</NavItem>
                <NavItem to="/admin/unassigned" icon={FiUserX} onClick={onNavigate} badgeCount={unassignedCount} chipLabel={chip}>Unassigned Schedules</NavItem>
              </>
            )}
          </>
        )}
      </VStack>
    </Box>
  );
}
