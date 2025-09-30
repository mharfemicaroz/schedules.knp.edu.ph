import React, { useMemo, useState } from 'react';
import { Box, Heading, HStack, VStack, Table, Thead, Tbody, Tr, Th, Td, Text, useColorModeValue, IconButton, Button, useDisclosure, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, Tag, TagLabel, Badge, Wrap, WrapItem, FormControl, FormLabel, Input, Select } from '@chakra-ui/react';
import { useSelector, useDispatch } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
import { FiAlertTriangle, FiEdit, FiTrash, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import EditScheduleModal from '../components/EditScheduleModal';
import { updateScheduleThunk, deleteScheduleThunk, loadAllSchedules } from '../store/dataThunks';
import Pagination from '../components/Pagination';
import { getTimeOptions } from '../utils/timeOptions';
import { buildConflicts, buildCrossFacultyOverlaps, parseTimeBlockToMinutes } from '../utils/conflicts';

export default function ConflictSchedules() {
  const dispatch = useDispatch();
  const allCourses = useSelector(selectAllCourses);
  const authUser = useSelector(s => s.auth.user);
  const isAdmin = !!authUser && (String(authUser.role).toLowerCase() === 'admin' || String(authUser.role).toLowerCase() === 'manager');
  const border = useColorModeValue('gray.200','gray.700');
  const panelBg = useColorModeValue('white','gray.800');
  const editDisc = useDisclosure();
  const delDisc = useDisclosure();
  const [selected, setSelected] = useState(null);
  const cancelRef = React.useRef();

  // Build conflicts consistent with Edit modal and Faculty Detail
  const conflicts = useMemo(() => {
    const isUnknownFaculty = (val) => {
      const s = String(val || '').trim();
      if (!s) return true;
      const n = s.toLowerCase();
      // broader match: catch variations like "unknown faculty", "t.b.a.", "no faculty", etc.
      if (/(unknown|unassigned|no\s*faculty|not\s*assigned)/i.test(n)) return true;
      if (/^n\/?a$/.test(n)) return true;
      if (/^t\.?b\.?a\.?$/.test(n) || n === 'tba') return true;
      if (n === '-' || n === '--') return true;
      return false;
    };
    const normalizeName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g,'');
    const termOf = (r) => String(r.semester || r.term || '').trim().toLowerCase();
    const timeStrOf = (r) => String(r.scheduleKey || r.schedule || r.time || '').trim();
    const timeKeyOf = (r) => {
      const s = timeStrOf(r);
      const start = Number.isFinite(r.timeStartMinutes) ? r.timeStartMinutes : undefined;
      const end = Number.isFinite(r.timeEndMinutes) ? r.timeEndMinutes : undefined;
      return (Number.isFinite(start) && Number.isFinite(end)) ? `${start}-${end}` : s.toLowerCase();
    };
    const sectionOf = (r) => normalizeName(r.section || '');
    const facIdOf = (r) => (r.facultyId != null ? String(r.facultyId) : (r.faculty_id != null ? String(r.faculty_id) : ''));
    const facKeyOf = (r) => facIdOf(r) || normalizeName(r.facultyName || r.faculty || r.instructor);

    // 1) Exclude merged duplicates globally: same faculty, term, time, section
    const seen = new Set();
    const filtered = (allCourses || []).filter(r => {
      const k = ['merged', facKeyOf(r), termOf(r), timeKeyOf(r), sectionOf(r)].join('|');
      if (seen.has(k)) return false; seen.add(k); return true;
    });

    // 2) Sanitize invalid-time rows and use sanitized dataset for base and cross conflicts
    const toKey = (start, end) => `${start}-${end}`;
    const sanitized = filtered.map(r => {
      const tStr = String(r.scheduleKey || r.schedule || r.time || '').trim();
      const hasNums = Number.isFinite(r.timeStartMinutes) && Number.isFinite(r.timeEndMinutes);
      if (hasNums) return { ...r, scheduleKey: toKey(r.timeStartMinutes, r.timeEndMinutes) };
      const tr = parseTimeBlockToMinutes(tStr);
      const valid = Number.isFinite(tr.start) && Number.isFinite(tr.end);
      return valid ? { ...r, scheduleKey: toKey(tr.start, tr.end) } : { ...r, scheduleKey: '', schedule: '', time: '' };
    });
    const base = buildConflicts(sanitized);
    const cross = buildCrossFacultyOverlaps(sanitized);

    // 3) Additional rule: Same faculty, same term, same time (ignore F2F day) across different sections
    const sameTimeIgnoreF2F = [];
    const byKey = new Map();
    const key = (...parts) => parts.map(v => String(v ?? '').toLowerCase().trim()).join('|');
    sanitized.forEach(r => {
      const fac = facKeyOf(r); const t = termOf(r); const tk = timeKeyOf(r);
      if (!fac || !t || !tk) return;
      const k = key('same-time-any-f2f', fac, t, tk);
      const arr = byKey.get(k) || []; arr.push(r); byKey.set(k, arr);
    });
    byKey.forEach((arr, k) => {
      if (arr.length > 1) {
        const secs = new Set(arr.map(sectionOf).filter(Boolean));
        if (secs.size > 1) sameTimeIgnoreF2F.push({ reason: 'Double-booked: same term and time (ignoring F2F day)', key: 'R:'+k, items: arr });
      }
    });

    const allGroups = [...base, ...cross, ...sameTimeIgnoreF2F];

    // 4) Deduplicate redundant conflicts regardless of pairings (subset suppression per reason)
    const groupsSorted = allGroups
      .map(g => ({
        ...g,
        _ids: Array.from(new Set((g.items || []).map(it => String(it.id)).filter(Boolean))).sort(),
        _reason: String(g.reason || ''),
      }))
      .filter(g => g._ids.length >= 2)
      .sort((a, b) => b._ids.length - a._ids.length);

    const kept = [];
    const perReason = new Map(); // reason -> array of Set(ids) kept
    for (const g of groupsSorted) {
      const r = g._reason;
      const ids = g._ids;
      const sets = perReason.get(r) || [];
      let redundant = false;
      for (const s of sets) {
        let isSubset = true;
        for (const id of ids) { if (!s.has(id)) { isSubset = false; break; } }
        if (isSubset) { redundant = true; break; }
      }
      if (redundant) continue;
      sets.push(new Set(ids));
      perReason.set(r, sets);
      kept.push(g);
    }

    // Exclude groups with unknown/placeholder faculty labels
    const facFiltered = kept.filter(g => {
      const rep = (g.items && g.items[0]) || {};
      const fac = rep.facultyName || rep.faculty || rep.instructor || '';
      return !isUnknownFaculty(fac);
    });

    return facFiltered;
  }, [allCourses]);
  // Filters
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [sortKey, setSortKey] = useState('reason'); // 'reason' | 'faculty' | 'term' | 'time'
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    const arr = conflicts.filter(g => {
      // reason filter
      if (reason && g.reason !== reason) return false;
      // term filter (any item in group matching term)
      if (term && !g.items.some(x => (x.semester || x.term || '') === term)) return false;
      // time filter
      if (time && !g.items.some(x => (x.schedule || x.time || '') === time)) return false;
      // text query across faculty, code, section
      if (q) {
        const hit = g.items.some(x => {
          const fac = String(x.facultyName || x.faculty || x.instructor || '').toLowerCase();
          const code = String(x.code || '').toLowerCase();
          const sec = String(x.section || '').toLowerCase();
          return fac.includes(q) || code.includes(q) || sec.includes(q);
        });
        if (!hit) return false;
      }
      return true;
    });

    const getRep = (g) => g.items[0] || {};
    const valOf = (g, key) => {
      const rep = getRep(g);
      if (key === 'reason') return String(g.reason || '');
      if (key === 'faculty') return String(rep.facultyName || rep.faculty || rep.instructor || '');
      if (key === 'term') return String(rep.semester || rep.term || '');
      if (key === 'time') return String(rep.schedule || rep.time || '');
      return '';
    };
    const dir = (sortDir === 'asc') ? 1 : -1;
    return arr.slice().sort((a,b)=>{
      const va = valOf(a, sortKey).toLowerCase();
      const vb = valOf(b, sortKey).toLowerCase();
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      // tie-breakers for stability
      const fa = valOf(a, 'faculty').toLowerCase();
      const fb = valOf(b, 'faculty').toLowerCase();
      if (fa !== fb) return fa < fb ? -1 : 1;
      const ta = valOf(a, 'term').toLowerCase();
      const tb = valOf(b, 'term').toLowerCase();
      if (ta !== tb) return ta < tb ? -1 : 1;
      const sa = valOf(a, 'time').toLowerCase();
      const sb = valOf(b, 'time').toLowerCase();
      if (sa !== sb) return sa < sb ? -1 : 1;
      return 0;
    });
  }, [conflicts, query, term, time, reason, sortKey, sortDir]);

  // Pagination for filtered groups
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  // selection removed for performance and simplicity

  async function handleSaveEdit(payload){ if(!selected) return; await dispatch(updateScheduleThunk({ id: selected.id, changes: payload })); editDisc.onClose(); setSelected(null); dispatch(loadAllSchedules()); }
  async function confirmDelete(){ if(!selected) return; await dispatch(deleteScheduleThunk(selected.id)); delDisc.onClose(); setSelected(null); dispatch(loadAllSchedules()); }

  if (!isAdmin) {
    return (
      <VStack align="center" spacing={6} py={8}>
        <Heading size="md">Admin access required</Heading>
        <Text color="gray.500">This page is only visible to administrators.</Text>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" spacing={6}>
      <HStack spacing={3}>
        <FiAlertTriangle />
        <Heading size="md">Conflict Schedules</Heading>
        <Tag colorScheme="red" ml={2}><TagLabel>{filtered.length} groups</TagLabel></Tag>
      </HStack>

      {/* Filters */}
      <Box borderWidth="1px" borderColor={border} rounded="md" p={3} bg={panelBg}>
        <HStack spacing={3} wrap="wrap">
          <FormControl maxW="260px">
            <FormLabel m={0} fontSize="xs" color="gray.500">Search</FormLabel>
            <Input size="sm" value={query} onChange={(e)=>{ setQuery(e.target.value); setPage(1); }} placeholder="Faculty / Code / Section" />
          </FormControl>
          <FormControl maxW="160px">
            <FormLabel m={0} fontSize="xs" color="gray.500">Term</FormLabel>
            <Select size="sm" value={term} onChange={(e)=>{ setTerm(e.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="1st">1st</option>
              <option value="2nd">2nd</option>
              <option value="Sem">Sem</option>
            </Select>
          </FormControl>
          <FormControl maxW="180px">
            <FormLabel m={0} fontSize="xs" color="gray.500">Time</FormLabel>
            <Select size="sm" value={time} onChange={(e)=>{ setTime(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {getTimeOptions().map((t,i)=>(<option key={`${t}-${i}`} value={t}>{t || '—'}</option>))}
            </Select>
          </FormControl>
          <FormControl maxW="240px">
            <FormLabel m={0} fontSize="xs" color="gray.500">Reason</FormLabel>
            <Select size="sm" value={reason} onChange={(e)=>{ setReason(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {[...new Set(conflicts.map(c=>c.reason))].map(r => (<option key={r} value={r}>{r}</option>))}
            </Select>
          </FormControl>
          <Button size="sm" variant="ghost" onClick={()=>{ setQuery(''); setTerm(''); setTime(''); setReason(''); setPage(1); }}>Clear</Button>
        </HStack>
      </Box>

      <Box borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg}>
        <Table size="sm">
          <Thead>
            <Tr>
              <Th onClick={()=>toggleSort('reason')} cursor="pointer" userSelect="none">
                <HStack spacing={1}>
                  <Text>Reason</Text>
                  {sortKey==='reason' && (sortDir==='asc' ? <FiChevronUp/> : <FiChevronDown/>) }
                </HStack>
              </Th>
              <Th onClick={()=>toggleSort('faculty')} cursor="pointer" userSelect="none">
                <HStack spacing={1}>
                  <Text>Faculty</Text>
                  {sortKey==='faculty' && (sortDir==='asc' ? <FiChevronUp/> : <FiChevronDown/>) }
                </HStack>
              </Th>
              <Th onClick={()=>toggleSort('term')} cursor="pointer" userSelect="none">
                <HStack spacing={1}>
                  <Text>Term</Text>
                  {sortKey==='term' && (sortDir==='asc' ? <FiChevronUp/> : <FiChevronDown/>) }
                </HStack>
              </Th>
              <Th onClick={()=>toggleSort('time')} cursor="pointer" userSelect="none">
                <HStack spacing={1}>
                  <Text>Time</Text>
                  {sortKey==='time' && (sortDir==='asc' ? <FiChevronUp/> : <FiChevronDown/>) }
                </HStack>
              </Th>
              <Th>Course/Section</Th>
              <Th>Location</Th>
              <Th textAlign="right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {paged.map(group => {
              // pick a representative for row summary
              const rep = group.items[0] || {};
              const fac = rep.facultyName || rep.faculty || rep.instructor || '—';
              const term = rep.semester || rep.term || '—';
              const t = rep.schedule || rep.time || '—';
              const code = rep.code || '—';
              const sec = rep.section || '—';
              const room = rep.room || '—';
              const ses = rep.session || '—';
              return (
                <Tr key={group.key}>
                  <Td maxW="520px">
                    <Text whiteSpace="normal" wordBreak="break-word" color="red.500" fontWeight="600">{group.reason}</Text>
                  </Td>
                  <Td>{fac}</Td>
                  <Td>{term}</Td>
                  <Td>{t}</Td>
                  <Td>{code} <Text as="span" color="gray.500">/</Text> {sec}</Td>
                  <Td>{room} <Text as="span" color="gray.500">/</Text> <Text as="span" fontSize="xs" color="gray.600">{ses}</Text></Td>
                  <Td textAlign="right">
                    <Wrap justify="end" spacing={1}>
                      {group.items.slice(0,6).map((c, idx) => (
                        <WrapItem key={`${c.id}-${idx}`}>
                          <Badge variant="subtle" colorScheme="gray" px={2} py={1} rounded="md">
                            <Text as="span" fontSize="xs" color="gray.600">{c.code}/{c.section}</Text>
                            <IconButton aria-label="Edit" icon={<FiEdit />} size="xs" variant="ghost" ml={1} onClick={() => { setSelected(c); editDisc.onOpen(); }} />
                            <IconButton aria-label="Delete" icon={<FiTrash />} size="xs" colorScheme="red" variant="ghost" onClick={() => { setSelected(c); delDisc.onOpen(); }} />
                          </Badge>
                        </WrapItem>
                      ))}
                    </Wrap>
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Box>

      <Pagination page={page} pageCount={pageCount} onPage={setPage} pageSize={pageSize} onPageSize={() => {}} />

      <EditScheduleModal isOpen={editDisc.isOpen} onClose={() => { editDisc.onClose(); setSelected(null); }} schedule={selected} onSave={handleSaveEdit} viewMode={'regular'} />

      <AlertDialog isOpen={delDisc.isOpen} onClose={delDisc.onClose} leastDestructiveRef={cancelRef} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete schedule?</AlertDialogHeader>
            <AlertDialogBody>
              This action cannot be undone. Are you sure you want to delete <b>{selected?.code}</b> - {selected?.title}?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={delDisc.onClose} variant="ghost">Cancel</Button>
              <Button colorScheme="red" onClick={confirmDelete} ml={3}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </VStack>
  );
}
