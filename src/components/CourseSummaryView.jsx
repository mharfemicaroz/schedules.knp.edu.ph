import React from 'react';
import {
  Box,
  VStack,
  HStack,
  SimpleGrid,
  Grid,
  GridItem,
  Heading,
  Text,
  Select,
  Badge,
  Tag,
  Button,
  useColorModeValue,
  useBreakpointValue,
  SkeletonText,
  Progress,
  Text as ChakraText,
  Stack,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
} from '@chakra-ui/react';
import { FiRefreshCw } from 'react-icons/fi';
import { useSelector } from 'react-redux';
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
const normalizeSemesterLabel = (v) => {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return '';
  if (s.startsWith('1')) return '1st Semester';
  if (s.startsWith('2')) return '2nd Semester';
  if (s.startsWith('s')) return 'Summer';
  if (s.includes('summer')) return 'Summer';
  return v;
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

const donutPalette = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#F472B6', '#0EA5E9', '#EF4444', '#14B8A6'];

function MultiDonut({ data = [], size = 180, thickness = 18, title, subtitle }) {
  const total = data.reduce((acc, it) => acc + (it.value || 0), 0);
  const safeTotal = total > 0 ? total : 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const track = useColorModeValue('#E2E8F0', '#2D3748');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  let offset = 0;

  return (
    <Box textAlign="center">
      <Box position="relative" w={`${size}px`} h={`${size}px`} mx="auto">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={track}
              strokeWidth={thickness}
              fill="none"
            />
            {data.map((d, idx) => {
              const val = Number(d.value) || 0;
              if (val <= 0 || total <= 0) return null;
              const pct = val / safeTotal;
              const dash = `${pct * circumference} ${circumference}`;
              const rot = (offset / safeTotal) * 360;
              offset += val;
              return (
                <circle
                  key={d.label || idx}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={d.color || donutPalette[idx % donutPalette.length]}
                  strokeWidth={thickness}
                  fill="none"
                  strokeDasharray={dash}
                  strokeLinecap="round"
                  transform={`rotate(${rot} ${size / 2} ${size / 2})`}
                  opacity={0.95}
                />
              );
            })}
          </g>
        </svg>
        <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" textAlign="center">
          <Heading size="md" color={textColor}>{total || 0}</Heading>
          <Text fontSize="xs" color="gray.500">{title || 'Total'}</Text>
        </Box>
      </Box>
      {subtitle && <Text mt={2} color="gray.600" fontSize="sm">{subtitle}</Text>}
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

function Donut({ assigned = 0, unassigned = 0, size = 160 }) {
  const total = Math.max(assigned + unassigned, 1);
  const pct = (assigned / total) * 100;
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

function ProgramStatCard({ programcode, assigned, total }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (assigned / total) * 100)) : 0;
  const unassigned = Math.max(total - assigned, 0);
  const tone = pct >= 90 ? 'green' : pct >= 70 ? 'blue' : pct >= 40 ? 'yellow' : 'red';
  const cardBg = useColorModeValue('white', 'gray.900');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');
  const progressBg = useColorModeValue('gray.100', 'gray.700');
  return (
    <Box
      borderWidth="1px"
      borderColor={cardBorder}
      rounded="lg"
      p={3}
      bg={cardBg}
      boxShadow="sm"
      transition="all 0.15s ease"
      _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
    >
      <HStack justify="space-between" align="start" spacing={2} mb={2}>
        <Box minW={0}>
          <ChakraText fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="0.08em">
            Program
          </ChakraText>
          <Heading size="sm" noOfLines={1}>{programcode}</Heading>
        </Box>
        <Tag colorScheme={tone} variant="subtle" size="sm">{Math.round(pct)}%</Tag>
      </HStack>
      <Progress value={pct} size="sm" colorScheme={tone} borderRadius="full" bg={progressBg} />
      <HStack spacing={2} mt={2} justify="space-between" fontSize="xs" color="gray.600">
        <Badge colorScheme="green" variant="subtle">{assigned} assigned</Badge>
        <Badge colorScheme="blue" variant="subtle">{total} total</Badge>
        <Badge colorScheme="red" variant="subtle">{unassigned} open</Badge>
      </HStack>
    </Box>
  );
}

export default function CourseSummaryView() {
  const settings = useSelector(selectSettings);
  const blocks = useSelector(selectBlocks);
  const faculties = useSelector((s) => s.data?.faculties || []);
  const donutSize = useBreakpointValue({ base: 140, sm: 160, md: 180, lg: 200 });
  const surface = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const subtleBorder = useColorModeValue('gray.200', 'gray.700');
  const mutedProgressBg = useColorModeValue('gray.100', 'gray.700');
  const dangerProgressBg = useColorModeValue('red.100', 'red.900');
  const blockBorderColor = useColorModeValue('gray.200', 'gray.700');

  const [schoolYear, setSchoolYear] = React.useState(settings?.schedulesLoad?.school_year || '');
  const [semester, setSemester] = React.useState(normalizeSemesterLabel(settings?.schedulesLoad?.semester || ''));
  const [program, setProgram] = React.useState('');
  const [facultyThreshold, setFacultyThreshold] = React.useState(24);
  const [stats, setStats] = React.useState(null);
  const [loadingStats, setLoadingStats] = React.useState(false);
  const [loadingFaculty, setLoadingFaculty] = React.useState(false);
  const [error, setError] = React.useState('');
  const lastParamsRef = React.useRef(null);
  const lastFacultyParamsRef = React.useRef(null);

  const programRows = React.useMemo(() => {
    const list = Array.isArray(stats?.byProgram) ? stats.byProgram : [];
    return list
      .map((p) => ({
        programcode: p.programcode || 'N/A',
        count: Number(p.count) || 0,
        assigned: Number(p.assigned) || 0,
      }))
      .map((p) => ({
        ...p,
        pct: p.count > 0 ? p.assigned / p.count : 0,
      }))
      .sort((a, b) => (b.pct - a.pct) || (b.assigned - a.assigned) || (b.count - a.count) || a.programcode.localeCompare(b.programcode));
  }, [stats]);

  const fetchStats = React.useCallback(
    async ({ sy, sem, prog, threshold }, { updateFacultyOnly = false } = {}) => {
      if (updateFacultyOnly) setLoadingFaculty(true);
      else setLoadingStats(true);
      if (!updateFacultyOnly) setError('');
      try {
        const params = {};
        if (sy) params.schoolyear = sy;
        if (sem) params.semester = sem;
        if (prog) params.programcode = prog;
        if (threshold != null) params.thresholdUnits = threshold;
        const res = await apiService.getProspectusStats(params);
        if (updateFacultyOnly) {
          setStats((prev) => ({ ...(prev || {}), facultySummary: res?.facultySummary }));
        } else {
          setStats(res || null);
        }
      } catch (e) {
        if (!updateFacultyOnly) setError(e?.message || 'Failed to load stats');
      } finally {
        if (updateFacultyOnly) setLoadingFaculty(false);
        else setLoadingStats(false);
      }
    },
    []
  );

  // Sync defaults from settings when they load/change
  React.useEffect(() => {
    const newSy = settings?.schedulesLoad?.school_year || '';
    const newSem = normalizeSemesterLabel(settings?.schedulesLoad?.semester || '');
    setSchoolYear(newSy);
    setSemester(newSem);
  }, [settings?.schedulesLoad?.school_year, settings?.schedulesLoad?.semester]);

  React.useEffect(() => {
    const params = { sy: schoolYear, sem: semester, prog: program, threshold: facultyThreshold };
    const baseKey = JSON.stringify({ sy: schoolYear, sem: semester, prog: program });
    if (lastParamsRef.current === baseKey) return;
    lastParamsRef.current = baseKey;
    lastFacultyParamsRef.current = JSON.stringify(params);
    fetchStats(params);
  }, [schoolYear, semester, program, facultyThreshold, fetchStats]);

  // Recompute faculty summary only when threshold changes (same SY/Sem/Program)
  React.useEffect(() => {
    if (!stats) return;
    const params = { sy: schoolYear, sem: semester, prog: program, threshold: facultyThreshold };
    const key = JSON.stringify(params);
    if (lastFacultyParamsRef.current === key) return;
    lastFacultyParamsRef.current = key;
    fetchStats(params, { updateFacultyOnly: true });
  }, [facultyThreshold, schoolYear, semester, program, stats, fetchStats]);

  const semesterOptions = React.useMemo(() => ['', '1st Semester', '2nd Semester', 'Summer'], []);

  const schoolYearOptions = React.useMemo(() => {
    const baseMatch = String(settings?.schedulesLoad?.school_year || '').match(/(\d{4})/);
    const baseYear = baseMatch ? parseInt(baseMatch[1], 10) : new Date().getFullYear();
    const list = [];
    for (let offset = -3; offset <= 3; offset++) {
      const start = baseYear + offset;
      list.push(`${start}-${start + 1}`);
    }
    const uniq = Array.from(new Set(list));
    return [''].concat(uniq);
  }, [settings?.schedulesLoad?.school_year]);

  const programOptions = React.useMemo(() => {
    const fromBlocks = Array.isArray(blocks)
      ? Array.from(new Set(blocks.map((b) => parseBlockProgram(b.blockCode || b.block_code)).filter(Boolean)))
      : [];
    return [''].concat(fromBlocks);
  }, [blocks]);

  const handleThresholdChange = React.useCallback((val) => {
    const n = Number(val);
    const next = Number.isFinite(n) ? Math.max(1, Math.min(60, n)) : 24;
    setFacultyThreshold(next);
  }, []);

  const facultyLoadStats = React.useMemo(() => {
    const summary = stats?.facultySummary || null;
    const heavyThreshold = Number(summary?.threshold ?? facultyThreshold ?? 24);
    if (summary) {
      const heavyTotal = Number(summary.faculty24OrMore ?? summary.faculty_24_or_more ?? 0);
      const lightTotal = Number(summary.facultyLessThan24 ?? summary.faculty_less_than_24 ?? 0);
      const totalFaculty = Number(summary.totalFaculty ?? heavyTotal + lightTotal);
      const safeTotal = totalFaculty > 0 ? totalFaculty : heavyTotal + lightTotal;
      const normalizeLabel = (v) => {
        const s = String(v ?? '').trim();
        return s || 'Unspecified';
      };
      const empList = (summary.byEmployment || [])
        .map((e) => {
          const heavy = Number(e.faculty24OrMore ?? e.faculty_24_or_more ?? 0);
          const light = Number(e.facultyLessThan24 ?? e.faculty_less_than_24 ?? 0);
          const total = Number(e.totalFaculty ?? e.total_faculty_in_employment ?? (heavy + light));
          const label = normalizeLabel(e.label ?? e.employment);
          return { key: label, label, heavy, total };
        })
        .sort((a, b) => (b.heavy - a.heavy) || (b.total - a.total) || a.key.localeCompare(b.key));
      const deptList = (summary.byDepartment || [])
        .map((d) => {
          const heavy = Number(d.faculty24OrMore ?? d.faculty_24_or_more ?? 0);
          const light = Number(d.facultyLessThan24 ?? d.faculty_less_than_24 ?? 0);
          const total = Number(d.totalFaculty ?? d.total_faculty_in_dept ?? (heavy + light));
          const label = normalizeLabel(d.label ?? d.dept);
          return { key: label, label, heavy, total };
        })
        .sort((a, b) => (b.heavy - a.heavy) || (b.total - a.total) || a.key.localeCompare(b.key));
      return { heavyThreshold, heavyTotal, totalFaculty: safeTotal, deptList, empList };
    }

    // Fallback to client-side computation if server summary is missing
    const deptMap = new Map();
    const empMap = new Map();
    let heavyTotal = 0;
    let totalFaculty = 0;

    const ensure = (map, key) => {
      if (!map.has(key)) map.set(key, { key, label: key, heavy: 0, total: 0 });
      return map.get(key);
    };

    (faculties || []).forEach((f) => {
      const load = Number(f?.stats?.loadHours ?? f?.loadHours ?? 0) || 0;
      const dept = (f?.department || f?.dept || 'Unspecified') || 'Unspecified';
      const employment = (f?.employment || 'Unspecified') || 'Unspecified';
      const isHeavy = load >= heavyThreshold;

      ensure(deptMap, dept).total += 1;
      ensure(empMap, employment).total += 1;
      totalFaculty += 1;

      if (isHeavy) {
        heavyTotal += 1;
        ensure(deptMap, dept).heavy += 1;
        ensure(empMap, employment).heavy += 1;
      }
    });

    const deptList = Array.from(deptMap.values()).sort((a, b) => (b.heavy - a.heavy) || (b.total - a.total) || a.key.localeCompare(b.key));
    const empList = Array.from(empMap.values()).sort((a, b) => (b.heavy - a.heavy) || (b.total - a.total) || a.key.localeCompare(b.key));

    return { heavyThreshold, heavyTotal, totalFaculty, deptList, empList };
  }, [stats, faculties, facultyThreshold]);

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
                const params = { sy: schoolYear, sem: semester, prog: program, threshold: facultyThreshold };
                lastFacultyParamsRef.current = JSON.stringify(params);
                fetchStats(params);
              }}
              isLoading={loadingStats}
            >
              Refresh data
            </Button>
            <Badge colorScheme={loadingStats ? 'orange' : 'green'}>{loadingStats ? 'Syncing' : 'Server'}</Badge>
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
        <StatCard label="Total Required Schedules" value={stats?.total ?? 0} tone="blue" helper="block-adjusted" />
        <StatCard label="Assigned Schedules" value={stats?.assigned ?? 0} tone="green" helper="schedules mapped" />
        <StatCard label="Unassigned Schedules" value={stats?.unassigned ?? 0} tone="orange" helper="remaining slots" />
        <StatCard label="Total Blocks" value={stats?.totalBlocks ?? 0} tone="purple" helper="in this slice" />
      </SimpleGrid>

      <Grid templateColumns={{ base: '1fr', md: 'repeat(4, minmax(0, 1fr))' }} gap={4} alignItems="stretch">
        <GridItem colSpan={{ base: 1, md: 1 }}>
          <Box borderWidth="1px" borderColor={border} bg={surface} rounded="xl" p={4} boxShadow="sm" h="100%">
            <Heading size="sm" mb={3}>Assignment Split</Heading>
            {loadingStats ? (
              <SkeletonText noOfLines={3} spacing="3" />
            ) : (
              <Donut
                assigned={stats?.assigned ?? 0}
                unassigned={stats?.unassigned ?? 0}
                size={donutSize || 160}
              />
            )}
          </Box>
        </GridItem>
        <GridItem colSpan={{ base: 1, md: 3 }}>
          <Box borderWidth="1px" borderColor={border} bg={surface} rounded="xl" p={4} boxShadow="sm" h="100%">
            <Heading size="sm" mb={3}>Programs</Heading>
            {loadingStats && <SkeletonText noOfLines={4} spacing="3" />}
            {!loadingStats && programRows.length === 0 && (
              <Text fontSize="sm" color="gray.500">No program data for this slice.</Text>
            )}
            {!loadingStats && programRows.length > 0 && (
              <>
                <HStack justify="space-between" align="center" mb={3} spacing={2}>
                  <ChakraText fontSize="xs" color="gray.500">Sorted by completion, compact grid to fit more on screen.</ChakraText>
                  <Tag colorScheme="blue" variant="subtle" size="sm">{programRows.length} programs</Tag>
                </HStack>
                <SimpleGrid columns={{ base: 1, sm: 2, md: 3, xl: 4 }} spacing={3}>
                  {programRows.map((p) => (
                    <ProgramStatCard
                      key={p.programcode}
                      programcode={p.programcode}
                      assigned={p.assigned}
                      total={p.count}
                    />
                  ))}
                </SimpleGrid>
              </>
            )}
          </Box>
        </GridItem>
      </Grid>

      <Box borderWidth="1px" borderColor={border} bg={surface} rounded="xl" p={4} boxShadow="sm">
        <HStack justify="space-between" align="center" mb={2} flexWrap="wrap" spacing={2}>
          <HStack spacing={3} align="center">
            <Heading size="sm">Faculty load</Heading>
            <Tag colorScheme="blue" variant="subtle">
              {facultyLoadStats.heavyTotal}/{facultyLoadStats.totalFaculty || 0} hitting {facultyLoadStats.heavyThreshold}+
            </Tag>
          </HStack>
          <HStack spacing={2} align="center">
            <Text fontSize="xs" color="gray.600">Units threshold</Text>
            <NumberInput
              size="sm"
              maxW="110px"
              min={1}
              max={60}
              value={facultyThreshold}
              onChange={handleThresholdChange}
              allowMouseWheel
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </HStack>
        </HStack>
        <Text fontSize="sm" color="gray.600" mb={3}>
          Counts faculty whose combined scheduled units reach at least {facultyLoadStats.heavyThreshold}. Sourced from server stats for the selected school year/semester.
        </Text>
        {loadingStats ? (
          <SkeletonText noOfLines={4} spacing="3" />
        ) : facultyLoadStats.totalFaculty === 0 ? (
          <Text fontSize="sm" color="gray.500">No faculty data available yet.</Text>
        ) : (
          <Grid templateColumns={{ base: '1fr', lg: 'repeat(3, minmax(0, 1fr))' }} gap={4}>
            <GridItem>
              <Box borderWidth="1px" borderColor={border} rounded="lg" p={3} h="100%">
                <Heading size="xs" mb={2}>Overall hit rate</Heading>
                <Donut
                  assigned={facultyLoadStats.heavyTotal}
                  unassigned={Math.max(facultyLoadStats.totalFaculty - facultyLoadStats.heavyTotal, 0)}
                  size={donutSize || 160}
                />
              </Box>
            </GridItem>
            <GridItem>
              <Box borderWidth="1px" borderColor={border} rounded="lg" p={3} h="100%">
                <Heading size="xs" mb={2}>By employment ({facultyLoadStats.heavyThreshold}+)</Heading>
                <MultiDonut
                  data={facultyLoadStats.empList.map((e, idx) => ({
                    label: e.label,
                    value: e.heavy,
                    color: donutPalette[idx % donutPalette.length],
                  }))}
                  size={donutSize || 160}
                  thickness={18}
                  title="Heavy faculty"
                  subtitle="Breakdown by employment"
                />
                <Stack spacing={2} mt={3}>
                  {facultyLoadStats.empList.map((e, idx) => {
                    const pct = e.total > 0 ? Math.round((e.heavy / e.total) * 100) : 0;
                    const tone = pct >= 90 ? 'green' : pct >= 60 ? 'blue' : pct >= 30 ? 'orange' : 'red';
                    return (
                      <HStack key={e.label} justify="space-between" spacing={3} fontSize="sm">
                        <HStack spacing={2}>
                          <Box boxSize="10px" rounded="full" bg={donutPalette[idx % donutPalette.length]} />
                          <Text>{e.label}</Text>
                        </HStack>
                        <Badge colorScheme={tone} variant="subtle">{e.heavy}/{e.total} ({pct}%)</Badge>
                      </HStack>
                    );
                  })}
                </Stack>
              </Box>
            </GridItem>
            <GridItem colSpan={{ base: 1, lg: 1 }}>
              <Box borderWidth="1px" borderColor={border} rounded="lg" p={3} h="100%">
                <HStack justify="space-between" mb={2}>
                <Heading size="xs">By department ({facultyLoadStats.heavyThreshold}+)</Heading>
                  <Tag colorScheme="blue" variant="subtle" size="sm">
                    {facultyLoadStats.deptList.length} depts
                  </Tag>
                </HStack>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  {facultyLoadStats.deptList.map((d) => {
                    const pct = d.total > 0 ? Math.round((d.heavy / d.total) * 100) : 0;
                    const tone = pct >= 90 ? 'green' : pct >= 60 ? 'blue' : pct >= 30 ? 'orange' : 'red';
                    return (
                      <Box key={d.key} borderWidth="1px" borderColor={subtleBorder} rounded="md" p={3}>
                        <HStack justify="space-between" mb={1}>
                          <Text fontWeight="600" noOfLines={1}>{d.label}</Text>
                          <Badge colorScheme={tone} variant="subtle">{d.heavy}/{d.total} ({pct}%)</Badge>
                        </HStack>
                        <Progress value={pct} size="sm" colorScheme={tone} borderRadius="full" bg={mutedProgressBg} />
                      </Box>
                    );
                  })}
                  {facultyLoadStats.deptList.length === 0 && (
                    <Text fontSize="sm" color="gray.500">No department info found.</Text>
                  )}
                </SimpleGrid>
              </Box>
            </GridItem>
          </Grid>
        )}
      </Box>

      <Box borderWidth="1px" borderColor={border} bg={surface} rounded="xl" p={4} boxShadow="sm">
        <HStack justify="space-between" align="center" mb={3}>
          <Heading size="sm">Year Level Coverage</Heading>
          <Tag colorScheme="blue" variant="subtle" size="sm">
            {(stats?.byYearlevel || []).length} levels
          </Tag>
        </HStack>
        {loadingStats && <SkeletonText noOfLines={5} spacing="3" />}
        {!loadingStats && (
          <>
            {(!stats?.byYearlevel || stats.byYearlevel.length === 0) && (
              <Text fontSize="sm" color="gray.500">No year-level data for this slice.</Text>
            )}
            <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={3}>
              {(stats?.byYearlevel || []).map((y) => {
                const total = Math.max(Number(y.count) || 0, 1);
                const assignedPct = Math.min(100, Math.max(0, ((Number(y.assigned) || 0) / total) * 100));
                const unassigned = Math.max(0, Number(y.unassigned) || 0);
                const blocks = Array.isArray(y.blocks) ? y.blocks : [];
                return (
                  <Box
                    key={y.yearlevel || 'N/A'}
                    borderWidth="1px"
                    borderColor={border}
                    rounded="lg"
                    p={3}
                    h="100%"
                    transition="all 0.15s ease"
                    _hover={{ boxShadow: 'md', transform: 'translateY(-2px)' }}
                  >
                    <HStack justify="space-between" mb={2}>
                      <Text fontWeight="700" noOfLines={1}>{y.yearlevel || 'N/A'}</Text>
                      <Tag colorScheme="blue" size="sm">{y.count ?? 0} total</Tag>
                    </HStack>
                    <Progress
                      value={assignedPct}
                      size="sm"
                      colorScheme={assignedPct >= 80 ? 'green' : assignedPct >= 50 ? 'blue' : 'orange'}
                      borderRadius="full"
                      mb={2}
                      bg={dangerProgressBg}
                    />
                    <HStack spacing={2} fontSize="xs" color="gray.600" mb={blocks.length ? 2 : 0}>
                      <Badge colorScheme="green" variant="subtle">Assigned {y.assigned ?? 0}</Badge>
                      <Badge colorScheme="red" variant="subtle">Unassigned {unassigned}</Badge>
                      <Badge colorScheme="purple" variant="subtle">Blocks {y.totalBlocks ?? 0}</Badge>
                    </HStack>
                    {blocks.length > 0 && (
                      <VStack align="stretch" spacing={1}>
                        {blocks.map((b) => {
                          const bTotal = Math.max(Number(b.count) || 0, 1);
                          const bPct = Math.min(100, Math.max(0, ((Number(b.assigned) || 0) / bTotal) * 100));
                          return (
                            <HStack key={b.block} justify="space-between" fontSize="xs" spacing={2}>
                              <Text fontWeight="600" noOfLines={1} maxW="70%">{b.block}</Text>
                              <HStack spacing={2} minW="30%">
                                <Progress value={bPct} size="xs" colorScheme="green" borderRadius="full" flex="1" />
                                <Text color="gray.500">{b.assigned ?? 0}/{b.count ?? 0}</Text>
                              </HStack>
                            </HStack>
                          );
                        })}
                      </VStack>
                    )}
                  </Box>
                );
              })}
            </SimpleGrid>
          </>
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
