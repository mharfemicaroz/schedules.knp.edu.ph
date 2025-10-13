import React, { useMemo } from 'react';
import { Box, Heading, SimpleGrid, useColorModeValue, IconButton, Tooltip, HStack, Text, Badge, VStack, Button } from '@chakra-ui/react';
import { useSelector } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
import { getProgramColor } from '../utils/programColors';
import { Link as RouterLink } from 'react-router-dom';
import { FiChevronRight, FiShare2 } from 'react-icons/fi';
import { usePublicView } from '../utils/uiFlags';
import { encodeShareDepartment } from '../utils/share';

function canonFacultyKey(id, name) {
  if (id != null) return String(id);
  const n = String(name || '').trim().toUpperCase();
  const base = n.split(',')[0];
  return base.replace(/\s+/g, ' ');
}

export default function ViewsDepartments() {
  const allCourses = useSelector(selectAllCourses);
  const isPublic = usePublicView();
  const authUser = useSelector(s => s.auth.user);
  const isAdmin = !!authUser && (String(authUser.role).toLowerCase() === 'admin' || String(authUser.role).toLowerCase() === 'manager');
  const border = useColorModeValue('gray.200','gray.700');
  const cardBg = useColorModeValue('white','gray.800');
  const subtle = useColorModeValue('gray.600','gray.400');

  const rows = useMemo(() => {
    const m = new Map();
    allCourses.forEach(c => {
      const key = c.program || 'N/A';
      const e = m.get(key) || { department: key, courses: 0, facultyKeys: new Set(), blockKeys: new Set() };
      e.courses += 1;
      e.facultyKeys.add(canonFacultyKey(c.facultyId, c.facultyName));
      const yl = c.yearlevel || 'N/A';
      const blk = c.section || c.block || 'N/A';
      e.blockKeys.add(`${yl}||${blk}`);
      m.set(key, e);
    });
    return Array.from(m.values())
      .map(e => ({ department: e.department, blocks: e.blockKeys.size, courses: e.courses, facultyCount: e.facultyKeys.size }))
      .sort((a,b)=>a.department.localeCompare(b.department));
  }, [allCourses]);

  function Card({ item }) {
    const accent = getProgramColor(item.department);
    return (
      <Box
        as={RouterLink}
        to={isPublic ? `/share/departments/${encodeURIComponent(encodeShareDepartment(item.department))}` : `/views/departments/${encodeURIComponent(item.department)}`}
        className="view-card"
        bg={cardBg}
        borderWidth="1px"
        borderColor={border}
        rounded="xl"
        p={4}
        position="relative"
        transition="transform 0.18s ease, box-shadow 0.18s ease"
        cursor="pointer"
        _hover={{ textDecoration: 'none' }}
      >
        <Box position="absolute" top={0} left={0} right={0} h="4px" bg={accent.bar} roundedTop="xl" />
        <VStack align="start" spacing={3}>
          <HStack justify="space-between" w="full">
            <HStack spacing={2}>
              <Badge colorScheme={accent.scheme} variant="subtle">Program</Badge>
              <Text fontWeight="800">{item.department}</Text>
            </HStack>
            <Tooltip label="View loads">
              <IconButton aria-label="View" icon={<FiChevronRight />} size="sm" variant="ghost" onClick={(e)=>e.stopPropagation()} />
            </Tooltip>
          </HStack>
          <HStack spacing={4}>
            <Stat label="Faculty" value={item.facultyCount} />
            <Stat label="Blocks" value={item.blocks} />
            <Stat label="Courses" value={item.courses} />
          </HStack>
          <Text fontSize="sm" color={subtle}>Click view to see Year Levels → Blocks ordered by term and time.</Text>
        </VStack>
      </Box>
    );
  }

  function Stat({ label, value }) {
    return (
      <Box>
        <Text fontSize="xs" color={subtle}>{label}</Text>
        <Text fontWeight="700" fontSize="lg">{value}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Faculty Load by Program</Heading>
        {isAdmin && !isPublic && (
          <Button as={RouterLink} to="/share/departments" leftIcon={<FiShare2 />} size="sm" colorScheme="blue">Share</Button>
        )}
      </HStack>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={4}>
        <Box bg={cardBg} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
          <Text fontSize="xs" color={subtle}>Programs</Text>
          <Text fontWeight="800" fontSize="xl">{rows.length}</Text>
        </Box>
        <Box bg={cardBg} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
          <Text fontSize="xs" color={subtle}>Unique Faculty</Text>
          <Text fontWeight="800" fontSize="xl">{rows.reduce((s, r) => s + (r.facultyCount || 0), 0)}</Text>
        </Box>
        <Box bg={cardBg} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
          <Text fontSize="xs" color={subtle}>Total Blocks</Text>
          <Text fontWeight="800" fontSize="xl">{rows.reduce((s, r) => s + (r.blocks || 0), 0)}</Text>
        </Box>
        <Box bg={cardBg} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
          <Text fontSize="xs" color={subtle}>Courses</Text>
          <Text fontWeight="800" fontSize="xl">{rows.reduce((s, r) => s + (r.courses || 0), 0)}</Text>
        </Box>
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={4}>
        {rows.map(r => (
          <Card key={r.department} item={r} />
        ))}
      </SimpleGrid>
    </Box>
  );
}
