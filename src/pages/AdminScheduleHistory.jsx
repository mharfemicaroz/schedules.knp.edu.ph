import React from 'react';
import {
  Badge,
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Grid,
  GridItem,
  Heading,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Skeleton,
  Spinner,
  Stack,
  Stat,
  StatLabel,
  StatNumber,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useDisclosure,
  VStack,
  Wrap,
  WrapItem,
  Code,
} from '@chakra-ui/react';
import { FiActivity, FiClock, FiFilter, FiHash, FiRefreshCw, FiUser } from 'react-icons/fi';
import apiService from '../services/apiService';

const actionTone = (action) => {
  const key = String(action || '').toLowerCase();
  if (key.includes('create')) return 'green';
  if (key.includes('delete')) return 'red';
  if (key.includes('swap')) return 'purple';
  if (key.includes('update')) return 'blue';
  return 'gray';
};

const fmtDateTime = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
};

const shortText = (value, limit = 140) => {
  const text = String(value || '').trim();
  if (text.length <= limit) return text || '-';
  return `${text.slice(0, limit)}...`;
};

function StatCard({ label, value, helper, icon: Icon }) {
  const border = useColorModeValue('gray.200', 'gray.700');
  const bg = useColorModeValue('white', 'gray.800');
  const iconColor = useColorModeValue('gray.500', 'gray.300');
  return (
    <Box borderWidth="1px" borderColor={border} bg={bg} rounded="xl" p={4} boxShadow="sm">
      <HStack justify="space-between" align="start">
        <Stat>
          <StatLabel>{label}</StatLabel>
          <StatNumber>{value}</StatNumber>
          {helper ? <Text fontSize="sm" color="gray.500">{helper}</Text> : null}
        </Stat>
        {Icon ? <Box color={iconColor}><Icon /></Box> : null}
      </HStack>
    </Box>
  );
}

export default function AdminScheduleHistory() {
  const border = useColorModeValue('gray.200', 'gray.700');
  const panelBg = useColorModeValue('white', 'gray.800');
  const muted = useColorModeValue('gray.600', 'gray.300');
  const softBg = useColorModeValue('gray.50', 'whiteAlpha.50');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
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
      topActors: [],
      dailyCounts: [],
    },
  });
  const [query, setQuery] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [action, setAction] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(25);
  const [selected, setSelected] = React.useState(null);
  const detail = useDisclosure();

  const loadFeed = React.useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiService.getScheduleHistoryFeed({
        page,
        limit,
        q: search,
        action,
        dateFrom,
        dateTo,
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
          topActors: Array.isArray(res?.summary?.topActors) ? res.summary.topActors : [],
          dailyCounts: Array.isArray(res?.summary?.dailyCounts) ? res.summary.dailyCounts : [],
        },
      });
    } catch (e) {
      setError(e?.message || 'Failed to load schedule history.');
    } finally {
      setLoading(false);
    }
  }, [action, dateFrom, dateTo, limit, page, search]);

  React.useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  React.useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  React.useEffect(() => {
    setPage(1);
  }, [search, action, dateFrom, dateTo, limit]);

  const pageCount = Math.max(1, Math.ceil((payload.count || 0) / (payload.limit || 25)));
  const items = payload.items || [];
  const summary = payload.summary || {};
  const maxDaily = Math.max(1, ...(summary.dailyCounts || []).map((d) => Number(d.count || 0)));

  return (
    <VStack align="stretch" spacing={5}>
      <Box borderWidth="1px" borderColor={border} rounded="xl" p={5} bg={panelBg} boxShadow="sm">
        <HStack justify="space-between" align="start" flexWrap="wrap" spacing={3}>
          <VStack align="start" spacing={1}>
            <HStack spacing={2}>
              <Heading size="md">Schedule History</Heading>
              <Badge colorScheme="purple">Admin Audit</Badge>
            </HStack>
            <Text color={muted}>
              Audit feed for schedule creations, updates, swaps, and deletions. Server-paginated for large history tables.
            </Text>
          </VStack>
          <Button size="sm" leftIcon={<FiRefreshCw />} onClick={loadFeed} isLoading={loading}>
            Refresh
          </Button>
        </HStack>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
        <StatCard label="History events" value={summary.totalEntries || 0} helper="matching current filters" icon={FiActivity} />
        <StatCard label="Schedules touched" value={summary.uniqueSchedules || 0} helper="distinct schedule records" icon={FiHash} />
        <StatCard label="Actors" value={summary.uniqueUsers || 0} helper="distinct users in result set" icon={FiUser} />
        <StatCard label="Last 24 hours" value={summary.recent24h || 0} helper="recent audit activity" icon={FiClock} />
      </SimpleGrid>

      <Grid templateColumns={{ base: '1fr', xl: '1.6fr 1fr' }} gap={4}>
        <GridItem>
          <Box borderWidth="1px" borderColor={border} rounded="xl" p={4} bg={panelBg} boxShadow="sm">
            <HStack justify="space-between" mb={3}>
              <HStack>
                <FiFilter />
                <Heading size="sm">Filters</Heading>
              </HStack>
              <Badge colorScheme="gray">{payload.count || 0} rows</Badge>
            </HStack>
            <SimpleGrid columns={{ base: 1, md: 2, xl: 5 }} spacing={3}>
              <Input
                placeholder="Search action, actor, course, block, details"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Select value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="">All actions</option>
                {(summary.actionCounts || []).map((item) => (
                  <option key={item.action} value={item.action}>{item.action}</option>
                ))}
              </Select>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              <Select value={limit} onChange={(e) => setLimit(Number(e.target.value) || 25)}>
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n} / page</option>
                ))}
              </Select>
            </SimpleGrid>
          </Box>
        </GridItem>

        <GridItem>
          <Box borderWidth="1px" borderColor={border} rounded="xl" p={4} bg={panelBg} boxShadow="sm" h="100%">
            <Heading size="sm" mb={3}>Insights</Heading>
            <Stack spacing={4}>
              <Box>
                <Text fontSize="sm" color={muted} mb={2}>Action mix</Text>
                <Wrap spacing={2}>
                  {(summary.actionCounts || []).map((item) => (
                    <WrapItem key={item.action}>
                      <Badge colorScheme={actionTone(item.action)} px={2} py={1} rounded="full">
                        {item.action} {item.count}
                      </Badge>
                    </WrapItem>
                  ))}
                  {(!summary.actionCounts || summary.actionCounts.length === 0) && (
                    <Text fontSize="sm" color={muted}>No action data.</Text>
                  )}
                </Wrap>
              </Box>

              <Box>
                <Text fontSize="sm" color={muted} mb={2}>Top actors</Text>
                <VStack align="stretch" spacing={2}>
                  {(summary.topActors || []).map((actor) => (
                    <HStack key={`${actor.userId || 'system'}-${actor.actor}`} justify="space-between">
                      <Text noOfLines={1}>{actor.actor}</Text>
                      <Badge colorScheme="blue">{actor.count}</Badge>
                    </HStack>
                  ))}
                  {(!summary.topActors || summary.topActors.length === 0) && (
                    <Text fontSize="sm" color={muted}>No actor data.</Text>
                  )}
                </VStack>
              </Box>

              <Box>
                <Text fontSize="sm" color={muted} mb={2}>Recent trend</Text>
                <VStack align="stretch" spacing={2}>
                  {(summary.dailyCounts || []).map((item) => (
                    <Box key={item.day}>
                      <HStack justify="space-between" mb={1}>
                        <Text fontSize="sm">{item.day}</Text>
                        <Text fontSize="sm" color={muted}>{item.count}</Text>
                      </HStack>
                      <Box h="8px" rounded="full" bg={softBg} overflow="hidden">
                        <Box
                          h="100%"
                          rounded="full"
                          bg={useColorModeValue('blue.400', 'blue.300')}
                          width={`${Math.max(8, Math.round((Number(item.count || 0) / maxDaily) * 100))}%`}
                        />
                      </Box>
                    </Box>
                  ))}
                  {(!summary.dailyCounts || summary.dailyCounts.length === 0) && (
                    <Text fontSize="sm" color={muted}>No recent activity.</Text>
                  )}
                </VStack>
              </Box>
            </Stack>
          </Box>
        </GridItem>
      </Grid>

      <Box borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} boxShadow="sm" overflowX="auto">
        {loading ? (
          <VStack align="stretch" spacing={3} p={4}>
            {[1, 2, 3, 4].map((n) => <Skeleton key={n} height="64px" rounded="lg" />)}
          </VStack>
        ) : error ? (
          <VStack py={10} spacing={3}>
            <Text color="red.500">{error}</Text>
            <Button size="sm" onClick={loadFeed}>Retry</Button>
          </VStack>
        ) : items.length === 0 ? (
          <VStack py={12} spacing={2}>
            <Spinner size="sm" color="gray.400" />
            <Text color={muted}>No history entries matched the current filters.</Text>
          </VStack>
        ) : (
          <>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>When</Th>
                  <Th>Action</Th>
                  <Th>Actor</Th>
                  <Th>Schedule</Th>
                  <Th>Context</Th>
                  <Th>Details</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <Tbody>
                {items.map((item) => {
                  const schedule = item.schedule || {};
                  const scheduleLabel = [
                    schedule.programcode,
                    schedule.courseName || schedule.courseTitle,
                  ].filter(Boolean).join(' • ');
                  const contextLabel = [
                    schedule.blockCode,
                    schedule.term,
                    schedule.time,
                    schedule.instructor,
                  ].filter(Boolean).join(' • ');
                  return (
                    <Tr key={item.id}>
                      <Td whiteSpace="nowrap">{fmtDateTime(item.createdAt)}</Td>
                      <Td><Badge colorScheme={actionTone(item.action)}>{item.action || 'unknown'}</Badge></Td>
                      <Td maxW="180px"><Text noOfLines={2}>{item.actor || 'system'}</Text></Td>
                      <Td maxW="280px">
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="600" noOfLines={1}>{scheduleLabel || `Schedule #${item.scheduleId}`}</Text>
                          <Text fontSize="xs" color={muted}>ID {item.scheduleId}</Text>
                        </VStack>
                      </Td>
                      <Td maxW="240px"><Text noOfLines={2}>{contextLabel || '-'}</Text></Td>
                      <Td maxW="360px"><Text noOfLines={2}>{shortText(item.detailsPreview || item.details, 180)}</Text></Td>
                      <Td>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            setSelected(item);
                            detail.onOpen();
                          }}
                        >
                          Inspect
                        </Button>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>

            <HStack justify="space-between" p={4} borderTopWidth="1px" borderColor={border}>
              <Text fontSize="sm" color={muted}>
                Page {payload.page || page} of {pageCount}
              </Text>
              <HStack>
                <Button size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} isDisabled={(payload.page || page) <= 1}>
                  Prev
                </Button>
                <Button size="sm" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} isDisabled={(payload.page || page) >= pageCount}>
                  Next
                </Button>
              </HStack>
            </HStack>
          </>
        )}
      </Box>

      <Drawer isOpen={detail.isOpen} placement="right" onClose={detail.onClose} size="md">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>History Entry</DrawerHeader>
          <DrawerBody>
            {selected ? (
              <VStack align="stretch" spacing={4}>
                <SimpleGrid columns={2} spacing={3}>
                  <Box>
                    <Text fontSize="xs" color={muted}>Action</Text>
                    <Badge colorScheme={actionTone(selected.action)}>{selected.action || 'unknown'}</Badge>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>When</Text>
                    <Text>{fmtDateTime(selected.createdAt)}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Actor</Text>
                    <Text>{selected.actor || 'system'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Schedule ID</Text>
                    <Text>{selected.scheduleId}</Text>
                  </Box>
                </SimpleGrid>

                <Box borderWidth="1px" borderColor={border} rounded="lg" p={3}>
                  <Text fontSize="xs" color={muted} mb={2}>Schedule context</Text>
                  <VStack align="stretch" spacing={1}>
                    <Text fontWeight="600">
                      {selected.schedule?.programcode ? `${selected.schedule.programcode} • ` : ''}
                      {selected.schedule?.courseName || selected.schedule?.courseTitle || `Schedule #${selected.scheduleId}`}
                    </Text>
                    <Text color={muted}>
                      {[
                        selected.schedule?.blockCode,
                        selected.schedule?.term,
                        selected.schedule?.time,
                        selected.schedule?.room,
                        selected.schedule?.instructor,
                      ].filter(Boolean).join(' • ') || '-'}
                    </Text>
                  </VStack>
                </Box>

                <Box>
                  <Text fontSize="xs" color={muted} mb={2}>Details</Text>
                  <Code display="block" whiteSpace="pre-wrap" p={3} rounded="lg" borderWidth="1px">
                    {selected.details || 'No details'}
                  </Code>
                </Box>
              </VStack>
            ) : null}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </VStack>
  );
}
