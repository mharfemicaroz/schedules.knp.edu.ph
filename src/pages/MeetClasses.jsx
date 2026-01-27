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
import { listMeetClasses, listMeetLiveClasses, getMeetTimeline } from '../services/meetService';

function toDateInputValue(date) {
  const d = new Date(date);
  const pad = (v) => String(v).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function parseDateInput(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isRecentNow(date) {
  if (!date) return false;
  const diff = Math.abs(Date.now() - date.getTime());
  return diff < 2 * 60 * 1000;
}

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
  const [nextPageToken, setNextPageToken] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [lastRefreshAt, setLastRefreshAt] = React.useState(null);
  const [stale, setStale] = React.useState(false);

  const [status, setStatus] = React.useState('all');
  const [orgUnit, setOrgUnit] = React.useState('');
  const [customOrgUnit, setCustomOrgUnit] = React.useState('');
  const [windowPreset, setWindowPreset] = React.useState('2');
  const [fromValue, setFromValue] = React.useState('');
  const [toValue, setToValue] = React.useState('');
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

  React.useEffect(() => {
    if (windowPreset === 'custom') return;
    const hours = Number(windowPreset || 2);
    const now = new Date();
    const from = new Date(now.getTime() - hours * 60 * 60 * 1000);
    setFromValue(toDateInputValue(from));
    setToValue(toDateInputValue(now));
  }, [windowPreset]);

  const fromIso = React.useMemo(() => {
    const d = parseDateInput(fromValue);
    return d ? d.toISOString() : undefined;
  }, [fromValue]);
  const toIso = React.useMemo(() => {
    const d = parseDateInput(toValue);
    return d ? d.toISOString() : undefined;
  }, [toValue]);
  const toDate = React.useMemo(() => parseDateInput(toValue), [toValue]);
  const useLiveEndpoint = status === 'live' && windowPreset !== 'custom' && isRecentNow(toDate);

  const fetchClasses = React.useCallback(async ({ append = false, pageTokenOverride } = {}) => {
    try {
      if (append) setLoadingMore(true); else setLoading(true);
      setError(null);
      const params = {
        from: fromIso,
        to: toIso,
        ou: orgUnit === '__custom' ? customOrgUnit : orgUnit,
        status,
        pageToken: pageTokenOverride || undefined,
        pageSize: 50,
      };
      const response = useLiveEndpoint && !append
        ? await listMeetLiveClasses({ ou: params.ou, from: params.from, to: params.to })
        : await listMeetClasses(params);

      const newItems = response.items || [];
      const nextToken = response.nextPageToken || null;
      const nextStats = response.stats || { totalEvents: newItems.reduce((sum, row) => sum + (row.eventCount || 0), 0), totalMeetings: newItems.length };
      const signature = newItems.map((row) => `${row.meetingKey}|${row.lastActivityAt}|${row.status}`).join(';');
      if (!append && signature === lastSignatureRef.current) {
        setStats(nextStats);
        setNextPageToken(nextToken);
        setLastRefreshAt(response.generatedAt || new Date().toISOString());
        setStale(response.cacheStatus === 'stale');
        return;
      }
      if (!append) lastSignatureRef.current = signature;
      setItems((prev) => append ? [...prev, ...newItems] : newItems);
      setStats(nextStats);
      setNextPageToken(nextToken);
      setLastRefreshAt(response.generatedAt || new Date().toISOString());
      setStale(response.cacheStatus === 'stale');
    } catch (err) {
      setError(err);
      if (autoRefresh) setStale(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [fromIso, toIso, orgUnit, customOrgUnit, status, useLiveEndpoint, autoRefresh]);

  React.useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

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

  const handleLoadMore = React.useCallback(() => {
    if (!nextPageToken) return;
    fetchClasses({ append: true, pageTokenOverride: nextPageToken });
  }, [nextPageToken, fetchClasses]);

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
      const response = await getMeetTimeline({
        conferenceId: id,
        from: fromIso,
        to: toIso,
      });
      setTimelineEvents(response.items || []);
    } catch (err) {
      setTimelineError(err?.message || 'Unable to load timeline.');
      setTimelineEvents([]);
    } finally {
      setTimelineLoading(false);
    }
  }, [fromIso, toIso]);

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
          windowPreset={windowPreset}
          onWindowPresetChange={setWindowPreset}
          fromValue={fromValue}
          toValue={toValue}
          onFromChange={setFromValue}
          onToChange={setToValue}
          status={status}
          onStatusChange={setStatus}
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
            hasMore={Boolean(nextPageToken)}
            onLoadMore={handleLoadMore}
            loadingMore={loadingMore}
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

