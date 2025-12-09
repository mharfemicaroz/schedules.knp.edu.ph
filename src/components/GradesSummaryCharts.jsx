import React from 'react';
import {
  Box,
  HStack,
  VStack,
  SimpleGrid,
  Heading,
  Text,
  Badge,
  Progress,
  useColorModeValue,
  Stack,
  Divider,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';

const parseDateSafe = (val) => {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const donutColors = ['#2563EB', '#38B2AC', '#F6AD55', '#E53E3E', '#805AD5', '#2F855A'];

function DonutChart({ data = [], size = 180, thickness = 22, title }) {
  const total = data.reduce((acc, it) => acc + (it.value || 0), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const track = useColorModeValue('#E2E8F0', '#2D3748');
  const textColor = useColorModeValue('gray.800', 'gray.100');
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
              const val = d.value || 0;
              const pct = total > 0 ? val / total : 0;
              const dash = `${pct * circumference} ${circumference}`;
              const rot = (offset / total) * 360;
              offset += val;
              return (
                <circle
                  key={idx}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={donutColors[idx % donutColors.length]}
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
        <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" pointerEvents="none">
          <Heading size="md" color={textColor}>{total || 0}</Heading>
          <Text fontSize="xs" color="gray.500">Total</Text>
        </Box>
      </Box>
      <Text fontWeight="600" mt={2}>{title}</Text>
    </Box>
  );
}

function StatCard({ label, value, helper, tone = 'blue' }) {
  const bg = useColorModeValue(`${tone}.50`, 'gray.900');
  const border = useColorModeValue(`${tone}.200`, 'gray.700');
  const text = useColorModeValue(`${tone}.700`, `${tone}.200`);
  return (
    <Box borderWidth="1px" borderColor={border} rounded="xl" p={4} bg={bg} boxShadow="sm">
      <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.08em" color="gray.500" mb={1}>{label}</Text>
      <Heading size="lg" color={text}>{value}</Heading>
      {helper && <Text fontSize="sm" color="gray.600" mt={1}>{helper}</Text>}
    </Box>
  );
}

function DeptProgressList({ items }) {
  const barBg = useColorModeValue('gray.100', 'gray.700');
  return (
    <VStack align="stretch" spacing={3}>
      {items.map((d) => {
        const pct = d.total > 0 ? Math.round((d.submitted / d.total) * 100) : 0;
        const tone = pct >= 90 ? 'green' : pct >= 70 ? 'blue' : pct >= 40 ? 'orange' : 'red';
        return (
          <Box key={d.key} borderWidth="1px" borderColor={useColorModeValue('gray.200','gray.700')} rounded="lg" p={3} bg={useColorModeValue('white', 'gray.800')}>
            <HStack justify="space-between" mb={1} align="center">
              <Text fontWeight="600">{d.label}</Text>
              <Badge colorScheme={tone}>{d.submitted}/{d.total} ({pct}%)</Badge>
            </HStack>
            <Progress value={pct} size="sm" rounded="full" bg={barBg} colorScheme={tone} />
          </Box>
        );
      })}
    </VStack>
  );
}

export default function GradesSummaryCharts({ courses = [], facultyList = [] }) {
  const surface = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');

  const profileMap = React.useMemo(() => {
    const map = new Map();
    facultyList.forEach((f) => {
      const keyName = normalize(f.name || f.faculty);
      if (keyName) map.set(keyName, f);
      if (f.id != null) map.set(String(f.id), f);
    });
    return map;
  }, [facultyList]);

  const stats = React.useMemo(() => {
    const deptAgg = new Map();
    const empAgg = new Map();
    let submitted = 0;
    let total = 0;

    const ensure = (map, key) => {
      if (!map.has(key)) map.set(key, { submitted: 0, total: 0 });
      return map.get(key);
    };

    (courses || []).forEach((c) => {
      const facKey = c.facultyId != null ? String(c.facultyId) : normalize(c.facultyName || c.faculty || '');
      const prof = profileMap.get(facKey);
      const dept = (prof?.dept ?? prof?.department ?? c.dept ?? 'Unspecified') || 'Unspecified';
      const employment = (prof?.employment || 'Unspecified') || 'Unspecified';
      const has = !!parseDateSafe(c.gradesSubmitted);

      ensure(deptAgg, dept).total += 1;
      ensure(empAgg, employment).total += 1;
      total += 1;

      if (has) {
        ensure(deptAgg, dept).submitted += 1;
        ensure(empAgg, employment).submitted += 1;
        submitted += 1;
      }
    });

    const deptList = Array.from(deptAgg.entries()).map(([key, v]) => ({
      key,
      label: key,
      submitted: v.submitted,
      total: v.total,
    })).sort((a, b) => {
      const pa = a.total ? a.submitted / a.total : 0;
      const pb = b.total ? b.submitted / b.total : 0;
      return pb - pa;
    });

    const empList = Array.from(empAgg.entries()).map(([label, v]) => ({
      label,
      value: v.submitted,
      pending: Math.max(v.total - v.submitted, 0),
      total: v.total,
    }));

    const termAgg = new Map();
    (courses || []).forEach((c) => {
      const t = String(c.term || 'N/A');
      if (!termAgg.has(t)) termAgg.set(t, { submitted: 0, total: 0 });
      const has = !!parseDateSafe(c.gradesSubmitted);
      termAgg.get(t).total += 1;
      if (has) termAgg.get(t).submitted += 1;
    });
    const termList = Array.from(termAgg.entries()).map(([term, v]) => ({
      term,
      submitted: v.submitted,
      total: v.total,
      pct: v.total ? Math.round((v.submitted / v.total) * 100) : 0,
    })).sort((a, b) => a.term.localeCompare(b.term));

    return { deptList, empList, termList, submitted, total };
  }, [courses, profileMap]);

  if (!courses || courses.length === 0) {
    return (
      <Box borderWidth="1px" borderColor={border} rounded="xl" p={6} bg={surface}>
        <Heading size="sm">No schedules</Heading>
        <Text mt={2} color="gray.500">Grades summary will appear once schedules are loaded.</Text>
      </Box>
    );
  }

  const pctOverall = stats.total > 0 ? Math.round((stats.submitted / stats.total) * 100) : 0;
  const pieData = stats.empList.map((e, idx) => ({ ...e, color: donutColors[idx % donutColors.length] }));

  return (
    <VStack align="stretch" spacing={4}>
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
        <StatCard label="Overall submitted" value={`${stats.submitted}/${stats.total}`} helper={`${pctOverall}% submitted`} tone="green" />
        <StatCard label="Pending submissions" value={Math.max(stats.total - stats.submitted, 0)} helper="Courses without grades submitted" tone="orange" />
        <StatCard label="Departments" value={stats.deptList.length} helper="Based on faculty profile departments" tone="blue" />
      </SimpleGrid>

      <Box borderWidth="1px" borderColor={border} rounded="xl" p={4} bg={surface} boxShadow="sm">
        <Heading size="sm" mb={3}>By term</Heading>
        <VStack align="stretch" spacing={3}>
          {stats.termList.map((t) => {
            const tone = t.pct >= 90 ? 'green' : t.pct >= 70 ? 'blue' : t.pct >= 40 ? 'orange' : 'red';
            return (
              <Box key={t.term} borderWidth="1px" borderColor={border} rounded="lg" p={3}>
                <HStack justify="space-between" mb={1}>
                  <Text fontWeight="600">{t.term}</Text>
                  <Badge colorScheme={tone}>{t.submitted}/{t.total} ({t.pct}%)</Badge>
                </HStack>
                <Progress value={t.pct} size="sm" rounded="full" colorScheme={tone} />
              </Box>
            );
          })}
        </VStack>
      </Box>

      <Box borderWidth="1px" borderColor={border} rounded="xl" p={4} bg={surface} boxShadow="sm">
        <HStack justify="space-between" mb={3} align="center">
          <Heading size="sm">Submission by department</Heading>
          <Badge colorScheme="blue" variant="subtle">{stats.deptList.length} dept</Badge>
        </HStack>
        <DeptProgressList items={stats.deptList} />
      </Box>

      <Box borderWidth="1px" borderColor={border} rounded="xl" p={4} bg={surface} boxShadow="sm">
        <Heading size="sm" mb={3}>Submission mix by employment</Heading>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          {['full', 'part'].map((kind) => {
            const match = stats.empList.find(e => normalize(e.label).includes(kind));
            const label = kind === 'full' ? 'Full-time' : 'Part-time';
            const submitted = match?.value || 0;
            const pending = match?.pending || 0;
            const total = match?.total || submitted + pending;
            return (
              <Box key={kind} borderWidth="1px" borderColor={border} rounded="lg" p={4} bg={useColorModeValue('white','gray.900')} boxShadow="sm">
                <Heading size="sm" mb={3}>{label}</Heading>
                <Stack direction={{ base: 'column', sm: 'row' }} spacing={6} align="center">
                  <DonutChart
                    size={200}
                    thickness={18}
                    title={`${submitted}/${total} submitted`}
                    data={[
                      { label: 'Submitted', value: submitted },
                      { label: 'Pending', value: pending },
                    ]}
                  />
                  <VStack align="start" spacing={2} fontSize="sm" minW="160px">
                    <HStack>
                      <Box w="10px" h="10px" bg={donutColors[0]} rounded="full" />
                      <Text>Submitted {submitted}</Text>
                    </HStack>
                    <HStack>
                      <Box w="10px" h="10px" bg={donutColors[1]} rounded="full" />
                      <Text>Pending {pending}</Text>
                    </HStack>
                    <Text color="gray.500">Total {total}</Text>
                  </VStack>
                </Stack>
              </Box>
            );
          })}
        </SimpleGrid>
      </Box>

      <Divider />
    </VStack>
  );
}
