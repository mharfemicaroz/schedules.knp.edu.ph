// full component file - drop in place of your previous CourseLoading component
import React from 'react';
import {
  Box, HStack, VStack, Heading, Text, Input, IconButton, Button, Select, Divider,
  useColorModeValue, Spinner, Badge, Tag, Wrap, WrapItem, useToast, Checkbox,
  SimpleGrid, Tooltip,
  AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody
} from '@chakra-ui/react';
import { FiRefreshCw, FiUpload, FiSearch, FiLock, FiInfo, FiHelpCircle, FiTrash, FiUserPlus } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { loadBlocksThunk } from '../store/blockThunks';
import { selectBlocks } from '../store/blockSlice';
import { loadFacultiesThunk } from '../store/facultyThunks';
import { selectAllFaculty, selectFacultyFilterOptions } from '../store/facultySlice';
import { loadProspectusThunk } from '../store/prospectusThunks';
import { selectAllProspectus } from '../store/prospectusSlice';
import { selectSettings } from '../store/settingsSlice';
import { selectAllCourses } from '../store/dataSlice';
import api from '../services/apiService';
import FacultySelect from '../components/FacultySelect';
import AssignFacultyModal from '../components/AssignFacultyModal';
import { updateScheduleThunk, deleteScheduleThunk, loadAllSchedules } from '../store/dataThunks';
import { getTimeOptions } from '../utils/timeOptions';
import { normalizeTimeBlock } from '../utils/timeNormalize';
import { parseTimeBlockToMinutes, parseF2FDays } from '../utils/conflicts';
import { buildIndexes, buildFacultyStats, buildFacultyScoreMap, normalizeSem } from '../utils/facultyScoring';

// --- helpers (same as previous) ---
function parseBlockMeta(blockCode) {
  const s = String(blockCode || '').trim();
  if (!s) return { programcode: '', yearlevel: '', section: '' };
  let m = s.match(/^([A-Z0-9-]+)\s+(\d+)(?:[^\d]*)/i);
  if (m) {
    const programcode = (m[1] || '').toUpperCase();
    const yearlevel = m[2] || '';
    const secM = s.substring(m[0].length - (m[2]?.length || 0)).match(/\d+[-\s]*([A-Z0-9]+)$/i);
    const section = secM ? (secM[1] || '') : '';
    return { programcode, yearlevel, section };
  }
  const [head, rest] = s.split('-');
  if (rest) {
    const m2 = rest.match(/(\d+)(.*)/);
    const programcode = (head || '').toUpperCase();
    const yearlevel = m2 ? (m2[1] || '') : '';
    const section = m2 ? (m2[2] || '').trim() : '';
    return { programcode, yearlevel, section };
  }
  const m3 = s.match(/^(\D+?)(\d+)/);
  if (m3) {
    return { programcode: (m3[1] || '').replace(/[-\s]+$/,'').toUpperCase(), yearlevel: m3[2] || '', section: '' };
  }
  return { programcode: s.toUpperCase(), yearlevel: '', section: '' };
}
function normalizeProgramCode(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function extractYearDigits(val) { const m = String(val ?? '').match(/(\d+)/); return m ? m[1] : ''; }
// function normalizeSem(s) { const v = String(s || '').trim().toLowerCase(); if (!v) return ''; if (v.startsWith('1')) return '1st'; if (v.startsWith('2')) return '2nd'; if (v.startsWith('s')) return 'Sem'; return s; }
function canonicalTerm(s) { return normalizeSem(s); }

// --- UI subcomponents (unchanged structure) ---
function BlockList({ items, selectedId, onSelect, loading, onProgramChange }) {
  const border = useColorModeValue('gray.200','gray.700');
  const bg = useColorModeValue('white','gray.800');
  const muted = useColorModeValue('gray.600','gray.300');
  const [q, setQ] = React.useState('');
  const [prog, setProg] = React.useState('');
  const [yr, setYr] = React.useState('');

  const metaList = React.useMemo(() => {
    return (items || []).map(b => {
      const m = parseBlockMeta(b.blockCode || '');
      return { ref: b, prog: String(m.programcode || '').toUpperCase(), yr: String(m.yearlevel || '').trim() };
    });
  }, [items]);

  const programOptions = React.useMemo(() => {
    const set = new Set(metaList.map(m => m.prog).filter(Boolean));
    return Array.from(set).sort();
  }, [metaList]);

  const yearOptions = React.useMemo(() => {
    const list = metaList.filter(m => !prog || m.prog === prog).map(m => m.yr).filter(Boolean);
    const set = new Set(list);
    return Array.from(set).sort((a,b) => Number(a) - Number(b));
  }, [metaList, prog]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const arr = metaList.filter(m => (!prog || m.prog === prog) && (!yr || m.yr === yr)).map(m => m.ref);
    if (!needle) return arr;
    return arr.filter(b => String(b.blockCode || '').toLowerCase().includes(needle));
  }, [metaList, prog, yr, q]);
  const sorted = React.useMemo(() => {
    const arr = (filtered || []).slice();
    const keyOf = (b) => {
      const { programcode, yearlevel, section } = parseBlockMeta(b.blockCode || '');
      const yr = parseInt(yearlevel || '0', 10) || 0;
      const sec = String(section || '').padStart(3, '0');
      return [programcode, yr.toString().padStart(2,'0'), sec, (b.blockCode || '')].join('|');
    };
    return arr.sort((a,b) => keyOf(a).localeCompare(keyOf(b)));
  }, [filtered]);
  return (
    <VStack align="stretch" spacing={3} borderWidth="1px" borderColor={border} rounded="xl" p={3} bg={bg} minH="calc(100vh - 210px)">
      <HStack spacing={2} flexWrap="wrap">
        <Select size="sm" placeholder="Program" value={prog} onChange={(e)=>{ const v=e.target.value; setProg(v); setYr(''); try { onProgramChange && onProgramChange(v); } catch {} }} maxW="180px">
          {programOptions.map(p => <option key={p} value={p}>{p}</option>)}
        </Select>
        <Select size="sm" placeholder="Year" value={yr} onChange={(e)=>setYr(e.target.value)} maxW="120px">
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search blocks" size="sm" maxW="220px" />
        <IconButton aria-label="Search" icon={<FiSearch />} size="sm" variant="outline" />
      </HStack>
      <VStack align="stretch" spacing={2} overflowY="auto">
        {loading && <HStack><Spinner size="sm" /><Text color={muted}>Loading blocks…</Text></HStack>}
        {!loading && sorted.map(b => (
          <Box key={b.id}
            onClick={()=>onSelect(b)}
            cursor="pointer"
            p={2}
            borderWidth="1px"
            borderColor={String(selectedId)===String(b.id)?'blue.400':border}
            rounded="md"
            _hover={{ borderColor: 'blue.400' }}
          >
            <HStack justify="space-between">
              <Text fontWeight="600">{b.blockCode}</Text>
              {b.isActive ? <Badge colorScheme="green">Active</Badge> : <Badge>Inactive</Badge>}
            </HStack>
            <Wrap mt={1} spacing={1}>
              {(String(b.room || '').split(',').map(x=>x.trim()).filter(Boolean)).slice(0,3).map((r, i)=>( 
                <WrapItem key={`r-${b.id}-${i}`}><Tag size="sm" variant="subtle" colorScheme="blue">{r}</Tag></WrapItem>
              ))}
            </Wrap>
            {b.session && <Text fontSize="xs" color={muted} mt={1}>{b.session}</Text>}
          </Box>
        ))}
        {!loading && sorted.length === 0 && (
          <Text fontSize="sm" color={muted}>No blocks match.</Text>
        )}
      </VStack>
    </VStack>
  );
}

// function AssignmentRow({ row, faculties, schedulesSource, allCourses, blockCode, disabled, onChange, onToggle, onRequestLockChange, onRequestConflictInfo, onRequestSuggest, onRequestDelete, onRequestAssign, onRequestResolve, onRequestAddToSwap }) {
//   const timeOpts = getTimeOptions();
//   const dayOpts = ['MON-FRI','Mon','Tue','Wed','Thu','Fri','Sat','Sun','MWF','TTH','TBA'];
//   const semOpts = ['1st','2nd','Sem'];
//   const rowBorder = useColorModeValue('gray.100','gray.700');
//   const mutedText = useColorModeValue('gray.600','gray.300');
//   const isLocked = !!row?._locked || (function(v){ if (typeof v==='boolean') return v; const s=String(v||'').toLowerCase(); return s==='yes'||s==='true'||s==='1'; })(row?.lock);
//   const hasDoubleBooked = Array.isArray(row?._conflictDetails) && row._conflictDetails.some(d => String(d?.reason || '').toLowerCase().includes('double-booked: same faculty'));
//   const normTerm = (v) => {
//     const s = String(v || '').trim().toLowerCase();
//     if (s.startsWith('1')) return '1st'; if (s.startsWith('2')) return '2nd'; if (s.startsWith('s')) return 'Sem'; return String(v||'');
//   };
//   const timeKey = (t) => normalizeTimeBlock(t || '')?.key || String(t||'').trim();
//   const sectionOf = (s) => String(s?.section ?? s?.blockCode ?? '').trim().toLowerCase();
//   const facultyKey = (s) => (s.facultyId != null ? `id:${s.facultyId}` : `nm:${String(s.instructor || s.faculty || '').toLowerCase().replace(/[^a-z0-9]/g,'')}`);
//   const currFacKey = (row._facultyId != null ? `id:${row._facultyId}` : `nm:${String(row._faculty || '').toLowerCase().replace(/[^a-z0-9]/g,'')}`);
//   const eligibleOptions = React.useMemo(() => {
//     // If term/time not chosen yet, show full list
//     if (!row?._term || !row?._time) return faculties || [];
//     const sect = String(blockCode || '').trim().toLowerCase();
//     const tKey = timeKey(row._time);
//     const term = normTerm(row._term);
//     const busy = new Set();
//     for (const s of (schedulesSource || [])) {
//       if (row._existingId && String(s.id) === String(row._existingId)) continue; // skip same row
//       if (normTerm(s.term) !== term) continue;
//       const sSect = sectionOf(s);
//       if (sSect !== sect) continue; // we only constrain within same block
//       const sKey = timeKey(s.schedule || s.time || '');
//       if (!sKey || !tKey) continue;
//       // consider exact same slot or overlapping ranges
//       if (sKey === tKey) busy.add(facultyKey(s));
//       else {
//         const a = normalizeTimeBlock(sKey); const b = normalizeTimeBlock(tKey);
//         if (a && b && Number.isFinite(a.start) && Number.isFinite(a.end) && Number.isFinite(b.start) && Number.isFinite(b.end)) {
//           if (Math.max(a.start, b.start) < Math.min(a.end, b.end)) busy.add(facultyKey(s));
//         }
//       }
//     }
//     // Filter base list by excluding busy; always include current selection to avoid dropping it visually
//     const base = faculties || [];
//     const currentInList = base.find(o => (o.id != null ? `id:${o.id}` : `nm:${String(o.label||'').toLowerCase().replace(/[^a-z0-9]/g,'')}`) === currFacKey);
//     const filtered = base.filter(o => {
//       const key = (o.id != null ? `id:${o.id}` : `nm:${String(o.label||'').toLowerCase().replace(/[^a-z0-9]/g,'')}`);
//       if (key === currFacKey) return true; // keep current selection even if busy
//       return !busy.has(key);
//     });
//     // Compute scores aligned with AssignFacultyModal main factors (approximation)
//     const seededRand = (seedStr) => {
//       let h = 1779033703 ^ String(seedStr||'').length;
//       for (let i=0;i<String(seedStr||'').length;i++) {
//         h = Math.imul(h ^ String(seedStr).charCodeAt(i), 3432918353);
//         h = (h << 13) | (h >>> 19);
//       }
//       h = Math.imul(h ^ (h >>> 16), 2246822507);
//       h = Math.imul(h ^ (h >>> 13), 3266489909);
//       h ^= h >>> 16;
//       const t = h >>> 0;
//       let x = t >>> 0;
//       x = (x + 0x6D2B79F5) >>> 0;
//       let r = Math.imul(x ^ (x >>> 15), 1 | x);
//       r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
//       return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
//     };
//     const program = String(row.programcode || row.program || '').toLowerCase();
//     const deptTarget = String(row.dept || '').toLowerCase();
//     const statsByFac = new Map();
//     const bandOf = (mid) => (Number.isFinite(mid) && mid < 12*60) ? 'AM' : (Number.isFinite(mid) && mid >= 17*60 ? 'EVE' : 'PM');
//     for (const s of (schedulesSource || [])) {
//       const key = facultyKey(s);
//       if (!key) continue;
//       const st = statsByFac.get(key) || { units: 0, courses: 0, byProgram: 0, timeMids: [], am:0, pm:0, eve:0 };
//       st.units += Number(s.unit || 0) || 0;
//       st.courses += 1;
//       const progS = String(s.programcode || s.program || '').toLowerCase();
//       if (progS && program && progS === program) st.byProgram += 1;
//       const tStr = String(s.schedule || s.time || '').trim();
//       const tr = parseTimeBlockToMinutes(tStr);
//       if (Number.isFinite(tr.start) && Number.isFinite(tr.end)) {
//         const mid = (tr.start + tr.end) / 2;
//         st.timeMids.push(mid);
//         const b = bandOf(mid);
//         if (b==='AM') st.am++; else if (b==='PM') st.pm++; else st.eve++;
//       }
//       statsByFac.set(key, st);
//     }
//     // Helpers copied from AssignFacultyModal
//     const tok = (s) => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);
//     const normalizeTight = (s) => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
//     const simRatio = (a, b) => {
//       a=String(a||''); b=String(b||''); if (!a && !b) return 1; if (!a||!b) return 0; const m=a.length, n=b.length; if (!m||!n) return 1; const dp=Array.from({length:m+1},()=>new Array(n+1).fill(0)); for(let i=0;i<=m;i++)dp[i][0]=i; for(let j=0;j<=n;j++)dp[0][j]=j; for(let i=1;i<=m;i++){ for(let j=1;j<=n;j++){ const cost=a.charCodeAt(i-1)===b.charCodeAt(j-1)?0:1; dp[i][j]=Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost); } } const d=dp[m][n]; return Math.max(0,1 - d/Math.max(m,n)); };
//     const dice2Gram = (a,b) => { a=normalizeTight(a); b=normalizeTight(b); if (a===b) return 1; if (a.length<2||b.length<2) return simRatio(a,b); const grams=s=>{const arr=[]; for(let i=0;i<s.length-1;i++)arr.push(s.slice(i,i+2)); return arr;}; const aa=grams(a), bb=grams(b), set=new Set(aa); let inter=0; for(const g of bb) if(set.has(g)) inter++; return (2*inter)/(aa.length+bb.length); };
//     const tokenFuzzyBestRatio = (candTokens, poolTokens) => {
//       let best=0; for(const t of candTokens){ for(const p of poolTokens){ const r=simRatio(t,p); if (r>best) best=r; if (best>=1) return 1; } } return best; };

//     const scored = filtered.map(o => {
//       const key = (o.id != null ? `id:${o.id}` : `nm:${String(o.label||'').toLowerCase().replace(/[^a-z0-9]/g,'')}`);
//       const st = statsByFac.get(key) || { units: 0, courses: 0, byProgram: 0, timeMids: [], am:0, pm:0, eve:0 };
//       const release = Number(o.loadReleaseUnits || 0) || 0;
//       const baseline = Math.max(0, 24 - release);
//       const overload = Math.max(0, st.units - baseline);
//       // Employment
//       const emp = String(o.employment || '').toLowerCase();
//       const empScore = emp.includes('full') ? 1 : emp.includes('part') ? 0.6 : 0.5;
//       // Degree parsing (heuristic)
//       const nameLabel = String(o.label || o.name || o.faculty || '').toUpperCase();
//       const tokens = nameLabel.replace(/[^A-Z0-9\s\.]/g,' ').split(/[\s,]+/).filter(Boolean).map(t=>t.replace(/\.+/g,''));
//       const docSet = new Set(['DR','PHD','PH.D','DPA','EDD']);
//       const masSet = new Set(['MS','MA','MBA','MSC','M.SC','M.ED']);
//       const licSet = new Set(['RN','LPT','LET','ENGR','ARCH','CPA']);
//       let nDoc=0,nMas=0,nLic=0,nAtty=0,nCpa=0,nEng=0,nArx=0;
//       tokens.forEach(tt=>{ const u=tt.toUpperCase(); if(docSet.has(u)) nDoc++; if(masSet.has(u)) nMas++; if(licSet.has(u)) nLic++; if(u==='ATTY'||u==='JD') nAtty++; if(u==='CPA') nCpa++; if(u==='ENGR') nEng++; if(u==='ARCH') nArx++; });
//       let degreeScore = 0.4 + Math.min(0.9, nDoc*0.6) + (nAtty>0?0.5:0) + (nCpa>0?0.45:0) + Math.min(0.5, nMas*0.25) + Math.min(0.36, nLic*0.12) + Math.min(0.3, (nEng>0?0.15:0) + (nArx>0?0.15:0));
//       degreeScore = Math.max(0, Math.min(1, degreeScore));
//       // Time/session preference
//       const candTr = parseTimeBlockToMinutes(String(row._time || '').trim());
//       const candMid = (Number.isFinite(candTr.start) && Number.isFinite(candTr.end)) ? (candTr.start + candTr.end)/2 : NaN;
//       let nearest=0.5, kdeBest=0.5, probBest=0.5, sessionMatch=0.5;
//       const candBand = Number.isFinite(candMid)?bandOf(candMid):'AM';
//       const totalSess = st.am + st.pm + st.eve;
//       if (totalSess > 0) {
//         const cnt = candBand==='AM'?st.am:(candBand==='PM'?st.pm:st.eve);
//         sessionMatch = cnt / totalSess;
//       }
//       if (Number.isFinite(candMid) && st.timeMids.length) {
//         const diffs = st.timeMids.map(m=>Math.abs(m-candMid));
//         const minDiff = Math.min(...diffs);
//         nearest = Math.max(0, 1 - (minDiff/240));
//         // simple KDE approx against points
//         let num=0,den=0; const sigma=60; st.timeMids.forEach(m=>{ const d=(candMid-m); const w=Math.exp(-(d*d)/(2*sigma*sigma)); num+=w; den+=1; });
//         kdeBest = den>0 ? Math.max(0, Math.min(1, num/den)) : 0.5;
//         // crude probability proxy by band
//         probBest = sessionMatch;
//       }
//       // Build rowsAll similar to modal using global courses for this faculty
//       const rowsAll = (allCourses||[]).filter(s=>{
//         const k = (s.facultyId != null) ? `id:${s.facultyId}` : `nm:${String(s.faculty || s.instructor || s.facultyName || '').toLowerCase().replace(/[^a-z0-9]/g,'')}`;
//         return k === key;
//       });
//       // Course match
//       const candCode = String(row.course_name || row.courseName || row.code || '');
//       const candTitle = String(row.course_title || row.courseTitle || row.title || '');
//       const candCodeTokens = tok(candCode);
//       const candTitleTokens = tok(candTitle);
//       const candTokens = Array.from(new Set(candCodeTokens.concat(candTitleTokens)));
//       const codeHasDigits = /\d/.test(candCode);
//       let matchScore = 0.5;
//       if (candTokens.length) {
//         let best = 0;
//         for (const r of rowsAll) {
//           const rCodeTokens = tok(r.code || r.courseName || '');
//           const rTitleTokens = tok(r.title || r.courseTitle || '');
//           const rTokensAll = Array.from(new Set(rCodeTokens.concat(rTitleTokens)));
//           if (!rTokensAll.length) continue;
//           const rCodeJoined = normalizeTight(String(r.code || r.courseName || ''));
//           const rTitleJoined = normalizeTight(String(r.title || r.courseTitle || ''));
//           const rJoined = normalizeTight(`${String(r.code || r.courseName || '')} ${String(r.title || r.courseTitle || '')}`);
//           const candCodeJoined = normalizeTight(candCode);
//           if (candCodeJoined && rCodeJoined && candCodeJoined === rCodeJoined) { best = 1; break; }
//           const codeTokenMatch = tokenFuzzyBestRatio(candCodeTokens, rCodeTokens.length ? rCodeTokens : rTokensAll);
//           const titleTokenMatch = tokenFuzzyBestRatio(candTitleTokens, rTitleTokens.length ? rTitleTokens : rTokensAll);
//           const tokenCodeW = codeHasDigits ? 0.88 : 0.82;
//           const tokenTitleW = 1 - tokenCodeW;
//           const tokenMatch = tokenCodeW * codeTokenMatch + tokenTitleW * titleTokenMatch;
//           const codeDice = dice2Gram(candCodeJoined, rCodeJoined);
//           const titleDice = dice2Gram(normalizeTight(candTitle), rTitleJoined);
//           const charMatch = 0.8 * codeDice + 0.2 * titleDice;
//           let combo = 0.75 * tokenMatch + 0.25 * charMatch;
//           const codeNear = Math.max(simRatio(candCodeJoined, rCodeJoined), codeDice);
//           if (codeNear >= 0.94) combo = Math.max(combo, 1.0);
//           if (combo > best) best = combo;
//           if (best >= 1) break;
//         }
//         const weakThresh = 0.5;
//         if (best <= weakThresh) matchScore = 0.5; else { const scaled = (best - weakThresh) / (1 - weakThresh); matchScore = 0.5 + 0.5 * Math.max(0, Math.min(1, scaled)); }
//       }
//       const deptScore = (deptTarget && String(o.dept||'').toLowerCase()===deptTarget) ? 1 : 0;
//       const progScore = Math.min(1, (st.byProgram || 0) / 5);
//       const loadScore = Math.max(0, 1 - (st.units || 0) / Math.max(1, baseline || 24));
//       const overScore = Math.max(0, 1 - (overload / 6));
//       const timeScore = 0.4 * kdeBest + 0.25 * probBest + 0.2 * nearest + 0.15 * sessionMatch;
//       const wDept=0.15, wEmp=0.05, wDeg=0.22, wTime=0.18, wLoad=0.10, wOver=0.04, wExp=0.08, wMatch=0.18;
//       // Basic expScore approximation: number of rows seen in current set
//       const rowsCount = (schedulesSource||[]).filter(s=>facultyKey(s)===key).length;
//       const expScore = Math.min(1, rowsCount/8);
//       const score01 = wDept*deptScore + wEmp*empScore + wDeg*degreeScore + wTime*timeScore + wLoad*loadScore + wOver*overScore + wExp*expScore + wMatch*matchScore;
//       const sId = String(row?.id || row?._existingId || '')+'|'+String(row?.course_name||row?.courseName||'')+'|'+String(blockCode||'')+'|'+String(row?._term||'');
//       const fId = (o.id != null ? String(o.id) : String(o.label||''));
//       const jitter = (seededRand(sId+'|'+fId) * 0.06) - 0.03;
//       const score = Math.max(1, Math.min(10, (score01 + jitter) * 10));
//       return { ...o, score: Number(score.toFixed(2)), parts: { dept: deptScore, employment: empScore, degree: degreeScore, time: timeScore, load: loadScore, overload: overScore, termExp: expScore, match: matchScore } };
//     });
//     // Sort by score desc then label
//     scored.sort((a,b) => {
//       const da = (typeof a.score === 'number') ? a.score : -1;
//       const db = (typeof b.score === 'number') ? b.score : -1;
//       if (db !== da) return db - da;
//       return String(a.label||'').localeCompare(String(b.label||''));
//     });
//     return scored;
//   }, [faculties, schedulesSource, blockCode, row?._term, row?._time, row?._existingId, row?._facultyId, row?._faculty]);
//   return (
//     <HStack spacing={2} py={2} borderBottomWidth="1px" borderColor={rowBorder}>
//       <Checkbox isChecked={!!row._selected} onChange={(e)=>onToggle(e.target.checked)} isDisabled={disabled} />
//       <Box flex="1 1 auto">
//         <Text fontWeight="600">{row.course_name || row.courseName} <Text as="span" fontWeight="400" color={mutedText}>({row.course_title || row.courseTitle})</Text></Text>
//         <HStack spacing={3} fontSize="sm" color={mutedText}>
//           <Text>Units: {row.unit ?? '-'}</Text>
//           <Text>Year: {row.yearlevel ?? '-'}</Text>
//           <Text>Sem: {row.semester ?? '-'}</Text>
//         </HStack>
//       </Box>
//       {row._existingId && (
//         row._locked ? (
//           <Tooltip label="Locked. Click to unlock."><IconButton aria-label="Unlock" icon={<FiLock />} size="sm" colorScheme="red" variant="ghost" onClick={()=>onRequestLockChange(false)} /></Tooltip>
//         ) : (
//           <Tooltip label="Unlocked. Click to lock."><IconButton aria-label="Lock" icon={<FiLock />} size="sm" variant="ghost" onClick={()=>onRequestLockChange(true)} /></Tooltip>
//         )
//       )}
//       <Select size="sm" value={row._term || ''} onChange={(e)=>onChange({ _term: e.target.value })} isDisabled={disabled || row._locked} maxW="130px">
//         <option value="">Term</option>
//         {semOpts.map(s => <option key={s} value={s}>{s}</option>)}
//       </Select>
//       <Select size="sm" value={row._day || 'MON-FRI'} onChange={(e)=>onChange({ _day: e.target.value })} isDisabled={disabled || row._locked} maxW="140px">
//         {dayOpts.map(d => <option key={d} value={d}>{d}</option>)}
//       </Select>
//       <Select size="sm" value={row._time || ''} onChange={(e)=>onChange({ _time: e.target.value })} isDisabled={disabled || row._locked} maxW="160px">
//         {timeOpts.map(t => <option key={t} value={t}>{t || 'Time'}</option>)}
//       </Select>
//       <Box minW="220px" maxW="260px">
//         <FacultySelect
//           value={row._faculty || ''}
//           onChange={(name)=>onChange({ _faculty: name })}
//           onChangeId={(fid)=>onChange({ _facultyId: fid })}
//           options={eligibleOptions}
//           allowClear
//           disabled={disabled || row._locked}
//           placeholder="Faculty"
//         />
//       </Box>
//       <HStack spacing={1}>
//         {row._checking ? (
//           <HStack spacing={1}><Spinner size="xs" /><Text fontSize="xs" color={mutedText}>Checking...</Text></HStack>
//         ) : (
//           <Badge colorScheme={row._status === 'Assigned' ? 'green' : (row._status === 'Conflict' ? 'red' : 'gray')}>{row._status || 'Unassigned'}</Badge>
//         )}
//         {row._status === 'Conflict' && (
//           <>
//             <Tooltip label="Explain conflict"><IconButton aria-label="Conflict details" icon={<FiInfo />} size="xs" variant="ghost" onClick={onRequestConflictInfo} /></Tooltip>
//             <Tooltip label="Suggestions"><IconButton aria-label="Suggestions" icon={<FiHelpCircle />} size="xs" variant="ghost" onClick={onRequestSuggest} /></Tooltip>
//             {!isLocked && hasDoubleBooked && (
//               <Tooltip label="Resolve by replacing conflicting schedule">
//                 <Button size="xs" colorScheme="purple" variant="solid" onClick={onRequestResolve}>Resolve</Button>
//               </Tooltip>
//             )}
//           </>
//         )}
//         {!isLocked && row._existingId && (
//           <Tooltip label="Add to Swap">
//             <IconButton aria-label="Add to Swap" icon={<FiRefreshCw />} size="xs" variant="ghost" onClick={onRequestAddToSwap} />
//           </Tooltip>
//         )}
//         <Tooltip label={isLocked ? 'Locked. Unlock to assign.' : 'Assign faculty (scored)'}>
//           <IconButton aria-label="Assign faculty" icon={<FiUserPlus />} size="sm" colorScheme="blue" variant="ghost" onClick={onRequestAssign} isDisabled={disabled || isLocked} />
//         </Tooltip>
//         {row._existingId && (
//           <Tooltip label={isLocked ? 'Locked. Unlock to delete.' : 'Delete assignment'}>
//             <IconButton aria-label="Delete assignment" icon={<FiTrash />} size="sm" colorScheme="red" variant="ghost" onClick={onRequestDelete} isDisabled={disabled || isLocked} />
//           </Tooltip>
//         )}
//       </HStack>
//     </HStack>
//   );
// }

// --- main component ---

function AssignmentRow({
  row,
  faculties,
  schedulesSource,
  allCourses,
  blockCode,
  disabled,
  onChange,
  onToggle,
  onRequestLockChange,
  onRequestConflictInfo,
  onRequestSuggest,
  onRequestDelete,
  onRequestAssign,
  onRequestResolve,
  onRequestAddToSwap,
}) {
  const timeOpts = getTimeOptions();
  const dayOpts = ['MON-FRI', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'MWF', 'TTH', 'TBA'];
  const semOpts = ['1st', '2nd', 'Sem'];

  const rowBorder = useColorModeValue('gray.100', 'gray.700');
  const mutedText = useColorModeValue('gray.600', 'gray.300');

  const isLocked =
    !!row?._locked ||
    (function (v) {
      if (typeof v === 'boolean') return v;
      const s = String(v || '').toLowerCase();
      return s === 'yes' || s === 'true' || s === '1';
    })(row?.lock);

  const hasDoubleBooked =
    Array.isArray(row?._conflictDetails) &&
    row._conflictDetails.some(d =>
      String(d?.reason || '').toLowerCase().includes('double-booked: same faculty')
    );

  const normTerm = (v) => normalizeSem(v);
  const timeKey = (t) => normalizeTimeBlock(t || '')?.key || String(t || '').trim();
  const sectionOf = (s) => String(s?.section ?? s?.blockCode ?? '').trim().toLowerCase();
  const facultyKey = (s) =>
    s.facultyId != null
      ? `id:${s.facultyId}`
      : `nm:${String(s.instructor || s.faculty || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')}`;

  const currFacKey =
    row?._facultyId != null
      ? `id:${row._facultyId}`
      : `nm:${String(row._faculty || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')}`;

  // ---------------------------------------------------------------------------
  // Shared scoring: indexes + stats + score map, same engine as AssignFacultyModal
  // ---------------------------------------------------------------------------

  const indexesAll = React.useMemo(
    () => buildIndexes(allCourses || []),
    [allCourses]
  );

  const stats = React.useMemo(
    () => buildFacultyStats(faculties || [], allCourses || []),
    [faculties, allCourses]
  );

  const scheduleForScoring = React.useMemo(
    () => ({
      id: row?._existingId || row?.id,
      code: row?.course_name || row?.courseName || row?.code,
      title: row?.course_title || row?.courseTitle || row?.title,
      section: blockCode || row?.section || row?.blockCode,
      term: row?._term || row?.semester || row?.term,
      schedule: row?._time || row?.time || row?.schedule,
      day: row?._day || row?.day,
      program: row?.program,
      programcode: row?.programcode,
      dept: row?.dept,
      session: row?.session,
      f2fDays: row?.f2fDays || row?.f2fSched || row?.f2fsched || row?.day,
    }),
    [row, blockCode]
  );

  const scoreOf = React.useMemo(
    () =>
      buildFacultyScoreMap({
        faculties: faculties || [],
        stats,
        indexesAll,
        schedule: scheduleForScoring,
      }),
    [faculties, stats, indexesAll, scheduleForScoring]
  );

  // ---------------------------------------------------------------------------
  // Eligible options (with shared scores, no extra rounding)
  // ---------------------------------------------------------------------------

const eligibleOptions = React.useMemo(() => {
  const base = faculties || [];
  if (!row) return base;

  const noTermOrTime = !row?._term || !row?._time;

  const sect = String(blockCode || '').trim().toLowerCase();
  const tKey = timeKey(row._time);
  const term = normTerm(row._term);
  const busy = new Set();

  if (!noTermOrTime) {
    for (const s of schedulesSource || []) {
      if (row._existingId && String(s.id) === String(row._existingId)) continue;
      if (normTerm(s.term) !== term) continue;

      const sSect = sectionOf(s);
      if (sSect !== sect) continue;

      const sKey = timeKey(s.schedule || s.time || '');
      if (!sKey || !tKey) continue;

      if (sKey === tKey) {
        busy.add(facultyKey(s));
      } else {
        const a = normalizeTimeBlock(sKey);
        const b = normalizeTimeBlock(tKey);
        if (
          a &&
          b &&
          Number.isFinite(a.start) &&
          Number.isFinite(a.end) &&
          Number.isFinite(b.start) &&
          Number.isFinite(b.end)
        ) {
          if (Math.max(a.start, b.start) < Math.min(a.end, b.end)) {
            busy.add(facultyKey(s));
          }
        }
      }
    }
  }

  const filtered = base.filter(o => {
    const key =
      o.id != null
        ? `id:${o.id}`
        : `nm:${String(o.label || o.name || o.faculty || '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')}`;

    if (key === currFacKey) return true;
    if (noTermOrTime) return true;
    return !busy.has(key);
  });

  const scored = filtered.map(o => {
    const entry = scoreOf.get(String(o.id)) || { score: 0, parts: {} };
    const rawScore = entry.score ?? 0;

    return {
      ...o,
      // raw numeric score (full precision, for matching the modal)
      score: rawScore,
      // formatted score for display – ALWAYS two decimal places
      scoreLabel: Number(rawScore).toFixed(2),
      parts: entry.parts || {},
    };
  });

  scored.sort((a, b) => {
    const sa = typeof a.score === 'number' ? a.score : -1;
    const sb = typeof b.score === 'number' ? b.score : -1;
    if (sb !== sa) return sb - sa;
    const la = String(a.label || a.name || a.faculty || '');
    const lb = String(b.label || b.name || b.faculty || '');
    return la.localeCompare(lb);
  });

  return scored;
}, [
  faculties,
  schedulesSource,
  blockCode,
  row?._term,
  row?._time,
  row?._existingId,
  row?._facultyId,
  row?._faculty,
  scoreOf,
]);


  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <HStack spacing={2} py={2} borderBottomWidth="1px" borderColor={rowBorder}>
      <Checkbox
        isChecked={!!row._selected}
        onChange={(e) => onToggle(e.target.checked)}
        isDisabled={disabled}
      />
      <Box flex="1 1 auto">
        <Text fontWeight="600">
          {row.course_name || row.courseName}{' '}
          <Text as="span" fontWeight="400" color={mutedText}>
            ({row.course_title || row.courseTitle})
          </Text>
        </Text>
        <HStack spacing={3} fontSize="sm" color={mutedText}>
          <Text>Units: {row.unit ?? '-'}</Text>
          <Text>Year: {row.yearlevel ?? '-'}</Text>
          <Text>Sem: {row.semester ?? '-'}</Text>
        </HStack>
      </Box>

      {row._existingId && (
        isLocked ? (
          <Tooltip label="Locked. Click to unlock.">
            <IconButton
              aria-label="Unlock"
              icon={<FiLock />}
              size="sm"
              colorScheme="red"
              variant="ghost"
              onClick={() => onRequestLockChange(false)}
            />
          </Tooltip>
        ) : (
          <Tooltip label="Unlocked. Click to lock.">
            <IconButton
              aria-label="Lock"
              icon={<FiLock />}
              size="sm"
              variant="ghost"
              onClick={() => onRequestLockChange(true)}
            />
          </Tooltip>
        )
      )}

      <Select
        size="sm"
        value={row._term || ''}
        onChange={(e) => onChange({ _term: e.target.value })}
        isDisabled={disabled || row._locked}
        maxW="130px"
      >
        <option value="">Term</option>
        {semOpts.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>

      <Select
        size="sm"
        value={row._day || 'MON-FRI'}
        onChange={(e) => onChange({ _day: e.target.value })}
        isDisabled={disabled || row._locked}
        maxW="140px"
      >
        {dayOpts.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </Select>

      <Select
        size="sm"
        value={row._time || ''}
        onChange={(e) => onChange({ _time: e.target.value })}
        isDisabled={disabled || row._locked}
        maxW="160px"
      >
        {timeOpts.map((t) => (
          <option key={t} value={t}>
            {t || 'Time'}
          </option>
        ))}
      </Select>

      <Box minW="220px" maxW="260px">
        <FacultySelect
          value={row._faculty || ''}
          onChange={(name) => onChange({ _faculty: name })}
          onChangeId={(fid) => onChange({ _facultyId: fid })}
          options={eligibleOptions}
          allowClear
          disabled={disabled || row._locked}
          placeholder="Faculty"
        />
      </Box>

      <HStack spacing={1}>
        {row._checking ? (
          <HStack spacing={1}>
            <Spinner size="xs" />
            <Text fontSize="xs" color={mutedText}>
              Checking...
            </Text>
          </HStack>
        ) : (
          <Badge
            colorScheme={
              row._status === 'Assigned'
                ? 'green'
                : row._status === 'Conflict'
                ? 'red'
                : 'gray'
            }
          >
            {row._status || 'Unassigned'}
          </Badge>
        )}

        {row._status === 'Conflict' && (
          <>
            <Tooltip label="Explain conflict">
              <IconButton
                aria-label="Conflict details"
                icon={<FiInfo />}
                size="xs"
                variant="ghost"
                onClick={onRequestConflictInfo}
              />
            </Tooltip>
            <Tooltip label="Suggestions">
              <IconButton
                aria-label="Suggestions"
                icon={<FiHelpCircle />}
                size="xs"
                variant="ghost"
                onClick={onRequestSuggest}
              />
            </Tooltip>
            {!isLocked && hasDoubleBooked && (
              <Tooltip label="Resolve by replacing conflicting schedule">
                <Button
                  size="xs"
                  colorScheme="purple"
                  variant="solid"
                  onClick={onRequestResolve}
                >
                  Resolve
                </Button>
              </Tooltip>
            )}
          </>
        )}

        {!isLocked && row._existingId && (
          <Tooltip label="Add to Swap">
            <IconButton
              aria-label="Add to Swap"
              icon={<FiRefreshCw />}
              size="xs"
              variant="ghost"
              onClick={onRequestAddToSwap}
            />
          </Tooltip>
        )}

        <Tooltip label={isLocked ? 'Locked. Unlock to assign.' : 'Assign faculty (scored)'}>
          <IconButton
            aria-label="Assign faculty"
            icon={<FiUserPlus />}
            size="sm"
            colorScheme="blue"
            variant="ghost"
            onClick={onRequestAssign}
            isDisabled={disabled || isLocked}
          />
        </Tooltip>

        {row._existingId && (
          <Tooltip label={isLocked ? 'Locked. Unlock to delete.' : 'Delete assignment'}>
            <IconButton
              aria-label="Delete assignment"
              icon={<FiTrash />}
              size="sm"
              colorScheme="red"
              variant="ghost"
              onClick={onRequestDelete}
              isDisabled={disabled || isLocked}
            />
          </Tooltip>
        )}
      </HStack>
    </HStack>
  );
}

export default function CourseLoading() {
  const dispatch = useDispatch();
  const toast = useToast();
  const border = useColorModeValue('gray.200','gray.700');
  const panelBg = useColorModeValue('white','gray.800');
  const subtle = useColorModeValue('gray.600','gray.300');
  const dividerBorder = useColorModeValue('gray.100','gray.700');

  const blocks = useSelector(selectBlocks);
  const facultyAll = useSelector(selectAllFaculty);
  const facultyOpts = useSelector(selectFacultyFilterOptions);
  const blocksLoading = useSelector(s => s.blocks.loading);
  const settings = useSelector(selectSettings);
  const prospectus = useSelector(selectAllProspectus);
  const existing = useSelector(selectAllCourses);
  const authUser = useSelector(s => s.auth.user);
  const role = String(authUser?.role || '').toLowerCase();
  const canLoad = (role === 'admin' || role === 'manager' || role === 'registrar');

  const [viewMode, setViewMode] = React.useState('blocks'); // 'blocks' | 'faculty'
  const [selectedBlock, setSelectedBlock] = React.useState(null);
  const [selectedFaculty, setSelectedFaculty] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [facLoading, setFacLoading] = React.useState(false);
  const [facOptions, setFacOptions] = React.useState([]);
  const [rows, setRows] = React.useState([]);
  // track schedule ids recently deleted so mapping won't re-prefill from stale fetch
  const excludeDeletedIdsRef = React.useRef(new Set());
  // cache freshly fetched schedules for the currently selected block (scoped by SY/Sem)
  const [freshCache, setFreshCache] = React.useState([]);
  // removed bulk assign state (deprecated)
  const [conflictOpen, setConflictOpen] = React.useState(false);
  const [conflictIndex, setConflictIndex] = React.useState(null);
  const [suggOpen, setSuggOpen] = React.useState(false);
  const [suggIndex, setSuggIndex] = React.useState(null);
  const [suggBusy, setSuggBusy] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState([]);
  // Faculty-view suggestions
  const [facSuggOpen, setFacSuggOpen] = React.useState(false);
  const [facSuggBusy, setFacSuggBusy] = React.useState(false);
  const [facSuggPlans, setFacSuggPlans] = React.useState([]);
  const [facSuggTargetId, setFacSuggTargetId] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [lockDialogBusy, setLockDialogBusy] = React.useState(false);
  const [lockDialogIndex, setLockDialogIndex] = React.useState(null);
  const [lockDialogBulkIdxs, setLockDialogBulkIdxs] = React.useState([]);
  const [lockDialogTarget, setLockDialogTarget] = React.useState(null);
  const [lockDialogOpen, setLockDialogOpen] = React.useState(false);
  const cancelRef = React.useRef();
  const [resolveOpen, setResolveOpen] = React.useState(false);
  const [resolveBusy, setResolveBusy] = React.useState(false);
  const [resolveRowIndex, setResolveRowIndex] = React.useState(null);
  const [resolveConflictId, setResolveConflictId] = React.useState(null);
  const [resolveLabel, setResolveLabel] = React.useState('');
  // Swap tray selections (persist across block/program changes)
  const [swapA, setSwapA] = React.useState(null);
  const [swapB, setSwapB] = React.useState(null);

  React.useEffect(() => { dispatch(loadBlocksThunk({})); }, [dispatch]);
  React.useEffect(() => { dispatch(loadFacultiesThunk({})); }, [dispatch]);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await api.getFaculties({});
        const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : (res?.items || []);
        const opts = (data || []).map(f => ({
          id: f.id,
          label: f.faculty || f.name || String(f.id),
          value: f.faculty || f.name || String(f.id),
          dept: f.dept || f.department || '',
          employment: f.employment || '',
          loadReleaseUnits: f.load_release_units ?? f.loadReleaseUnits ?? null,
        }));
        setFacOptions(opts);
      } catch (e) {
        setFacOptions([]);
      }
    })();
  }, []);

  const settingsLoad = settings?.schedulesLoad || { school_year: '', semester: '' };

  // Helper: reload currently selected block using the same path as the Reload button
  const reloadCurrentBlock = async () => {
    if (!selectedBlock) return;
    try {
      // Find a fresh instance from the blocks list to mimic a real click
      const byId = (blocks || []).find(b => String(b.id) === String(selectedBlock.id));
      const byCode = (blocks || []).find(b => !byId && String(b.blockCode) === String(selectedBlock.blockCode));
      const ref = byId || byCode || selectedBlock;
      await onSelectBlock(ref);
    } catch {}
  };

  // Quick retry wrapper for reload to handle eventual consistency (up to 3 tries)
  const retryReloadCurrentBlock = async (maxTries = 3, delayMs = 400) => {
    for (let i = 0; i < maxTries; i++) {
      try {
        await reloadCurrentBlock();
        return true;
      } catch {}
      await new Promise(res => setTimeout(res, delayMs));
    }
    return false;
  };

  const onSelectBlock = async (b) => {
    setSelectedBlock(b);
    const meta = parseBlockMeta(b.blockCode);
    setLoading(true);
    try {
      const action = await dispatch(loadProspectusThunk({ programcode: meta.programcode, yearlevel: meta.yearlevel, semester: settingsLoad?.semester || undefined }));
      let items = Array.isArray(action?.payload?.items) ? action.payload.items : (Array.isArray(prospectus) ? prospectus : []);
      const wantProgNorm = normalizeProgramCode(meta.programcode);
      const wantBaseNorm = normalizeProgramCode(meta.programcode.split('-')[0] || meta.programcode);
      const wantYear = extractYearDigits(meta.yearlevel);
      const tryExact = items.filter(p => normalizeProgramCode(p.programcode || p.program) === wantProgNorm);
      const dataset = tryExact.length > 0 ? tryExact : items.filter(p => normalizeProgramCode(p.programcode || p.program) === wantBaseNorm);
      let narrowed = dataset.filter(p => {
        if (!wantYear) return true;
        const y = extractYearDigits(p.yearlevel);
        return y === wantYear;
      });
      if (wantYear && narrowed.length === 0) narrowed = dataset;
      const loadSem = normalizeSem(settingsLoad?.semester || '');
      if (loadSem) {
        const bySem = narrowed.filter(p => normalizeSem(p.semester) === loadSem);
        if (bySem.length > 0) narrowed = bySem;
      }
      items = narrowed;
      const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g,' ').trim();
      const blockCode = String(b.blockCode || '').trim();
      // Fresh schedules from API for this block + current load SY/Sem
      let fresh = [];
      try {
        const q = new URLSearchParams();
        if (blockCode) q.set('blockCode', blockCode);
        if (settingsLoad?.school_year) q.set('sy', settingsLoad.school_year);
        if (settingsLoad?.semester) q.set('sem', settingsLoad.semester);
        const resp = await api.request(`/?${q.toString()}`);
        fresh = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
      } catch {}
      // Keep a local cache of fresh schedules so re-marking uses the same source
      setFreshCache(Array.isArray(fresh) ? fresh : []);
      const exRowsBase = fresh.length ? fresh : (existing || []);
      const exRows = exRowsBase.filter(c => !excludeDeletedIdsRef.current.has(c.id));
      const findExistingFor = (pros) => {
        const pid = pros?.id != null ? String(pros.id) : null;
        const pCode = norm(pros.course_name || pros.courseName || pros.code);
        const pTitle = norm(pros.course_title || pros.courseTitle || pros.title);
        const matches = exRows.filter(c => {
          const sectionVal = c.section != null ? c.section : (c.blockCode != null ? c.blockCode : '');
          const sameBlock = norm(sectionVal) === norm(blockCode);
          if (!sameBlock) return false;
          if (pid && String(c.prospectusId || '') === pid) return true;
          const cCode = norm(c.code || c.courseName);
          const cTitle = norm(c.title || c.courseTitle);
          const codeMatch = pCode && cCode && pCode === cCode;
          const titleMatch = pTitle && cTitle && pTitle === cTitle;
          return codeMatch || titleMatch;
        });
        return matches[0] || null;
      };

      const mapped = items.map(p => {
        const hit = findExistingFor(p);
        const locked = (() => {
          const v = hit?.lock;
          if (typeof v === 'boolean') return v;
          const s = String(v || '').trim().toLowerCase();
          return s === 'yes' || s === 'true' || s === '1';
        })();
        const prefill = hit ? {
          _term: canonicalTerm(hit.term || ''),
          _time: hit.schedule || hit.time || '',
          _faculty: hit.facultyName || hit.faculty || hit.instructor || '',
          _day: hit.day || 'MON-FRI',
        } : { _term: '', _time: '', _faculty: '', _day: 'MON-FRI' };
        return {
          ...p,
          ...prefill,
          _existingId: hit?.id || null,
          _locked: !!(hit && locked),
          _selected: false,
          _status: hit ? 'Assigned' : 'Unassigned',
        };
      });
      setRows(mapped);
    } finally {
      setLoading(false);
    }
  };

  // When existing schedules load/refresh, re-mark current block rows as Assigned/Unassigned
  React.useEffect(() => {
    if (!selectedBlock || !Array.isArray(rows) || rows.length === 0) return;
    const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g,' ').trim();
    const blockCode = String(selectedBlock.blockCode || '').trim();
    const findExistingForName = (name, title, pid) => {
      const pCode = norm(name);
      const pTitle = norm(title);
      const source = (freshCache && freshCache.length) ? freshCache : (existing || []);
      const matches = source.filter(c => {
        if (excludeDeletedIdsRef.current && excludeDeletedIdsRef.current.has(c.id)) return false;
        const sectionVal = c.section != null ? c.section : (c.blockCode != null ? c.blockCode : '');
        const sameBlock = norm(sectionVal) === norm(blockCode);
        if (!sameBlock) return false;
        if (pid && String(c.prospectusId || '') === String(pid)) return true;
        const cCode = norm(c.code || c.courseName);
        const cTitle = norm(c.title || c.courseTitle);
        const codeMatch = pCode && cCode && pCode === cCode;
        const titleMatch = pTitle && cTitle && pTitle === cTitle;
        return codeMatch || titleMatch;
      });
      return matches[0] || null;
    };
    const next = rows.map(r => {
      const hit = findExistingForName(r.course_name || r.courseName || r.code, r.course_title || r.courseTitle || r.title, r.id);
      const locked = (() => {
        const v = hit?.lock; if (typeof v === 'boolean') return v; const s = String(v || '').trim().toLowerCase(); return s === 'yes' || s === 'true' || s === '1';
      })();
      const prefillTerm = r._term || (hit ? canonicalTerm(hit.term || '') : '');
      const prefillTime = r._time || (hit ? (hit.schedule || hit.time || '') : '');
      const prefillFac = r._faculty || (hit ? (hit.facultyName || hit.faculty || hit.instructor || '') : '');
      const prefillDay = r._day || (hit ? (hit.day || 'MON-FRI') : 'MON-FRI');
      return {
        ...r,
        _existingId: hit?.id || null,
        _locked: !!(hit && locked),
        _status: hit ? 'Assigned' : 'Unassigned',
        _term: prefillTerm,
        _time: prefillTime,
        _faculty: prefillFac,
        _day: prefillDay,
      };
    });
    setRows(next);
  }, [existing, selectedBlock, freshCache]);

  // Assign Faculty Modal (Blocks view)
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [assignIndex, setAssignIndex] = React.useState(null);
  const openAssignForRow = (idx) => { setAssignIndex(idx); setAssignOpen(true); };
  const scheduleForAssign = React.useMemo(() => {
    if (assignIndex == null) return null;
    const r = rows[assignIndex];
    if (!r) return null;
    return {
      id: r._existingId || r.id || undefined,
      code: r.course_name || r.courseName || r.code,
      title: r.course_title || r.courseTitle || r.title,
      section: selectedBlock?.blockCode || r.section || '',
      term: r._term || r.term || '',
      time: r._time || r.time || r.schedule || '',
      schedule: r._time || r.time || r.schedule || '',
      room: '',
      program: selectedBlock?.program || undefined,
      programcode: parseBlockMeta(selectedBlock?.blockCode || '').programcode || undefined,
      session: selectedBlock?.session || '',
    };
  }, [assignIndex, rows, selectedBlock]);
  const handleAssignFromModal = async (fac) => {
    const idx = assignIndex;
    if (idx == null || !rows[idx]) { setAssignOpen(false); setAssignIndex(null); return; }
    const name = fac?.name || fac?.faculty || fac?.full_name || '';
    setRows(prev => prev.map((r,i) => i===idx ? { ...r, _faculty: name, _facultyId: fac?.id || null } : r));
    setTimeout(() => { try { checkRowConflictFresh(idx, { ...rows[idx], _faculty: name }); } catch {} }, 0);
    setAssignOpen(false); setAssignIndex(null);
  };

  // --- Faculty view helpers ---
  const [facDeptFilter, setFacDeptFilter] = React.useState('');
  const [facEmpFilter, setFacEmpFilter] = React.useState('');
  const [facQ, setFacQ] = React.useState('');
  const filteredFaculty = React.useMemo(() => {
    const norm = (s) => String(s || '').toLowerCase();
    const q = norm(facQ);
    return (facultyAll || []).filter(f => {
      const name = norm(f.name || f.faculty || f.instructorName || f.instructor || f.full_name);
      const dept = norm(f.department || f.dept || f.department_name || f.departmentName);
      const emp = norm(f.employment);
      if (facDeptFilter && dept !== norm(facDeptFilter)) return false;
      if (facEmpFilter && emp !== norm(facEmpFilter)) return false;
      if (q && !(name.includes(q) || dept.includes(q))) return false;
      return true;
    });
  }, [facultyAll, facDeptFilter, facEmpFilter, facQ]);

  const [facultySchedules, setFacultySchedules] = React.useState({ items: [], loading: false });
  const [facSelected, setFacSelected] = React.useState(new Set());
  const [facEdits, setFacEdits] = React.useState({}); // id -> { term,time,faculty,facultyId,_checking,_conflict,_details }
  const facCheckTimers = React.useRef(new Map());
  const fetchFacultySchedules = async (fac) => {
    if (!fac) return setFacultySchedules({ items: [], loading: false });
    const name = fac.faculty || fac.name || fac.instructor || '';
    if (!name) return setFacultySchedules({ items: [], loading: false });
    setFacultySchedules(prev => ({ ...prev, loading: true }));
    try {
      const sy = settingsLoad.school_year || '';
      const sem = settingsLoad.semester || '';
      let url = `/instructor/${encodeURIComponent(name)}?_ts=${Date.now()}`;
      if (sy) url += `&schoolyear=${encodeURIComponent(sy)}`;
      if (sem) url += `&semester=${encodeURIComponent(sem)}`;
      const res = await api.request(url);
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res?.items || []));
      const termOrder = (t) => { const v=String(t||'').trim().toLowerCase(); if (v.startsWith('1')) return 1; if (v.startsWith('2')) return 2; if (v.startsWith('s')) return 3; return 9; };
      const parseKey = (r) => {
        const t = termOrder(r.term);
        const m = parseTimeBlockToMinutes(String(r.scheduleKey || r.schedule || r.time || '').trim());
        const start = Number.isFinite(r.timeStartMinutes) ? r.timeStartMinutes : (Number.isFinite(m.start) ? m.start : 99999);
        return [t, start, String(r.courseName || r.code || '').toLowerCase()];
      };
      const sorted = (list || []).slice().sort((a,b) => {
        const ka = parseKey(a), kb = parseKey(b);
        for (let i=0;i<ka.length;i++){ if (ka[i]!==kb[i]) return ka[i]-kb[i]; }
        return 0;
      });
      setFacultySchedules({ items: sorted, loading: false });
      setFacSelected(new Set());
      // Seed edit state for quick inline changes
      setFacEdits(() => {
        const init = {};
        sorted.forEach(s => {
          init[s.id] = {
            term: canonicalTerm(s.term || ''),
            time: String(s.schedule || s.time || '').trim(),
            faculty: s.faculty || s.instructor || '',
            facultyId: s.facultyId || s.faculty_id || null,
            _checking: false,
            _conflict: false,
            _details: [],
            _ver: 0,
          };
        });
        return init;
      });
    } catch {
      setFacultySchedules({ items: [], loading: false });
    }
  };

  const updateFacEdit = (id, patch) => {
    let nextVer;
    setFacEdits(prev => {
      const curr = prev[id] || { _ver: 0 };
      const merged = { ...curr, ...patch, _ver: (curr._ver || 0) + 1 };
      nextVer = merged._ver;
      return { ...prev, [id]: merged };
    });
    try {
      // debounce per-row to ensure latest state is used and avoid rapid duplicate calls
      const map = facCheckTimers.current;
      if (map.has(id)) { clearTimeout(map.get(id)); map.delete(id); }
      const t = setTimeout(() => {
        const eCur = (facEdits[id] ? { ...facEdits[id], ...patch, _ver: nextVer } : { ...patch, _ver: nextVer });
        checkFacultyConflict(id, eCur, nextVer);
      }, 30);
      map.set(id, t);
    } catch {}
  };

  const checkFacultyConflict = async (id, editOverride, verToken) => {
    const base = facultySchedules.items.find(x => String(x.id) === String(id));
    const e = editOverride || facEdits[id];
    if (!base || !e) return;
    const term = String(e.term || '').trim();
    const timeStr = String(e.time || '').trim();
    const facName = String(e.faculty || '').trim();
    if (!term || !timeStr || !facName) {
      setFacEdits(prev => ({ ...prev, [id]: { ...prev[id], _checking: false, _conflict: false, _details: [] } }));
      return;
    }
    setFacEdits(prev => ({ ...prev, [id]: { ...prev[id], _checking: true } }));
    try {
      const payload = {
        term,
        time: timeStr,
        faculty: facName,
        facultyId: facName,
        schoolyear: settingsLoad.school_year || undefined,
        semester: settingsLoad.semester || undefined,
        blockCode: base.blockCode || base.section || '',
        courseName: base.courseName || base.code || '',
        session: base.session || '',
      };
      const res = await api.checkScheduleConflict(id, payload);
      const conflict = !!res?.conflict;
      const details = Array.isArray(res?.details) ? res.details : [];
      setFacEdits(prev => {
        const curr = prev[id];
        if (verToken != null && curr && curr._ver !== verToken) return prev; // stale result
        return { ...prev, [id]: { ...curr, _checking: false, _conflict: conflict, _details: details } };
      });
    } catch {
      setFacEdits(prev => ({ ...prev, [id]: { ...prev[id], _checking: false } }));
    }
  };

  const saveFacultyEdit = async (id) => {
    const base = facultySchedules.items.find(x => String(x.id) === String(id));
    const e = facEdits[id];
    if (!base || !e) return;
    const changes = {};
    if (canonicalTerm(base.term || '') !== e.term) changes.term = e.term;
    const baseTime = String(base.schedule || base.time || '').trim();
    if (baseTime !== e.time) changes.time = e.time;
    if ((base.facultyId || base.faculty_id || null) !== (e.facultyId || null)) changes.faculty_id = e.facultyId || null;
    if (Object.keys(changes).length === 0) return;
    try {
      await dispatch(updateScheduleThunk({ id, changes }));
      // Refresh schedule list to reflect persisted data
      await fetchFacultySchedules(selectedFaculty);
      dispatch(loadAllSchedules());
    } catch {}
  };

  const openFacultySuggestions = (id) => {
    const base = facultySchedules.items.find(x => String(x.id) === String(id));
    const e = facEdits[id];
    if (!base || !e) return;
    setFacSuggTargetId(id);
    setFacSuggOpen(true);
    setFacSuggBusy(true);
    setFacSuggPlans([]);
    setTimeout(async () => {
      try {
        const payload = {
          term: e.term,
          time: e.time,
          faculty: e.faculty,
          facultyId: e.facultyId || null,
          schoolyear: settingsLoad.school_year || undefined,
          semester: settingsLoad.semester || undefined,
          blockCode: base.blockCode || base.section || '',
          courseName: base.courseName || base.code || '',
          session: base.session || '',
        };
        const plans = await api.getScheduleSuggestions(id, payload, { maxDepth: 3 });
        setFacSuggPlans(Array.isArray(plans) ? plans : []);
      } catch {
        setFacSuggPlans([]);
      } finally {
        setFacSuggBusy(false);
      }
    }, 30);
  };

  // Faculty-view lock/unlock and delete handlers
  const toggleFacultyLock = async (id, nextLocked) => {
    try {
      await dispatch(updateScheduleThunk({ id, changes: { lock: nextLocked ? 'yes' : 'no', is_locked: nextLocked } }));
      await fetchFacultySchedules(selectedFaculty);
      // Refresh block mapping if a block is selected
      try { if (selectedBlock) await onSelectBlock(selectedBlock); } catch {}
      dispatch(loadAllSchedules());
      toast({ title: nextLocked ? 'Locked' : 'Unlocked', status: 'success' });
    } catch (e) {
      toast({ title: 'Action failed', description: e?.message || `Could not ${nextLocked ? 'lock' : 'unlock'} schedule.`, status: 'error' });
    }
  };

  const [facDelOpen, setFacDelOpen] = React.useState(false);
  const [facDelBusy, setFacDelBusy] = React.useState(false);
  const [facDelIndex, setFacDelIndex] = React.useState(null);
  const facDelCancelRef = React.useRef();
  const requestFacultyDelete = (idx) => { setFacDelIndex(idx); setFacDelOpen(true); };
  const confirmFacultyDelete = async () => {
    const idx = facDelIndex;
    const item = facultySchedules.items[idx];
    if (idx == null || !item) { setFacDelOpen(false); setFacDelIndex(null); return; }
    const isLocked = (function(v){ if (typeof v==='boolean') return v; const s=String(v||'').toLowerCase(); return s==='yes'||s==='true'||s==='1'; })(item.lock || item.is_locked);
    if (isLocked) { toast({ title: 'Locked schedule', description: 'Unlock the schedule before deleting.', status: 'warning' }); setFacDelOpen(false); setFacDelIndex(null); return; }
    setFacDelBusy(true);
    try {
      await dispatch(deleteScheduleThunk(item.id));
      await fetchFacultySchedules(selectedFaculty);
      // Also refresh block view mapping if a block is selected
      try { if (selectedBlock) await onSelectBlock(selectedBlock); } catch {}
      try { dispatch(loadAllSchedules()); } catch {}
      toast({ title: 'Deleted', description: `${item.code || item.courseName} removed.`, status: 'success' });
    } catch (e) {
      toast({ title: 'Delete failed', description: e?.message || 'Could not delete schedule.', status: 'error' });
    } finally {
      setFacDelBusy(false);
      setFacDelOpen(false);
      setFacDelIndex(null);
    }
  };

  // Faculty bulk lock/unlock selection helpers
  const facSelectedIds = React.useMemo(() => Array.from(facSelected || new Set()), [facSelected]);
  const facSelectedItems = React.useMemo(() => (facultySchedules.items || []).filter(it => facSelectedIds.includes(it.id)), [facSelectedIds, facultySchedules.items]);
  const isItemLocked = (it) => (function(v){ if (typeof v==='boolean') return v; const s=String(v||'').toLowerCase(); return s==='yes'||s==='true'||s==='1'; })(it?.lock || it?.is_locked);
  const allSelectedLocked = facSelectedItems.length > 0 && facSelectedItems.every(isItemLocked);
  const allSelectedUnlocked = facSelectedItems.length > 0 && facSelectedItems.every(it => !isItemLocked(it));

  const toggleFacSelect = (id, checked) => {
    setFacSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  // Assign Faculty Modal (Faculty view reassign)
  const [facAssignOpen, setFacAssignOpen] = React.useState(false);
  const [facAssignIndex, setFacAssignIndex] = React.useState(null);
  const openFacAssign = (idx) => { setFacAssignIndex(idx); setFacAssignOpen(true); };
  const scheduleForFacAssign = React.useMemo(() => {
    if (facAssignIndex == null) return null;
    const it = facultySchedules.items[facAssignIndex];
    if (!it) return null;
    return {
      id: it.id,
      code: it.code || it.courseName,
      title: it.title || it.courseTitle,
      section: it.section || it.blockCode || '',
      term: it.term || '',
      time: it.schedule || it.time || '',
      schedule: it.schedule || it.time || '',
      room: it.room || '',
      program: it.program || it.programcode || '',
      programcode: it.programcode || it.program || '',
      session: it.session || '',
    };
  }, [facAssignIndex, facultySchedules.items]);
  const handleFacAssign = async (fac) => {
    const idx = facAssignIndex;
    const it = facultySchedules.items[idx];
    if (idx == null || !it) { setFacAssignOpen(false); setFacAssignIndex(null); return; }
    try {
      await dispatch(updateScheduleThunk({ id: it.id, changes: { faculty_id: fac?.id || null } }));
      await fetchFacultySchedules(selectedFaculty);
      dispatch(loadAllSchedules());
      toast({ title: 'Assigned', description: `Assigned ${fac?.name || fac?.faculty || 'faculty'} to ${it.code || it.courseName}.`, status: 'success' });
    } catch (e) {
      toast({ title: 'Assign failed', description: e?.message || 'Could not assign faculty.', status: 'error' });
    } finally {
      setFacAssignOpen(false);
      setFacAssignIndex(null);
    }
  };

  // Bulk lock dialog state
  const [facLockOpen, setFacLockOpen] = React.useState(false);
  const [facLockBusy, setFacLockBusy] = React.useState(false);
  const [facLockTarget, setFacLockTarget] = React.useState(null); // true = lock, false = unlock
  const facLockCancelRef = React.useRef();
  const requestFacultyBulkLockChange = (nextLocked) => {
    if (facSelectedIds.length === 0) return;
    setFacLockTarget(!!nextLocked);
    setFacLockOpen(true);
  };
  const confirmFacultyBulkLockChange = async () => {
    const nextLocked = !!facLockTarget;
    setFacLockBusy(true);
    try {
      let count = 0;
      for (const it of facSelectedItems) {
        const curLocked = isItemLocked(it);
        if (curLocked === nextLocked) continue;
        await dispatch(updateScheduleThunk({ id: it.id, changes: { lock: nextLocked ? 'yes' : 'no', is_locked: nextLocked } }));
        count++;
      }
      if (count > 0) {
        await fetchFacultySchedules(selectedFaculty);
        try { if (selectedBlock) await onSelectBlock(selectedBlock); } catch {}
        dispatch(loadAllSchedules());
      }
      toast({ title: nextLocked ? 'Locked' : 'Unlocked', description: `${count} schedule(s) ${nextLocked ? 'locked' : 'unlocked'}.`, status: 'success' });
    } catch (e) {
      toast({ title: 'Action failed', description: e?.message || `Could not ${facLockTarget ? 'lock' : 'unlock'} selected schedules.`, status: 'error' });
    } finally {
      setFacLockBusy(false);
      setFacLockOpen(false);
      setFacLockTarget(null);
      setFacSelected(new Set());
    }
  };

  const applyFacultySuggestion = (plan) => {
    if (!plan || !plan.candidateChange || facSuggTargetId == null) return;
    const cc = plan.candidateChange;
    updateFacEdit(facSuggTargetId, { term: cc.toTerm || (facEdits[facSuggTargetId]?.term || ''), time: cc.toTime || (facEdits[facSuggTargetId]?.time || '') });
    setFacSuggOpen(false);
    setFacSuggTargetId(null);
  };

  const grouped = React.useMemo(() => {
    const map = new Map();
    (rows || []).forEach(r => {
      const prog = String(r.programcode || r.program || '').toUpperCase();
      const yr = String(r.yearlevel || '').trim();
      const key = prog + '|' + yr;
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    });
    const termOrder = (t) => {
      const v = String(t || '').trim().toLowerCase();
      if (v.startsWith('1')) return 1;
      if (v.startsWith('2')) return 2;
      if (v.startsWith('s')) return 3;
      return 9;
    };
    const out = [];
    map.forEach((arr, key) => {
      arr.sort((a, b) => {
        const oa = termOrder(a._term);
        const ob = termOrder(b._term);
        if (oa !== ob) return oa - ob;
        const ta = normalizeTimeBlock(a._time);
        const tb = normalizeTimeBlock(b._time);
        const sa = Number.isFinite(ta?.start) ? ta.start : Infinity;
        const sb = Number.isFinite(tb?.start) ? tb.start : Infinity;
        if (sa !== sb) return sa - sb;
        const ca = String(a.course_name || a.courseName || '').toLowerCase();
        const cb = String(b.course_name || b.courseName || '').toLowerCase();
        return ca.localeCompare(cb);
      });
      const [prog, yr] = key.split('|');
      out.push({ programcode: prog, yearlevel: yr, items: arr });
    });
    return out.sort((a,b) => a.programcode.localeCompare(b.programcode) || String(a.yearlevel).localeCompare(String(b.yearlevel)));
  }, [rows]);

  const requestLockChange = (idx, nextLocked) => {
    setLockDialogIndex(idx);
    setLockDialogBulkIdxs([]);
    setLockDialogTarget(!!nextLocked);
    setLockDialogOpen(true);
  };

  // Delete confirmation dialog state
  const [delDialogOpen, setDelDialogOpen] = React.useState(false);
  const [delDialogBusy, setDelDialogBusy] = React.useState(false);
  const [delDialogIndex, setDelDialogIndex] = React.useState(null);
  const delCancelRef = React.useRef();

  const requestDelete = (idx) => {
    setDelDialogIndex(idx);
    setDelDialogOpen(true);
  };

  const confirmDelete = async () => {
    const idx = delDialogIndex;
    if (idx == null) { setDelDialogOpen(false); return; }
    const row = rows[idx];
    if (!row || !row._existingId) { setDelDialogOpen(false); return; }
    // Prevent deleting locked schedules
    const isLocked = !!row?._locked || (function(v){ if (typeof v==='boolean') return v; const s=String(v||'').toLowerCase(); return s==='yes'||s==='true'||s==='1'; })(row?.lock);
    if (isLocked) {
      toast({ title: 'Locked schedule', description: 'Unlock the schedule before deleting.', status: 'warning' });
      setDelDialogOpen(false);
      setDelDialogIndex(null);
      return;
    }
    setDelDialogBusy(true);
    try {
      await dispatch(deleteScheduleThunk(row._existingId));
      // prevent immediate re-prefill from stale fetch by excluding this id once
      try { excludeDeletedIdsRef.current.add(row._existingId); } catch {}
      // Reset this row's editable fields immediately in UI
      setRows(prev => prev.map((r,i) => (
        i === idx
          ? { ...r, _existingId: null, _locked: false, _status: 'Unassigned', _term: '', _time: '', _faculty: '', _day: 'MON-FRI', _selected: false }
          : r
      )));
      // Immediately refresh block prospectus + schedules to remap UI accurately
      try { await onSelectBlock(selectedBlock); } catch {}
      // Also refresh global cache for other views
      try { dispatch(loadAllSchedules()); } catch {}
      toast({ title: 'Deleted', description: `${row.course_name || row.courseName || row.code} removed from assignments.`, status: 'success' });
    } catch (e) {
      toast({ title: 'Delete failed', description: e?.message || 'Could not delete schedule.', status: 'error' });
    } finally {
      setDelDialogBusy(false);
      setDelDialogOpen(false);
      setDelDialogIndex(null);
    }
  };

  const requestBulkLockChange = (nextLocked) => {
    const idxs = rows.map((r,i) => (r._selected && r._existingId ? i : -1)).filter(i => i >= 0);
    if (idxs.length === 0) return;
    setLockDialogIndex(null);
    setLockDialogBulkIdxs(idxs);
    setLockDialogTarget(!!nextLocked);
    setLockDialogOpen(true);
  };

  const confirmLockChange = async () => {
    const idxs = lockDialogBulkIdxs.length ? lockDialogBulkIdxs : (lockDialogIndex != null ? [lockDialogIndex] : []);
    if (idxs.length === 0) { setLockDialogOpen(false); return; }
    const nextLocked = !!lockDialogTarget;
    setLockDialogBusy(true);
    try {
      let count = 0;
      for (const idx of idxs) {
        const row = rows[idx];
        if (!row || !row._existingId) continue;
        await dispatch(updateScheduleThunk({ id: row._existingId, changes: { lock: nextLocked ? 'yes' : 'no', is_locked: nextLocked } }));
        count++;
      }
      if (count > 0) {
        try { if (selectedBlock) await onSelectBlock(selectedBlock); } catch {}
        dispatch(loadAllSchedules());
      }
      setRows(prev => prev.map((r,i) => idxs.includes(i) ? { ...r, _locked: nextLocked } : r));
      toast({ title: nextLocked ? 'Locked' : 'Unlocked', description: `${count} schedule(s) ${nextLocked ? 'locked' : 'unlocked'}.`, status: 'success' });
    } catch (e) {
      toast({ title: 'Action failed', description: e?.message || `Could not ${nextLocked ? 'lock' : 'unlock'} schedules.`, status: 'error' });
    } finally {
      setLockDialogBusy(false);
      setLockDialogOpen(false);
      setLockDialogIndex(null);
      setLockDialogBulkIdxs([]);
      setLockDialogTarget(null);
    }
  };

  const readyToLoad = canLoad && !!settingsLoad.school_year && !!settingsLoad.semester;

  const updateRow = (idx, patch) => setRows(prev => prev.map((r,i) => i===idx ? { ...r, ...patch } : r));
  const toggleRow = (idx, checked) => setRows(prev => prev.map((r,i) => i===idx ? { ...r, _selected: !!checked } : r));
  // removed bulk apply (deprecated)

  // ---------- enhanced conflict logic (now fetches ALL schedules + instructor schedules) ----------
  const normalizeTermForCompare = (t) => {
    const v = String(t || '').trim().toLowerCase();
    if (!v) return '';
    if (v.startsWith('1')) return '1st';
    if (v.startsWith('2')) return '2nd';
    if (v.startsWith('s')) return 'Sem';
    return v;
  };
  const normFaculty = (f) => String(f || '').trim().toLowerCase();
  const normSection = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  const normCode = (c) => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

  const getTimeRange = (timeStr) => {
    if (!timeStr) return null;
    try {
      const rn = parseTimeBlockToMinutes(String(timeStr).trim());
      if (rn && (Number.isFinite(rn.start) || Number.isFinite(rn.end) || rn.key)) return rn;
    } catch (e) {}
    try {
      const s = String(timeStr).trim();
      const m = s.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      if (m) {
        const parsePart = (p) => {
          let ss = p.trim().toLowerCase();
          const parts = ss.replace(/\s*(am|pm)$/,'').split(':');
          let hour = Number(parts[0]);
          let min = parts.length > 1 ? Number(parts[1]) : 0;
          if (ss.includes('pm') && hour < 12) hour += 12;
          if (ss.includes('am') && hour === 12) hour = 0;
          return hour * 60 + min;
        };
        const start = parsePart(m[1]);
        const end = parsePart(m[2]);
        return { start, end, key: `${start}-${end}` };
      }
    } catch (e) {}
    return { start: NaN, end: NaN, key: String(timeStr).trim() };
  };

  const timeRangesOverlap = (a, b) => {
    if (!a || !b) return false;
    const aStart = a.start, aEnd = a.end, bStart = b.start, bEnd = b.end;
    if (Number.isFinite(aStart) && Number.isFinite(aEnd) && Number.isFinite(bStart) && Number.isFinite(bEnd)) {
      return Math.max(aStart, bStart) < Math.min(aEnd, bEnd) || (aStart === bStart && aEnd === bEnd);
    }
    if (a.key && b.key) return String(a.key).trim() === String(b.key).trim();
    return false;
  };

  // fetch instructor schedules trying multiple identifiers (label/value) with optional filters
  const fetchInstructorSchedulesTry = async (candidates, { sy, sem } = {}) => {
    for (const cand of candidates) {
      if (!cand) continue;
      try {
        let url = `/instructor/${encodeURIComponent(String(cand))}?_ts=${Date.now()}`;
        if (sy) url += `&schoolyear=${encodeURIComponent(sy)}`;
        if (sem) url += `&semester=${encodeURIComponent(sem)}`;
        const res = await api.request(url);
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res?.items || []));
        if (Array.isArray(list) && list.length > 0) return list;
      } catch (e) {
        // continue to next candidate
      }
    }
    return [];
  };

  // fetch ALL saved schedules (non-cached) filtered to current load SY/semester if available
  const fetchAllSavedSchedules = async () => {
    try {
      const sy = settingsLoad.school_year || '';
      const sem = settingsLoad.semester || '';
      let url = `/?_ts=${Date.now()}`;
      if (sy) url += `&schoolyear=${encodeURIComponent(sy)}`;
      if (sem) url += `&semester=${encodeURIComponent(sem)}`;
      const res = await api.request(url);
      return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res?.items || []));
    } catch (e) {
      return [];
    }
  };

  const checkRowConflictFresh = async (idx, candRow) => {
    const row = candRow || rows[idx];
    if (!row) return;
    const term = String(row._term || '').trim();
    const timeStr = String(row._time || '').trim();

    // build faculty identifiers to try (label, value, facultyName)
    const opt = (facOptions || []).find(o => String(o.value) === String(row._faculty));
    const optByLabel = (facOptions || []).find(o => String(o.label) === String(row._faculty));
    const candidateIdentifiers = [];
    if (opt?.label) candidateIdentifiers.push(opt.label);
    if (opt?.value) candidateIdentifiers.push(opt.value);
    if (optByLabel && !candidateIdentifiers.includes(optByLabel.label)) candidateIdentifiers.push(optByLabel.label);
    if (row._faculty && !candidateIdentifiers.includes(row._faculty)) candidateIdentifiers.push(row._faculty);
    if (row.facultyName && !candidateIdentifiers.includes(row.facultyName)) candidateIdentifiers.push(row.facultyName);
    const uniqCandidates = Array.from(new Set(candidateIdentifiers.filter(Boolean)));

    if (!term || !timeStr || uniqCandidates.length === 0) {
      setRows(prev => prev.map((r,i) => i===idx ? { ...r, _status: r._status === 'Conflict' ? 'Unassigned' : r._status, _conflict: false, _conflictNote: '', _checking: false } : r));
      return;
    }

    setRows(prev => prev.map((r,i) => i===idx ? { ...r, _checking: true } : r));
    try {
      // prepare candidate norms and filters
      const candRange = getTimeRange(timeStr) || {};
      const candTermN = normalizeTermForCompare(term).toLowerCase();
      const candFacNorms = uniqCandidates.map(x => normFaculty(x));
      const candidateCodeNorm = normCode(row.course_name || row.courseName || row.code);
      const candidateSectionNorm = normSection(selectedBlock?.blockCode || '');
      const sy = settingsLoad.school_year || '';
      const sem = settingsLoad.semester || '';

      // Server-side conflict check
      const payload = {
        term,
        time: timeStr,
        day: row._day || undefined,
        faculty: opt?.label || row._faculty || row.faculty || '',
        facultyId: opt?.value || null,
        schoolyear: sy || undefined,
        semester: sem || undefined,
        blockCode: selectedBlock?.blockCode || '',
        courseName: row.course_name || row.courseName || row.code || ''
      };
      const idForCheck = row._existingId || 0;
      const res = await api.request(`/${encodeURIComponent(idForCheck)}/check`, { method: 'POST', body: JSON.stringify(payload) });
      const conflict = !!(res?.conflict);
      const details = Array.isArray(res?.details) ? res.details : [];
      setRows(prev => prev.map((r,i) => i===idx ? { ...r, _status: conflict ? 'Conflict' : (r._existingId ? 'Assigned' : 'Unassigned'), _conflict: conflict, _conflictNote: conflict ? 'Conflicts with an existing schedule for this faculty.' : '', _conflictDetails: details, _checking: false } : r));
    } catch (e) {
      setRows(prev => prev.map((r,i) => i===idx ? { ...r, _checking: false } : r));
      toast({ title: 'Conflict check failed', description: e?.message || 'Could not check conflicts.', status: 'error' });
    }
  };

  // when a row changes, do fresh check immediately
  const handleRowChange = (idx, patch) => {
    const base = rows[idx];
    const merged = { ...base, ...patch };
    setRows(prev => prev.map((r,i) => i===idx ? merged : r));
    setTimeout(() => { checkRowConflictFresh(idx, merged); }, 0);
  };

  const openSuggestions = (idx) => {
    setSuggIndex(idx);
    setSuggOpen(true);
    setSuggBusy(true);
    setSuggestions([]);
    setTimeout(async () => {
      try {
        const row = rows[idx];
        if (!row) { setSuggestions([]); return; }
        const payload = {
          term: row._term,
          time: row._time,
          day: row._day || undefined,
          faculty: row._faculty,
          blockCode: selectedBlock?.blockCode || '',
          courseName: row.course_name || row.courseName || row.code,
          schoolyear: settingsLoad?.school_year,
          semester: settingsLoad?.semester,
          session: selectedBlock?.session || '',
        };
        const id = row._existingId || 'new';
        const serverPlans = await api.getScheduleSuggestions(id, payload, { maxDepth: 3 });
        setSuggestions(Array.isArray(serverPlans) ? serverPlans : []);
      } catch (e) {
        setSuggestions([]);
      } finally {
        setSuggBusy(false);
      }
    }, 0);
  };

  const applySuggestion = (sugg) => {
    if (suggIndex == null) return;
    const idx = suggIndex;
    if (!rows[idx]) return;
    const cc = sugg && sugg.candidateChange;
    if (!cc) return; // only auto-apply simple candidate moves
    const next = rows.slice();
    next[idx] = { ...next[idx], _term: cc.toTerm || next[idx]._term, _time: cc.toTime || next[idx]._time };
    setRows(next);
    setSuggOpen(false);
    setSuggIndex(null);
    // Re-run conflict check on the updated row
    setTimeout(() => { try { checkRowConflictFresh(idx, next[idx]); } catch {} }, 0);
  };

  const preparePayload = (rowsToSave) => {
    const blockCode = selectedBlock?.blockCode || '';
    const toYearLabel = (yl) => {
      const n = parseInt(String(yl||'').trim(), 10);
      if (!Number.isFinite(n) || n <= 0) return String(yl||'');
      const suffix = (v) => (v===1?'st':v===2?'nd':v===3?'rd':'th');
      return `${n}${suffix(n)} Year`;
    };
    const facIdOf = (row) => {
      // Prefer explicit id tracked in row edits
      if (row._facultyId != null) return row._facultyId;
      // Try to find by label from known faculty list
      try {
        const name = String(row._faculty || '').trim().toLowerCase();
        const f = (facultyAll || []).find(x => String(x.name||x.faculty||'').trim().toLowerCase() === name);
        if (f && f.id != null) return f.id;
      } catch {}
      return null;
    };
    const findFaculty = (row, fid) => {
      try {
        if (fid != null) {
          const f = (facultyAll || []).find(x => String(x.id) === String(fid));
          if (f) return f;
        }
        const name = String(row._faculty || '').trim().toLowerCase();
        const f2 = (facultyAll || []).find(x => String(x.name||x.faculty||'').trim().toLowerCase() === name);
        if (f2) return f2;
      } catch {}
      return undefined;
    };
    const mapSemLong = (t) => {
      const v = String(t||'').trim().toLowerCase();
      if (!v) return '';
      if (v.startsWith('1')) return '1st Semester';
      if (v.startsWith('2')) return '2nd Semester';
      if (v.startsWith('s')) return 'Summer';
      return t;
    };
    return rowsToSave.map(r => {
      const yrLbl = toYearLabel(r.yearlevel);
      const facultyId = facIdOf(r);
      const facRec = findFaculty(r, facultyId);
      const deptVal = facRec ? (facRec.department || facRec.dept || facRec.department_name || facRec.departmentName) : undefined;
      const termVal = r._term;
      // Always use Schedules Load Defaults for semester labels
      const semLong = mapSemLong(settingsLoad.semester);
      const instr = facRec ? String(facRec.faculty || facRec.name || r._faculty || '').trim() : String(r._faculty || '').trim();
      // include _existingId so caller can decide update vs create
      return {
        _existingId: r._existingId || null,
        programcode: r.programcode || r.program,
        courseName: r.course_name || r.courseName,
        courseTitle: r.course_title || r.courseTitle,
        unit: r.unit,
        ...(termVal ? { term: termVal } : {}),
        ...(semLong ? { sem: semLong, semester: semLong } : {}),
        time: r._time,
        day: r._day || 'MON-FRI',
        faculty: instr,
        ...(facultyId != null ? { facultyId } : {}),
        ...(deptVal ? { dept: deptVal } : {}),
        // Explicitly link saved schedule to its prospectus row
        ...(r?.id != null ? { prospectusId: r.id } : {}),
        blockCode,
        schoolyear: settingsLoad.school_year,
        sy: settingsLoad.school_year,
        session: selectedBlock?.session || undefined,
        yearlevel: yrLbl,
        ...(authUser?.id != null ? { user_id_created: authUser.id, user_id_lastmodified: authUser.id } : {}),
      };
    });
  };

  const [swapBusy, setSwapBusy] = React.useState(false);
  const swapSelected = async () => {
    const idxs = rows.map((r,i) => (r._selected ? i : -1)).filter(i => i >= 0);
    if (idxs.length !== 2) { toast({ title: 'Select two rows', description: 'Pick exactly two schedules to swap faculty.', status: 'info' }); return; }
    const [i1, i2] = idxs;
    const r1 = rows[i1], r2 = rows[i2];
    if (!r1._existingId || !r2._existingId) { toast({ title: 'Swap unavailable', description: 'Swap applies only to existing schedules.', status: 'warning' }); return; }
    if (r1._locked || r2._locked) { toast({ title: 'Locked schedule', description: 'Unlock schedules before swapping.', status: 'warning' }); return; }
    if (r1._status === 'Conflict' || r2._status === 'Conflict') { toast({ title: 'Resolve conflicts first', description: 'Swap requires no conflicts on both schedules.', status: 'warning' }); return; }
    try {
      setSwapBusy(true);
      await api.swapSchedules(r1._existingId, r2._existingId);
      // Update UI immediately to reflect swapped faculty, then refresh
      setRows(prev => prev.map((r, idx) => {
        if (idx === i1) return { ...r, _faculty: (r2._faculty || ''), _facultyId: (r2._facultyId ?? null) };
        if (idx === i2) return { ...r, _faculty: (r1._faculty || ''), _facultyId: (r1._facultyId ?? null) };
        return r;
      }));
      try { await onSelectBlock(selectedBlock); } catch {}
      try { dispatch(loadAllSchedules()); } catch {}
      toast({ title: 'Swapped', description: 'Faculty swapped successfully.', status: 'success' });
    } catch (e) {
      toast({ title: 'Swap failed', description: e?.message || 'Could not swap faculty.', status: 'error' });
    } finally {
      setSwapBusy(false);
    }
  };

  const addToSwap = (row) => {
    if (!row || !row._existingId) { toast({ title: 'Only existing schedules', description: 'Save a schedule before adding to swap.', status: 'info' }); return; }
    if (row._locked) { toast({ title: 'Locked schedule', description: 'Unlock before swapping.', status: 'warning' }); return; }
    const label = `${row.course_name || row.courseName || row.code || 'Course'} • ${row._faculty || row.faculty || row.instructor || 'Faculty'} • ${(row._day || row.day || '').toString()} ${(row._time || row.time || '').toString()}`.trim();
    const entry = { id: row._existingId, label, blockCode: selectedBlock?.blockCode || row.blockCode || row.section || '' };
    if (!swapA || (swapA && swapA.id === entry.id)) { setSwapA(entry); return; }
    if (!swapB || (swapB && swapB.id === entry.id)) { setSwapB(entry); return; }
    // Replace A if both filled
    setSwapA(entry);
  };

  const clearSwapSlot = (slot) => { if (slot === 'A') setSwapA(null); else setSwapB(null); };

  const swapNow = async () => {
    if (!swapA || !swapB) { toast({ title: 'Select two schedules', status: 'info' }); return; }
    setSwapBusy(true);
    try {
      await api.swapSchedules(swapA.id, swapB.id);
      // Retry reload quickly to reflect persisted swap
      try { await retryReloadCurrentBlock(3, 400); } catch {}
      // Refresh other affected block(s) by temporarily selecting and reloading them, then restore current
      try {
        const prev = selectedBlock;
        const otherCodes = Array.from(new Set([swapA.blockCode, swapB.blockCode].filter(Boolean)));
        for (const code of otherCodes) {
          if (!prev || (prev && String(prev.blockCode) === String(code))) continue;
          const other = (blocks || []).find(b => String(b.blockCode) === String(code));
          if (other) {
            await onSelectBlock(other);
          }
        }
        if (prev) await onSelectBlock(prev);
      } catch {}

      try { await onSelectBlock(selectedBlock); } catch {}
      try { dispatch(loadAllSchedules()); } catch {}

      toast({ title: 'Swapped', description: 'Faculty swapped successfully.', status: 'success' });
      setSwapA(null); setSwapB(null);
    } catch (e) {
      toast({ title: 'Swap failed', description: e?.message || 'Could not swap faculty.', status: 'error' });
    } finally {
      setSwapBusy(false);
    }
  };

  // Resolve conflict: delete conflicting old schedule and save current row
  const requestResolve = async (idx) => {
    const row = rows[idx]; if (!row) return;
    const isLocked = !!row?._locked || (function(v){ if (typeof v==='boolean') return v; const s=String(v||'').toLowerCase(); return s==='yes'||s==='true'||s==='1'; })(row?.lock);
    if (isLocked) { toast({ title: 'Locked schedule', description: 'Unlock the schedule before resolving.', status: 'warning' }); return; }
    let details = Array.isArray(row._conflictDetails) ? row._conflictDetails : [];
    let target = details.find(d => String(d?.reason||'').toLowerCase().includes('double-booked: same faculty'));
    // If not present, perform a fresh server-side check to obtain conflict id and lock state
    if (!target) {
      try {
        const payload = {
          term: row._term,
          time: row._time,
          faculty: row._faculty,
          facultyId: row._facultyId || null,
          schoolyear: settingsLoad.school_year || undefined,
          semester: settingsLoad.semester || undefined,
          blockCode: selectedBlock?.blockCode || '',
          courseName: row.course_name || row.courseName || row.code || ''
        };
        const idForCheck = row._existingId || 0;
        const res = await api.request(`/${encodeURIComponent(idForCheck)}/check`, { method: 'POST', body: JSON.stringify(payload) });
        details = Array.isArray(res?.details) ? res.details : [];
        target = details.find(d => String(d?.reason||'').toLowerCase().includes('double-booked: same faculty'));
      } catch (e) {}
    }
    const confId = target?.item?.id;
    if (!confId) { toast({ title: 'Cannot resolve', description: 'No conflicting schedule found to replace.', status: 'warning' }); return; }
    const lockedFlag = (v) => { if (typeof v==='boolean') return v; const s=String(v||'').toLowerCase(); return s==='yes'||s==='true'||s==='1'; };
    if (lockedFlag(target?.item?.lock)) { toast({ title: 'Cannot resolve', description: 'Conflicting schedule is locked. Unlock it first.', status: 'warning' }); return; }
    try {
      const s = await api.getScheduleById(confId);
      const locked = (function(v){ if (typeof v==='boolean') return v; const st=String(v||'').toLowerCase(); return st==='yes'||st==='true'||st==='1'; })(s?.lock || s?.is_locked);
      if (locked) { toast({ title: 'Cannot resolve', description: 'Conflicting schedule is locked. Unlock it first.', status: 'warning' }); return; }
      const label = `${s?.code || s?.courseName || ''} ${s?.section ? '('+s.section+')' : ''}`.trim() || 'schedule';
      setResolveRowIndex(idx);
      setResolveConflictId(confId);
      setResolveLabel(label);
      setResolveOpen(true);
    } catch (e) {
      toast({ title: 'Cannot resolve', description: e?.message || 'Failed to load conflicting schedule.', status: 'error' });
    }
  };

  const saveOneRow = async (idx) => {
    const r = rows[idx]; if (!r) return;
    const [item] = preparePayload([r]);
    const { _existingId, ...body } = item || {};
    if (_existingId) await api.updateSchedule(_existingId, body); else await api.createSchedule(body);
  };

  const confirmResolve = async () => {
    const idx = resolveRowIndex; const confId = resolveConflictId;
    if (idx == null || !confId) { setResolveOpen(false); return; }
    setResolveBusy(true);
    try {
      // Perform resolve on server-side to ensure fresh checks and atomicity
      const row = rows[idx];
      const [item] = preparePayload([row]);
      const idForResolve = row?._existingId || 0;
      await api.resolveSchedule(idForResolve, item);
      // Refresh block cache and global list
      try { await onSelectBlock(selectedBlock); } catch {}
      try { dispatch(loadAllSchedules()); } catch {}
      toast({ title: 'Resolved', description: 'Replaced conflicting schedule with your new assignment.', status: 'success' });
    } catch (e) {
      toast({ title: 'Resolve failed', description: e?.message || 'Could not resolve the conflict.', status: 'error' });
    } finally {
      setResolveBusy(false);
      setResolveOpen(false);
      setResolveRowIndex(null);
      setResolveConflictId(null);
      setResolveLabel('');
    }
  };

  const computeConflicts = (pending) => {
    const timeKey = (t) => normalizeTimeBlock(t || '')?.key || '';
    const daysOf = (d) => {
      const v = String(d || '').trim().toUpperCase();
      if (!v || v === 'TBA') return [];
      const map = {
        'MON-FRI': ['MON','TUE','WED','THU','FRI'],
        'MWF': ['MON','WED','FRI'],
        'TTH': ['TUE','THU'],
        'MON': ['MON'], 'TUE': ['TUE'], 'WED': ['WED'], 'THU': ['THU'], 'FRI': ['FRI'], 'SAT': ['SAT'], 'SUN': ['SUN'],
      };
      if (map[v]) return map[v];
      return v.split(/[^A-Z]+/).filter(Boolean);
    };
    const matchLoad = (it) => {
      const syWant = String(settingsLoad?.school_year || '').trim().toLowerCase();
      const syHave = String(it.sy || it.schoolyear || it.schoolYear || '').trim().toLowerCase();
      if (syWant && syHave && syWant !== syHave) return false;
      const tWant = normalizeTermForCompare(settingsLoad?.semester || '').toLowerCase();
      const tHave = normalizeTermForCompare(it.term || it.semester || '').toLowerCase();
      if (tWant && tHave && tWant !== tHave) return false;
      return true;
    };
    const sourceBase = (freshCache && freshCache.length) ? freshCache : (existing || []);
    const source = sourceBase.filter(matchLoad);
    const seen = new Set();
    const errs = new Set();
    const dayKeys = (d) => {
      const list = daysOf(d);
      return list.length ? list : ['ANY'];
    };
    // Faculty-time-day conflicts within the same load term/SY
    pending.forEach((r) => {
      if (!r._faculty || !r._term || !r._time) return;
      const termN = String(normalizeTermForCompare(r._term)).toLowerCase();
      dayKeys(r._day).forEach((d) => {
        const k = [String(r._faculty).toLowerCase(), termN, d, timeKey(r._time)].join('|');
        if (seen.has(k)) errs.add(k);
        seen.add(k);
      });
    });
    source.forEach((c) => {
      const fac = String(c.faculty || c.instructor || '').toLowerCase();
      const term = String(normalizeTermForCompare(c.term || c.semester || '')).toLowerCase();
      dayKeys(c.day).forEach((d) => {
        const k = [fac, term, d, c.scheduleKey || timeKey(c.time)].join('|');
        if (seen.has(k)) errs.add(k);
      });
    });
    // Duplicate course detection within the same block (based on courseName/title) in the same load
    const dupSeen = new Set();
    const dupErrs = new Set();
    const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g,' ').trim();
    const blockCode = String(selectedBlock?.blockCode || '').trim().toLowerCase();
    pending.forEach((r) => {
      const code = norm(r.course_name || r.courseName || r.code);
      const title = norm(r.course_title || r.courseTitle || r.title);
      const key1 = blockCode + '|code:' + code;
      const key2 = blockCode + '|title:' + title;
      if (code) {
        if (dupSeen.has(key1)) dupErrs.add(key1);
        dupSeen.add(key1);
      }
      if (title) {
        if (dupSeen.has(key2)) dupErrs.add(key2);
        dupSeen.add(key2);
      }
    });
    source.forEach((c) => {
      const sect = norm(c.section != null ? c.section : (c.blockCode != null ? c.blockCode : ''));
      if (sect !== blockCode) return;
      const code = norm(c.code || c.courseName);
      const title = norm(c.title || c.courseTitle);
      const key1 = blockCode + '|code:' + code;
      const key2 = blockCode + '|title:' + title;
      if (code && dupSeen.has(key1)) dupErrs.add(key1);
      if (title && dupSeen.has(key2)) dupErrs.add(key2);
    });
    return (r) => {
      // Faculty/day/time conflict
      if (r._faculty && r._term && r._time) {
        const termN = String(normalizeTermForCompare(r._term)).toLowerCase();
        for (const d of dayKeys(r._day)) {
          const k = [String(r._faculty).toLowerCase(), termN, d, timeKey(r._time)].join('|');
          if (errs.has(k)) return true;
        }
      }
      // Duplicate course within block
      const code = norm(r.course_name || r.courseName || r.code);
      const title = norm(r.course_title || r.courseTitle || r.title);
      const k1 = blockCode + '|code:' + code;
      const k2 = blockCode + '|title:' + title;
      if ((code && dupErrs.has(k1)) || (title && dupErrs.has(k2))) return true;
      return false;
    };
  };

  const saveSelected = async () => {
    if (!readyToLoad) {
      toast({ title: 'Loading disabled', description: 'Set Schedules Load in Settings and ensure you have permission.', status: 'warning' });
      return;
    }
    const chosen = rows.filter(r => {
      const hasFaculty = (r._facultyId != null) || (String(r._faculty || '').trim() !== '');
      const hasTerm = String(r._term || '').trim() !== '';
      const hasTime = String(r._time || '').trim() !== '';
      return !!r._selected && hasFaculty && hasTerm && hasTime;
    });
    if (chosen.length === 0) {
      toast({ title: 'Nothing to save', status: 'info' });
      return;
    }
    // Do not rely on stale row._status; recompute consistently for current Load
    const isConflict = computeConflicts(chosen);
    let hasConflict = chosen.some(isConflict);
    if (hasConflict) {
      // Confirm with server: if server reports no conflict for all, proceed anyway
      let serverAnyConflict = false;
      try {
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          if (!r._selected) continue;
          const term = String(r._term || '').trim();
          const timeStr = String(r._time || '').trim();
          if (!term || !timeStr) continue;
          const payload = {
            term,
            time: timeStr,
            day: r._day || undefined,
            faculty: r._faculty || undefined,
            facultyId: r._facultyId || undefined,
            schoolyear: settingsLoad.school_year || undefined,
            semester: settingsLoad.semester || undefined,
            blockCode: selectedBlock?.blockCode || '',
            courseName: r.course_name || r.courseName || r.code || '',
            courseTitle: r.course_title || r.courseTitle || r.title || '',
          };
          const idForCheck = r._existingId || 0;
          try {
            const res = await api.request(`/${encodeURIComponent(idForCheck)}/check`, { method: 'POST', body: JSON.stringify(payload) });
            if (res && res.conflict) {
              serverAnyConflict = true;
              setRows(prev => prev.map((x,j) => j===i ? { ...x, _status: 'Conflict' } : x));
            }
          } catch {}
        }
      } catch {}
      if (serverAnyConflict) {
        toast({ title: 'Conflicts detected', description: 'Server reported conflicts. Please adjust assignment.', status: 'error' });
        return;
      }
      // Server says OK for all selected rows; continue with save despite local heuristic
    }
    // Server-side parity check per row to avoid false positives/negatives
    try {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r._selected) continue;
        const term = String(r._term || '').trim();
        const timeStr = String(r._time || '').trim();
        if (!term || !timeStr) continue;
        const payload = {
          term,
          time: timeStr,
          day: r._day || undefined,
          faculty: r._faculty || undefined,
          facultyId: r._facultyId || undefined,
          schoolyear: settingsLoad.school_year || undefined,
          semester: settingsLoad.semester || undefined,
          blockCode: selectedBlock?.blockCode || '',
          courseName: r.course_name || r.courseName || r.code || '',
          courseTitle: r.course_title || r.courseTitle || r.title || '',
        };
        const idForCheck = r._existingId || 0;
        try {
          const res = await api.request(`/${encodeURIComponent(idForCheck)}/check`, { method: 'POST', body: JSON.stringify(payload) });
          if (res && res.conflict) {
            setRows(prev => prev.map((x,j) => j===i ? { ...x, _status: 'Conflict' } : x));
            toast({ title: 'Conflicts detected', description: 'Server reported a conflict. Please adjust assignment.', status: 'error' });
            return;
          }
        } catch {}
      }
    } catch {}
    const payload = preparePayload(chosen);
    setSaving(true);
    try {
      for (const item of payload) {
        const { _existingId, ...body } = item || {};
        if (_existingId) {
          await api.updateSchedule(_existingId, body);
        } else {
          await api.createSchedule(body);
        }
      }
      setRows(prev => prev.map(r => r._selected ? { ...r, _status: 'Assigned', _existingId: (r._existingId || null) } : r));
      // Refresh local schedules cache for the current block so the UI persists
      try {
        const q = new URLSearchParams();
        const blockCode = String(selectedBlock?.blockCode || '').trim();
        if (blockCode) q.set('blockCode', blockCode);
        if (settingsLoad?.school_year) q.set('sy', settingsLoad.school_year);
        if (settingsLoad?.semester) q.set('sem', settingsLoad.semester);
        const resp = await api.request(`/?${q.toString()}`);
        const fresh = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
        setFreshCache(Array.isArray(fresh) ? fresh : []);
      } catch {}
      // Also refresh global cache for other views
      try { dispatch(loadAllSchedules()); } catch {}
      toast({ title: 'Courses loaded', description: `${chosen.length} schedule(s) created.`, status: 'success' });
    } catch (e) {
      toast({ title: 'Save failed', description: e?.message || 'Could not create schedules.', status: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // --- render (unchanged) ---
  return (
    <VStack align="stretch" spacing={4}>
      <HStack justify="space-between">
        <HStack>
          <Heading size="md">Course Loading</Heading>
          <HStack spacing={1} ml={3}>
            <Button size="sm" variant={viewMode==='blocks'?'solid':'ghost'} colorScheme="blue" onClick={()=>setViewMode('blocks')}>Blocks</Button>
            <Button size="sm" variant={viewMode==='faculty'?'solid':'ghost'} colorScheme="blue" onClick={()=>setViewMode('faculty')}>Faculty</Button>
          </HStack>
        </HStack>
        <HStack>
          <Badge colorScheme={readyToLoad ? 'green' : 'red'}>
            Load SY {settingsLoad.school_year || '—'} / {settingsLoad.semester || '—'}
          </Badge>
          <Tooltip label={canLoad ? 'You can assign and save' : 'View-only: insufficient permissions'}>
            <Badge>{canLoad ? 'Editable' : 'View-only'}</Badge>
          </Tooltip>
        </HStack>
      </HStack>

      <SimpleGrid columns={{ base: 1, lg: 5 }} gap={4} alignItems="start">
        <Box gridColumn={{ base: 'auto', lg: '1 / span 1' }} maxW={{ base: '100%', lg: '340px' }}>
          {viewMode === 'blocks' ? (
            <BlockList
              items={blocks}
              selectedId={selectedBlock?.id}
              onSelect={onSelectBlock}
              loading={blocksLoading}
              onProgramChange={()=>{ setSelectedBlock(null); setRows([]); setFreshCache([]); }}
            />
          ) : (
            <VStack align="stretch" spacing={3} borderWidth="1px" borderColor={border} rounded="xl" p={3} bg={panelBg} minH="calc(100vh - 210px)">
              <HStack spacing={2} flexWrap="wrap">
                <Input size="sm" placeholder="Search faculty" value={facQ} onChange={(e)=>setFacQ(e.target.value)} maxW="200px" />
                <Select size="sm" placeholder="Department" value={facDeptFilter} onChange={(e)=>setFacDeptFilter(e.target.value)} maxW="180px">
                  {(facultyOpts.departments || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </Select>
                <Select size="sm" placeholder="Employment" value={facEmpFilter} onChange={(e)=>setFacEmpFilter(e.target.value)} maxW="160px">
                  {(facultyOpts.employments || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </Select>
              </HStack>
              <VStack align="stretch" spacing={1} maxH="calc(100vh - 300px)" overflowY="auto">
                {filteredFaculty.map(f => {
                  const isSel = selectedFaculty && String(selectedFaculty.id) === String(f.id);
                  const dept = f.department || f.dept || f.department_name || f.departmentName || '';
                  return (
                    <Box key={f.id}
                      p={2}
                      rounded="md"
                      borderWidth="1px"
                      borderColor={isSel ? 'blue.300' : border}
                      bg={isSel ? 'blue.50' : undefined}
                      cursor="pointer"
                      onClick={()=>{ setSelectedFaculty(f); fetchFacultySchedules(f); }}
                      _hover={{ borderColor: 'blue.400' }}
                    >
                      <Text fontWeight="600" noOfLines={1}>{f.name || f.faculty || '—'}</Text>
                      <HStack spacing={2} mt={1} fontSize="xs" color={subtle}>
                        {dept && <Badge>{dept}</Badge>}
                        {f.employment && <Badge colorScheme="purple">{f.employment}</Badge>}
                      </HStack>
                    </Box>
                  );
                })}
                {filteredFaculty.length === 0 && (
                  <Text fontSize="sm" color={subtle}>No faculty match current filters.</Text>
                )}
              </VStack>
            </VStack>
          )}
        </Box>

        <Box gridColumn={{ base: 'auto', lg: '2 / span 4' }} borderWidth="1px" borderColor={border} rounded="xl" p={3} bg={panelBg}>
          {!selectedBlock && (
            <VStack py={10} spacing={2}>
              {viewMode === 'blocks' ? (
                <>
                  <Heading size="sm">Select a block to begin</Heading>
                  <Text color={subtle}>All related prospectus courses will auto-load for assignment.</Text>
                </>
              ) : (
                <>
                  <Heading size="sm">Select a faculty to view schedules</Heading>
                  <Text color={subtle}>Filter by department and employment to narrow the list.</Text>
                </>
              )}
            </VStack>
          )}
          {viewMode === 'blocks' && selectedBlock && (
            <VStack align="stretch" spacing={3}>
              <HStack justify="space-between" align="center">
                <HStack>
                  <Heading size="sm">Block:</Heading>
                  <Badge colorScheme="purple">{selectedBlock.blockCode}</Badge>
                </HStack>
                <HStack>
                  <Button leftIcon={<FiRefreshCw />} size="sm" variant="outline" onClick={()=>onSelectBlock(selectedBlock)} isLoading={loading}>Reload</Button>
                </HStack>
              </HStack>

              {/* Persistent quick swap tray */}
              <Box borderWidth="1px" borderColor={border} rounded="md" p={2}>
                <HStack spacing={2} align="center" flexWrap="wrap">
                  <Badge colorScheme={swapA ? 'blue' : 'gray'}>A</Badge>
                  <Text noOfLines={1} flex="1 1 220px" color={subtle}>{swapA ? swapA.label : 'Add a schedule to slot A'}</Text>
                  {swapA && <Button size="xs" variant="ghost" onClick={()=>clearSwapSlot('A')}>Clear</Button>}
                  <Divider orientation="vertical" />
                  <Badge colorScheme={swapB ? 'purple' : 'gray'}>B</Badge>
                  <Text noOfLines={1} flex="1 1 220px" color={subtle}>{swapB ? swapB.label : 'Add a schedule to slot B'}</Text>
                  {swapB && <Button size="xs" variant="ghost" onClick={()=>clearSwapSlot('B')}>Clear</Button>}
                  <Button size="sm" colorScheme="blue" onClick={swapNow} isDisabled={!canLoad || !swapA || !swapB || swapBusy} isLoading={swapBusy}>Swap Now</Button>
                </HStack>
              </Box>

              <Box borderWidth="1px" borderColor={border} rounded="md" p={2}>
                <HStack spacing={3} flexWrap="wrap" align="center">
                  {(() => {
                    const total = rows.length;
                    const selectedCount = rows.filter(r => r._selected).length;
                    const allChecked = total > 0 && selectedCount === total;
                    const indeterminate = selectedCount > 0 && selectedCount < total;
                    return (
                      <HStack>
                        <Checkbox
                          isChecked={allChecked}
                          isIndeterminate={indeterminate}
                          onChange={(e)=> setRows(prev => prev.map(r => ({ ...r, _selected: !!e.target.checked })))}
                        >
                          Select all
                        </Checkbox>
                        <Badge colorScheme={selectedCount ? 'blue' : 'gray'}>{selectedCount} selected</Badge>
                        <Button size="sm" variant="ghost" onClick={()=>setRows(prev => prev.map(r => ({ ...r, _selected: true })))}>
                          Select All
                        </Button>
                        <Button size="sm" variant="ghost" onClick={()=>setRows(prev => prev.map(r => ({ ...r, _selected: false })))}>
                          Deselect All
                        </Button>
                      </HStack>
                    );
                  })()}
                  <Button size="sm" colorScheme="blue" leftIcon={<FiUpload />} onClick={saveSelected} isDisabled={!canLoad || saving || rows.some(r => r._selected && r._status === 'Conflict')} isLoading={saving}>Save Selected</Button>
                  <Button size="sm" variant="outline" leftIcon={<FiRefreshCw />} onClick={swapSelected} isDisabled={!canLoad || swapBusy} isLoading={swapBusy}>Swap Faculty</Button>
                  <Button size="sm" variant="outline" onClick={()=>requestBulkLockChange(true)} isDisabled={!canLoad || rows.every(r => !r._selected || !r._existingId || r._locked)}>
                    Lock Selected
                  </Button>
                  <Button size="sm" variant="outline" onClick={()=>requestBulkLockChange(false)} isDisabled={!canLoad || rows.every(r => !r._selected || !r._existingId || !r._locked)}>
                    Unlock Selected
                  </Button>
                </HStack>
              </Box>

              {grouped.map(group => (
                <Box key={`${group.programcode}-${group.yearlevel}`} borderWidth="1px" borderColor={border} rounded="md" p={2}>
                  <HStack justify="space-between" mb={2}>
                    <HStack>
                      <Badge colorScheme="blue">{group.programcode}</Badge>
                      <Badge colorScheme="orange">Year {group.yearlevel || '—'}</Badge>
                    </HStack>
                    <Text fontSize="sm" color={subtle}>{group.items.length} course(s)</Text>
                  </HStack>
          <VStack align="stretch" spacing={0} divider={<Divider borderColor={dividerBorder} />}> 
            {group.items.map((r) => {
              const idx = rows.indexOf(r);
              return (
                        <AssignmentRow
                          key={`${r.id || r.course_name}-${idx}`}
                          row={r}
                          faculties={facOptions}
                          schedulesSource={(freshCache && freshCache.length) ? freshCache : (existing || [])}
                          allCourses={(existing || [])}
                          blockCode={selectedBlock?.blockCode || ''}
                          disabled={!canLoad}
                          onChange={(patch)=>handleRowChange(idx, patch)}
                          onToggle={(ck)=>toggleRow(idx, ck)}
                         onRequestLockChange={(next)=>requestLockChange(idx, next)}
                          onRequestConflictInfo={()=>{ setConflictIndex(idx); setConflictOpen(true); }}
                          onRequestSuggest={()=>openSuggestions(idx)}
                         onRequestAssign={()=>openAssignForRow(idx)}
                          onRequestAddToSwap={()=>addToSwap(rows[idx])}
                          onRequestDelete={()=>requestDelete(idx)}
                          onRequestResolve={()=>requestResolve(idx)}
                        />
              );
            })}
          </VStack>
                </Box>
              ))}
              {grouped.length === 0 && (
                <VStack py={10}><Text color={subtle}>No prospectus courses for this block/program/year.</Text></VStack>
              )}
            </VStack>
          )}
          {viewMode === 'faculty' && selectedFaculty && (
            <VStack align="stretch" spacing={3}>
              <HStack justify="space-between" align="center">
                <HStack>
                  <Heading size="sm">Faculty:</Heading>
                  <Badge colorScheme="purple">{selectedFaculty.name || selectedFaculty.faculty}</Badge>
                </HStack>
                <HStack>
                  {facultySchedules.loading && <HStack><Spinner size="sm" /><Text>Loading schedules…</Text></HStack>}
                </HStack>
              </HStack>
              <Box borderWidth="1px" borderColor={border} rounded="md" p={2}>
                <HStack spacing={3} mb={2} align="center" flexWrap="wrap">
                  {(() => {
                    const eligible = (facultySchedules.items || []).filter(it => !isItemLocked(it));
                    const eligibleCount = eligible.length;
                    const allChecked = eligibleCount > 0 && facSelectedIds.length === eligibleCount;
                    const indeterminate = facSelectedIds.length > 0 && facSelectedIds.length < eligibleCount;
                    return (
                      <HStack>
                        <Checkbox
                          isChecked={allChecked}
                          isIndeterminate={indeterminate}
                          onChange={(e)=> {
                            const chk = !!e.target.checked;
                            setFacSelected(() => chk ? new Set(eligible.map(it => it.id)) : new Set());
                          }}
                        >
                          Select all
                        </Checkbox>
                        <Badge colorScheme={facSelectedIds.length ? 'blue' : 'gray'}>{facSelectedIds.length} selected</Badge>
                        <Button size="sm" variant="ghost" onClick={()=> setFacSelected(new Set(eligible.map(it => it.id)))}>
                          Select All
                        </Button>
                        <Button size="sm" variant="ghost" onClick={()=> setFacSelected(new Set())}>
                          Deselect All
                        </Button>
                      </HStack>
                    );
                  })()}
                  <Button size="sm" variant="outline" onClick={()=>requestFacultyBulkLockChange(true)} isDisabled={!canLoad || facSelectedIds.length === 0 || allSelectedLocked}>Lock Selected</Button>
                  <Button size="sm" variant="outline" onClick={()=>requestFacultyBulkLockChange(false)} isDisabled={!canLoad || facSelectedIds.length === 0 || allSelectedUnlocked}>Unlock Selected</Button>
                </HStack>
                {facultySchedules.items.length === 0 ? (
                  <VStack py={8}><Text color={subtle}>No schedules assigned for the selected school year.</Text></VStack>
                ) : (
                  <VStack align="stretch" spacing={2}>
                    {(() => {
                      const groups = new Map();
                      facultySchedules.items.forEach(s => {
                        const key = String(s.term || '').trim() || '—';
                        const arr = groups.get(key) || []; arr.push(s); groups.set(key, arr);
                      });
                      const order = (t) => { const v=String(t).toLowerCase(); if (v.startsWith('1')) return 1; if (v.startsWith('2')) return 2; if (v.startsWith('s')) return 3; return 9; };
                      return Array.from(groups.entries()).sort((a,b)=>order(a[0])-order(b[0])).map(([term, arr]) => (
                        <Box key={term} borderWidth="1px" rounded="md" p={2}>
                          <HStack justify="space-between" mb={1}><Badge colorScheme="blue">{term}</Badge><Text fontSize="xs" color={subtle}>{arr.length} item(s)</Text></HStack>
                          <VStack align="stretch" spacing={2}>
                            {arr.map((c, i) => {
                              const e = facEdits[c.id] || { term: canonicalTerm(c.term || ''), time: String(c.schedule || c.time || '').trim(), faculty: c.faculty || c.instructor || '', facultyId: c.facultyId || c.faculty_id || null };
                              const dirty = canonicalTerm(c.term || '') !== e.term || String(c.schedule || c.time || '').trim() !== e.time || (c.facultyId || c.faculty_id || null) !== (e.facultyId || null);
                              const canSave = dirty && !e._checking && !e._conflict;
                              const isLocked = (function(v){ if (typeof v==='boolean') return v; const s=String(v||'').toLowerCase(); return s==='yes'||s==='true'||s==='1'; })(c.lock || c.is_locked);
                              return (
                                <Box key={`${term}-${i}`} p={2} borderWidth="1px" rounded="md">
                                  <HStack spacing={3} align="center">
                                    <Checkbox isChecked={facSelected.has(c.id)} onChange={(e)=>toggleFacSelect(c.id, e.target.checked)} isDisabled={isLocked} />
                                    <Badge>{c.code || c.courseName}</Badge>
                                    <Text noOfLines={1} flex="1">{c.title || c.courseTitle}</Text>
                                    <Badge colorScheme="orange">{c.blockCode || c.section || '—'}</Badge>
                                  </HStack>
                                  <HStack mt={2} spacing={2} align="center" flexWrap="wrap">
                                    <Select size="sm" value={e.term} onChange={(ev)=>updateFacEdit(c.id, { term: ev.target.value })} maxW="120px" isDisabled={isLocked}>
                                      {['1st','2nd','Sem'].map(v => <option key={v} value={v}>{v}</option>)}
                                    </Select>
                                    <Select size="sm" value={e.time} onChange={(ev)=>updateFacEdit(c.id, { time: ev.target.value })} maxW="160px" isDisabled={isLocked}>
                                      {getTimeOptions().map(t => <option key={t} value={t}>{t || 'Time'}</option>)}
                                    </Select>
                                    <Box minW="220px">
                                      <FacultySelect
                                        value={e.faculty}
                                        onChange={(v)=>updateFacEdit(c.id, { faculty: v })}
                                        onChangeId={(fid)=>updateFacEdit(c.id, { facultyId: fid })}
                                        allowClear
                                        disabled={isLocked}
                                        options={facOptions}
                                      />
                                    </Box>
                                    <HStack>
                                      {e._checking ? (
                                        <HStack spacing={1}><Spinner size="xs" /><Text fontSize="xs" color={subtle}>Checking...</Text></HStack>
                                      ) : (
                                        <Badge colorScheme={e._conflict ? 'red' : (dirty ? 'yellow' : 'green')}>
                                          {e._conflict ? 'Conflict' : (dirty ? 'Unsaved' : 'OK')}
                                        </Badge>
                                      )}
                                    </HStack>
                                    <HStack ml="auto" spacing={2}>
                                      {e._conflict && (
                                        <Button size="sm" variant="outline" leftIcon={<FiHelpCircle />} onClick={()=>openFacultySuggestions(c.id)} isDisabled={isLocked}>Suggestions</Button>
                                      )}
                                      <Button size="sm" leftIcon={<FiUserPlus />} variant="outline" onClick={()=>openFacAssign(facultySchedules.items.indexOf(c))} isDisabled={isLocked}>Assign</Button>
                                      <Button size="sm" variant="outline" onClick={()=>updateFacEdit(c.id, { term: canonicalTerm(c.term || ''), time: String(c.schedule || c.time || '').trim(), faculty: c.faculty || c.instructor || '', facultyId: c.facultyId || c.faculty_id || null, _conflict:false, _details:[] })} isDisabled={!dirty || isLocked}>Revert</Button>
                                      <Button size="sm" colorScheme="blue" onClick={()=>saveFacultyEdit(c.id)} isDisabled={!canSave || isLocked}>Save</Button>
                                      {isLocked ? (
                                        <Tooltip label="Locked. Click to unlock."><IconButton aria-label="Unlock" icon={<FiLock />} size="sm" colorScheme="red" variant="ghost" onClick={()=>toggleFacultyLock(c.id, false)} /></Tooltip>
                                      ) : (
                                        <Tooltip label="Unlocked. Click to lock."><IconButton aria-label="Lock" icon={<FiLock />} size="sm" variant="ghost" onClick={()=>toggleFacultyLock(c.id, true)} /></Tooltip>
                                      )}
                                      <Tooltip label={isLocked ? 'Locked. Unlock to delete.' : 'Delete assignment'}>
                                        <IconButton aria-label="Delete" icon={<FiTrash />} size="sm" colorScheme="red" variant="ghost" onClick={()=>requestFacultyDelete(facultySchedules.items.indexOf(c))} isDisabled={isLocked} />
                                      </Tooltip>
                                    </HStack>
                                  </HStack>
                                  {e._conflict && Array.isArray(e._details) && e._details.length > 0 && (
                                    <VStack align="stretch" spacing={1} mt={2}>
                                      {e._details.slice(0,3).map((d, j) => (
                                        <Text key={j} fontSize="xs" color="red.600">{d.reason}: {d.item?.code || ''} / {d.item?.section || ''} {d.item?.time || ''}</Text>
                                      ))}
                                    </VStack>
                                  )}
                                </Box>
                              );
                            })}
                          </VStack>
                        </Box>
                      ));
                    })()}
                  </VStack>
                )}
              </Box>
            </VStack>
          )}
        </Box>
      </SimpleGrid>

      {/* Assign Faculty Modal for Blocks view */}
      <AssignFacultyModal
        isOpen={assignOpen}
        onClose={()=>{ setAssignOpen(false); setAssignIndex(null); }}
        schedule={scheduleForAssign}
        onAssign={handleAssignFromModal}
        schoolyear={settingsLoad?.school_year}
        semester={settingsLoad?.semester}
      />
      <AssignFacultyModal
        isOpen={facAssignOpen}
        onClose={()=>{ setFacAssignOpen(false); setFacAssignIndex(null); }}
        schedule={scheduleForFacAssign}
        onAssign={handleFacAssign}
        schoolyear={settingsLoad?.school_year}
        semester={settingsLoad?.semester}
      />

      {/* Resolve conflict dialog */}
      <AlertDialog isOpen={resolveOpen} onClose={()=>{ if (!resolveBusy) { setResolveOpen(false); setResolveRowIndex(null); setResolveConflictId(null); setResolveLabel(''); } }} leastDestructiveRef={cancelRef}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Resolve conflict?</AlertDialogHeader>
            <AlertDialogBody>
              This will delete the existing conflicting schedule (<b>{resolveLabel || 'schedule'}</b>) and save your new assignment for this course. This action cannot be undone. Proceed?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={()=>{ if (!resolveBusy) { setResolveOpen(false); setResolveRowIndex(null); setResolveConflictId(null); setResolveLabel(''); } }}>Cancel</Button>
              <Button colorScheme="purple" ml={3} isLoading={resolveBusy} onClick={confirmResolve}>Resolve</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Faculty suggestions modal */}
      <Modal isOpen={facSuggOpen} onClose={()=>{ if (!facSuggBusy) { setFacSuggOpen(false); setFacSuggTargetId(null); } }} isCentered size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Suggestions</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {facSuggBusy ? (
              <HStack spacing={2}><Spinner size="sm" /><Text>Analyzing suggestions...</Text></HStack>
            ) : (
              <VStack align="stretch" spacing={3}>
                {Array.isArray(facSuggPlans) && facSuggPlans.length > 0 ? (
                  facSuggPlans.map((s, i) => (
                    <Box key={i} p={3} borderWidth="1px" borderRadius="md">
                      <VStack align="stretch" spacing={2}>
                        <HStack justify="space-between">
                          <Text fontWeight="600">{s.label}</Text>
                          {s?.candidateChange && (
                            <Button size="xs" colorScheme="blue" onClick={() => applyFacultySuggestion(s)}>Apply</Button>
                          )}
                        </HStack>
                        {Array.isArray(s.steps) && s.steps.length > 0 && (
                          <VStack align="stretch" spacing={1}>
                            {s.steps.map((st, j) => (
                              <HStack key={j} spacing={3} fontSize="sm" color={subtle}>
                                <Badge colorScheme="gray">{st.node ?? (j+1)}</Badge>
                                <Text><b>{st.course}</b> {st.section ? `/ ${st.section}` : ''}</Text>
                                <Text>from <b>{st.from}</b> to <b>{st.to}</b></Text>
                              </HStack>
                            ))}
                          </VStack>
                        )}
                      </VStack>
                    </Box>
                  ))
                ) : (
                  <Text fontSize="sm" color={subtle}>No suggestions found that avoid conflicts in the same session. Try a different term or adjust surrounding schedules.</Text>
                )}
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Lock/Unlock */}
      <AlertDialog isOpen={lockDialogOpen} onClose={()=>{ if (!lockDialogBusy) { setLockDialogOpen(false); setLockDialogIndex(null); setLockDialogBulkIdxs([]); setLockDialogTarget(null); } }} leastDestructiveRef={cancelRef} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>{lockDialogTarget ? 'Lock schedule(s)?' : 'Unlock schedule(s)?'}</AlertDialogHeader>
            <AlertDialogBody>
              {lockDialogTarget ? 'Locked schedules cannot be edited until unlocked. Proceed to lock the selected item(s)?' : 'Unlocking will allow editing term/time/faculty. Proceed to unlock the selected item(s)?'}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={()=>{ if (!lockDialogBusy) { setLockDialogOpen(false); setLockDialogIndex(null); setLockDialogBulkIdxs([]); setLockDialogTarget(null); } }} variant="ghost">Cancel</Button>
              <Button colorScheme="blue" onClick={confirmLockChange} ml={3} isLoading={lockDialogBusy}>{lockDialogTarget ? 'Lock' : 'Unlock'}</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Delete assignment */}
      <AlertDialog isOpen={delDialogOpen} onClose={()=>{ if (!delDialogBusy) { setDelDialogOpen(false); setDelDialogIndex(null); } }} leastDestructiveRef={delCancelRef} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete assignment?</AlertDialogHeader>
            <AlertDialogBody>
              {(() => {
                const r = delDialogIndex != null ? rows[delDialogIndex] : null;
                const label = r ? (r.course_name || r.courseName || r.code || 'this item') : 'this item';
                return (
                  <Text>
                    This action cannot be undone. Are you sure you want to delete <b>{label}</b> from the assigned schedules?
                  </Text>
                );
              })()}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={delCancelRef} onClick={()=>{ if (!delDialogBusy) { setDelDialogOpen(false); setDelDialogIndex(null); } }} variant="ghost">Cancel</Button>
              <Button colorScheme="red" onClick={confirmDelete} ml={3} isLoading={delDialogBusy}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Faculty delete confirmation */}
      <AlertDialog isOpen={facDelOpen} onClose={()=>{ if (!facDelBusy) { setFacDelOpen(false); setFacDelIndex(null); } }} leastDestructiveRef={facDelCancelRef} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete assignment?</AlertDialogHeader>
            <AlertDialogBody>
              {(() => {
                const r = facDelIndex != null ? facultySchedules.items[facDelIndex] : null;
                const label = r ? (r.code || r.courseName || 'this item') : 'this item';
                return (
                  <Text>
                    This action cannot be undone. Are you sure you want to delete <b>{label}</b> from the assigned schedules?
                  </Text>
                );
              })()}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={facDelCancelRef} onClick={()=>{ if (!facDelBusy) { setFacDelOpen(false); setFacDelIndex(null); } }} variant="ghost">Cancel</Button>
              <Button colorScheme="red" onClick={confirmFacultyDelete} ml={3} isLoading={facDelBusy}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Faculty bulk lock/unlock */}
      <AlertDialog isOpen={facLockOpen} onClose={()=>{ if (!facLockBusy) { setFacLockOpen(false); setFacLockTarget(null); } }} leastDestructiveRef={facLockCancelRef} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>{facLockTarget ? 'Lock selected schedule(s)?' : 'Unlock selected schedule(s)?'}</AlertDialogHeader>
            <AlertDialogBody>
              {facLockTarget ? 'Locked schedules cannot be edited until unlocked. Proceed to lock the selected item(s)?' : 'Unlocking will allow editing term/time/faculty. Proceed to unlock the selected item(s)?'}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={facLockCancelRef} onClick={()=>{ if (!facLockBusy) { setFacLockOpen(false); setFacLockTarget(null); } }} variant="ghost">Cancel</Button>
              <Button colorScheme="blue" onClick={confirmFacultyBulkLockChange} ml={3} isLoading={facLockBusy}>{facLockTarget ? 'Lock' : 'Unlock'}</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Conflict details modal */}
      <Modal isOpen={conflictOpen} onClose={()=>{ setConflictOpen(false); setConflictIndex(null); }} isCentered size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Why this conflicts</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {(() => {
              const r = (conflictIndex != null) ? rows[conflictIndex] : null;
              const details = r?._conflictDetails || [];
              if (!r) return <Text>No data.</Text>;
              if (!details.length) return <Text>This schedule conflicts with another entry for the same faculty at the same term and time.</Text>;
              return (
                <VStack align="stretch" spacing={3}>
                  <Text fontSize="sm" color={subtle}>
                    The selected assignment sets faculty <b>{r._faculty}</b> to <b>{r._term}</b> term at <b>{r._time}</b> for block <b>{selectedBlock?.blockCode || '-'}</b>.
                    Another schedule exists for the same faculty at the same term and time, which causes a double-booking conflict.
                  </Text>
                  {details.map((d, i) => (
                    <Box key={i} p={3} borderWidth="1px" borderRadius="md">
                      <Text fontWeight="600" mb={1}>{d.reason}</Text>
                      <Text fontSize="sm">
                        {d.item.code} — {d.item.title}
                      </Text>
                      <HStack spacing={4} fontSize="sm" color={subtle}>
                        <Text>Section: <b>{d.item.section || 'N/A'}</b></Text>
                        <Text>Term: <b>{d.item.term || 'N/A'}</b></Text>
                        <Text>Time: <b>{d.item.time || 'N/A'}</b></Text>
                        <Text>Room: <b>{d.item.room || 'N/A'}</b></Text>
                      </HStack>
                    </Box>
                  ))}
                  <Text fontSize="sm" color={subtle}>
                    To proceed, adjust the time or term so it does not overlap with existing schedules, or assign a different faculty.
                  </Text>
                </VStack>
              );
            })()}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Suggestions modal */}
      <Modal isOpen={suggOpen} onClose={()=>{ setSuggOpen(false); setSuggIndex(null); }} isCentered size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Suggestions</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {suggBusy ? (
              <HStack spacing={2}><Spinner size="sm" /><Text>Analyzing suggestions...</Text></HStack>
            ) : (
              <VStack align="stretch" spacing={3}>
                {Array.isArray(suggestions) && suggestions.length > 0 ? (
                  suggestions.map((s, i) => (
                    <Box key={i} p={3} borderWidth="1px" borderRadius="md">
                      <VStack align="stretch" spacing={2}>
                        <HStack justify="space-between">
                          <Text fontWeight="600">{s.label}</Text>
                          {s?.candidateChange && (
                            <Button size="xs" colorScheme="blue" onClick={() => applySuggestion(s)}>Apply</Button>
                          )}
                        </HStack>
                        {Array.isArray(s.steps) && s.steps.length > 0 && (
                          <VStack align="stretch" spacing={1}>
                            {s.steps.map((st, j) => (
                              <HStack key={j} spacing={3} fontSize="sm" color={subtle}>
                                <Badge colorScheme="gray">{st.node ?? (j+1)}</Badge>
                                <Text><b>{st.course}</b> {st.section ? `/ ${st.section}` : ''}</Text>
                                <Text>from <b>{st.from}</b> to <b>{st.to}</b></Text>
                              </HStack>
                            ))}
                          </VStack>
                        )}
                      </VStack>
                    </Box>
                  ))
                ) : (
                  <Text fontSize="sm" color={subtle}>No suggestions found that avoid conflicts in the same session. Try a different term or adjust surrounding schedules.</Text>
                )}
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </VStack>
  );
}
