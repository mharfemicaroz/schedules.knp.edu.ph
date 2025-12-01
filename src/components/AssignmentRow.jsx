import React from 'react';
import {
  Box, HStack, VStack, Text, Select, Checkbox, IconButton, Tooltip, Badge, Spinner,
  useColorModeValue, Button
} from '@chakra-ui/react';
import { FiRefreshCw, FiLock, FiInfo, FiHelpCircle, FiTrash, FiUserPlus } from 'react-icons/fi';
import FacultySelect from './FacultySelect';
import { getTimeOptions } from '../utils/timeOptions';
import { normalizeTimeBlock } from '../utils/timeNormalize';
import { buildIndexes, buildFacultyStats, buildFacultyScoreMap, normalizeSem } from '../utils/facultyScoring';

export default function AssignmentRow({
  row,
  faculties,
  schedulesSource,
  allCourses,
  statsCourses,
  blockCode,
  attendanceStats,
  disabled,
  onChange,
  onToggle,
  onRequestLockChange,
  onRequestConflictInfo,
  onRequestSuggest,
  onRequestDelete,
  onRequestAssign,
  onRequestResolve,
  onRequestAddToSwap,
  onRequestHistory,
  isAdmin,
  variant = 'default', // 'default' | 'courses'
}) {
  const timeOpts = getTimeOptions();
  const dayOpts = ['MON-FRI', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'MWF', 'TTH', 'TBA'];
  const semOpts = ['1st', '2nd', 'Sem'];

  const rowBorder = useColorModeValue('gray.100', 'gray.700');
  const mutedText = useColorModeValue('gray.600', 'gray.300');

  const isLocked =
    !!row?._locked ||
    (function (v) {
      if (typeof v === 'boolean') return v;
      const s = String(v || '').toLowerCase();
      return s === 'yes' || s === 'true' || s === '1';
    })(row?.lock);

  const hasDoubleBooked =
    Array.isArray(row?._conflictDetails) &&
    row._conflictDetails.some(d =>
      String(d?.reason || '').toLowerCase().includes('double-booked: same faculty')
    );

  const normTerm = (v) => normalizeSem(v);
  const timeKey = (t) => normalizeTimeBlock(t || '')?.key || String(t || '').trim();
  const sectionOf = (s) => String(s?.section ?? s?.blockCode ?? '').trim().toLowerCase();
  const facultyKey = (s) =>
    s.facultyId != null
      ? `id:${s.facultyId}`
      : `nm:${String(s.instructor || s.faculty || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')}`;

  const currFacKey =
    row?._facultyId != null
      ? `id:${row._facultyId}`
      : `nm:${String(row._faculty || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')}`;

  const indexesAll = React.useMemo(
    () => buildIndexes(allCourses || []),
    [allCourses]
  );

  const stats = React.useMemo(
    () => buildFacultyStats(faculties || [], statsCourses || allCourses || []),
    [faculties, statsCourses, allCourses]
  );

  const scheduleForScoring = React.useMemo(
    () => ({
      id: row?._existingId || row?.id,
      code: row?.course_name || row?.courseName || row?.code,
      title: row?.course_title || row?.courseTitle || row?.title,
      section: blockCode || row?.section || row?.blockCode,
      term: row?._term || row?.semester || row?.term,
      schedule: row?._time || row?.time || row?.schedule,
      day: row?._day || row?.day,
      program: row?.program,
      programcode: row?.programcode,
      dept: row?.dept,
      session: row?.session,
      f2fDays: row?.f2fDays || row?.f2fSched || row?.f2fsched || row?.day,
    }),
    [row, blockCode]
  );

  const scoreOf = React.useMemo(
    () =>
      buildFacultyScoreMap({
        faculties: faculties || [],
        stats,
        indexesAll,
        schedule: scheduleForScoring,
        attendanceStats: attendanceStats,
      }),
    [faculties, stats, indexesAll, scheduleForScoring, attendanceStats]
  );

  const eligibleOptions = React.useMemo(() => {
    const base = faculties || [];
    if (!row) return base;
    const noTermOrTime = !row?._term || !row?._time;
    const sect = String(blockCode || '').trim().toLowerCase();
    const tKey = timeKey(row._time);
    const term = normTerm(row._term);
    const busy = new Set();
    if (!noTermOrTime) {
      for (const s of schedulesSource || []) {
        if (row._existingId && String(s.id) === String(row._existingId)) continue;
        if (normTerm(s.term) !== term) continue;
        const sSect = sectionOf(s);
        if (sSect !== sect) continue;
        const sKey = timeKey(s.schedule || s.time || '');
        if (!sKey || !tKey) continue;
        if (sKey === tKey) {
          busy.add(facultyKey(s));
        } else {
          const a = normalizeTimeBlock(sKey);
          const b = normalizeTimeBlock(tKey);
          if (a && b && Number.isFinite(a.start) && Number.isFinite(a.end) && Number.isFinite(b.start) && Number.isFinite(b.end)) {
            if (Math.max(a.start, b.start) < Math.min(a.end, b.end)) busy.add(facultyKey(s));
          }
        }
      }
    }
    const filtered = base.filter(o => {
      const key = o.id != null ? `id:${o.id}` : `nm:${String(o.label || o.name || o.faculty || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      if (key === currFacKey) return true;
      if (!noTermOrTime && busy.has(key)) return false;
      const prog = String(row?.programcode || row?.program || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const deptRaw = String(o.dept || '').toUpperCase();
      const deptStripped = deptRaw.replace(/[^A-Z0-9]/g, '');
      const always = ['GENED', 'KNP PARTTIME', 'PARTTIME', 'PE'];
      const whitelisted = always.includes(deptRaw.trim());
      const deptMatches = prog ? (deptStripped.includes(prog)) : true;
      return whitelisted || deptMatches;
    });
    const scored = filtered.map(o => {
      const entry = scoreOf.get(String(o.id)) || { score: 0, parts: {} };
      const rawScore = entry.score ?? 0;
      return { ...o, score: rawScore, scoreLabel: Number(rawScore).toFixed(2), parts: entry.parts || {} };
    });
    scored.sort((a, b) => {
      const sa = typeof a.score === 'number' ? a.score : -1;
      const sb = typeof b.score === 'number' ? b.score : -1;
      const ra = Math.round(sa * 100) / 100; const rb = Math.round(sb * 100) / 100;
      if (rb !== ra) return rb - ra;
      const la = String(a.label || a.name || a.faculty || ''); const lb = String(b.label || b.name || b.faculty || '');
      return la.localeCompare(lb);
    });
    return scored;
  }, [faculties, schedulesSource, blockCode, row?._term, row?._time, row?._existingId, row?._facultyId, row?._faculty, scoreOf]);

  return (
    <HStack spacing={2} py={2} borderBottomWidth="1px" borderColor={rowBorder}>
      <Checkbox isChecked={!!row._selected} onChange={(e) => onToggle(e.target.checked)} isDisabled={disabled} />
      <Box flex="1 1 auto">
        <Text fontWeight="600">
          {row.course_name || row.courseName}{' '}
          <Text as="span" fontWeight="400" color={mutedText}>({row.course_title || row.courseTitle})</Text>
        </Text>
        {variant === 'courses' ? (
          <HStack spacing={3} fontSize="sm" color={mutedText}>
            <Text>Block: {blockCode || row.blockCode || '-'}</Text>
          </HStack>
        ) : (
          <HStack spacing={3} fontSize="sm" color={mutedText}>
            <Text>Units: {row.unit ?? '-'}</Text>
            <Text>Year: {row.yearlevel ?? '-'}</Text>
            <Text>Sem: {row.semester ?? '-'}</Text>
          </HStack>
        )}
      </Box>

      {row._existingId && (
        isLocked ? (
          <Tooltip label={isAdmin ? 'Locked. Click to unlock.' : 'Locked. Only admin can unlock.'}>
            <IconButton aria-label="Unlock" icon={<FiLock />} size="sm" colorScheme="red" variant="ghost" onClick={() => onRequestLockChange && onRequestLockChange(false)} isDisabled={disabled || !isAdmin} />
          </Tooltip>
        ) : (
          <Tooltip label="Unlocked. Click to lock.">
            <IconButton aria-label="Lock" icon={<FiLock />} size="sm" variant="ghost" onClick={() => onRequestLockChange && onRequestLockChange(true)} isDisabled={disabled} />
          </Tooltip>
        )
      )}

      <Select size="sm" value={row._term || ''} onChange={(e) => onChange({ _term: e.target.value })} isDisabled={disabled || row._locked} maxW="130px">
        <option value="">Term</option>
        {semOpts.map((s) => (<option key={s} value={s}>{s}</option>))}
      </Select>

      <Select size="sm" value={row._day || 'MON-FRI'} onChange={(e) => onChange({ _day: e.target.value })} isDisabled={disabled || row._locked} maxW="140px">
        {dayOpts.map((d) => (<option key={d} value={d}>{d}</option>))}
      </Select>

      <Select size="sm" value={row._time || ''} onChange={(e) => onChange({ _time: e.target.value })} isDisabled={disabled || row._locked} maxW="160px">
        {timeOpts.map((t) => (<option key={t} value={t}>{t || 'Time'}</option>))}
      </Select>

      <Box minW="220px" maxW="260px">
        <FacultySelect value={row._faculty || ''} onChange={(name) => onChange({ _faculty: name })} onChangeId={(fid) => onChange({ _facultyId: fid })} options={eligibleOptions} allowClear disabled={disabled || row._locked} placeholder="Faculty" />
      </Box>

      <HStack spacing={1}>
        {row._checking ? (
          <HStack spacing={1}><Spinner size="xs" /><Text fontSize="xs" color={mutedText}>Checking...</Text></HStack>
        ) : (
          <Badge colorScheme={row._status === 'Assigned' ? 'green' : row._status === 'Conflict' ? 'red' : 'gray'}>{row._status || 'Unassigned'}</Badge>
        )}

        {row._status === 'Conflict' && (
          <>
            <Tooltip label="Explain conflict">
              <IconButton aria-label="Conflict details" icon={<FiInfo />} size="xs" variant="ghost" onClick={onRequestConflictInfo} />
            </Tooltip>
            <Tooltip label="Suggestions">
              <IconButton aria-label="Suggestions" icon={<FiHelpCircle />} size="xs" variant="ghost" onClick={onRequestSuggest} />
            </Tooltip>
            {!isLocked && hasDoubleBooked && (
              <Tooltip label="Resolve by replacing conflicting schedule">
                <Button size="xs" colorScheme="purple" variant="solid" onClick={onRequestResolve}>Resolve</Button>
              </Tooltip>
            )}
          </>
        )}

        {!isLocked && row._existingId && (
          <Tooltip label="Add to Swap">
            <IconButton aria-label="Add to Swap" icon={<FiRefreshCw />} size="xs" variant="ghost" onClick={onRequestAddToSwap} />
          </Tooltip>
        )}

        <Tooltip label={isLocked ? 'Locked. Unlock to assign.' : 'Assign faculty (scored)'}>
          <IconButton aria-label="Assign faculty" icon={<FiUserPlus />} size="sm" colorScheme="blue" variant="ghost" onClick={onRequestAssign} isDisabled={disabled || isLocked} />
        </Tooltip>

        {row._existingId && (
          <>
            <Tooltip label={isLocked ? 'Locked. Unlock to delete.' : 'Delete assignment'}>
              <IconButton aria-label="Delete assignment" icon={<FiTrash />} size="sm" colorScheme="red" variant="ghost" onClick={onRequestDelete} isDisabled={disabled || isLocked} />
            </Tooltip>
            {isAdmin && (
              <Tooltip label="View history">
                <IconButton aria-label="View history" icon={<FiInfo />} size="sm" variant="ghost" onClick={() => onRequestHistory && onRequestHistory(row)} isDisabled={!(row?._existingId || row?.id)} />
              </Tooltip>
            )}
          </>
        )}

      </HStack>
    </HStack>
  );
}
