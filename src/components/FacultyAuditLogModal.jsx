import React from 'react';
import {
  Badge,
  Box,
  Button,
  Divider,
  HStack,
  Icon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  useColorModeValue,
  VStack,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { FiActivity, FiArrowRight, FiClock, FiRefreshCw, FiTrash2, FiEdit3, FiPlusCircle } from 'react-icons/fi';
import api from '../services/apiService';

const actionMeta = (action) => {
  const key = String(action || '').toLowerCase();
  if (key.includes('create')) return { label: 'Created', color: 'green', icon: FiPlusCircle };
  if (key.includes('delete')) return { label: 'Deleted', color: 'red', icon: FiTrash2 };
  return { label: 'Updated', color: 'blue', icon: FiEdit3 };
};

const fmtDateTime = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
};

const prettyLabel = (raw) => {
  const map = {
    Term: 'Term',
    Time: 'Time',
    Faculty: 'Faculty',
    FacultyId: 'Faculty ID',
    Day: 'Day',
    Session: 'Session',
    SchoolYear: 'School Year',
    Semester: 'Semester',
    Program: 'Program',
    Course: 'Course',
    Lock: 'Lock',
  };
  const key = String(raw || '').trim();
  return map[key] || key;
};

const normalizeTermShort = (value) => {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  if (text.startsWith('1')) return '1st';
  if (text.startsWith('2')) return '2nd';
  if (text.startsWith('s')) return 'Sem';
  return String(value || '').trim();
};

const normalizeLock = (value) => {
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  const text = String(value || '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(text)) return 'yes';
  if (['0', 'false', 'no', 'n', ''].includes(text)) return 'no';
  return text;
};

const normalizeCompare = (label, value) => {
  const key = String(label || '').trim().toLowerCase();
  if (key === 'term') return normalizeTermShort(value);
  if (key === 'lock') return normalizeLock(value);
  return String(value ?? '').trim();
};

const parseDetails = (value) => {
  const parts = String(value || '').split('|').map((part) => part.trim()).filter(Boolean);
  const changes = [];
  const tags = [];
  parts.forEach((part) => {
    const changeMatch = part.match(/^([^:]+):\s*'(.*)'\s*->\s*'(.*)'$/);
    if (changeMatch) {
      const label = prettyLabel(changeMatch[1]);
      const from = changeMatch[2];
      const to = changeMatch[3];
      if (normalizeCompare(label, from) !== normalizeCompare(label, to)) {
        changes.push({ label, from, to });
      }
      return;
    }
    const assignMatch = part.match(/^([^=]+)=(.*)$/);
    if (assignMatch) {
      tags.push({ label: prettyLabel(assignMatch[1]), value: assignMatch[2] });
      return;
    }
    tags.push({ label: '', value: part });
  });
  return { changes, tags };
};

function StatCard({ label, value, helper }) {
  const border = useColorModeValue('gray.200', 'gray.700');
  const bg = useColorModeValue('gray.50', 'whiteAlpha.50');
  return (
    <Box borderWidth="1px" borderColor={border} bg={bg} rounded="lg" p={3}>
      <Stat>
        <StatLabel>{label}</StatLabel>
        <StatNumber>{value}</StatNumber>
        {helper ? <Text fontSize="xs" color="gray.500">{helper}</Text> : null}
      </Stat>
    </Box>
  );
}

export default function FacultyAuditLogModal({
  isOpen,
  onClose,
  faculty,
  facultySchedules = [],
  settingsLoad,
}) {
  const border = useColorModeValue('gray.200', 'gray.700');
  const panelBg = useColorModeValue('white', 'gray.800');
  const softBg = useColorModeValue('gray.50', 'whiteAlpha.50');
  const muted = useColorModeValue('gray.600', 'gray.300');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(25);
  const [payload, setPayload] = React.useState({
    items: [],
    count: 0,
    page: 1,
    limit: 25,
    summary: {
      totalEntries: 0,
      uniqueSchedules: 0,
      uniqueUsers: 0,
      recent24h: 0,
      actionCounts: [],
    },
  });

  const facultyId = faculty?.id ?? '';
  const facultyName = String(faculty?.name || faculty?.faculty || '').trim();
  const schoolyear = String(settingsLoad?.school_year || '').trim();
  const semester = String(settingsLoad?.semester || '').trim();
  const scheduleIds = React.useMemo(() => (
    Array.from(
      new Set(
        (Array.isArray(facultySchedules) ? facultySchedules : [])
          .map((item) => item?._existingId ?? item?.id)
          .filter((value) => value != null && !String(value).startsWith('tmp:'))
          .map((value) => String(value).trim())
          .filter(Boolean)
      )
    )
  ), [facultySchedules]);

  const loadFeed = React.useCallback(async () => {
    if (!isOpen || !facultyId || !schoolyear || !semester || scheduleIds.length === 0) return;
    try {
      setLoading(true);
      setError('');
      const res = await api.getScheduleHistoryFeed({
        page,
        limit,
        scheduleIds: scheduleIds.join(','),
        facultyId,
        facultyName,
        schoolyear,
        semester,
        actions: 'create,update,delete',
      });
      setPayload({
        items: Array.isArray(res?.items) ? res.items : [],
        count: Number(res?.count || 0),
        page: Number(res?.page || page),
        limit: Number(res?.limit || limit),
        summary: {
          totalEntries: Number(res?.summary?.totalEntries || 0),
          uniqueSchedules: Number(res?.summary?.uniqueSchedules || 0),
          uniqueUsers: Number(res?.summary?.uniqueUsers || 0),
          recent24h: Number(res?.summary?.recent24h || 0),
          actionCounts: Array.isArray(res?.summary?.actionCounts) ? res.summary.actionCounts : [],
        },
      });
    } catch (e) {
      setError(e?.message || 'Failed to load faculty audit logs.');
    } finally {
      setLoading(false);
    }
  }, [facultyId, facultyName, isOpen, limit, page, schoolyear, semester, scheduleIds]);

  React.useEffect(() => {
    if (!isOpen) return;
    loadFeed();
  }, [isOpen, loadFeed]);

  React.useEffect(() => {
    if (!isOpen) return;
    setPage(1);
  }, [facultyId, schoolyear, semester, scheduleIds, isOpen]);

  const items = payload.items || [];
  const summary = payload.summary || {};
  const pageCount = Math.max(1, Math.ceil((payload.count || 0) / (payload.limit || 25)));

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <VStack align="start" spacing={2}>
            <HStack spacing={2} flexWrap="wrap">
              <Text>Faculty Audit Logs</Text>
              <Badge colorScheme="purple">{facultyName || 'Faculty'}</Badge>
              <Badge colorScheme="blue">SY {schoolyear || '-'}</Badge>
              <Badge colorScheme="orange">{semester || '-'}</Badge>
            </HStack>
            <Text fontSize="sm" fontWeight="normal" color={muted}>
              Created, updated, and deleted schedule history for this faculty under the current load context.
            </Text>
          </VStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <HStack justify="space-between" align="center" flexWrap="wrap">
              <SimpleGrid columns={{ base: 2, lg: 4 }} spacing={3} flex="1 1 auto" minW={0}>
                <StatCard label="Audit events" value={summary.totalEntries || 0} helper="scoped to this faculty" />
                <StatCard label="Schedules touched" value={summary.uniqueSchedules || 0} helper="distinct schedule records" />
                <StatCard label="Actors" value={summary.uniqueUsers || 0} helper="users who changed records" />
                <StatCard label="Last 24 hours" value={summary.recent24h || 0} helper="recent audit activity" />
              </SimpleGrid>
              <HStack align="center">
                <Select size="sm" value={limit} onChange={(e) => setLimit(Number(e.target.value) || 25)} maxW="120px">
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>{n} / page</option>
                  ))}
                </Select>
                <Button size="sm" leftIcon={<FiRefreshCw />} onClick={loadFeed} isLoading={loading}>
                  Refresh
                </Button>
              </HStack>
            </HStack>

            <Box borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} overflow="hidden">
              <Box px={4} py={3} borderBottomWidth="1px" borderColor={border} bg={softBg}>
                <HStack justify="space-between" flexWrap="wrap">
                  <HStack spacing={2}>
                    <Icon as={FiActivity} color={muted} />
                    <Text fontWeight="600">Timeline</Text>
                  </HStack>
                  <Wrap spacing={2}>
                    {(summary.actionCounts || []).map((item) => {
                      const meta = actionMeta(item.action);
                      return (
                        <WrapItem key={item.action}>
                          <Badge colorScheme={meta.color} px={2} py={1} rounded="full">
                            {meta.label} {item.count}
                          </Badge>
                        </WrapItem>
                      );
                    })}
                  </Wrap>
                </HStack>
              </Box>

              <VStack align="stretch" spacing={0} divider={<Divider />}>
                {loading && items.length === 0 && Array.from({ length: 5 }).map((_, idx) => (
                  <Box key={`audit-skel-${idx}`} px={4} py={4}>
                    <Skeleton height="18px" mb={3} />
                    <Skeleton height="14px" mb={2} />
                    <Skeleton height="14px" width="70%" />
                  </Box>
                ))}

                {!loading && error ? (
                  <Box px={4} py={8}>
                    <Text color="red.400">{error}</Text>
                  </Box>
                ) : null}

                {!loading && !error && scheduleIds.length === 0 ? (
                  <Box px={4} py={8}>
                    <Text color={muted}>No saved schedules are currently loaded for this faculty in the selected SY/semester.</Text>
                  </Box>
                ) : null}

                {!loading && !error && scheduleIds.length > 0 && items.length === 0 ? (
                  <Box px={4} py={8}>
                    <Text color={muted}>No audit log entries matched this faculty and load context.</Text>
                  </Box>
                ) : null}

                {items.map((item) => {
                  const meta = actionMeta(item.action);
                  const parsed = parseDetails(item.details || '');
                  const schedule = item.schedule || null;
                  const detailFaculty =
                    parsed.tags.find((tag) => tag.label === 'Faculty')?.value ||
                    '';
                  const title = [
                    schedule?.courseName || parsed.tags.find((t) => t.label === 'Course')?.value || '',
                    schedule?.courseTitle || '',
                  ].filter(Boolean).join(' • ');
                  const blockCode = schedule?.blockCode || '';
                  const actor = item.actor || 'system';
                  return (
                    <Box key={item.id} px={4} py={4}>
                      <HStack justify="space-between" align="start" spacing={3} flexWrap="wrap">
                        <VStack align="start" spacing={2} flex="1 1 320px">
                          <HStack spacing={2} flexWrap="wrap">
                            <Badge colorScheme={meta.color}>
                              <HStack spacing={1}>
                                <Icon as={meta.icon} />
                                <Text>{meta.label}</Text>
                              </HStack>
                            </Badge>
                            {schedule?.programcode ? <Badge colorScheme="blue" variant="subtle">{schedule.programcode}</Badge> : null}
                            {blockCode ? <Badge colorScheme="purple" variant="subtle">{blockCode}</Badge> : null}
                            {schedule?.term ? <Badge colorScheme="orange" variant="subtle">{schedule.term}</Badge> : null}
                          </HStack>
                          <Text fontWeight="700">{title || 'Schedule change'}</Text>
                          <HStack spacing={2} fontSize="sm" color={muted} flexWrap="wrap">
                            <HStack spacing={1}>
                              <Icon as={FiClock} />
                              <Text>{fmtDateTime(item.createdAt)}</Text>
                            </HStack>
                            <Text>by {actor}</Text>
                          </HStack>
                        </VStack>
                        <VStack align="end" spacing={1} minW="180px">
                          {schedule?.semester ? <Text fontSize="sm" color={muted}>{schedule.semester}</Text> : null}
                          {schedule?.schoolyear ? <Text fontSize="sm" color={muted}>{schedule.schoolyear}</Text> : null}
                          {(detailFaculty || schedule?.instructor) ? (
                            <Text fontSize="sm" color={muted} textAlign="right">
                              {detailFaculty || schedule?.instructor}
                            </Text>
                          ) : null}
                        </VStack>
                      </HStack>

                      {parsed.changes.length > 0 ? (
                        <VStack align="stretch" spacing={2} mt={3}>
                          {parsed.changes.map((change, idx) => (
                            <HStack key={`${item.id}-change-${idx}`} spacing={3} align="center" flexWrap="wrap">
                              <Badge colorScheme="gray" fontSize="0.65rem">{change.label}</Badge>
                              <Text fontSize="sm" color={muted}>{change.from || '-'}</Text>
                              <Icon as={FiArrowRight} color={muted} />
                              <Text fontSize="sm">{change.to || '-'}</Text>
                            </HStack>
                          ))}
                        </VStack>
                      ) : null}

                      {parsed.tags.length > 0 ? (
                        <Wrap mt={3} spacing={2}>
                          {parsed.tags
                            .filter((tag) => !['Course', 'Program', 'School Year', 'Semester', 'Faculty'].includes(tag.label))
                            .map((tag, idx) => (
                              <WrapItem key={`${item.id}-tag-${idx}`}>
                                <Badge colorScheme="gray" variant="subtle">
                                  {tag.label ? `${tag.label}: ${tag.value}` : tag.value}
                                </Badge>
                              </WrapItem>
                            ))}
                        </Wrap>
                      ) : null}
                    </Box>
                  );
                })}
              </VStack>
            </Box>

            <HStack justify="space-between" align="center">
              <Text fontSize="sm" color={muted}>
                Page {payload.page || page} of {pageCount}
              </Text>
              <HStack>
                <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} isDisabled={(payload.page || page) <= 1 || loading}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} isDisabled={(payload.page || page) >= pageCount || loading}>
                  Next
                </Button>
              </HStack>
            </HStack>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
