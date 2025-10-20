import React from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Badge, HStack, IconButton, Tooltip, SkeletonText, useColorModeValue } from '@chakra-ui/react';
import { FiTrash2, FiEdit } from 'react-icons/fi';

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

export default function AttendanceTable({ items = [], loading, onEdit, onDelete }) {
  const mode = useColorModeValue('light', 'dark');
  return (
    <Table size="sm" variant="striped" colorScheme={useColorModeValue('blackAlpha','whiteAlpha')}>
      <Thead>
        <Tr>
          <Th>Date</Th>
          <Th>Status</Th>
          <Th>Course</Th>
          <Th>Instructor</Th>
          <Th>Schedule</Th>
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
            <Td>{r.schedule?.instructor || '-'}</Td>
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

