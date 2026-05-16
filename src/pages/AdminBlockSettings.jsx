import React from 'react';
import { Box, Heading, HStack, VStack, Button, Input, FormControl, FormLabel, Select, Table, Thead, Tr, Th, Tbody, Td, IconButton, useDisclosure, useColorModeValue, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, Text, Tag, Wrap, WrapItem, SimpleGrid, Badge, Divider, InputGroup, InputLeftElement, useToast } from '@chakra-ui/react';
import { useDispatch, useSelector } from 'react-redux';
import { loadBlocksThunk, createBlockThunk, updateBlockThunk, deleteBlockThunk } from '../store/blockThunks';
import { selectBlocks, setBlockFilters, selectBlockPage, selectBlockPageSize, selectBlockFilters, setBlockPage, setBlockPageSize } from '../store/blockSlice';
import BlockFormModal from '../components/BlockFormModal';
import { FiPlus, FiRefreshCw, FiEdit, FiTrash, FiSearch, FiLayers } from 'react-icons/fi';
import Pagination from '../components/Pagination';
import { getBlockSearchText, parseBlockMeta } from '../utils/blockMeta';

export default function AdminBlockSettings() {
  const dispatch = useDispatch();
  const toast = useToast();
  const allBlocks = useSelector(selectBlocks);
  const loading = useSelector(s => s.blocks.loading);
  const filters = useSelector(selectBlockFilters);
  const page = useSelector(selectBlockPage);
  const pageSize = useSelector(selectBlockPageSize);
  const [q, setQ] = React.useState(filters.blockCode || '');
  const [program, setProgram] = React.useState(filters.program || '');
  const [yearlevel, setYearlevel] = React.useState(filters.yearlevel || '');
  const [room, setRoom] = React.useState(filters.room || '');
  const [session, setSession] = React.useState(filters.session || '');
  const [f2f, setF2f] = React.useState(filters.f2fSched || '');
  const [active, setActive] = React.useState(filters.active || '');
  const [selected, setSelected] = React.useState(null);
  const editDisc = useDisclosure();
  const delDisc = useDisclosure();
  const cancelRef = React.useRef();
  const border = useColorModeValue('gray.200','gray.700');
  const tableBg = useColorModeValue('white','gray.800');
  const muted = useColorModeValue('gray.600','gray.300');
  const panelBg = useColorModeValue('gray.50', 'whiteAlpha.80');
  const statBg = useColorModeValue('white', 'gray.900');
  const searchValue = React.useDeferredValue(q);

  React.useEffect(() => { dispatch(loadBlocksThunk({})); }, [dispatch]);

  React.useEffect(() => {
    dispatch(setBlockFilters({ blockCode: q, program, yearlevel, room, session, f2fSched: f2f, active }));
  }, [active, dispatch, f2f, program, q, room, session, yearlevel]);

  const resetFilters = () => {
    setQ('');
    setProgram('');
    setYearlevel('');
    setRoom('');
    setSession('');
    setF2f('');
    setActive('');
  };

  const onCreate = () => { setSelected(null); editDisc.onOpen(); };

  const onSubmit = async (form) => {
    try {
      const normList = (s) => Array.from(new Set(String(s || '').split(',').map(x => x.trim()).filter(Boolean))).join(', ');
      const payload = { ...form, room: normList(form.room), f2fSched: normList(form.f2fSched), examDay: normList(form.examDay), examSession: normList(form.examSession), examRoom: normList(form.examRoom) };
      if (selected?.id) {
        await dispatch(updateBlockThunk({ id: selected.id, changes: payload }));
      } else {
        await dispatch(createBlockThunk(payload));
      }
      editDisc.onClose(); setSelected(null);
      dispatch(loadBlocksThunk({}));
    } catch {}
  };

  const confirmDelete = async () => {
    if (!selected) return;
    try {
      await dispatch(deleteBlockThunk(selected.id));
      delDisc.onClose(); setSelected(null);
      dispatch(loadBlocksThunk({}));
    } catch {}
  };

  const toggleBlockStatus = async (block) => {
    if (!block?.id) return;
    const nextActive = !block._isActive;
    try {
      await dispatch(updateBlockThunk({
        id: block.id,
        changes: { isActive: nextActive, is_active: nextActive },
      })).unwrap();
      toast({
        status: 'success',
        title: nextActive ? 'Block activated' : 'Block deactivated',
        description: `${block.blockCode || block.block_code || 'Block'} is now ${nextActive ? 'active' : 'inactive'}.`,
      });
      dispatch(loadBlocksThunk({}));
    } catch (e) {
      toast({
        status: 'error',
        title: 'Status update failed',
        description: e?.message || 'Unable to update block status.',
      });
    }
  };

  const chips = (s) => String(s || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);

  const enrichedBlocks = React.useMemo(() => {
    const items = Array.isArray(allBlocks) ? allBlocks : [];
    return items
      .map((block) => {
        const meta = parseBlockMeta(block.blockCode || block.block_code || '');
        const programcode = String(block.programcode || block.program || meta.programcode || '').trim().toUpperCase();
        const parsedYear = String(block.yearlevel || meta.yearlevel || '').match(/(\d+)/)?.[1] || '';
        return {
          ...block,
          _meta: {
            ...meta,
            programcode: programcode || meta.programcode,
            yearlevel: parsedYear || meta.yearlevel,
          },
          _isActive: typeof block.isActive === 'boolean' ? block.isActive : !!block.is_active,
          _search: getBlockSearchText(block),
        };
      })
      .sort((a, b) => String(a.blockCode || a.block_code || '').localeCompare(String(b.blockCode || b.block_code || '')));
  }, [allBlocks]);

  const programOptions = React.useMemo(() => Array.from(new Set(
    enrichedBlocks.map((block) => block._meta.programcode).filter(Boolean),
  )).sort((a, b) => a.localeCompare(b)), [enrichedBlocks]);

  const yearOptions = React.useMemo(() => Array.from(new Set(
    enrichedBlocks.map((block) => String(block._meta.yearlevel || '')).filter(Boolean),
  )).sort((a, b) => Number(a) - Number(b)), [enrichedBlocks]);

  const filteredBlocks = React.useMemo(() => {
    const search = String(searchValue || '').trim().toLowerCase();
    const roomNeedle = String(room || '').trim().toLowerCase();
    const sessionNeedle = String(session || '').trim().toLowerCase();
    const f2fNeedle = String(f2f || '').trim().toLowerCase();
    const yearNeedle = String(yearlevel || '').trim();

    return enrichedBlocks.filter((block) => {
      if (search && !block._search.includes(search)) return false;
      if (program && block._meta.programcode !== String(program).toUpperCase()) return false;
      if (yearNeedle && String(block._meta.yearlevel || '') !== yearNeedle) return false;
      if (roomNeedle && !String(block.room || '').toLowerCase().includes(roomNeedle)) return false;
      if (sessionNeedle && !String(block.session || '').toLowerCase().includes(sessionNeedle)) return false;
      if (f2fNeedle && !String(block.f2fSched || '').toLowerCase().includes(f2fNeedle)) return false;
      if (active === 'true' && !block._isActive) return false;
      if (active === 'false' && block._isActive) return false;
      return true;
    });
  }, [active, enrichedBlocks, f2f, program, room, searchValue, session, yearlevel]);

  const pageCount = React.useMemo(
    () => Math.max(1, Math.ceil((filteredBlocks.length || 0) / pageSize)),
    [filteredBlocks.length, pageSize],
  );

  React.useEffect(() => {
    if (page > pageCount) {
      dispatch(setBlockPage(pageCount));
    }
  }, [dispatch, page, pageCount]);

  const blocks = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredBlocks.slice(start, start + pageSize);
  }, [filteredBlocks, page, pageSize]);

  const stats = React.useMemo(() => {
    const activeCount = filteredBlocks.filter((block) => block._isActive).length;
    return {
      total: enrichedBlocks.length,
      visible: filteredBlocks.length,
      active: activeCount,
      programs: new Set(filteredBlocks.map((block) => block._meta.programcode).filter(Boolean)).size,
    };
  }, [enrichedBlocks.length, filteredBlocks]);

  return (
    <Box px={{ base: 2, md: 4 }} py={4}>
      <HStack justify="space-between" align="center" mb={4}>
        <VStack align="start" spacing={1}>
          <Heading size="md">Block Settings</Heading>
          <Text fontSize="sm" color={muted}>
            Program and year filters now understand block codes like <b>BSAB-2-3</b> and <b>BSED-MATH 3-2</b>.
          </Text>
        </VStack>
        <HStack>
          <Button leftIcon={<FiRefreshCw />} variant="outline" onClick={() => dispatch(loadBlocksThunk({}))} isLoading={loading}>Refresh</Button>
          <Button leftIcon={<FiPlus />} colorScheme="blue" onClick={onCreate}>Add Block</Button>
        </HStack>
      </HStack>

      <SimpleGrid columns={{ base: 2, lg: 4 }} spacing={3} mb={4}>
        <Box borderWidth="1px" borderColor={border} rounded="xl" bg={statBg} p={4}>
          <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.08em" color={muted}>Showing</Text>
          <Text fontSize="2xl" fontWeight="800">{stats.visible}</Text>
          <Text fontSize="sm" color={muted}>of {stats.total} blocks</Text>
        </Box>
        <Box borderWidth="1px" borderColor={border} rounded="xl" bg={statBg} p={4}>
          <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.08em" color={muted}>Active</Text>
          <Text fontSize="2xl" fontWeight="800">{stats.active}</Text>
          <Text fontSize="sm" color={muted}>currently enabled</Text>
        </Box>
        <Box borderWidth="1px" borderColor={border} rounded="xl" bg={statBg} p={4}>
          <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.08em" color={muted}>Programs</Text>
          <Text fontSize="2xl" fontWeight="800">{stats.programs}</Text>
          <Text fontSize="sm" color={muted}>in current result set</Text>
        </Box>
        <Box borderWidth="1px" borderColor={border} rounded="xl" bg={statBg} p={4}>
          <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.08em" color={muted}>Page Size</Text>
          <Text fontSize="2xl" fontWeight="800">{pageSize}</Text>
          <Text fontSize="sm" color={muted}>rows at a time</Text>
        </Box>
      </SimpleGrid>

      <Box borderWidth="1px" borderColor={border} rounded="2xl" p={4} mb={4} bg={panelBg}>
        <VStack align="stretch" spacing={3}>
          <HStack justify="space-between" align="start" spacing={3} flexWrap="wrap">
            <VStack align="start" spacing={1}>
              <HStack spacing={2}>
                <FiLayers />
                <Text fontWeight="700">Filter Blocks</Text>
              </HStack>
              <Text fontSize="sm" color={muted}>
                Search by block code, program, major, room, or exam details.
              </Text>
            </VStack>
            <HStack spacing={2}>
              <Badge colorScheme="blue" variant="subtle">{stats.visible} result{stats.visible === 1 ? '' : 's'}</Badge>
              {program ? <Badge colorScheme="purple" variant="subtle">{program}</Badge> : null}
              {yearlevel ? <Badge colorScheme="orange" variant="subtle">Year {yearlevel}</Badge> : null}
            </HStack>
          </HStack>
          <Divider />
          <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={3}>
            <FormControl>
              <FormLabel>Search</FormLabel>
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <FiSearch color="currentColor" />
                </InputLeftElement>
                <Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="e.g., BSED-MATH, BSAB-2-3, NB201" />
              </InputGroup>
            </FormControl>
            <FormControl>
              <FormLabel>Program</FormLabel>
              <Select value={program} onChange={(e)=>setProgram(e.target.value)}>
                <option value="">All programs</option>
                {programOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel>Year Level</FormLabel>
              <Select value={yearlevel} onChange={(e)=>setYearlevel(e.target.value)}>
                <option value="">All year levels</option>
                {yearOptions.map((item) => <option key={item} value={item}>Year {item}</option>)}
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel>Room</FormLabel>
              <Input value={room} onChange={(e)=>setRoom(e.target.value)} placeholder="NB201" />
            </FormControl>
            <FormControl>
              <FormLabel>Session</FormLabel>
              <Input value={session} onChange={(e)=>setSession(e.target.value)} placeholder="Morning" />
            </FormControl>
            <FormControl>
              <FormLabel>F2F Schedule</FormLabel>
              <Input value={f2f} onChange={(e)=>setF2f(e.target.value)} placeholder="Mon, Fri" />
            </FormControl>
            <FormControl maxW={{ base: '100%', md: '180px' }}>
              <FormLabel>Status</FormLabel>
              <Select value={active} onChange={(e)=>setActive(e.target.value)}>
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            </FormControl>
          </SimpleGrid>
          <HStack justify="space-between" flexWrap="wrap">
            <Text fontSize="sm" color={muted}>
              Parsed example: <b>BSED-MATH 3-2</b> becomes program <b>BSED</b>, major <b>MATH</b>, year <b>3</b>, block <b>2</b>.
            </Text>
            <Button variant="ghost" onClick={resetFilters}>Clear Filters</Button>
          </HStack>
        </VStack>
      </Box>

      {/* Mobile cards view */}
      <Box display={{ base: 'block', md: 'none' }}>
        <VStack align="stretch" spacing={3}>
          {blocks.map((b) => (
            <Box key={b.id} borderWidth="1px" borderColor={border} rounded="xl" bg={tableBg} p={4}>
              <VStack align="stretch" spacing={3}>
                <VStack align="start" spacing={2}>
                  <Text fontWeight="800" fontSize="md">{b.blockCode}</Text>
                  <Wrap>
                    {b._meta.programcode ? <WrapItem><Badge colorScheme="blue">{b._meta.programcode}</Badge></WrapItem> : null}
                    {b._meta.major ? <WrapItem><Badge colorScheme="purple">{b._meta.major}</Badge></WrapItem> : null}
                    {b._meta.yearlevel ? <WrapItem><Badge colorScheme="orange">Year {b._meta.yearlevel}</Badge></WrapItem> : null}
                    {b._meta.block ? <WrapItem><Badge colorScheme="gray">Block {b._meta.block}</Badge></WrapItem> : null}
                  </Wrap>
                </VStack>
                <SimpleGrid columns={2} spacing={3}>
                  <Box>
                    <Text fontSize="xs" color={muted}>Room(s)</Text>
                    <Wrap>{(b.room && chips(b.room).length) ? chips(b.room).map((t,i)=>(<WrapItem key={`r-${b.id}-${i}`}><Tag variant="subtle" colorScheme="blue">{t}</Tag></WrapItem>)) : <Text>-</Text>}</Wrap>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Session</Text>
                    <Text>{b.session || '-'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>F2F Sched</Text>
                    <Wrap>{(b.f2fSched && chips(b.f2fSched).length) ? chips(b.f2fSched).map((t,i)=>(<WrapItem key={`f-${b.id}-${i}`}><Tag variant="subtle" colorScheme="green">{t}</Tag></WrapItem>)) : <Text>-</Text>}</Wrap>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Exam Day</Text>
                    <Text>{b.examDay || '-'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Exam Session</Text>
                    <Text>{b.examSession || '-'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Exam Room</Text>
                    <Text>{b.examRoom || '-'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Status</Text>
                    <Badge colorScheme={b._isActive ? 'green' : 'gray'} variant={b._isActive ? 'subtle' : 'outline'}>
                      {b._isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Box>
                </SimpleGrid>
                <HStack justify="flex-end" spacing={2}>
                  <Button
                    size="sm"
                    variant={b._isActive ? 'outline' : 'solid'}
                    colorScheme={b._isActive ? 'orange' : 'green'}
                    onClick={() => toggleBlockStatus(b)}
                  >
                    {b._isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <IconButton aria-label="Edit" icon={<FiEdit />} size="sm" variant="outline" colorScheme="yellow" onClick={() => { setSelected(b); editDisc.onOpen(); }} />
                  <IconButton aria-label="Delete" icon={<FiTrash />} size="sm" variant="outline" colorScheme="red" onClick={() => { setSelected(b); delDisc.onOpen(); }} />
                </HStack>
              </VStack>
            </Box>
          ))}
        </VStack>
      </Box>

      {/* Desktop/tablet table view */}
      <Box className="responsive-table" overflowX="auto" borderWidth="1px" borderColor={border} rounded="xl" bg={tableBg} display={{ base: 'none', md: 'block' }}>
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Block Code</Th>
              <Th>Academic Details</Th>
              <Th>Room(s)</Th>
              <Th>Session</Th>
              <Th>F2F Sched</Th>
              <Th>Exam Day</Th>
              <Th>Exam Session</Th>
              <Th>Exam Room</Th>
              <Th>Status</Th>
              <Th textAlign="right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {blocks.map((b) => (
              <Tr key={b.id}>
                <Td><Text fontWeight="600">{b.blockCode}</Text></Td>
                <Td>
                  <Wrap spacing={2}>
                    {b._meta.programcode ? <WrapItem><Badge colorScheme="blue">{b._meta.programcode}</Badge></WrapItem> : null}
                    {b._meta.major ? <WrapItem><Badge colorScheme="purple">{b._meta.major}</Badge></WrapItem> : null}
                    {b._meta.yearlevel ? <WrapItem><Badge colorScheme="orange">Year {b._meta.yearlevel}</Badge></WrapItem> : null}
                    {b._meta.block ? <WrapItem><Badge colorScheme="gray">Block {b._meta.block}</Badge></WrapItem> : null}
                  </Wrap>
                </Td>
                <Td>{(b.room && chips(b.room).length) ? (
                  <Wrap>{chips(b.room).map((t, i) => <WrapItem key={`r-${b.id}-${i}`}><Tag variant="subtle" colorScheme="blue">{t}</Tag></WrapItem>)}</Wrap>
                ) : '-'}</Td>
                <Td>{b.session || '-'}</Td>
                <Td>{(b.f2fSched && chips(b.f2fSched).length) ? (
                  <Wrap>{chips(b.f2fSched).map((t, i) => <WrapItem key={`f-${b.id}-${i}`}><Tag variant="subtle" colorScheme="green">{t}</Tag></WrapItem>)}</Wrap>
                ) : '-'}</Td>
                <Td>{b.examDay || '-'}</Td>
                <Td>{b.examSession || '-'}</Td>
                <Td>{b.examRoom || '-'}</Td>
                <Td>
                  <Badge colorScheme={b._isActive ? 'green' : 'gray'} variant={b._isActive ? 'subtle' : 'outline'}>
                    {b._isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Td>
                <Td textAlign="right">
                  <HStack justify="end" spacing={1}>
                    <Button
                      size="xs"
                      variant={b._isActive ? 'outline' : 'solid'}
                      colorScheme={b._isActive ? 'orange' : 'green'}
                      onClick={() => toggleBlockStatus(b)}
                    >
                      {b._isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <IconButton aria-label="Edit" icon={<FiEdit />} size="sm" variant="ghost" colorScheme="yellow" onClick={() => { setSelected(b); editDisc.onOpen(); }} />
                    <IconButton aria-label="Delete" icon={<FiTrash />} size="sm" variant="ghost" colorScheme="red" onClick={() => { setSelected(b); delDisc.onOpen(); }} />
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      {!loading && filteredBlocks.length === 0 ? (
        <Box mt={4} borderWidth="1px" borderColor={border} rounded="xl" bg={tableBg} p={6}>
          <Text fontWeight="700">No blocks match the current filters.</Text>
          <Text fontSize="sm" color={muted}>Try clearing some filters or refreshing the dataset.</Text>
        </Box>
      ) : null}

      <Box mt={4}>
        <Pagination page={page} pageCount={pageCount} onPage={(p)=>dispatch(setBlockPage(p))} pageSize={pageSize} onPageSize={(n)=>dispatch(setBlockPageSize(n))} />
      </Box>

      <BlockFormModal isOpen={editDisc.isOpen} onClose={()=>{ editDisc.onClose(); setSelected(null); }} onSubmit={onSubmit} initial={selected} />

      <AlertDialog isOpen={delDisc.isOpen} onClose={delDisc.onClose} leastDestructiveRef={cancelRef} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete block?</AlertDialogHeader>
            <AlertDialogBody>
              This action cannot be undone. Delete block <b>{selected?.blockCode}</b>?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={delDisc.onClose} variant="ghost">Cancel</Button>
              <Button colorScheme="red" onClick={confirmDelete} ml={3}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}
