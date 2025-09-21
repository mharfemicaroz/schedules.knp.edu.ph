import React from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Avatar, HStack, Text, Badge, Box, useColorModeValue, IconButton, Tooltip } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';

function FacultyRow({ f }) {
  const subtle = useColorModeValue('gray.600','gray.400');
  return (
    <Tr className="faculty-row" _hover={{ bg: useColorModeValue('gray.50','whiteAlpha.50') }} transition="all 0.2s ease" cursor="pointer">
      <Td py={{ base: 2, md: 3 }}>
        <HStack>
          <Avatar size="sm" name={f.name} />
          <Box>
            <Text fontWeight="600" noOfLines={1} maxW={{ base: '180px', sm: '240px', md: 'unset' }}>{f.name}</Text>
            <Text fontSize="sm" color={subtle} noOfLines={1} maxW={{ base: '180px', sm: '240px', md: 'unset' }}>{f.employment || '—'}</Text>
          </Box>
        </HStack>
      </Td>
      <Td py={{ base: 2, md: 3 }}>
        <HStack spacing={2}>
          <Badge colorScheme="blue" variant="subtle">Units {f.stats?.loadHours ?? 0}</Badge>
          {(() => { const rel = Number(f.loadReleaseUnits)||0; const base = Math.max(0, 24 - rel); const over = f.stats?.overloadHours ?? Math.max(0, (f.stats?.loadHours||0) - base); return over > 0; })() && (
            <Badge colorScheme="pink">Over {(() => { const rel = Number(f.loadReleaseUnits)||0; const base = Math.max(0, 24 - rel); return f.stats?.overloadHours ?? Math.max(0, (f.stats?.loadHours||0) - base); })()}</Badge>
          )}
        </HStack>
      </Td>
      <Td py={{ base: 2, md: 3 }}>{f.stats?.courseCount ?? (f.courses?.length || 0)}</Td>
      <Td isNumeric py={{ base: 1, md: 2 }}>
        <Tooltip label="View details">
          <IconButton as={RouterLink} to={`/faculty/${encodeURIComponent(f.id)}`} size="sm" variant="ghost" aria-label="View" icon={<FiChevronRight />} />
        </Tooltip>
      </Td>
    </Tr>
  );
}

export default function FacultyTable({ items }) {
  const border = useColorModeValue('gray.200','gray.700');
  return (
    <Box overflowX="auto" borderWidth="1px" borderColor={border} rounded="xl" bg={useColorModeValue('white','gray.800')}>
      <Table size={{ base: 'sm', md: 'md' }}>
        <Thead>
          <Tr>
            <Th>Faculty</Th>
            <Th>Load</Th>
            <Th>Courses</Th>
            <Th isNumeric py={{ base: 1, md: 2 }}>Action</Th>
          </Tr>
        </Thead>
        <Tbody>
          {items.map(f => <FacultyRow key={f.id} f={f} />)}
        </Tbody>
      </Table>
    </Box>
  );
}




