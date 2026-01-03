import React from 'react';
import {
  Box,
  HStack,
  Text,
  Select,
  Checkbox,
  IconButton,
  Tooltip,
  Badge,
  Spinner,
  useColorModeValue,
  Button,
} from '@chakra-ui/react';
import { FiRefreshCw, FiLock, FiInfo, FiHelpCircle, FiTrash, FiUserPlus } from 'react-icons/fi';
import FacultySelect from './FacultySelect'; // kept for legacy compiled references
import { getTimeOptions } from '../utils/timeOptions';
import { normalizeSem } from '../utils/facultyScoring';
import { parseTimeBlockToMinutes } from '../utils/conflicts';
import { allowedSessionsForCourse, isPEorNSTP, normalizeSessionKey } from '../utils/courseRules';

const TIME_OPTS = getTimeOptions();
const DAY_OPTS = ['MON-FRI', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'MWF', 'TTH', 'TBA'];
const SEM_OPTS = ['1st', '2nd', 'Sem'];

function AssignmentRow({
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
  blockSession,
  variant = 'default',
}) {
  const rowBorder = useColorModeValue('gray.100', 'gray.700');
  const mutedText = useColorModeValue('gray.600', 'gray.300');
  const tileBg = useColorModeValue('white', 'gray.800');
  const tileBorder = useColorModeValue('blue.100', 'blue.600');
  const isTile = variant === 'tile';

  const isLocked = React.useMemo(
    () =>
      !!row?._locked ||
      (function (v) {
        if (typeof v === 'boolean') return v;
        const s = String(v || '').toLowerCase();
        return s === 'yes' || s === 'true' || s === '1';
      })(row?.lock),
    [row?._locked, row?.lock]
  );

  const hasDoubleBooked = React.useMemo(
    () =>
      Array.isArray(row?._conflictDetails) &&
      row._conflictDetails.some(d =>
        String(d?.reason || '').toLowerCase().includes('double-booked: same faculty')
      ),
    [row?._conflictDetails]
  );

  const termDisplay = React.useCallback(v => {
    const n = normalizeSem(v);
    if (n) return n;
    const raw = String(v || '').trim();
    return /sem/i.test(raw) ? 'Sem' : '';
  }, []);

  const sameFaculty = React.useCallback((aId, aName, bId, bName) => {
    if (aId != null && bId != null) return String(aId) === String(bId);
    const na = String(aName || '').trim().toLowerCase();
    const nb = String(bName || '').trim().toLowerCase();
    return na === nb;
  }, []);

  const normalizeTime = React.useCallback(t => String(t || '').trim(), []);
  const normalizeDay = React.useCallback(d => {
    const v = String(d || '').trim().toUpperCase();
    return v || 'MON-FRI';
  }, []);

  const baseTerm = termDisplay(row?._baseTerm || row?.term || row?.semester || '');
  const baseTime = normalizeTime(row?._baseTime || row?.time || row?.schedule || '');
  const baseDay = normalizeDay(row?._baseDay || row?.day);
  const baseFacId = row?._baseFacultyId ?? row?.facultyId ?? row?.faculty_id ?? null;
  const baseFacName = row?._baseFaculty ?? row?.instructor ?? row?.faculty ?? row?.facultyName ?? '';

  const currTerm = termDisplay(row?._term ?? row?._baseTerm ?? row?.term ?? row?.semester ?? '');
  const currTime = normalizeTime(row?._time ?? row?._baseTime ?? row?.time ?? row?.schedule ?? '');
  const currDay = normalizeDay(row?._day ?? row?.day);
  const currFacId = row?._facultyId ?? baseFacId;
  const currFacName = row?._faculty ?? baseFacName;

  const hasScheduleChanges = React.useMemo(
    () =>
      currTerm !== baseTerm ||
      currTime !== baseTime ||
      currDay !== baseDay ||
      !sameFaculty(currFacId, currFacName, baseFacId, baseFacName),
    [
      currTerm,
      baseTerm,
      currTime,
      baseTime,
      currDay,
      baseDay,
      currFacId,
      currFacName,
      baseFacId,
      baseFacName,
      sameFaculty,
    ]
  );

  // Raw user-provided override fields (may be undefined / empty)
  const userTerm = row?._term;
  const userTime = row?._time;
  const userDay = row?._day;
  const userFacId = row?._facultyId;
  const userFacName = row?._faculty;

  /**
   * We consider there is "user input" only when the override values
   * (_term, _time, _day, _facultyId, _faculty) are BOTH:
   *   1) Present / non-empty, AND
   *   2) Different from the base values.
   *
   * This way:
   * - New/unassigned rows with default values show NO badge.
   * - Unsaved appears only when the user actually changes something.
   */
  const hasUserInput = React.useMemo(() => {
    const termChanged =
      userTerm != null &&
      String(userTerm).trim() !== '' &&
      termDisplay(userTerm) !== baseTerm;

    const timeChanged =
      userTime != null &&
      String(userTime).trim() !== '' &&
      normalizeTime(userTime) !== baseTime;

    const dayChanged =
      userDay != null &&
      String(userDay).trim() !== '' &&
      normalizeDay(userDay) !== baseDay;

    const facIdChanged =
      userFacId != null &&
      String(userFacId) !== String(baseFacId ?? '');

    const facNameChanged =
      typeof userFacName === 'string' &&
      userFacName.trim() !== '' &&
      !sameFaculty(userFacId, userFacName, baseFacId, baseFacName);

    return termChanged || timeChanged || dayChanged || facIdChanged || facNameChanged;
  }, [
    userTerm,
    userTime,
    userDay,
    userFacId,
    userFacName,
    baseTerm,
    baseTime,
    baseDay,
    baseFacId,
    baseFacName,
    termDisplay,
    normalizeTime,
    normalizeDay,
    sameFaculty,
  ]);

  // "Unsaved" should appear ONLY when there is actual user input
  // that differs from the base state (for both assigned and unassigned rows).
  const isDirty = hasUserInput;

  const handleToggle = React.useCallback(
    e => {
      onToggle(e.target.checked);
    },
    [onToggle]
  );

  const handleTermChange = React.useCallback(
    e => {
      onChange({ _term: e.target.value });
    },
    [onChange]
  );

  const handleDayChange = React.useCallback(
    e => {
      onChange({ _day: e.target.value });
    },
    [onChange]
  );

  const handleTimeChange = React.useCallback(
    e => {
      onChange({ _time: e.target.value });
    },
    [onChange]
  );

  const baseSessionKey = React.useMemo(
    () => normalizeSessionKey(blockSession || row?.session),
    [blockSession, row?.session]
  );

  const allowedSessionKeys = React.useMemo(
    () => allowedSessionsForCourse(row, baseSessionKey),
    [row, baseSessionKey]
  );

  const sessionRanges = React.useMemo(() => {
    if (!baseSessionKey) return [];
    return allowedSessionKeys
      .map(key => {
        if (key === 'morning') return { start: 8 * 60, end: 12 * 60 };
        if (key === 'afternoon') return { start: 13 * 60, end: 17 * 60 };
        if (key === 'evening') return { start: 17 * 60, end: 21 * 60 };
        return null;
      })
      .filter(Boolean);
  }, [allowedSessionKeys, baseSessionKey]);

  const timeOptions = React.useMemo(() => {
    if (!sessionRanges.length) return TIME_OPTS;
    return TIME_OPTS.filter(t => {
      if (!t) return true; // placeholder
      const val = String(t).trim().toUpperCase();
      if (val === 'TBA') return true;
      const { start, end } = parseTimeBlockToMinutes(val);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
      if (isPEorNSTP(row) && end - start <= 60) return false;
      return sessionRanges.some(range => start >= range.start && end <= range.end);
    });
  }, [sessionRanges]);

  const sessionLabel = React.useMemo(() => {
    if (!baseSessionKey || !allowedSessionKeys.length) return '';
    return allowedSessionKeys
      .map(key => `${key.charAt(0).toUpperCase()}${key.slice(1)}`)
      .join(' / ');
  }, [allowedSessionKeys, baseSessionKey]);

  const sessionTone = React.useMemo(() => {
    if (!baseSessionKey || !allowedSessionKeys.length) return 'gray';
    if (allowedSessionKeys.length > 1) return 'blue';
    const key = allowedSessionKeys[0];
    if (key === 'morning') return 'green';
    if (key === 'afternoon') return 'orange';
    if (key === 'evening') return 'purple';
    return 'gray';
  }, [allowedSessionKeys, baseSessionKey]);

  const showAssigned = !!(row._faculty || row.faculty || row.instructor || row._facultyId);

  return (
    <HStack
      spacing={3}
      py={isTile ? 3 : 2}
      px={isTile ? 3 : 2}
      borderBottomWidth={isTile ? '0px' : '1px'}
      borderWidth={isTile ? '1px' : undefined}
      borderColor={isTile ? tileBorder : rowBorder}
      bg={isTile ? tileBg : undefined}
      rounded={isTile ? 'lg' : undefined}
      boxShadow={isTile ? 'sm' : undefined}
      transition={isTile ? 'all 0.15s ease' : undefined}
      _hover={isTile ? { boxShadow: 'md', transform: 'translateY(-1px)' } : undefined}
      align="flex-start"
      w="full"
    >
      <Checkbox
        colorScheme={isTile ? 'blue' : undefined}
        size={isTile ? 'md' : 'sm'}
        isChecked={!!row._selected}
        onChange={handleToggle}
        isDisabled={disabled}
        mt={1}
      />

      <Box flex="1 1 auto" minW={0}>
        <Text fontWeight="600" noOfLines={2}>
          {row.course_name || row.courseName}{' '}
          <Text as="span" fontWeight="400" color={mutedText}>
            ({row.course_title || row.courseTitle})
          </Text>
        </Text>

        {variant === 'courses' ? (
          <HStack spacing={3} fontSize="sm" color={mutedText} mt={1} flexWrap="wrap">
            <Text>Block: {blockCode || row.blockCode || '-'}</Text>
            {sessionLabel && (
              <Badge
                colorScheme={sessionTone}
                variant="subtle"
                borderRadius="full"
                px={3}
                py={1}
                textTransform="none"
                boxShadow="sm"
              >
                {sessionLabel} Session
              </Badge>
            )}
          </HStack>
        ) : (
          <HStack spacing={3} fontSize="sm" color={mutedText} mt={1} flexWrap="wrap">
            <Text>Units: {row.unit ?? '-'}</Text>
            <Text>Year: {row.yearlevel ?? '-'}</Text>
            <Text>Sem: {row.semester ?? '-'}</Text>
          </HStack>
        )}

        <HStack spacing={2} mt={2} flexWrap="wrap">
          <Select
            size="sm"
            value={row._term || ''}
            onChange={handleTermChange}
            isDisabled={disabled || row._locked}
            maxW="130px"
          >
            <option value="">Term</option>
            {SEM_OPTS.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>

          <Select
            size="sm"
            value={row._day || 'MON-FRI'}
            onChange={handleDayChange}
            isDisabled={disabled || row._locked}
            maxW="140px"
          >
            {DAY_OPTS.map(d => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>

          <Select
            size="sm"
            value={row._time || ''}
            onChange={handleTimeChange}
            isDisabled={disabled || row._locked}
            maxW="160px"
          >
            {timeOptions.map(t => (
              <option key={t} value={t}>
                {t || 'Time'}
              </option>
            ))}
          </Select>

          <Button
            onClick={onRequestAssign}
            isDisabled={disabled || isLocked}
            size="sm"
            variant={showAssigned ? 'solid' : 'outline'}
            leftIcon={<FiUserPlus />}
            colorScheme={showAssigned ? 'blue' : 'gray'}
            px={3}
            whiteSpace="normal"
            wordBreak="break-word"
            textAlign="left"
            height="auto"
            minH="unset"
            rounded="md"
          >
            {row._faculty || row.faculty || row.instructor || 'Assign Faculty'}
          </Button>
        </HStack>
      </Box>

      <HStack spacing={2} align="flex-start">
        {row._existingId &&
          (isLocked ? (
            <Tooltip label={isAdmin ? 'Locked. Click to unlock.' : 'Locked. Only admin can unlock.'}>
              <IconButton
                aria-label="Unlock"
                icon={<FiLock />}
                size="sm"
                colorScheme="red"
                variant="ghost"
                onClick={() => onRequestLockChange && onRequestLockChange(false)}
                isDisabled={disabled || !isAdmin}
              />
            </Tooltip>
          ) : (
            <Tooltip label="Unlocked. Click to lock.">
              <IconButton
                aria-label="Lock"
                icon={<FiLock />}
                size="sm"
                variant="ghost"
                onClick={() => onRequestLockChange && onRequestLockChange(true)}
                isDisabled={disabled}
              />
            </Tooltip>
          ))}

        <Box>
          {row._checking ? (
            <HStack spacing={1}>
              <Spinner size="xs" />
              <Text fontSize="xs" color={mutedText}>
                Checking...
              </Text>
            </HStack>
          ) : (
            <HStack spacing={1} flexWrap="wrap" justify="flex-end">
              {(row._status === 'Conflict' || row._conflict) && (
                <Badge colorScheme="red" borderRadius="full">
                  Conflict
                </Badge>
              )}
              {(row._status === 'Assigned' || row._existingId) && (
                <Badge colorScheme="green" borderRadius="full">
                  Assigned
                </Badge>
              )}
              {isDirty && (
                <Badge colorScheme="yellow" borderRadius="full">
                  Unsaved
                </Badge>
              )}
            </HStack>
          )}

          <HStack spacing={1} mt={2} justify="flex-end" flexWrap="wrap">
            {row._status === 'Conflict' && (
              <>
                <Tooltip label="Explain conflict">
                  <IconButton
                    aria-label="Conflict details"
                    icon={<FiInfo />}
                    size="xs"
                    variant="ghost"
                    onClick={onRequestConflictInfo}
                  />
                </Tooltip>
                <Tooltip label="Suggestions">
                  <IconButton
                    aria-label="Suggestions"
                    icon={<FiHelpCircle />}
                    size="xs"
                    variant="ghost"
                    onClick={onRequestSuggest}
                  />
                </Tooltip>
                {!isLocked && hasDoubleBooked && (
                  <Tooltip label="Resolve by replacing conflicting schedule">
                    <Button
                      size="xs"
                      colorScheme="purple"
                      variant="solid"
                      onClick={onRequestResolve}
                    >
                      Resolve
                    </Button>
                  </Tooltip>
                )}
              </>
            )}

            {!isLocked && row._existingId && (
              <Tooltip label="Add to Swap">
                <IconButton
                  aria-label="Add to Swap"
                  icon={<FiRefreshCw />}
                  size="xs"
                  variant="ghost"
                  onClick={onRequestAddToSwap}
                />
              </Tooltip>
            )}

            {row._existingId && (
              <>
                <Tooltip
                  label={isLocked ? 'Locked. Unlock to delete.' : 'Delete assignment'}
                >
                  <IconButton
                    aria-label="Delete assignment"
                    icon={<FiTrash />}
                    size="sm"
                    colorScheme="red"
                    variant="ghost"
                    onClick={onRequestDelete}
                    isDisabled={disabled || isLocked}
                  />
                </Tooltip>
                {isAdmin && (
                  <Tooltip label="View history">
                    <IconButton
                      aria-label="View history"
                      icon={<FiInfo />}
                      size="sm"
                      variant="ghost"
                      onClick={() => onRequestHistory && onRequestHistory(row)}
                      isDisabled={!(row?._existingId || row?.id)}
                    />
                  </Tooltip>
                )}
              </>
            )}
          </HStack>
        </Box>
      </HStack>
    </HStack>
  );
}

export default React.memo(AssignmentRow);
