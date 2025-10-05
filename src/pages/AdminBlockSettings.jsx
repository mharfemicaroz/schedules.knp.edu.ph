import React from 'react';
import { Box, Heading, HStack, VStack, Button, Input, FormControl, FormLabel, Select, Table, Thead, Tr, Th, Tbody, Td, IconButton, useDisclosure, useColorModeValue, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, Text, Tag, Wrap, WrapItem } from '@chakra-ui/react';
import { useDispatch, useSelector } from 'react-redux';
import { loadBlocksThunk, createBlockThunk, updateBlockThunk, deleteBlockThunk } from '../store/blockThunks';
import { selectPagedBlocks, setBlockFilters, selectBlockPage, selectBlockPageSize, selectBlockPageCount, selectBlockFilters, setBlockPage, setBlockPageSize } from '../store/blockSlice';
import BlockFormModal from '../components/BlockFormModal';
import { FiPlus, FiRefreshCw, FiEdit, FiTrash } from 'react-icons/fi';
import Pagination from '../components/Pagination';

export default function AdminBlockSettings() {
  const dispatch = useDispatch();
  const blocks = useSelector(selectPagedBlocks);
  const loading = useSelector(s => s.blocks.loading);
  const filters = useSelector(selectBlockFilters);
  const page = useSelector(selectBlockPage);
  const pageSize = useSelector(selectBlockPageSize);
  const pageCount = useSelector(selectBlockPageCount);
  const [q, setQ] = React.useState(filters.blockCode || '');
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

  React.useEffect(() => { dispatch(loadBlocksThunk({})); }, [dispatch]);

  const applyFilters = () => {
    const f = { blockCode: q, room, session, f2fSched: f2f, active };
    dispatch(setBlockFilters(f));
    dispatch(loadBlocksThunk(f));
  };

  const resetFilters = () => {
    setQ(''); setRoom(''); setSession(''); setF2f(''); setActive('');
    dispatch(setBlockFilters({}));
    dispatch(loadBlocksThunk({}));
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
      dispatch(loadBlocksThunk(filters));
    } catch {}
  };

  const confirmDelete = async () => {
    if (!selected) return;
    try {
      await dispatch(deleteBlockThunk(selected.id));
      delDisc.onClose(); setSelected(null);
      dispatch(loadBlocksThunk(filters));
    } catch {}
  };

  const chips = (s) => String(s || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);

  return (
    <Box px={{ base: 2, md: 4 }} py={4}>
      <HStack justify="space-between" align="center" mb={4}>
        <Heading size="md">Block Settings</Heading>
        <HStack>
          <Button leftIcon={<FiRefreshCw />} variant="outline" onClick={() => dispatch(loadBlocksThunk(filters))} isLoading={loading}>Refresh</Button>
          <Button leftIcon={<FiPlus />} colorScheme="blue" onClick={onCreate}>Add Block</Button>
        </HStack>
      </HStack>

      <Box borderWidth="1px" borderColor={border} rounded="xl" p={4} mb={4}>
        <VStack align="stretch" spacing={3}>
          <HStack spacing={3} align="start">
            <FormControl>
              <FormLabel>Block Code</FormLabel>
              <Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="e.g., BSCS-1A" />
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
              <FormLabel>F2F Sched</FormLabel>
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
          </HStack>
          <HStack>
            <Button colorScheme="blue" onClick={applyFilters}>Apply Filters</Button>
            <Button variant="ghost" onClick={resetFilters}>Reset</Button>
          </HStack>
        </VStack>
      </Box>

      <Box className="responsive-table" overflowX="auto" borderWidth="1px" borderColor={border} rounded="xl" bg={tableBg}>
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Block Code</Th>
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
                <Td>{b.isActive ? 'Active' : 'Inactive'}</Td>
                <Td textAlign="right">
                  <HStack justify="end" spacing={1}>
                    <IconButton aria-label="Edit" icon={<FiEdit />} size="sm" variant="ghost" colorScheme="yellow" onClick={() => { setSelected(b); editDisc.onOpen(); }} />
                    <IconButton aria-label="Delete" icon={<FiTrash />} size="sm" variant="ghost" colorScheme="red" onClick={() => { setSelected(b); delDisc.onOpen(); }} />
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

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
