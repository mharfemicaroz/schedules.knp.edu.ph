import React, { useMemo } from 'react';
import { HStack, Select, Box } from '@chakra-ui/react';
import { useSelector, useDispatch } from 'react-redux';
import { setPageSize, setFacultyFilter, setDepartmentFilter, setEmploymentFilter } from '../store/dataSlice';
import FacultySelect from './FacultySelect';

export default function FilterBar() {
  const dispatch = useDispatch();
  const pageSize = useSelector(s => s.data.pageSize);
  const faculties = useSelector(s => s.data.faculties) || [];
  const department = useSelector(s => s.data.departmentFilter);
  const employment = useSelector(s => s.data.employmentFilter);
  const facultyVal = useSelector(s => s.data.facultyFilter);

  const options = useMemo(() => {
    const depts = new Set();
    const emps = new Set();
    const names = new Set();
    faculties.forEach(f => {
      const d = f.department || f.dept; if (d) depts.add(String(d));
      const e = f.employment; if (e) emps.add(String(e));
      const n = f.name || f.faculty; if (n) names.add(String(n));
    });
    return {
      departments: Array.from(depts).sort(),
      employments: Array.from(emps).sort(),
      names: Array.from(names).sort(),
    };
  }, [faculties]);

  return (
    <HStack spacing={3} wrap="wrap">
      <Box minW="220px" maxW="320px">
        <FacultySelect value={facultyVal} onChange={(val) => dispatch(setFacultyFilter(val))} allowClear placeholder="Filter: Faculty" />
      </Box>
      <Select placeholder="Department" value={department} onChange={e => dispatch(setDepartmentFilter(e.target.value))} maxW="220px">
        {options.departments.map(d => (<option key={d} value={d}>{d}</option>))}
      </Select>
      <Select placeholder="Employment" value={employment} onChange={e => dispatch(setEmploymentFilter(e.target.value))} maxW="180px">
        {options.employments.map(e => (<option key={e} value={e}>{e}</option>))}
      </Select>
      <Select value={pageSize} onChange={e => dispatch(setPageSize(Number(e.target.value)))} maxW="120px">
        {[10, 20, 50, 100].map(n => (<option key={n} value={n}>{n}/page</option>))}
      </Select>
    </HStack>
  );
}
