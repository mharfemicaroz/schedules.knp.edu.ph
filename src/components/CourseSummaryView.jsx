import React from 'react';
import {
  Box,
  VStack,
  HStack,
  SimpleGrid,
  Heading,
  Text,
  Select,
  Stack,
  Badge,
  Tag,
  Button,
  useColorModeValue,
  Skeleton,
  SkeletonText,
  Progress,
  Text as ChakraText,
} from '@chakra-ui/react';
import { FiRefreshCw } from 'react-icons/fi';
import { useSelector } from 'react-redux';
import MiniBarChart from './MiniBarChart';
import { selectSettings } from '../store/settingsSlice';
import { selectBlocks } from '../store/blockSlice';
import apiService from '../services/apiService';

const normalizeProgramCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
const parseBlockProgram = (blockCode) => {
  const s = String(blockCode || '').trim();
  if (!s) return '';
  const m = s.match(/^([A-Z0-9-]+)\s*\d+/i);
  if (m) return normalizeProgramCode(m[1]);
  // if pattern like BSED-SS-1A, capture before last dash-digit
  const parts = s.split(/\s+/)[0] || s;
  return normalizeProgramCode(parts);
};

function RadialGauge({ value = 0, total = 0, label, accent }) {
  const size = 180;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  const dash = `${pct * c} ${c}`;
  const track = useColorModeValue('#E2E8F0', '#2D3748');
  const fill = accent || useColorModeValue('#2563EB', '#63B3ED');
  const textColor = useColorModeValue('gray.700', 'gray.200');
  return (
    <Box textAlign="center">
      <Box position="relative" display="inline-flex">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={fill}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={dash}
              strokeLinecap="round"
            />
          </g>
        </svg>
        <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" textAlign="center">
          <Heading size="lg" color={textColor}>{Math.round(pct * 100)}%</Heading>
          <Text fontSize="xs" color="gray.500">
            {value} of {total}
          </Text>
        </Box>
      </Box>
      <Text mt={2} fontWeight="600">{label}</Text>
    </Box>
  );
}

function StatCard({ label, value, tone, helper }) {
  const bg = useColorModeValue(`${tone}.50`, 'gray.800');
  const border = useColorModeValue(`${tone}.200`, 'gray.700');
  const text = useColorModeValue(`${tone}.700`, `${tone}.200`);
  return (
    <Box borderWidth="1px" borderColor={border} bg={bg} rounded="xl" p={4} boxShadow="sm">
      <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.08em" color="gray.500" mb={1}>{label}</Text>
      <Heading size="lg" color={text}>{value}</Heading>
      {helper && <Text fontSize="sm" color="gray.500" mt={1}>{helper}</Text>}
    </Box>
  );
}

function Donut({ assigned = 0, unassigned = 0 }) {
  const total = Math.max(assigned + unassigned, 1);
  const pct = (assigned / total) * 100;
  const size = 160;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = `${(pct / 100) * c} ${c}`;
  const track = useColorModeValue('#E2E8F0', '#2D3748');
  const fill = useColorModeValue('#2F855A', '#68D391');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  return (
    <Box textAlign="center">
      <Box position="relative" display="inline-flex">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={fill}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={dash}
              strokeLinecap="round"
            />
          </g>
        </svg>
        <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" textAlign="center">
          <Heading size="lg" color={textColor}>{Math.round(pct)}%</Heading>
          <Text fontSize="xs" color="gray.500">Assigned</Text>
        </Box>
      </Box>
      <HStack justify="center" spacing={3} mt={2} fontSize="sm">
        <Badge colorScheme="green">Assigned {assigned}</Badge>
        <Badge colorScheme="red">Unassigned {unassigned}</Badge>
      </HStack>
    </Box>
  );
}

export default function CourseSummaryView() {
  const settings = useSelector(selectSettings);
  const blocks = useSelector(selectBlocks);
  const defaultSy = settings?.schedulesView?.school_year || settings?.schedulesLoad?.school_year || '';
  const defaultSem = settings?.schedulesView?.semester || settings?.schedulesLoad?.semester || '';
  const surface = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');

  const [schoolYear, setSchoolYear] = React.useState(defaultSy || '');
  const [semester, setSemester] = React.useState(defaultSem || '');
  const [program, setProgram] = React.useState('');
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const programChartData = React.useMemo(() => {
    const list = Array.isArray(stats?.byProgram) ? stats.byProgram : [];
    return list
      .map((p) => ({
        key: p.programcode || 'N/A',
        value: Number(p.count) || 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [stats]);

  const fetchStats = React.useCallback(async ({ sy, sem, prog }) => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (sy) params.schoolyear = sy;
      if (sem) params.semester = sem;
      if (prog) params.programcode = prog;
      const res = await apiService.getProspectusStats(params);
      setStats(res || null);
    } catch (e) {
      setError(e?.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStats({ sy: defaultSy, sem: defaultSem, prog: '' });
  }, [defaultSy, defaultSem, fetchStats]);

  React.useEffect(() => {
    fetchStats({ sy: schoolYear, sem: semester, prog: program });
  }, [schoolYear, semester, program, fetchStats]);

  const semesterOptions = React.useMemo(() => ['', '1st Semester', '2nd Semester', 'Summer'], []);

  const schoolYearOptions = React.useMemo(() => {
    const baseMatch = String(defaultSy || '').match(/(\d{4})/);
    const baseYear = baseMatch ? parseInt(baseMatch[1], 10) : new Date().getFullYear();
    const list = [];
    for (let offset = -3; offset <= 3; offset++) {
      const start = baseYear + offset;
      list.push(`${start}-${start + 1}`);
    }
    const uniq = Array.from(new Set(list));
    return [''].concat(uniq);
  }, [defaultSy]);

  const programOptions = React.useMemo(() => {
    const fromBlocks = Array.isArray(blocks)
      ? Array.from(new Set(blocks.map((b) => parseBlockProgram(b.blockCode || b.block_code)).filter(Boolean)))
      : [];
    return [''].concat(fromBlocks);
  }, [blocks]);

  return (
    <VStack align="stretch" spacing={4}>
      <Box borderWidth="1px" borderColor={border} bg={surface} rounded="xl" p={4} boxShadow="sm">
        <HStack justify="space-between" align="center" flexWrap="wrap" spacing={3}>
          <Heading size="md">Summary View</Heading>
          <HStack spacing={2}>
            <Button
              size="sm"
              leftIcon={<FiRefreshCw />}
              onClick={() => {
                fetchStats({ sy: schoolYear, sem: semester, prog: program });
              }}
              isLoading={loading}
            >
              Refresh data
            </Button>
            <Badge colorScheme={loading ? 'orange' : 'green'}>{loading ? 'Syncing' : 'Server'}</Badge>
          </HStack>
        </HStack>
        <HStack spacing={3} mt={3} flexWrap="wrap">
          <Select size="sm" placeholder="School Year" value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} maxW="180px">
            {schoolYearOptions.map((y) => <option key={y || 'all-sy'} value={y}>{y || 'All Years'}</option>)}
          </Select>
          <Select size="sm" placeholder="Semester" value={semester} onChange={(e) => setSemester(e.target.value)} maxW="180px">
            {semesterOptions.map((s) => <option key={s || 'all-sem'} value={s}>{s || 'All Semesters'}</option>)}
          </Select>
          <Select size="sm" placeholder="Program" value={program} onChange={(e) => setProgram(e.target.value)} maxW="200px">
            {programOptions.map((p) => <option key={p || 'all-prog'} value={p}>{p || 'All Programs'}</option>)}
          </Select>
        </HStack>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 4 }} gap={4}>
        <StatCard label="Total Prospectus" value={stats?.total ?? 0} tone="blue" helper="block-adjusted" />
        <StatCard label="Assigned" value={stats?.assigned ?? 0} tone="green" helper="schedules mapped" />
        <StatCard label="Unassigned" value={stats?.unassigned ?? 0} tone="orange" helper="remaining slots" />
        <StatCard label="Total Blocks" value={stats?.totalBlocks ?? 0} tone="purple" helper="in this slice" />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
        <Box borderWidth="1px" borderColor={border} bg={surface} rounded="xl" p={4} boxShadow="sm">
          <Heading size="sm" mb={3}>Assignment Split</Heading>
          {loading ? (
            <SkeletonText noOfLines={3} spacing="3" />
          ) : (
            <Donut assigned={stats?.assigned ?? 0} unassigned={stats?.unassigned ?? 0} />
          )}
        </Box>
        <Box borderWidth="1px" borderColor={border} bg={surface} rounded="xl" p={4} boxShadow="sm">
          <Heading size="sm" mb={3}>Programs</Heading>
          {loading ? (
            <SkeletonText noOfLines={4} spacing="3" />
          ) : (
            <MiniBarChart
              data={programChartData.length ? programChartData : [
                { key: program || 'Program', value: stats?.total ?? 0 },
              ]}
              maxItems={6}
            />
          )}
        </Box>
      </SimpleGrid>

      <Box borderWidth="1px" borderColor={border} bg={surface} rounded="xl" p={4} boxShadow="sm">
        <Heading size="sm" mb={2}>Year Level Coverage</Heading>
        {loading && <SkeletonText noOfLines={5} spacing="3" />}
        {!loading && (
          <VStack align="stretch" spacing={3}>
            {(stats?.byYearlevel || []).map((y) => {
              const total = Math.max(Number(y.count) || 0, 1);
              const assignedPct = Math.min(100, Math.max(0, ((Number(y.assigned) || 0) / total) * 100));
              const unassigned = Math.max(0, Number(y.unassigned) || 0);
              const blocks = Array.isArray(y.blocks) ? y.blocks : [];
              return (
                <Box key={y.yearlevel || 'N/A'} borderWidth="1px" borderColor={border} rounded="md" p={3}>
                  <HStack justify="space-between" mb={1}>
                    <Text fontWeight="600">{y.yearlevel || 'N/A'}</Text>
                    <Tag colorScheme="blue" size="sm">{y.count ?? 0} total</Tag>
                  </HStack>
                  <Progress
                    value={assignedPct}
                    size="sm"
                    colorScheme="green"
                    borderRadius="full"
                    mb={2}
                    bg={useColorModeValue('red.100', 'red.900')}
                  />
                  <HStack spacing={3} fontSize="sm" color="gray.600">
                    <Badge colorScheme="green">Assigned {y.assigned ?? 0}</Badge>
                    <Badge colorScheme="red">Unassigned {unassigned}</Badge>
                    <Badge colorScheme="purple">Blocks {y.totalBlocks ?? 0}</Badge>
                  </HStack>
                  {blocks.length > 0 && (
                    <Box mt={2}>
                      <Text fontSize="xs" color="gray.500" mb={1}>By block</Text>
                      <VStack align="stretch" spacing={2}>
                        {blocks.map((b) => {
                          const bTotal = Math.max(Number(b.count) || 0, 1);
                          const bPct = Math.min(100, Math.max(0, ((Number(b.assigned) || 0) / bTotal) * 100));
                          return (
                            <Box key={b.block} borderWidth="1px" borderColor={useColorModeValue('gray.200','gray.700')} rounded="md" p={2}>
                              <HStack justify="space-between" fontSize="sm">
                                <Text fontWeight="600">{b.block}</Text>
                                <Text color="gray.500">{b.assigned ?? 0}/{b.count ?? 0}</Text>
                              </HStack>
                              <Progress value={bPct} size="xs" colorScheme="green" borderRadius="full" mt={1} />
                            </Box>
                          );
                        })}
                      </VStack>
                    </Box>
                  )}
                </Box>
              );
            })}
            {(!stats?.byYearlevel || stats.byYearlevel.length === 0) && (
              <Text fontSize="sm" color="gray.500">No year-level data for this slice.</Text>
            )}
          </VStack>
        )}
      </Box>

      {error && (
        <Box borderWidth="1px" borderColor="red.300" bg="red.50" rounded="md" p={3}>
          <Text color="red.700" fontSize="sm">{error}</Text>
        </Box>
      )}
    </VStack>
  );
}
