import React from 'react';
import {
  Box, Heading, Text, HStack, VStack, Button, useColorModeValue, Input, Select, Tag, TagLabel, TagCloseButton,
  SimpleGrid, IconButton, useDisclosure, useToast, Divider
} from '@chakra-ui/react';
import { FiRefreshCw, FiPlus, FiFilter } from 'react-icons/fi';
import useAttendance from '../hooks/useAttendance';
import apiService from '../services/apiService';
import AttendanceTable from '../components/AttendanceTable';
import AttendanceFormModal from '../components/AttendanceFormModal';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'excused', label: 'Excused' },
];

export default function Attendance() {
  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(100);
  const [filters, setFilters] = React.useState({ startDate: '', endDate: '', status: '', scheduleId: '' });
  const { data, loading, error, refresh } = useAttendance({ page, limit, ...filters });
  const [stats, setStats] = React.useState({ total: 0, byStatus: {} });
  const [editing, setEditing] = React.useState(null);
  const modal = useDisclosure();
  const toast = useToast();

  const loadStats = React.useCallback(async () => {
    try { const s = await apiService.getAttendanceStats(filters); setStats(s || { total: 0, byStatus: {} }); } catch {}
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

  return (
    <Box>
      <HStack justify="space-between" align="center" mb={4}>
        <VStack align="start" spacing={0}>
          <Heading size="md">Attendance</Heading>
          <Text fontSize="sm" color={useColorModeValue('gray.600','gray.400')}>Track attendance per schedule, with quick filters.</Text>
        </VStack>
        <HStack>
          <IconButton aria-label="Refresh" icon={<FiRefreshCw />} onClick={refresh} />
          <Button leftIcon={<FiPlus />} colorScheme="blue" onClick={() => { setEditing(null); modal.onOpen(); }}>Add</Button>
        </HStack>
      </HStack>

      <Box bg={cardBg} borderWidth="1px" borderColor={border} rounded="lg" p={4} mb={4}>
        <HStack spacing={3} align="end" flexWrap="wrap">
          <Box>
            <Text fontSize="xs" color="gray.500" mb={1}>Start Date</Text>
            <Input type="date" value={filters.startDate} onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))} maxW="180px" />
          </Box>
          <Box>
            <Text fontSize="xs" color="gray.500" mb={1}>End Date</Text>
            <Input type="date" value={filters.endDate} onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))} maxW="180px" />
          </Box>
          <Box>
            <Text fontSize="xs" color="gray.500" mb={1}>Status</Text>
            <Select placeholder="All" value={filters.status} onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))} maxW="180px">
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Box>
          <Box>
            <Text fontSize="xs" color="gray.500" mb={1}>Schedule ID</Text>
            <Input placeholder="e.g., 123" value={filters.scheduleId} onChange={(e) => setFilters(f => ({ ...f, scheduleId: e.target.value }))} maxW="160px" />
          </Box>
          <Box>
            <Text fontSize="xs" color="gray.500" mb={1}>Page Size</Text>
            <Select value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))} maxW="120px">
              {[50,100,200,500,1000].map(n => <option key={n} value={n}>{n}</option>)}
            </Select>
          </Box>
          <Button leftIcon={<FiFilter />} onClick={onApply}>Apply</Button>
        </HStack>
        {(filters.status) && (
          <HStack spacing={2} mt={3}>
            <Tag size="sm" colorScheme="blue">
              <TagLabel>Status: {filters.status}</TagLabel>
              <TagCloseButton onClick={clearStatus} />
            </Tag>
          </HStack>
        )}
      </Box>

      <Box bg={cardBg} borderWidth="1px" borderColor={border} rounded="lg" p={0}>
        <HStack spacing={3} px={4} py={3} borderBottomWidth="1px" borderColor={border}>
          <Tag colorScheme="gray">Total: {stats.total || 0}</Tag>
          {Object.entries(stats.byStatus || {}).map(([k, v]) => (
            <Tag key={k} colorScheme={k==='present'?'green':k==='absent'?'red':k==='late'?'orange':'blue'}>{k}: {v}</Tag>
          ))}
        </HStack>
        <AttendanceTable
          items={data}
          loading={loading}
          onEdit={(row) => { setEditing(row); modal.onOpen(); }}
          onDelete={onDelete}
        />
        <HStack justify="space-between" px={4} py={3}>
          <Text fontSize="sm" color={useColorModeValue('gray.600','gray.400')}>Page {page}</Text>
          <HStack>
            <Button size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} isDisabled={page <= 1}>Prev</Button>
            <Button size="sm" onClick={() => setPage(p => p + 1)} isDisabled={Array.isArray(data) && data.length < limit}>Next</Button>
          </HStack>
        </HStack>
      </Box>

      <AttendanceFormModal isOpen={modal.isOpen} onClose={modal.onClose} initial={editing} onSaved={onSaved} />
    </Box>
  );
}
