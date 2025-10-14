import React, { useEffect, useMemo, useState } from 'react';
import { Box, Heading, HStack, VStack, Input, Select, Table, Thead, Tr, Th, Tbody, Td, Tag, TagLabel, useColorModeValue, Button, Text, Spinner, Grid, GridItem, SimpleGrid } from '@chakra-ui/react';
import apiService from '../services/apiService';
import { FiActivity, FiClock, FiUsers } from 'react-icons/fi';

function StatCard({ icon: Icon, label, value, accent='brand' }){
  const border = useColorModeValue('gray.200','gray.700');
  const bg = useColorModeValue('white','gray.800');
  return (
    <Box borderWidth="1px" borderColor={border} bg={bg} rounded="xl" p={4}>
      <HStack justify="space-between">
        <VStack align="start" spacing={0}>
          <Text fontSize="sm" color={useColorModeValue('gray.600','gray.400')}>{label}</Text>
          <Heading size="md">{value}</Heading>
        </VStack>
        <Icon />
      </HStack>
    </Box>
  );
}

export default function AdminGuestLogs(){
  const border = useColorModeValue('gray.200','gray.700');
  const panelBg = useColorModeValue('white','gray.800');
  const muted = useColorModeValue('gray.600','gray.300');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ total: 0, uniqueIps: 0, byRole: [] });
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => { (async () => {
    try{
      setLoading(true); setError(null);
      const [list, s] = await Promise.all([
        apiService.listGuests({ limit: 10000 }),
        apiService.getGuestStats(),
      ]);
      const arr = Array.isArray(list) ? list : (Array.isArray(list?.data) ? list.data : []);
      setRows(arr);
      setStats(s || { total: 0, uniqueIps: 0, byRole: [] });
    } catch(e){ setError(e.message || 'Failed to load guest logs'); }
    finally{ setLoading(false); }
  })(); }, []);

  const filtered = useMemo(() => {
    const norm = (s) => String(s||'').toLowerCase();
    const ql = norm(q);
    return (rows||[]).filter(g => {
      if (role && norm(g.role) !== norm(role)) return false;
      if (!ql) return true;
      const hay = [g.name, g.ip, g.role].map(norm).join(' ');
      return hay.includes(ql);
    }).sort((a,b)=> (new Date(b.dateLastAccessed||b.date_last_accessed||0)) - (new Date(a.dateLastAccessed||a.date_last_accessed||0)));
  }, [rows, q, role]);

  const paged = filtered.slice((page-1)*pageSize, (page-1)*pageSize + pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));

  if (loading) return (<VStack align="center" py={12}><Spinner/><Text>Loading guest logs…</Text></VStack>);
  if (error) return (<VStack align="center" py={12}><Text color="red.500">{error}</Text></VStack>);

  return (
    <VStack align="stretch" spacing={6}>
      <HStack justify="space-between" flexWrap="wrap" gap={3}>
        <HStack>
          <Heading size="md">Admin: Guest Logs</Heading>
          <Tag colorScheme="blue"><TagLabel>{filtered.length} records</TagLabel></Tag>
        </HStack>
        <HStack>
          <Input placeholder="Search by name, IP, role" value={q} onChange={(e)=>{ setQ(e.target.value); setPage(1); }} maxW="320px" />
          <Select placeholder="Role" value={role} onChange={(e)=>{ setRole(e.target.value); setPage(1); }} maxW="180px">
            {['student','faculty','admin','others'].map(r => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Select size="sm" value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value)||15); setPage(1); }} maxW="110px">
            {[10,15,20,30,50].map(n => <option key={n} value={n}>{n}/page</option>)}
          </Select>
        </HStack>
      </HStack>

      <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4}>
        <GridItem><StatCard icon={FiUsers} label="Total Guests" value={stats.total || 0} /></GridItem>
        <GridItem><StatCard icon={FiActivity} label="Unique IPs" value={stats.uniqueIps || 0} /></GridItem>
        <GridItem><StatCard icon={FiClock} label="Roles Tracked" value={(stats.byRole||[]).length} /></GridItem>
      </Grid>

      {/* Mobile cards view */}
      <Box display={{ base: 'block', md: 'none' }}>
        <VStack align="stretch" spacing={3}>
          {paged.map(g => (
            <Box key={g.id} borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} p={4}>
              <VStack align="stretch" spacing={3}>
                <Text fontWeight="800" fontSize="md" noOfLines={2}>{g.name || '-'}</Text>
                <SimpleGrid columns={2} spacing={3}>
                  <Box>
                    <Text fontSize="xs" color={muted}>Role</Text>
                    <Tag size="sm" colorScheme="purple"><TagLabel>{g.role || '-'}</TagLabel></Tag>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>IP</Text>
                    <Text>{g.ip}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Route</Text>
                    <Text>{g.lastVisitedPage || g.last_visited_page || '-'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>First Access</Text>
                    <Text>{g.dateFirstAccessed ? new Date(g.dateFirstAccessed).toLocaleString() : (g.date_first_accessed ? new Date(g.date_first_accessed).toLocaleString() : '-')}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Last Access</Text>
                    <Text>{g.dateLastAccessed ? new Date(g.dateLastAccessed).toLocaleString() : (g.date_last_accessed ? new Date(g.date_last_accessed).toLocaleString() : '-')}</Text>
                  </Box>
                </SimpleGrid>
              </VStack>
            </Box>
          ))}
        </VStack>
      </Box>

      <Box borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} overflowX="auto" display={{ base: 'none', md: 'block' }}>
        <Table size={{ base: 'sm', md: 'md' }}>
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>IP</Th>
              <Th>Route</Th>
              <Th>First Access</Th>
              <Th>Last Access</Th>
            </Tr>
          </Thead>
          <Tbody>
            {paged.map(g => (
              <Tr key={g.id}>
                <Td>{g.name}</Td>
                <Td><Tag size="sm" colorScheme="purple"><TagLabel>{g.role || '-'}</TagLabel></Tag></Td>
                <Td>{g.ip}</Td>
                <Td>{g.lastVisitedPage || g.last_visited_page || '-'}</Td>
                <Td>{g.dateFirstAccessed ? new Date(g.dateFirstAccessed).toLocaleString() : (g.date_first_accessed ? new Date(g.date_first_accessed).toLocaleString() : '-')}</Td>
                <Td>{g.dateLastAccessed ? new Date(g.dateLastAccessed).toLocaleString() : (g.date_last_accessed ? new Date(g.date_last_accessed).toLocaleString() : '-')}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <HStack justify="space-between">
        <Text fontSize="sm" color="gray.500">Page {page} / {pageCount}</Text>
        <HStack>
          <Button size="sm" onClick={()=>setPage(p=>Math.max(1,p-1))} isDisabled={page<=1}>Prev</Button>
          <Button size="sm" onClick={()=>setPage(p=>Math.min(pageCount,p+1))} isDisabled={page>=pageCount}>Next</Button>
        </HStack>
      </HStack>
    </VStack>
  );
}
