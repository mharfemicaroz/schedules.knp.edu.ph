import React from 'react';
import { HStack, Select } from '@chakra-ui/react';
import { useData } from '../context/DataContext';

export default function FilterBar() {
  const { semesters, semester, setSemester, pageSize, setPageSize } = useData();
  return (
    <HStack spacing={3} wrap="wrap">
      <Select value={semester} onChange={e => setSemester(e.target.value)} maxW="180px">
        {semesters.map(s => (<option key={s} value={s}>{s}</option>))}
      </Select>
      <Select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} maxW="120px">
        {[10, 20, 50, 100].map(n => (<option key={n} value={n}>{n}/page</option>))}
      </Select>
    </HStack>
  );
}
