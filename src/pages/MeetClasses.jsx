import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  useColorModeValue,
  Button,
  useToast,
} from '@chakra-ui/react';
import { FiVideo } from 'react-icons/fi';
import MeetSummaryCards from '../components/MeetSummaryCards';
import MeetFilterBar from '../components/MeetFilterBar';
import MeetClassesTable from '../components/MeetClassesTable';
import MeetTimelineDrawer from '../components/MeetTimelineDrawer';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import useDebounce from '../hooks/useDebounce';
import { listMeetClasses, getMeetTimeline } from '../services/meetService';

function getMeetUrl(code) {
  if (!code) return null;
  const clean = String(code).trim();
  if (!/^[a-z0-9-]+$/i.test(clean)) return null;
  return `https://meet.google.com/${clean}`;
}

export default function MeetClasses() {
  const toast = useToast();
  const border = useColorModeValue('gray.200', 'gray.700');
  const subtle = useColorModeValue('gray.600', 'gray.400');

  const [items, setItems] = React.useState([]);
  const [stats, setStats] = React.useState({ totalEvents: 0, totalMeetings: 0 });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [lastRefreshAt, setLastRefreshAt] = React.useState(null);
  const [stale, setStale] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [perPage] = React.useState(10);
  const [pagination, setPagination] = React.useState({
    page: 1,
    perPage: 10,
    totalItems: 0,
    totalPages: 1,
    startItem: 0,
    endItem: 0,
    hasPrevPage: false,
    hasNextPage: false,
  });

  const [orgUnit, setOrgUnit] = React.useState('');
  const [customOrgUnit, setCustomOrgUnit] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const [refreshInterval, setRefreshInterval] = React.useState(30000);
  const [showUnique, setShowUnique] = React.useState(true);

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerMeeting, setDrawerMeeting] = React.useState(null);
  const [timelineEvents, setTimelineEvents] = React.useState([]);
  const [timelineLoading, setTimelineLoading] = React.useState(false);
  const [timelineError, setTimelineError] = React.useState(null);
  const lastSignatureRef = React.useRef('');

  const debouncedSearch = useDebounce(search, 300);

  const orgUnitOptions = React.useMemo(() => (
    [
      { label: '/Faculty (default)', value: '/Faculty' },
      { label: '/Students', value: '/Students' },
      { label: '/Staff', value: '/Staff' },
      { label: '/All', value: '' },
      { label: 'Custom...', value: '__custom' },
    ]
  ), []);

  const isCustomOrgUnit = orgUnit === '__custom';

  const getWindowRange = React.useCallback(() => {
    const now = new Date();
    const from = new Date(now.getTime() - 60 * 60 * 1000);
    return {
      fromIso: from.toISOString(),
      toIso: now.toISOString(),
    };
  }, []);

  const fetchClasses = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const windowRange = getWindowRange();
      const params = {
        from: windowRange.fromIso,
        to: windowRange.toIso,
        ou: orgUnit === '__custom' ? customOrgUnit : orgUnit,
        status: 'all',
        page,
        perPage,
      };
      const response = await listMeetClasses(params);

      const newItems = response.items || [];
      const nextStats = response.stats || { totalEvents: newItems.reduce((sum, row) => sum + (row.eventCount || 0), 0), totalMeetings: newItems.length };
      const signature = newItems.map((row) => `${row.meetingKey}|${row.lastActivityAt}|${row.status}`).join(';');
      if (signature === lastSignatureRef.current) {
        const fallbackPagination = (() => {
          const totalItems = newItems.length;
          const totalPages = totalItems ? Math.ceil(totalItems / perPage) : 1;
          const safePage = Math.min(Math.max(page, 1), totalPages);
          const startItem = totalItems ? (safePage - 1) * perPage + 1 : 0;
          const endItem = totalItems ? Math.min(safePage * perPage, totalItems) : 0;
          return {
            page: safePage,
            perPage,
            totalItems,
            totalPages,
            startItem,
            endItem,
            hasPrevPage: safePage > 1,
            hasNextPage: safePage < totalPages,
          };
        })();
        const nextPagination = response.pagination || fallbackPagination;
        setStats(nextStats);
        setLastRefreshAt(response.generatedAt || new Date().toISOString());
        setStale(response.cacheStatus === 'stale');
        setPagination(nextPagination);
        if (nextPagination.page !== page) setPage(nextPagination.page);
        return;
      }
      lastSignatureRef.current = signature;
      setItems(newItems);
      setStats(nextStats);
      const fallbackPagination = (() => {
        const totalItems = newItems.length;
        const totalPages = totalItems ? Math.ceil(totalItems / perPage) : 1;
        const safePage = Math.min(Math.max(page, 1), totalPages);
        const startItem = totalItems ? (safePage - 1) * perPage + 1 : 0;
        const endItem = totalItems ? Math.min(safePage * perPage, totalItems) : 0;
        return {
          page: safePage,
          perPage,
          totalItems,
          totalPages,
          startItem,
          endItem,
          hasPrevPage: safePage > 1,
          hasNextPage: safePage < totalPages,
        };
      })();
      const nextPagination = response.pagination || fallbackPagination;
      setPagination(nextPagination);
      if (nextPagination.page !== page) setPage(nextPagination.page);
      setLastRefreshAt(response.generatedAt || new Date().toISOString());
      setStale(response.cacheStatus === 'stale');
    } catch (err) {
      setError(err);
      if (autoRefresh) setStale(true);
    } finally {
      setLoading(false);
    }
  }, [orgUnit, customOrgUnit, autoRefresh, page, perPage, getWindowRange]);

  React.useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  React.useEffect(() => {
    setPage(1);
  }, [orgUnit, customOrgUnit]);

  React.useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = setInterval(() => {
      fetchClasses();
    }, refreshInterval);
    return () => clearInterval(timer);
  }, [autoRefresh, refreshInterval, fetchClasses]);

  const filteredItems = React.useMemo(() => {
    const query = String(debouncedSearch || '').trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => {
      return [item.actorEmail, item.meetingCode, item.conferenceId]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(query));
    });
  }, [items, debouncedSearch]);

  const sortedItems = React.useMemo(() => {
    const toTime = (value) => {
      const t = new Date(value).getTime();
      return Number.isNaN(t) ? 0 : t;
    };
    return filteredItems.slice().sort((a, b) => toTime(b.lastActivityAt) - toTime(a.lastActivityAt));
  }, [filteredItems]);

  const visibleItems = React.useMemo(() => {
    if (!showUnique) return sortedItems;
    const seen = new Set();
    const deduped = [];
    sortedItems.forEach((row) => {
      const key = String(row.meetingCode || row.conferenceId || '').toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      deduped.push(row);
    });
    return deduped;
  }, [sortedItems, showUnique]);

  const liveCount = React.useMemo(() => visibleItems.filter((row) => row.status === 'LIVE').length, [visibleItems]);
  const totalEvents = stats?.totalEvents ?? visibleItems.reduce((sum, row) => sum + (row.eventCount || 0), 0);
  const lastRefreshLabel = lastRefreshAt ? new Date(lastRefreshAt).toLocaleTimeString() : '-';

  const handlePageChange = React.useCallback((value) => {
    setPage(value);
  }, []);

  const handleCopy = React.useCallback(async (value, label) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied`, status: 'success', duration: 2000, isClosable: true });
    } catch {
      toast({ title: 'Copy failed', status: 'error', duration: 2000, isClosable: true });
    }
  }, [toast]);

  const handleViewTimeline = React.useCallback(async (meeting) => {
    setDrawerMeeting(meeting);
    setDrawerOpen(true);
    setTimelineLoading(true);
    setTimelineError(null);
    try {
      const id = meeting.conferenceId || meeting.meetingCode;
      const windowRange = getWindowRange();
      const response = await getMeetTimeline({
        conferenceId: id,
        from: windowRange.fromIso,
        to: windowRange.toIso,
      });
      setTimelineEvents(response.items || []);
    } catch (err) {
      setTimelineError(err?.message || 'Unable to load timeline.');
      setTimelineEvents([]);
    } finally {
      setTimelineLoading(false);
    }
  }, [getWindowRange]);

  const handleOpenMeet = React.useCallback((meeting) => {
    const url = getMeetUrl(meeting.meetingCode);
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  }, []);

  const handleOrgUnitChange = React.useCallback((value) => {
    setOrgUnit(value);
    if (value !== '__custom') setCustomOrgUnit('');
  }, []);

  if (loading && items.length === 0) {
    return <LoadingState label="Loading Meet classes..." />;
  }

  if (error && items.length === 0) {
    return <ErrorState error={error} onRetry={() => fetchClasses()} />;
  }

  return (
    <Box px={{ base: 4, md: 6 }} py={6} maxW="100%" mx="auto">
      <VStack align="stretch" spacing={6}>
        <HStack justify="space-between" align="center" flexWrap="wrap" spacing={4}>
          <HStack spacing={3}>
            <Box p={3} rounded="lg" borderWidth="1px" borderColor={border}>
              <FiVideo />
            </Box>
            <VStack align="start" spacing={0}>
              <Heading size="md">Meet Classes</Heading>
              <Text fontSize="sm" color={subtle}>Live Google Meet sessions for knp.edu.ph</Text>
            </VStack>
          </HStack>
          <Button size="sm" variant="outline" onClick={() => fetchClasses()}>Manual refresh</Button>
        </HStack>

        <MeetSummaryCards
          totalLive={liveCount}
          totalEvents={totalEvents}
          lastRefreshLabel={lastRefreshLabel}
        />

        <MeetFilterBar
          orgUnit={orgUnit}
          onOrgUnitChange={handleOrgUnitChange}
          orgUnitOptions={orgUnitOptions}
          isCustomOrgUnit={isCustomOrgUnit}
          customOrgUnit={customOrgUnit}
          onCustomOrgUnitChange={setCustomOrgUnit}
          search={search}
          onSearchChange={setSearch}
          showUnique={showUnique}
          onShowUniqueChange={setShowUnique}
          autoRefresh={autoRefresh}
          onAutoRefreshChange={setAutoRefresh}
          refreshInterval={refreshInterval}
          onRefreshIntervalChange={setRefreshInterval}
          onRefresh={() => fetchClasses()}
          isRefreshing={loading}
          isStale={stale}
        />

        {visibleItems.length === 0 ? (
          <Box borderWidth="1px" borderColor={border} rounded="xl" p={10} textAlign="center">
            <Text fontWeight="700">No Meet classes found</Text>
            <Text fontSize="sm" color={subtle} mt={2}>Try widening the time window or switching to All status.</Text>
          </Box>
        ) : (
          <MeetClassesTable
            items={visibleItems}
            onViewTimeline={handleViewTimeline}
            onCopyMeetingCode={(row) => handleCopy(row.meetingCode, 'Meeting code')}
            onOpenMeet={handleOpenMeet}
            pagination={pagination}
            onPageChange={handlePageChange}
          />
        )}
      </VStack>

      <MeetTimelineDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        meeting={drawerMeeting}
        events={timelineEvents}
        loading={timelineLoading}
        error={timelineError}
      />
    </Box>
  );
}

