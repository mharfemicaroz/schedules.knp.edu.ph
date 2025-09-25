import React from 'react';
import { HStack, Select } from '@chakra-ui/react';
import { useSelector, useDispatch } from 'react-redux';
import { selectSemesters, setSemester, setPageSize } from '../store/dataSlice';

export default function FilterBar() {
  const dispatch = useDispatch();
  const semesters = useSelector(selectSemesters);
  const semester = useSelector(s => s.data.semester);
  const pageSize = useSelector(s => s.data.pageSize);
  return (
    <HStack spacing={3} wrap="wrap">
      <Select value={semester} onChange={e => dispatch(setSemester(e.target.value))} maxW="180px">
        {semesters.map(s => (<option key={s} value={s}>{s}</option>))}
      </Select>
      <Select value={pageSize} onChange={e => dispatch(setPageSize(Number(e.target.value)))} maxW="120px">
        {[10, 20, 50, 100].map(n => (<option key={n} value={n}>{n}/page</option>))}
      </Select>
    </HStack>
  );
}
