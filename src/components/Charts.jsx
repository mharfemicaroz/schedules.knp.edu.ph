import React, { useMemo } from 'react';
import { Box, Grid, GridItem, Heading, Text, useColorModeValue } from '@chakra-ui/react';
import { useData } from '../context/DataContext';

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

function BarByDept({ data }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const barBg = useColorModeValue('brand.100', 'whiteAlpha.200');
  const barFg = useColorModeValue('brand.600', 'brand.200');
  return (
    <Box>
      {data.map(d => (
        <Box key={d.key} mb={2}>
          <Text fontSize="sm" mb={1}>{d.key} • {d.value}</Text>
          <Box h="8px" bg={barBg} rounded="full">
            <Box h="8px" w={`${(d.value/max)*100}%`} bg={barFg} rounded="full" />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export default function Charts() {
  const { faculties } = useData();
  const { overload, total } = useMemo(() => {
    let load = 0, over = 0;
    faculties.forEach(f => { load += f.stats?.loadHours || 0; over += Math.max(0, (f.stats?.loadHours||0) - 24); });
    return { total: load, overload: over };
  }, [faculties]);

  const byDept = useMemo(() => {
    const m = new Map();
    faculties.forEach(f => {
      const key = f.department || 'N/A';
      const prev = m.get(key) || 0;
      m.set(key, prev + (f.stats?.loadHours || 0));
    });
    return Array.from(m.entries()).map(([key, value]) => ({ key, value })).sort((a,b)=>b.value-a.value).slice(0,8);
  }, [faculties]);

  return (
    <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={6}>
      <GridItem bg={useColorModeValue('white','gray.800')} borderWidth="1px" borderColor={useColorModeValue('gray.200','gray.700')} rounded="xl" p={4}>
        <Heading size="sm" mb={4}>Load vs Overload</Heading>
        <Donut value={overload} total={total} label="Overload share" />
      </GridItem>
      <GridItem bg={useColorModeValue('white','gray.800')} borderWidth="1px" borderColor={useColorModeValue('gray.200','gray.700')} rounded="xl" p={4}>
        <Heading size="sm" mb={4}>Units by Program</Heading>
        <BarByDept data={byDept} />
      </GridItem>
    </Grid>
  );
}

