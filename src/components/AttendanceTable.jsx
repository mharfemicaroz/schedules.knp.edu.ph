import React from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Badge, HStack, IconButton, Tooltip, SkeletonText, useColorModeValue, Button } from '@chakra-ui/react';
import { FiTrash2, FiEdit, FiChevronUp, FiChevronDown } from 'react-icons/fi';

const statusColor = (s, mode) => {
  const v = String(s || '').toLowerCase();
  const isLight = mode === 'light';
  switch (v) {
    case 'present': return 'green';
    case 'absent': return 'red';
    case 'late': return 'orange';
    case 'excused': return 'blue';
    default: return isLight ? 'gray' : 'purple';
  }
};

export default function AttendanceTable({ items = [], loading, onEdit, onDelete, sortKey, sortOrder, onSortChange }) {
  const mode = useColorModeValue('light', 'dark');
  const activeClr = useColorModeValue('blue.600', 'blue.300');
  const idleClr = useColorModeValue('gray.600', 'gray.400');
  const headerBtn = (label, key) => {
    const active = sortKey === key;
    const Icon = active ? (sortOrder === 'asc' ? FiChevronUp : FiChevronDown) : FiChevronUp;
    return (
      <Button onClick={() => onSortChange && onSortChange(key)} variant="ghost" size="xs" px={1} py={0} rightIcon={<Icon />} color={active ? activeClr : idleClr} _hover={{ color: activeClr }}>
        {label}
      </Button>
    );
  };
  return (
    <Table size="sm" variant="striped" colorScheme={useColorModeValue('blackAlpha','whiteAlpha')}>
      <Thead>
        <Tr>
          <Th>{headerBtn('Date', 'date')}</Th>
          <Th>{headerBtn('Status', 'status')}</Th>
          <Th>{headerBtn('Course', 'course')}</Th>
          <Th>{headerBtn('Instructor', 'instructor')}</Th>
          <Th>{headerBtn('Schedule', 'schedule')}</Th>
          <Th>Remarks</Th>
          <Th>Recorded By</Th>
          <Th isNumeric>Actions</Th>
        </Tr>
      </Thead>
      <Tbody>
        {loading ? (
          [...Array(6)].map((_, i) => (
            <Tr key={i}><Td colSpan={8}><SkeletonText noOfLines={1} /></Td></Tr>
          ))
        ) : (items || []).map((r) => (
          <Tr key={r.id}>
            <Td>{r.date}</Td>
            <Td><Badge colorScheme={statusColor(r.status, mode)} textTransform="capitalize">{r.status}</Badge></Td>
            <Td>{r.schedule ? `${r.schedule.programcode} • ${r.schedule.courseName}` : '-'}</Td>
            <Td>{r.facultyName || '-'}</Td>
            <Td>{r.schedule ? `${r.schedule.day} ${r.schedule.time}` : '-'}</Td>
            <Td maxW="320px" isTruncated title={r.remarks || ''}>{r.remarks || ''}</Td>
            <Td>{r.recordedBy ? (r.recordedBy.username || r.recordedBy.email) : '-'}</Td>
            <Td isNumeric>
              <HStack spacing={1} justify="flex-end">
                <Tooltip label="Edit"><IconButton size="xs" aria-label="Edit" icon={<FiEdit />} onClick={() => onEdit && onEdit(r)} /></Tooltip>
                <Tooltip label="Delete"><IconButton size="xs" aria-label="Delete" icon={<FiTrash2 />} colorScheme="red" variant="ghost" onClick={() => onDelete && onDelete(r)} /></Tooltip>
              </HStack>
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
