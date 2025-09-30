import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Button, HStack, VStack, Input, Select, Text, Box, useColorModeValue, Table, Thead, Tr, Th, Tbody, Td, Spinner, Tooltip, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, useDisclosure } from '@chakra-ui/react';
import { FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
import { selectAllFaculty, selectFacultyFilterOptions } from '../store/facultySlice';
import { loadFacultiesThunk } from '../store/facultyThunks';
import { buildConflicts, buildCrossFacultyOverlaps, parseF2FDays, parseTimeBlockToMinutes } from '../utils/conflicts';

function useIndexes(courses) {
  return useMemo(() => {
    const byFac = new Map();
    const bySecTerm = new Map();
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g,'');
    (courses || []).forEach(r => {
      const idKey = r.facultyId != null ? `id:${r.facultyId}` : '';
      const nmKey = norm(r.facultyName || r.faculty || r.instructor);
      if (idKey) { const a = byFac.get(idKey) || []; a.push(r); byFac.set(idKey, a); }
      if (nmKey) { const a = byFac.get(`nm:${nmKey}`) || []; a.push(r); byFac.set(`nm:${nmKey}`, a); }
      const sec = norm(r.section || '');
      const term = String(r.semester || r.term || '').trim().toLowerCase();
      const k = `${sec}|${term}`;
      const arr = bySecTerm.get(k) || []; arr.push(r); bySecTerm.set(k, arr);
    });
    return { byFac, bySecTerm };
  }, [courses]);
}

function useFacultyStats(faculties, courses) {
  const indexes = useIndexes(courses);
  return useMemo(() => {
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g,'');
    const termOf = (r) => String(r.semester || r.term || '').trim().toLowerCase();
    const timeKeyOf = (r) => {
      const s = String(r.scheduleKey || r.schedule || r.time || '').trim();
      const start = Number.isFinite(r.timeStartMinutes) ? r.timeStartMinutes : undefined;
      const end = Number.isFinite(r.timeEndMinutes) ? r.timeEndMinutes : undefined;
      if (Number.isFinite(start) && Number.isFinite(end)) return `${start}-${end}`;
      const tr = parseTimeBlockToMinutes(s);
      return (Number.isFinite(tr.start) && Number.isFinite(tr.end)) ? `${tr.start}-${tr.end}` : s.toLowerCase();
    };
    const map = new Map();
    (faculties || []).forEach(f => {
      const fid = f.id != null ? String(f.id) : '';
      const nm = norm(f.name || f.faculty || f.full_name || '');
      const rows = (indexes.byFac.get(`id:${fid}`) || []).concat(indexes.byFac.get(`nm:${nm}`) || []);
      const seen = new Set();
      let units = 0, coursesCnt = 0;
      for (const r of rows) {
        const code = String(r.code || r.courseName || '').trim().toLowerCase();
        const sec = norm(r.section || '');
        const term = termOf(r);
        const tk = timeKeyOf(r);
        if (!code || !sec || !term || !tk) continue;
        const k = [code, sec, term, tk].join('|');
        if (seen.has(k)) continue; seen.add(k);
        units += Number(r.unit || 0) || 0; coursesCnt += 1;
      }
      const release = Number(f.load_release_units ?? f.loadReleaseUnits ?? 0) || 0;
      const baseline = Math.max(0, 24 - release);
      const overload = Math.max(0, units - baseline);
      map.set(String(f.id), { load: units, release, overload, courses: coursesCnt });
    });
    return map;
  }, [faculties, courses]);
}

function isEligibleAssignment(schedule, faculty, indexes) {
  if (!schedule || !faculty) return false;
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g,'');
  const termOf = (r) => String(r.semester || r.term || '').trim().toLowerCase();
  const timeStr = String(schedule.scheduleKey || schedule.schedule || schedule.time || '').trim();
  const t0 = parseTimeBlockToMinutes(timeStr);
  const term = termOf(schedule);
  if (!term || !timeStr || !Number.isFinite(t0.start) || !Number.isFinite(t0.end)) return false;

  const sameSectionKey = `${norm(schedule.section || '')}|${term}`;
  const fnameKey = norm(faculty.name || faculty.faculty || faculty.full_name || '');
  const rowsFac = (indexes.byFac.get(`id:${faculty.id}`) || []).concat(indexes.byFac.get(`nm:${fnameKey}`) || []).filter(r => termOf(r) === term);
  const rowsSec = (indexes.bySecTerm.get(sameSectionKey) || []).filter(r => r && String(r.id) !== String(schedule.id));

  const overlaps = (r) => {
    const rStr = String(r.scheduleKey || r.schedule || r.time || '').trim();
    let s = r.timeStartMinutes, e = r.timeEndMinutes;
    if (!Number.isFinite(s) || !Number.isFinite(e)) { const tr = parseTimeBlockToMinutes(rStr); s = tr.start; e = tr.end; }
    const sameKey = rStr && timeStr && rStr.toLowerCase() === timeStr.toLowerCase();
    const rngOverlap = Number.isFinite(s) && Number.isFinite(e) && Math.max(t0.start, s) < Math.min(t0.end, e);
    return sameKey || rngOverlap;
  };

  // Conflict if faculty has overlap at this time (ignore day)
  if (rowsFac.some(overlaps)) return false;
  // Conflict if same section has overlap at this time (cross-faculty) (ignore day)
  if (rowsSec.some(overlaps)) return false;
  return true;
}

export default function AssignFacultyModal({ isOpen, onClose, schedule, onAssign }) {
  const dispatch = useDispatch();
  const allCourses = useSelector(selectAllCourses);
  const faculties = useSelector(selectAllFaculty);
  const opts = useSelector(selectFacultyFilterOptions);
  const loadingFac = useSelector(s => s.faculty.loading);
  const border = useColorModeValue('gray.200','gray.700');
  const panelBg = useColorModeValue('white','gray.800');

  useEffect(() => { if (isOpen && (!faculties || faculties.length === 0)) dispatch(loadFacultiesThunk({})); }, [isOpen, dispatch]);

  const [q, setQ] = useState('');
  const [department, setDepartment] = useState('');
  const [employment, setEmployment] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState('score'); // score | name | department | employment | load | release | overload | courses
  const [sortDir, setSortDir] = useState('desc');
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setPage(1);
  };

  const stats = useFacultyStats(faculties, allCourses);
  const indexes = useIndexes(allCourses);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const norm = (s) => String(s || '').toLowerCase();
    return (faculties || [])
      .filter(f => (!department || String(f.department || f.dept || '') === department))
      .filter(f => (!employment || String(f.employment || '') === employment))
      .filter(f => (!ql || [f.name, f.email, f.department, f.dept].some(v => norm(v).includes(ql))));
  }, [faculties, q, department, employment]);

  const [eligibles, setEligibles] = useState([]);
  const [busy, setBusy] = useState(false);
  const confirm = useDisclosure();
  const [pendingFac, setPendingFac] = useState(null);
  const cancelRef = React.useRef();

  const scheduleInfo = useMemo(() => {
    return {
      code: schedule?.code || schedule?.courseName || '-',
      title: schedule?.title || schedule?.courseTitle || '-',
      section: schedule?.section || '-',
      term: schedule?.semester || schedule?.term || '-',
      time: schedule?.schedule || schedule?.time || '-',
      room: schedule?.room || '-',
    };
  }, [schedule]);

  // Compute fitness score (1-10) per faculty for this schedule
  const scoreOf = useMemo(() => {
    const norm = (s) => String(s || '').toLowerCase();
    const deptOf = (f) => String(f.department || f.dept || '');
    const prog = String(schedule?.program || schedule?.programcode || '').toLowerCase();
    const schedDept = String(schedule?.dept || '').toLowerCase();
    const timeStr = String(schedule?.scheduleKey || schedule?.schedule || schedule?.time || '').trim();
    const tr = parseTimeBlockToMinutes(timeStr);
    const candMid = Number.isFinite(tr.start) && Number.isFinite(tr.end) ? (tr.start + tr.end)/2 : NaN;
    const term = String(schedule?.semester || schedule?.term || '').trim().toLowerCase();
    const tok = (s) => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);
    const candTokens = (() => {
      const a = tok(schedule?.code || schedule?.courseName || '');
      const b = tok(schedule?.title || schedule?.courseTitle || '');
      return Array.from(new Set(a.concat(b)));
    })();

    const map = new Map();
    (faculties || []).forEach(f => {
      const stat = stats.get(String(f.id)) || { load:0, release:0, overload:0, courses:0 };
      // Department-program match
      const d = deptOf(f).toLowerCase();
      let deptScore = 0.5;
      if (prog && d.includes(prog)) deptScore = 1.0;
      else if (schedDept && d === schedDept) deptScore = 0.9;
      // Employment priority
      const emp = norm(f.employment);
      let empScore = 0.6;
      if (emp.includes('full')) empScore = 1.0; else if (emp.includes('knp')) empScore = 0.85; else if (emp.includes('part')) empScore = 0.7;
      // Degree/Credential priority (Doctor > Masters > Profession > License)
      const info = `${String(f.name||'')} ${String(f.designation||'')} ${String(f.rank||'')}`.toLowerCase();
      const has = (re) => re.test(info);
      const reAny = (arr) => arr.some(rx => has(rx));
      const rxDoctor = [/\bph\.?d\b/, /\bed\.?d\b/, /\bdoctor(ate)?\b/, /\bdr\.?\b/, /\bdba\b/];
      const rxMasters = [/\bmaed\b/, /\bm\.?s\b/, /\bmsc\b/, /\bm\.a\b/, /\bm\.?ed\b/, /\bmaem\b/, /\bmba\b/];
      const rxProfession = [/\batty\.?\b/, /\beng(?:r|\.)?\b/, /\barch\b/];
      const rxLicense = [/\blpt\b/, /\brgc\b/, /\brcrim\b/, /\brmt\b/, /\brn\b/];
      let degreeScore = 0.5;
      if (reAny(rxDoctor)) degreeScore = 1.0;
      else if (reAny(rxMasters)) degreeScore = 0.85;
      else if (reAny(rxProfession)) degreeScore = 0.75;
      else if (reAny(rxLicense)) degreeScore = 0.7;
      // Time proximity (same term)
      const rowsAll = ((indexes.byFac.get(`id:${f.id}`) || []).concat(indexes.byFac.get(`nm:${norm(f.name || f.faculty || f.full_name)}`) || []));
      const rows = rowsAll.filter(r => String(r.semester || r.term || '').trim().toLowerCase() === term);
      let avg = NaN; if (rows.length) {
        let sum=0, cnt=0; rows.forEach(r => { let s=r.timeStartMinutes,e=r.timeEndMinutes; const tS=String(r.scheduleKey||r.schedule||r.time||'').trim(); if(!Number.isFinite(s)||!Number.isFinite(e)){const tt=parseTimeBlockToMinutes(tS); s=tt.start; e=tt.end;} if(Number.isFinite(s)&&Number.isFinite(e)){ sum+=(s+e)/2; cnt++; } }); avg = cnt? sum/cnt : NaN;
      }
      let timeScore = 0.7;
      if (Number.isFinite(candMid) && Number.isFinite(avg)) {
        const diff = Math.abs(candMid - avg); // minutes
        timeScore = Math.max(0, 1 - diff/360); // within 6h -> reduces to 0
      }
      // String match between candidate code/title and faculty catalog
      let matchScore = 0.5;
      if (candTokens.length) {
        let best = 0;
        for (const r of rowsAll) {
          const rTokens = Array.from(new Set(tok(r.code || r.courseName || '').concat(tok(r.title || r.courseTitle || ''))));
          if (!rTokens.length) continue;
          let hit = 0; const setR = new Set(rTokens);
          for (const t of candTokens) { if (setR.has(t)) hit++; }
          const ratio = hit / candTokens.length;
          if (ratio > best) best = ratio;
          if (best >= 1) break;
        }
        matchScore = 0.5 + 0.5 * best; // 0.5..1.0 boost
      }
      // Load and overload
      const baseline = Math.max(0, 24 - (stat.release||0));
      const loadRatio = baseline > 0 ? (stat.load||0)/baseline : 1;
      const loadScore = Math.max(0, 1 - Math.max(0, loadRatio - 0.8)/0.8);
      const overloadScore = Math.max(0, 1 - (stat.overload||0)/6);
      // Term experience count
      const termCount = rows.length; const expScore = Math.min(1, termCount/8);
      // Weighted sum -> 1..10 (rebalanced to emphasize Course Match)
      // Weights: dept 0.16, emp 0.16, degree 0.10, time 0.10, load 0.16, overload 0.08, exp 0.08, match 0.16 => 1.00
      const score01 = 0.16*deptScore + 0.16*empScore + 0.10*degreeScore + 0.10*timeScore + 0.16*loadScore + 0.08*overloadScore + 0.08*expScore + 0.16*matchScore;
      const score = Math.max(1, Math.min(10, (score01*10)));
      map.set(String(f.id), {
        score,
        parts: {
          dept: deptScore,
          employment: empScore,
          degree: degreeScore,
          time: timeScore,
          load: loadScore,
          overload: overloadScore,
          termExp: expScore,
          match: matchScore,
        }
      });
    });
    return map;
  }, [faculties, stats, indexes, schedule]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setBusy(true);
      // Compute synchronously; dataset is small per faculty due to indexing
      const out = [];
      for (const f of filtered) {
        if (isEligibleAssignment(schedule, f, indexes, allCourses)) out.push(f);
      }
      if (alive) { setEligibles(out); setBusy(false); setPage(1); }
    };
    run();
    return () => { alive = false; };
  }, [filtered, schedule, indexes]);

  const sortedEligibles = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const get = (f) => {
      if (sortKey === 'score') return (scoreOf.get(String(f.id))?.score) || 0;
      if (sortKey === 'name') return String(f.name || f.faculty || f.full_name || '').toLowerCase();
      if (sortKey === 'department') return String(f.department || f.dept || '').toLowerCase();
      if (sortKey === 'employment') return String(f.employment || '').toLowerCase();
      const s = stats.get(String(f.id)) || { load:0, release:0, overload:0, courses:0 };
      if (sortKey === 'load') return s.load || 0;
      if (sortKey === 'release') return s.release || 0;
      if (sortKey === 'overload') return s.overload || 0;
      if (sortKey === 'courses') return s.courses || 0;
      return '';
    };
    const arr = eligibles.slice().sort((a,b) => {
      const va = get(a), vb = get(b);
      if (typeof va === 'number' && typeof vb === 'number') {
        if (va !== vb) return (va - vb) * dir;
      } else {
        const sa = String(va), sb = String(vb);
        if (sa !== sb) return (sa < sb ? -1 : 1) * dir;
      }
      // tie-breaker by name
      const na = String(a.name || a.faculty || a.full_name || '').toLowerCase();
      const nb = String(b.name || b.faculty || b.full_name || '').toLowerCase();
      if (na < nb) return -1; if (na > nb) return 1; return 0;
    });
    return arr;
  }, [eligibles, sortKey, sortDir, stats]);

  const pageCount = Math.max(1, Math.ceil(sortedEligibles.length / pageSize));
  const paged = useMemo(() => sortedEligibles.slice((page-1)*pageSize, (page-1)*pageSize + pageSize), [sortedEligibles, page, pageSize]);

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" isCentered>
      <ModalOverlay />
      <ModalContent maxW={{ base: '95vw', md: '90vw' }}>
        <ModalHeader>Assign Faculty</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <Box borderWidth="1px" borderColor={border} rounded="md" p={3} bg={panelBg}>
              <HStack spacing={3} wrap="wrap">
                <Input placeholder="Search name / email / dept" value={q} onChange={(e)=>{ setQ(e.target.value); setPage(1); }} maxW="260px" size="sm" />
                <Select placeholder="Department" value={department} onChange={(e)=>{ setDepartment(e.target.value); setPage(1); }} maxW="200px" size="sm">
                  {(opts?.departments || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </Select>
                <Select placeholder="Employment" value={employment} onChange={(e)=>{ setEmployment(e.target.value); setPage(1); }} maxW="180px" size="sm">
                  {(opts?.employments || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </Select>
                <Select size="sm" value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value)||10); setPage(1); }} maxW="100px">
                  {[10,15,20,30,50].map(n => <option key={n} value={n}>{n}/page</option>)}
                </Select>
              </HStack>
            </Box>

            {(busy || loadingFac) ? (
              <VStack align="center" py={10}>
                <Spinner thickness="3px" speed="0.6s" color="blue.400" size="lg" />
                <Text color={useColorModeValue('gray.600','gray.300')}>Finding eligible faculty…</Text>
              </VStack>
            ) : (
              <>
              <Box borderWidth="1px" borderColor={border} rounded="md" bg={useColorModeValue('blue.50','whiteAlpha.200')} p={3}>
                <Text fontSize="sm" color={useColorModeValue('blue.900','blue.100')}>
                  Score ranks faculty by: department alignment, employment priority (full-time first), academic degree (doctorate/masters), closeness to their usual schedule time, current load vs. capacity, overload, experience in the same term, and course name/code similarity. Higher is better (1–10).
                </Text>
              </Box>

              <Box borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg}>
                <Table size="sm" variant="striped" colorScheme="gray">
                  <Thead>
                    <Tr>
                      <Th onClick={()=>toggleSort('name')} cursor="pointer" userSelect="none">
                        <HStack spacing={1}><Text>Faculty</Text>{sortKey==='name' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/>)}</HStack>
                      </Th>
                      <Th onClick={()=>toggleSort('department')} cursor="pointer" userSelect="none">
                        <HStack spacing={1}><Text>Department</Text>{sortKey==='department' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/>)}</HStack>
                      </Th>
                      <Th onClick={()=>toggleSort('employment')} cursor="pointer" userSelect="none">
                        <HStack spacing={1}><Text>Employment</Text>{sortKey==='employment' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/>)}</HStack>
                      </Th>
                      <Th isNumeric onClick={()=>toggleSort('load')} cursor="pointer" userSelect="none">
                        <HStack justify="end" spacing={1}><Text>Load</Text>{sortKey==='load' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/>)}</HStack>
                      </Th>
                      <Th isNumeric onClick={()=>toggleSort('release')} cursor="pointer" userSelect="none">
                        <HStack justify="end" spacing={1}><Text>Release</Text>{sortKey==='release' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/>)}</HStack>
                      </Th>
                      <Th isNumeric onClick={()=>toggleSort('overload')} cursor="pointer" userSelect="none">
                        <HStack justify="end" spacing={1}><Text>Overload</Text>{sortKey==='overload' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/>)}</HStack>
                      </Th>
                      <Th isNumeric onClick={()=>toggleSort('courses')} cursor="pointer" userSelect="none">
                        <HStack justify="end" spacing={1}><Text>Courses</Text>{sortKey==='courses' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/>)}</HStack>
                      </Th>
                      <Th isNumeric onClick={()=>toggleSort('score')} cursor="pointer" userSelect="none">
                        <HStack justify="end" spacing={1}><Text>Score</Text>{sortKey==='score' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/>)}</HStack>
                      </Th>
                      <Th></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {paged.map(f => {
                      const s = stats.get(String(f.id)) || { load: 0, release: 0, overload: 0, courses: 0 };
                      const entry = scoreOf.get(String(f.id)) || { score: 0, parts: {} };
                      const score = entry.score;
                      return (
                        <Tr key={f.id}>
                          <Td>
                            <VStack align="start" spacing={0}>
                              <Text fontWeight="700">{f.name || f.faculty || f.full_name || '-'}</Text>
                              <Text fontSize="xs" color="gray.500">{f.email || ''}</Text>
                            </VStack>
                          </Td>
                          <Td>{f.department || f.dept || '-'}</Td>
                          <Td>{f.employment || '-'}</Td>
                          <Td isNumeric>{s.load}</Td>
                          <Td isNumeric>{s.release}</Td>
                          <Td isNumeric color={s.overload > 0 ? 'red.500' : undefined}>{s.overload}</Td>
                          <Td isNumeric>{s.courses}</Td>
                          <Td isNumeric>
                            <Tooltip hasArrow placement="top" label={
                              (()=>{
                                const p = entry.parts || {};
                                return `Dept:${(p.dept??0).toFixed(2)}  Emp:${(p.employment??0).toFixed(2)}  Degree:${(p.degree??0).toFixed(2)}\nTime:${(p.time??0).toFixed(2)}  Load:${(p.load??0).toFixed(2)}  Overload:${(p.overload??0).toFixed(2)}\nTermExp:${(p.termExp??0).toFixed(2)}  Match:${(p.match??0).toFixed(2)}`;
                              })()
                            }>
                              <Text as="span">{score.toFixed(1)}</Text>
                            </Tooltip>
                          </Td>
                          <Td textAlign="right">
                            <Button size="sm" colorScheme="blue" onClick={()=> { setPendingFac(f); confirm.onOpen(); }}>Assign</Button>
                          </Td>
                        </Tr>
                      );
                    })}
                    {paged.length === 0 && (
                      <Tr><Td colSpan={8}><Text textAlign="center" py={6} color="gray.500">No eligible faculty found.</Text></Td></Tr>
                    )}
                  </Tbody>
                </Table>
              </Box>
              </>
            )}

            <HStack justify="flex-end">
              <Text fontSize="xs" color={useColorModeValue('gray.600','gray.400')}>Page {page} of {pageCount}</Text>
              <HStack>
                <Button size="xs" onClick={()=>setPage(p=>Math.max(1,p-1))} isDisabled={page<=1}>Prev</Button>
                <Button size="xs" onClick={()=>setPage(p=>Math.min(pageCount,p+1))} isDisabled={page>=pageCount}>Next</Button>
              </HStack>
            </HStack>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose} variant="ghost">Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>

    <AlertDialog isOpen={confirm.isOpen} onClose={confirm.onClose} leastDestructiveRef={cancelRef} isCentered>
      <AlertDialogOverlay />
      <AlertDialogContent>
        <AlertDialogHeader>Confirm Assignment</AlertDialogHeader>
        <AlertDialogBody>
          <VStack align="start" spacing={2}>
            <Text>Assign <Text as="span" fontWeight="700">{pendingFac?.name || pendingFac?.faculty || '-'}</Text> to:</Text>
            <Box borderWidth="1px" borderColor={useColorModeValue('gray.200','gray.700')} rounded="md" p={3} w="full">
              <Text fontSize="sm"><Text as="span" fontWeight="700">{scheduleInfo.code}</Text> — {scheduleInfo.title}</Text>
              <HStack spacing={4} fontSize="sm" color={useColorModeValue('gray.700','gray.300')}>
                <Text>Section: <Text as="span" fontWeight="600">{scheduleInfo.section}</Text></Text>
                <Text>Term: <Text as="span" fontWeight="600">{scheduleInfo.term}</Text></Text>
                <Text>Time: <Text as="span" fontWeight="600">{scheduleInfo.time}</Text></Text>
                <Text>Room: <Text as="span" fontWeight="600">{scheduleInfo.room}</Text></Text>
              </HStack>
            </Box>
            <Text fontSize="sm" color={useColorModeValue('gray.600','gray.400')}>This will update the schedule's faculty and recheck conflicts.</Text>
          </VStack>
        </AlertDialogBody>
        <AlertDialogFooter>
          <Button ref={cancelRef} onClick={()=>{ setPendingFac(null); confirm.onClose(); }} variant="ghost">Cancel</Button>
          <Button colorScheme="blue" ml={3} onClick={async ()=>{ if (pendingFac) { await onAssign?.(pendingFac); } setPendingFac(null); confirm.onClose(); }}>Confirm</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}
