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

  // Deterministic tie-break randomness for score sorting (advisable only for near-ties)
  const seededRand = (seedStr) => {
    // xmur3 hash to 32-bit seed
    const xmur3 = (str) => {
      let h = 1779033703 ^ str.length;
      for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      return () => {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;
        return h >>> 0;
      };
    };
    const mulberry32 = (a) => {
      let t = a >>> 0;
      return () => {
        t = (t + 0x6D2B79F5) >>> 0;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
      };
    };
    const seedFn = xmur3(String(seedStr || ''));
    const prng = mulberry32(seedFn());
    return prng();
  };
  const scoreTieJitter = (fac) => {
    const sId = String(schedule?.id || '')
      + '|' + String(schedule?.code || schedule?.courseName || '')
      + '|' + String(schedule?.section || '')
      + '|' + String(schedule?.semester || schedule?.term || '');
    const fId = String(fac?.id || fac?.email || fac?.name || '');
    const r = seededRand(sId + '|' + fId);
    // return jitter in range [-A, +A]
    const A = 0.03; // on 1..10 score scale, this is ±0.03
    return (r * 2 - 1) * A;
  };

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
    const candDays = (() => {
      const arr = parseF2FDays(schedule?.f2fDays || schedule?.f2fSched || schedule?.f2fsched || schedule?.day);
      return Array.isArray(arr) && arr.length ? arr : ['ANY'];
    })();
    const bandOf = (mid) => (Number.isFinite(mid) && mid < 12*60) ? 'AM' : 'PM';
    const candBand = bandOf(candMid);
    const termOrder = (t) => {
      const s = String(t||'').toLowerCase();
      // Extract years like 2024 or 2024-2025
      const years = Array.from(s.matchAll(/(20\d{2})/g)).map(m=>parseInt(m[1],10));
      let year = years.length ? Math.min(...years) : NaN;
      // Semester index
      let sem = 0;
      if (/summer|mid\s*year|midyear/.test(s)) sem = 3;
      else if (/(^|[^a-z])2(nd)?([^a-z]|$)|\bsem\s*2\b|\bterm\s*2\b/.test(s)) sem = 2;
      else if (/(^|[^a-z])1(st)?([^a-z]|$)|\bsem\s*1\b|\bterm\s*1\b/.test(s)) sem = 1;
      else if (/\b3(rd)?\b/.test(s)) sem = 3;
      // Fallback: if only one year and contains '2nd', assume sem=2, else 1
      if (!sem) sem = /2(nd)?|second/.test(s) ? 2 : 1;
      if (!Number.isFinite(year)) {
        // Try to infer year from patterns like 'ay 24-25'
        const yy = s.match(/\b(\d{2})\s*[-/]\s*(\d{2})\b/);
        if (yy) {
          const y = parseInt(yy[1],10);
          year = 2000 + (y >= 50 ? y : y); // assume 20xx
        }
      }
      if (!Number.isFinite(year)) return NaN;
      return year*10 + sem;
    };
    const candTermOrder = termOrder(term);
    const tok = (s) => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);
    const normalizeTight = (s) => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
    const hasDigits = (s) => /\d/.test(String(s||''));

    // Efficient token-level fuzzy matching with normalized Levenshtein and bigram Dice
    const levenshtein = (a, b) => {
      if (a === b) return 0;
      const m = a.length, n = b.length;
      if (m === 0) return n; if (n === 0) return m;
      // Use two-row DP to reduce memory
      let prev = new Array(n + 1);
      let curr = new Array(n + 1);
      for (let j = 0; j <= n; j++) prev[j] = j;
      for (let i = 1; i <= m; i++) {
        curr[0] = i;
        const ca = a.charCodeAt(i - 1);
        for (let j = 1; j <= n; j++) {
          const cost = (ca === b.charCodeAt(j - 1)) ? 0 : 1;
          const del = prev[j] + 1;
          const ins = curr[j - 1] + 1;
          const sub = prev[j - 1] + cost;
          curr[j] = del < ins ? (del < sub ? del : sub) : (ins < sub ? ins : sub);
        }
        const tmp = prev; prev = curr; curr = tmp;
      }
      return prev[n];
    };
    const simRatio = (a, b) => {
      if (!a && !b) return 1;
      if (!a || !b) return 0;
      const maxLen = Math.max(a.length, b.length);
      if (maxLen === 0) return 1;
      const d = levenshtein(a, b);
      return Math.max(0, 1 - d / maxLen);
    };
    const dice2Gram = (a, b) => {
      a = normalizeTight(a); b = normalizeTight(b);
      if (a === b) return 1;
      if (a.length < 2 || b.length < 2) return simRatio(a, b);
      const grams = (s) => {
        const map = new Map();
        for (let i = 0; i < s.length - 1; i++) {
          const g = s.slice(i, i + 2);
          map.set(g, (map.get(g) || 0) + 1);
        }
        return map;
      };
      const ga = grams(a), gb = grams(b);
      let inter = 0;
      for (const [g, ca] of ga.entries()) {
        const cb = gb.get(g);
        if (cb) inter += Math.min(ca, cb);
      }
      const total = Array.from(ga.values()).reduce((s,v)=>s+v,0) + Array.from(gb.values()).reduce((s,v)=>s+v,0);
      return total ? (2 * inter) / total : 0;
    };
    const tokenFuzzyBestRatio = (queryTokens, poolTokens) => {
      if (!queryTokens.length || !poolTokens.length) return 0;
      // For each query token, take the best similarity among pool tokens
      let sum = 0;
      for (const q of queryTokens) {
        let best = 0;
        for (const p of poolTokens) {
          const r = simRatio(q, p);
          if (r > best) best = r;
          if (best >= 1) break;
        }
        sum += best;
      }
      return sum / queryTokens.length; // 0..1
    };
    const candCodeTokens = tok(schedule?.code || schedule?.courseName || '');
    const candTitleTokens = tok(schedule?.title || schedule?.courseTitle || '');
    const candTokens = Array.from(new Set(candCodeTokens.concat(candTitleTokens)));
    const candCodeJoined = normalizeTight(String(schedule?.code || schedule?.courseName || ''));
    const candTitleJoined = normalizeTight(String(schedule?.title || schedule?.courseTitle || ''));
    const candJoined = normalizeTight(`${String(schedule?.code || schedule?.courseName || '')} ${String(schedule?.title || schedule?.courseTitle || '')}`);
    const codeHasDigits = hasDigits(candCodeJoined);

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
      // Statistical time preference with recency weighting and AM/PM bands; plus KDE smoothing
      const timePoints = [];
      if (rowsAll.length) {
        rowsAll.forEach(r => {
          // Recency weighting: ignore future terms, decay older ones
          const rTerm = String(r.semester || r.term || '').trim().toLowerCase();
          const rOrd = termOrder(rTerm);
          if (Number.isFinite(candTermOrder) && Number.isFinite(rOrd) && rOrd > candTermOrder) return; // skip future
          let rec = 1;
          if (Number.isFinite(candTermOrder) && Number.isFinite(rOrd)) {
            const dOrd = Math.max(0, candTermOrder - rOrd);
            rec = Math.pow(0.75, dOrd); // exponential decay per term step
            if (rec < 0.25) rec = 0.25; // floor
          }
          let s=r.timeStartMinutes,e=r.timeEndMinutes;
          const tS=String(r.scheduleKey||r.schedule||r.time||'').trim();
          if (!Number.isFinite(s) || !Number.isFinite(e)) { const tt=parseTimeBlockToMinutes(tS); s=tt.start; e=tt.end; }
          if (!Number.isFinite(s) || !Number.isFinite(e)) return;
          const mid = (s+e)/2;
          const wUnits = Math.max(0.5, Number(r.unit || 0) || 1); // weight by units (min 0.5)
          const w = wUnits * rec;
          const days = parseF2FDays(r.f2fDays || r.f2fSched || r.f2fsched || r.day);
          const band = bandOf(mid);
          if (days && days.length) {
            days.forEach(d => timePoints.push({ day: d, band, mid, w }));
          } else {
            timePoints.push({ day: 'ANY', band, mid, w });
          }
        });
      }
      // Build stats per day-band and per day plus global
      const byDayBand = new Map();
      const byDay = new Map();
      let gSum = 0, gW = 0;
      timePoints.forEach(p => {
        const k = `${p.day}|${p.band}`; const a = byDayBand.get(k) || []; a.push(p); byDayBand.set(k, a);
        const ad = byDay.get(p.day) || []; ad.push(p); byDay.set(p.day, ad);
        gSum += p.mid * p.w; gW += p.w;
      });
      const gMean = gW > 0 ? gSum / gW : NaN;
      let gVarNum = 0; if (gW > 0) { timePoints.forEach(p => { gVarNum += p.w * (p.mid - gMean) * (p.mid - gMean); }); }
      const gSigma = gW > 0 ? Math.sqrt(gVarNum / gW) : NaN;
      const minSigma = 45; // minutes, floor for narrow distributions
      const dayBandStats = new Map();
      byDayBand.forEach((arr, k) => {
        let s=0,w=0; arr.forEach(p => { s += p.mid * p.w; w += p.w; });
        const mean = w>0 ? s/w : NaN;
        let varNum=0; if (w>0) arr.forEach(p => { varNum += p.w * (p.mid - mean) * (p.mid - mean); });
        let sigma = w>0 ? Math.sqrt(varNum / w) : NaN;
        if (!Number.isFinite(sigma) || sigma < minSigma) sigma = Math.max(minSigma, Number.isFinite(gSigma)? gSigma : minSigma);
        dayBandStats.set(k, { mean, sigma, w });
      });
      const dayStats = new Map();
      byDay.forEach((arr, d) => {
        let s=0,w=0; arr.forEach(p => { s += p.mid * p.w; w += p.w; });
        const mean = w>0 ? s/w : NaN;
        let varNum=0; if (w>0) arr.forEach(p => { varNum += p.w * (p.mid - mean) * (p.mid - mean); });
        let sigma = w>0 ? Math.sqrt(varNum / w) : NaN;
        if (!Number.isFinite(sigma) || sigma < minSigma) sigma = Math.max(minSigma, Number.isFinite(gSigma)? gSigma : minSigma);
        dayStats.set(d, { mean, sigma, w });
      });
      const getStat = (d, b) => dayBandStats.get(`${d}|${b}`) || dayStats.get(d) || (Number.isFinite(gMean) ? { mean: gMean, sigma: Math.max(minSigma, Number.isFinite(gSigma)? gSigma : minSigma), w: gW } : null);
      // Likelihood-based score: Gaussian around preferred time
      let probBest = 0;
      if (Number.isFinite(candMid) && (timePoints.length > 0)) {
        for (const d of candDays) {
          const st = getStat(d, candBand);
          if (!st) continue;
          const z = Math.abs(candMid - st.mean) / (st.sigma || minSigma);
          const prob = Math.exp(-0.5 * z * z); // 0..1
          if (prob > probBest) probBest = prob;
        }
      }
      // KDE smoothing score with bandwidth h
      const kdeH = 60; // minutes
      const kde = (arr) => {
        let num = 0, den = 0;
        for (const p of arr) {
          const diff = (candMid - p.mid) / kdeH;
          const k = Math.exp(-0.5 * diff * diff);
          num += p.w * k; den += p.w;
        }
        return den > 0 ? (num / den) : 0;
      };
      let kdeBest = 0;
      if (Number.isFinite(candMid) && (timePoints.length > 0)) {
        // Try day+band first, then day, then global
        for (const d of candDays) {
          const arrDB = byDayBand.get(`${d}|${candBand}`);
          if (arrDB && arrDB.length) kdeBest = Math.max(kdeBest, kde(arrDB));
          const arrD = byDay.get(d);
          if (arrD && arrD.length) kdeBest = Math.max(kdeBest, kde(arrD));
        }
        if (kdeBest === 0) kdeBest = kde(timePoints);
      }
      // Nearest neighbor closeness in minutes within same term
      let nearest = 0;
      if (Number.isFinite(candMid) && rows.length) {
        let minDiff = Infinity;
        rows.forEach(r => {
          let s=r.timeStartMinutes,e=r.timeEndMinutes; const tS=String(r.scheduleKey||r.schedule||r.time||'').trim();
          if(!Number.isFinite(s)||!Number.isFinite(e)){const tt=parseTimeBlockToMinutes(tS); s=tt.start; e=tt.end;}
          if(Number.isFinite(s)&&Number.isFinite(e)){
            const mid=(s+e)/2; const d=Math.abs(candMid - mid); if (d < minDiff) minDiff = d;
          }
        });
        // 0 at >= 4h difference, 1 when identical
        nearest = Math.max(0, 1 - (minDiff/240));
      }
      let timeScore = 0.7;
      if (Number.isFinite(candMid) && (timePoints.length > 0)) {
        timeScore = 0.5 * kdeBest + 0.3 * probBest + 0.2 * nearest; // KDE + Gaussian + proximity
        // Slight bonus if candidate days intersect faculty's most frequent day
        const dayFreq = new Map(); timePoints.forEach(p => dayFreq.set(p.day, (dayFreq.get(p.day)||0)+p.w));
        let topDay = null, topW = -1; dayFreq.forEach((w,d)=>{ if (w>topW) { topW=w; topDay=d; } });
        if (topDay && candDays.includes(topDay)) timeScore = Math.min(1, timeScore + 0.05);
      }
      // String match between candidate code/title and faculty catalog
      // Use fuzzy token similarity + whole-string bigram Dice for misspellings and near-matches
      let matchScore = 0.5;
      if (candTokens.length) {
        let best = 0;
        for (const r of rowsAll) {
          const rCodeTokens = tok(r.code || r.courseName || '');
          const rTitleTokens = tok(r.title || r.courseTitle || '');
          const rTokensAll = Array.from(new Set(rCodeTokens.concat(rTitleTokens)));
          if (!rTokensAll.length) continue;
          const rCodeJoined = normalizeTight(String(r.code || r.courseName || ''));
          const rTitleJoined = normalizeTight(String(r.title || r.courseTitle || ''));
          const rJoined = normalizeTight(`${String(r.code || r.courseName || '')} ${String(r.title || r.courseTitle || '')}`);

          // Exact code equality (ignoring dashes/spaces/case) dominates
          if (candCodeJoined && rCodeJoined && candCodeJoined === rCodeJoined) {
            best = 1;
            break;
          }

          // Token-level: bias course code over title
          const codeTokenMatch = tokenFuzzyBestRatio(candCodeTokens, rCodeTokens.length ? rCodeTokens : rTokensAll);
          const titleTokenMatch = tokenFuzzyBestRatio(candTitleTokens, rTitleTokens.length ? rTitleTokens : rTokensAll);
          const tokenCodeW = codeHasDigits ? 0.88 : 0.82;
          const tokenTitleW = 1 - tokenCodeW;
          const tokenMatch = tokenCodeW * codeTokenMatch + tokenTitleW * titleTokenMatch;

          // Char-level: bias code string over title string
          const codeDice = dice2Gram(candCodeJoined, rCodeJoined);
          const titleDice = dice2Gram(candTitleJoined, rTitleJoined);
          const charMatch = 0.8 * codeDice + 0.2 * titleDice;

          let combo = 0.75 * tokenMatch + 0.25 * charMatch; // emphasize word-level, smooth with char-level

          // Strong near-exact code match boost
          const codeNear = Math.max(simRatio(candCodeJoined, rCodeJoined), codeDice);
          if (codeNear >= 0.94) combo = Math.max(combo, 1.0);
          if (combo > best) best = combo;
          if (best >= 1) break;
        }
        // Threshold weak matches to avoid noise; scale above threshold
        const weakThresh = 0.5;
        if (best <= weakThresh) {
          matchScore = 0.5; // keep baseline
        } else {
          const scaled = (best - weakThresh) / (1 - weakThresh);
          matchScore = 0.5 + 0.5 * Math.max(0, Math.min(1, scaled)); // 0.5..1.0 boost
        }
      }
      // Load and overload
      const baseline = Math.max(0, 24 - (stat.release||0));
      const loadRatio = baseline > 0 ? (stat.load||0)/baseline : 1;
      const loadScore = Math.max(0, 1 - Math.max(0, loadRatio - 0.8)/0.8);
      const overloadScore = Math.max(0, 1 - (stat.overload||0)/6);
      // Term experience count
      const termCount = rows.length; const expScore = Math.min(1, termCount/8);
      // Weighted sum -> 1..10 (standardized, code-first course alignment)
      // Weights: dept 0.13, emp 0.13, degree 0.09, time 0.08, load 0.15, overload 0.08, exp 0.09, match 0.25 => 1.00
      const score01 = 0.13*deptScore + 0.13*empScore + 0.09*degreeScore + 0.08*timeScore + 0.15*loadScore + 0.08*overloadScore + 0.09*expScore + 0.25*matchScore;
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
        if (sortKey === 'score') {
          const diff = va - vb;
          const eps = 0.15; // treat scores within 0.15 (on 1..10 scale) as near-ties
          if (Math.abs(diff) > eps) return diff * dir;
          // near tie: break deterministically with seeded jitter
          const ja = scoreTieJitter(a);
          const jb = scoreTieJitter(b);
          if (ja !== jb) return (ja - jb) * dir;
        } else {
          if (va !== vb) return (va - vb) * dir;
        }
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
                  Score ranks faculty by: department alignment, employment priority (full-time first), academic degree (doctorate/masters), recency‑weighted time preference (AM/PM aware; Gaussian + KDE), current load vs. capacity, overload, experience in the same term, and code‑weighted fuzzy course matching (typo tolerant; exact code prioritized). Higher is better (1–10).
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
