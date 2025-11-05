import React, { useMemo } from 'react';
import { Box, Grid, GridItem, Heading, Text, useColorModeValue } from '@chakra-ui/react';

function Donut({ value, total, label }) {
  const size = 140;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  const dash = `${pct * c} ${c}`;
  const track = useColorModeValue('#EDF2F7', '#2D3748');
  const accent = useColorModeValue('#339af0', '#74c0fc');
  return (
    <Box display="flex" alignItems="center" justifyContent="center" flexDir="column">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size/2} ${size/2})`}>
          <circle cx={size/2} cy={size/2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
          <circle cx={size/2} cy={size/2} r={r} stroke={accent} strokeWidth={stroke} fill="none" strokeDasharray={dash} strokeLinecap="round" />
        </g>
      </svg>
      <Heading size="md" mt={-12}>{Math.round(pct*100)}%</Heading>
      <Text fontSize="sm" color="gray.500">{label}</Text>
    </Box>
  );
}

function Bar({ data, title }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const barBg = useColorModeValue('brand.100', 'whiteAlpha.200');
  const barFg = useColorModeValue('brand.600', 'brand.200');
  return (
    <Box>
      <Heading size="sm" mb={4}>{title}</Heading>
      {data.map(d => (
        <Box key={d.key} mb={2}>
          <Text fontSize="sm" mb={1}>{d.key} – {d.value}</Text>
          <Box h="8px" bg={barBg} rounded="full">
            <Box h="8px" w={`${(d.value/max)*100}%`} bg={barFg} rounded="full" />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export default function ChartsCourses({ courses }) {
  const { assigned, total } = useMemo(() => {
    const isUnknown = (s) => /^(unknown|unassigned|n\/?a|none|no\s*faculty|not\s*assigned|tba|\-)?$/i.test(String(s||'').trim());
    let assignedCount = 0;
    (courses || []).forEach(c => {
      const hasId = c.facultyId != null || c.faculty_id != null;
      const name = c.facultyName || c.faculty || c.instructor;
      if (hasId || (name && !isUnknown(name))) assignedCount += 1;
    });
    return { assigned: assignedCount, total: (courses || []).length };
  }, [courses]);

  const byProgramUnits = useMemo(() => {
    const m = new Map();
    (courses || []).forEach(c => {
      const key = String(c.program || c.programcode || 'N/A');
      const prev = m.get(key) || 0;
      m.set(key, prev + (Number(c.unit ?? c.hours ?? 0) || 0));
    });
    return Array.from(m.entries()).map(([key, value]) => ({ key, value })).sort((a,b)=>b.value-a.value).slice(0, 10);
  }, [courses]);

  const byTermCourses = useMemo(() => {
    const m = new Map();
    (courses || []).forEach(c => {
      const key = String(c.term || 'N/A');
      m.set(key, (m.get(key) || 0) + 1);
    });
    return Array.from(m.entries()).map(([key, value]) => ({ key, value })).sort((a,b)=>b.value-a.value);
  }, [courses]);

  return (
    <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={6}>
      <GridItem bg={useColorModeValue('white','gray.800')} borderWidth="1px" borderColor={useColorModeValue('gray.200','gray.700')} rounded="xl" p={4}>
        <Heading size="sm" mb={4}>Assigned vs Total Courses</Heading>
        <Donut value={assigned} total={total} label="Assigned share" />
      </GridItem>
      <GridItem bg={useColorModeValue('white','gray.800')} borderWidth="1px" borderColor={useColorModeValue('gray.200','gray.700')} rounded="xl" p={4}>
        <Bar title="Units by Program" data={byProgramUnits} />
      </GridItem>
      <GridItem bg={useColorModeValue('white','gray.800')} borderWidth="1px" borderColor={useColorModeValue('gray.200','gray.700')} rounded="xl" p={4}>
        <Bar title="Courses by Term" data={byTermCourses} />
      </GridItem>
    </Grid>
  );
}
