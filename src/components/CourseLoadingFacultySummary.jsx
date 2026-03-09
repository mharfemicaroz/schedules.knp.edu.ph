import React from 'react';
import {
  Badge,
  Box,
  Button,
  HStack,
  Heading,
  Input,
  Select,
  SimpleGrid,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  Tag,
  TagLabel,
  useColorModeValue,
  VStack,
  Stack
} from '@chakra-ui/react';
import { FiChevronDown, FiChevronUp, FiDownload, FiPrinter } from 'react-icons/fi';
import { parseTimeBlockToMinutes } from '../utils/conflicts';
import { buildTable, printContent } from '../utils/printDesign';
import api from '../services/apiService';

function normalizeName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isNSTPCourse(course) {
  const text = [
    course?.courseTitle,
    course?.course_title,
    course?.title,
    course?.courseName,
    course?.course_name,
    course?.code
  ]
    .filter(Boolean)
    .map(String)
    .join(' ')
    .toUpperCase();
  if (!text) return false;
  return text.includes('NSTP');
}

function shortTerm(term) {
  const v = String(term || '').trim().toLowerCase();
  if (v.startsWith('1')) return '1st';
  if (v.startsWith('2')) return '2nd';
  if (v.startsWith('s')) return 'Sem';
  return '';
}

function timeKeyOf(r) {
  const raw = String(r.scheduleKey || r.schedule || r.time || '').trim();
  const start = Number.isFinite(r.timeStartMinutes) ? r.timeStartMinutes : undefined;
  const end = Number.isFinite(r.timeEndMinutes) ? r.timeEndMinutes : undefined;
  if (Number.isFinite(start) && Number.isFinite(end)) return `${start}-${end}`;
  const tr = parseTimeBlockToMinutes(raw);
  if (Number.isFinite(tr.start) && Number.isFinite(tr.end)) return `${tr.start}-${tr.end}`;
  return raw.toLowerCase();
}

function emptyTermUnits() {
  return { '1st': 0, '2nd': 0, 'Sem': 0 };
}

function buildFacultyCourseStats(courses = []) {
  const out = new Map();
  const ensure = (key) => {
    if (!out.has(key)) {
      out.set(key, {
        units: 0,
        termUnits: emptyTermUnits(),
        nstpUnits: 0,
        nstpTermUnits: emptyTermUnits(),
        courseCount: 0,
        seen: new Set()
      });
    }
    return out.get(key);
  };
  const add = (key, seenKey, units, termKey, isNstp) => {
    if (!key) return;
    const entry = ensure(key);
    if (entry.seen.has(seenKey)) return;
    entry.seen.add(seenKey);
    entry.units += units;
    entry.courseCount += 1;
    if (termKey && Object.prototype.hasOwnProperty.call(entry.termUnits, termKey)) {
      entry.termUnits[termKey] += units;
    }
    if (isNstp) {
      entry.nstpUnits += units;
      if (termKey && Object.prototype.hasOwnProperty.call(entry.nstpTermUnits, termKey)) {
        entry.nstpTermUnits[termKey] += units;
      }
    }
  };
  (courses || []).forEach((r) => {
    const fid = r.facultyId ?? r.faculty_id;
    const name = r.facultyName || r.faculty || r.instructor || '';
    const code = String(r.code || r.courseName || '').trim().toLowerCase();
    const section = normalizeName(r.section || r.blockCode || '');
    if (!code || !section) return;
    const termKey = shortTerm(r.term || r.semester || r.sem);
    const tk = timeKeyOf(r);
    const seenKey = [code, section, termKey || 'n/a', tk || ''].join('|');
    const units = Number(r.unit ?? r.units ?? r.hours ?? 0) || 0;
    const isNstp = isNSTPCourse(r);
    const idKey = fid != null && fid !== '' ? `id:${fid}` : '';
    const nameKey = name ? `nm:${normalizeName(name)}` : '';
    if (idKey) add(idKey, seenKey, units, termKey, isNstp);
    if (nameKey && nameKey !== idKey) add(nameKey, seenKey, units, termKey, isNstp);
  });
  return out;
}

// Same overload split logic as CourseLoading faculty print utils
function splitOverload(total) {
  if (!Number.isFinite(total) || total <= 0) return { first: 0, second: 0 };
  const candidates = [];
  for (let a = 0; a <= total; a += 1) {
    if (a % 3 !== 0) continue; // first term must be divisible by 3
    const b = total - a;
    const bothDiv3 = b % 3 === 0;
    const gap = Math.abs(a - b);
    candidates.push({ a, b, bothDiv3, gap });
  }
  if (!candidates.length) return { first: total, second: 0 };
  candidates.sort((x, y) => {
    if (x.bothDiv3 !== y.bothDiv3) return (y.bothDiv3 ? 1 : 0) - (x.bothDiv3 ? 1 : 0);
    if (x.gap !== y.gap) return x.gap - y.gap;
    if (x.a !== y.a) return y.a - x.a;
    return 0;
  });
  return { first: candidates[0].a, second: candidates[0].b };
}

function fmtHours(hours) {
  if (!Number.isFinite(hours)) return '0';
  const rounded = Math.round(hours * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function unitsToHours(units) {
  if (!Number.isFinite(units)) return '0';
  return fmtHours(units / 3);
}

function formatTermPrint(units, hours, nstpUnits, nstpHours) {
  const base = `${units}u / ${hours}h`;
  if (Number(nstpUnits) > 0) return `${base} (NSTP ${nstpUnits}u/${nstpHours}h Saturday)`;
  return base;
}

function buildDeptOptions(faculties = []) {
  const seen = new Set();
  const list = [];
  faculties.forEach((f) => {
    const val = String(f.department || f.dept || '').trim();
    if (!val) return;
    const norm = val.toLowerCase();
    if (seen.has(norm)) return;
    seen.add(norm);
    list.push(val);
  });
  return list.sort((a, b) => a.localeCompare(b));
}

function buildEmploymentOptions(faculties = []) {
  const seen = new Set();
  const list = [];
  faculties.forEach((f) => {
    const val = String(f.employment || '').trim();
    if (!val) return;
    const norm = val.toLowerCase();
    if (seen.has(norm)) return;
    seen.add(norm);
    list.push(val);
  });
  return list.sort((a, b) => a.localeCompare(b));
}

export default function CourseLoadingFacultySummary({ faculties = [], courses = [], settingsLoad = {}, loading = false }) {
  const border = useColorModeValue('gray.200', 'gray.700');
  const panelBg = useColorModeValue('white', 'gray.800');
  const muted = useColorModeValue('gray.600', 'gray.300');
  const accentBg = useColorModeValue('blue.50', 'blue.900');
  const accentBorder = useColorModeValue('blue.200', 'blue.700');
  const nstpTone = useColorModeValue('orange.600', 'orange.300');
  const [serverRows, setServerRows] = React.useState([]);
  const [serverLoading, setServerLoading] = React.useState(false);
  const [serverError, setServerError] = React.useState('');
  const busy = serverLoading || loading;
  const [q, setQ] = React.useState('');
  const [dept, setDept] = React.useState('');
  const [employment, setEmployment] = React.useState('');
  const [sortKey, setSortKey] = React.useState('overload');
  const [sortDir, setSortDir] = React.useState('desc');
  const normalizeServerRow = React.useCallback((r, idx) => {
    const num = (v) => Number(v || 0) || 0;
    const termUnitsRaw = r.termUnits || r.term_units || {};
    const termUnits = {
      '1st': num(termUnitsRaw['1st'] ?? termUnitsRaw.first),
      '2nd': num(termUnitsRaw['2nd'] ?? termUnitsRaw.second),
      'Sem': num(termUnitsRaw.Sem ?? termUnitsRaw.sem ?? termUnitsRaw.summer)
    };
    const overloadFirst = num(r.overloadFirstUnits ?? r.overloadFirst ?? r.overload_first);
    const overloadSecond = num(r.overloadSecondUnits ?? r.overloadSecond ?? r.overload_second);
    const overloadFirstHoursRaw = r.overloadFirstHours ?? r.overload_first_hours;
    const overloadSecondHoursRaw = r.overloadSecondHours ?? r.overload_second_hours;
    const loadUnits = num(r.loadUnits ?? r.load_units ?? r.totalUnits ?? r.total_units);
    const releaseUnits = num(r.releaseUnits ?? r.release_units ?? r.loadReleaseUnits ?? r.load_release_units);
    const courseCount = num(r.courseCount ?? r.courses ?? r.countCourses ?? r.count_courses);
    return {
      id: r.facultyId != null ? `id:${r.facultyId}` : r.id || r.faculty || idx,
      facultyId: r.facultyId ?? r.faculty_id ?? null,
      faculty: r.faculty || r.name || '-',
      department: r.department || r.dept || '',
      employment: r.employment || '',
      releaseUnits,
      loadUnits,
      baseline: num(r.baselineUnits ?? r.baseline_units),
      overload: num(r.overloadUnits ?? r.overload_units ?? r.overload),
      overloadUnits: num(r.overloadUnits ?? r.overload_units ?? r.overload),
      overloadFirst,
      overloadSecond,
      overloadFirstHours: overloadFirstHoursRaw != null ? fmtHours(num(overloadFirstHoursRaw)) : unitsToHours(overloadFirst),
      overloadSecondHours: overloadSecondHoursRaw != null ? fmtHours(num(overloadSecondHoursRaw)) : unitsToHours(overloadSecond),
      courseCount,
      termUnits
    };
  }, []);

  const courseStatsByKey = React.useMemo(
    () => buildFacultyCourseStats(courses || []),
    [courses]
  );

  React.useEffect(() => {
    const sy = String(settingsLoad?.school_year || '').trim();
    const sem = String(settingsLoad?.semester || '').trim();
    if (!sy || !sem) {
      setServerRows([]);
      setServerError('');
      setServerLoading(false);
      return;
    }
    let alive = true;
    setServerLoading(true);
    setServerError('');
    (async () => {
      try {
        const res = await api.getFacultySummary({ schoolyear: sy, semester: sem });
        const payload = Array.isArray(res?.rows)
          ? res.rows
          : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res)
          ? res
          : [];
        const normalized = payload.map((r, idx) => normalizeServerRow(r, idx));
        if (!alive) return;
        setServerRows(normalized);
      } catch (e) {
        if (!alive) return;
        setServerError(e?.message || 'Failed to load faculty summary');
        setServerRows([]);
      } finally {
        if (alive) setServerLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [settingsLoad?.school_year, settingsLoad?.semester, normalizeServerRow]);

  const localRows = React.useMemo(() => {
    return (faculties || []).map((f, idx) => {
      const fid = f.id != null ? String(f.id) : '';
      const fname = f.name || f.faculty || f.full_name || f.instructor || '';
      const deptVal = f.department || f.dept || '';
      const empVal = f.employment || '';
      const releaseUnits = Number(f.load_release_units ?? f.loadReleaseUnits ?? f.loadRelease ?? 0) || 0;
      const isFullTime = /full\s*-?\s*time/i.test(String(empVal || ''));
      const isPartTime = !isFullTime && /part\s*-?\s*time/i.test(String(empVal || ''));

      const stats = (() => {
        if (fid) {
          const byId = courseStatsByKey.get(`id:${fid}`);
          if (byId) return byId;
        }
        const nameKey = normalizeName(fname);
        if (nameKey) return courseStatsByKey.get(`nm:${nameKey}`) || null;
        return null;
      })();

      const units = Number(stats?.units ?? 0) || 0;
      const termUnits = stats?.termUnits ? { ...stats.termUnits } : emptyTermUnits();
      const nstpUnits = Number(stats?.nstpUnits ?? 0) || 0;
      const nstpTermUnits = stats?.nstpTermUnits ? { ...stats.nstpTermUnits } : emptyTermUnits();
      const courseCount = Number(stats?.courseCount ?? 0) || 0;
      const nonNstpUnits = Math.max(0, units - nstpUnits);

      const baseline = Math.max(0, 24 - releaseUnits);
      const overloadUnits = Math.max(0, nonNstpUnits - baseline);
      const baseUnitsForSplit = overloadUnits > 0 ? overloadUnits : (isPartTime ? nonNstpUnits : 0);
      const { first: overloadFirst, second: overloadSecond } = splitOverload(baseUnitsForSplit);

      const nstpFirstUnits = nstpTermUnits['1st'] + nstpTermUnits['Sem'];
      const nstpSecondUnits = nstpTermUnits['2nd'] + nstpTermUnits['Sem'];

      return {
        id: fid || fname || idx,
        facultyId: fid || null,
        faculty: fname || '-',
        department: deptVal,
        employment: empVal,
        releaseUnits,
        loadUnits: units,
        baseline,
        overload: overloadUnits,
        overloadUnits,
        overloadFirst,
        overloadSecond,
        overloadFirstHours: unitsToHours(overloadFirst),
        overloadSecondHours: unitsToHours(overloadSecond),
        courseCount,
        termUnits,
        nstpUnits,
        nstpTermUnits,
        nstpFirstUnits,
        nstpSecondUnits,
        nstpFirstHours: unitsToHours(nstpFirstUnits),
        nstpSecondHours: unitsToHours(nstpSecondUnits)
      };
    });
  }, [faculties, courseStatsByKey]);

  const baseRows = React.useMemo(
    () => (serverRows && serverRows.length ? serverRows : localRows),
    [serverRows, localRows]
  );

  const decoratedRows = React.useMemo(() => {
    return (baseRows || []).map((r, idx) => {
      const fid = r.facultyId != null ? String(r.facultyId) : '';
      const fname = r.faculty || r.name || '';
      const stats = (() => {
        if (fid) {
          const byId = courseStatsByKey.get(`id:${fid}`);
          if (byId) return byId;
        }
        const nameKey = normalizeName(fname);
        if (nameKey) return courseStatsByKey.get(`nm:${nameKey}`) || null;
        return null;
      })();

      const hasStats = !!stats;
      const loadUnits = Number(r.loadUnits ?? 0) || 0;
      const releaseUnits = Number(r.releaseUnits ?? 0) || 0;
      const empVal = r.employment || '';
      const isFullTime = /full\s*-?\s*time/i.test(String(empVal || ''));
      const isPartTime = !isFullTime && /part\s*-?\s*time/i.test(String(empVal || ''));

      const termUnits = (r.termUnits && (r.termUnits['1st'] || r.termUnits['2nd'] || r.termUnits.Sem))
        ? r.termUnits
        : (stats?.termUnits ? { ...stats.termUnits } : (r.termUnits || emptyTermUnits()));
      const nstpUnits = Number(stats?.nstpUnits ?? 0) || 0;
      const nstpTermUnits = stats?.nstpTermUnits ? { ...stats.nstpTermUnits } : emptyTermUnits();

      let overloadUnits = Number(r.overloadUnits ?? r.overload ?? 0) || 0;
      let overloadFirst = Number(r.overloadFirst ?? 0) || 0;
      let overloadSecond = Number(r.overloadSecond ?? 0) || 0;
      let overloadFirstHours = r.overloadFirstHours ?? unitsToHours(overloadFirst);
      let overloadSecondHours = r.overloadSecondHours ?? unitsToHours(overloadSecond);

      if (hasStats) {
        const nonNstpUnits = Math.max(0, loadUnits - nstpUnits);
        const baseline = Math.max(0, 24 - releaseUnits);
        overloadUnits = Math.max(0, nonNstpUnits - baseline);
        const baseUnitsForSplit = overloadUnits > 0 ? overloadUnits : (isPartTime ? nonNstpUnits : 0);
        const split = splitOverload(baseUnitsForSplit);
        overloadFirst = split.first;
        overloadSecond = split.second;
        overloadFirstHours = unitsToHours(overloadFirst);
        overloadSecondHours = unitsToHours(overloadSecond);
      }

      const nstpFirstUnits = nstpTermUnits['1st'] + nstpTermUnits['Sem'];
      const nstpSecondUnits = nstpTermUnits['2nd'] + nstpTermUnits['Sem'];

      return {
        ...r,
        id: r.id ?? fid ?? fname ?? idx,
        termUnits,
        nstpUnits,
        nstpTermUnits,
        nstpFirstUnits,
        nstpSecondUnits,
        nstpFirstHours: unitsToHours(nstpFirstUnits),
        nstpSecondHours: unitsToHours(nstpSecondUnits),
        overload: overloadUnits,
        overloadUnits,
        overloadFirst,
        overloadSecond,
        overloadFirstHours,
        overloadSecondHours
      };
    });
  }, [baseRows, courseStatsByKey]);

  const deptOptions = React.useMemo(() => buildDeptOptions(decoratedRows.length ? decoratedRows : faculties), [decoratedRows, faculties]);
  const employmentOptions = React.useMemo(() => buildEmploymentOptions(decoratedRows.length ? decoratedRows : faculties), [decoratedRows, faculties]);

const rows = React.useMemo(() => {
  const ql = q.trim().toLowerCase();
  const filtered = (decoratedRows || [])
    .filter(r => (!ql || [r.faculty, r.department, r.employment].some(x => String(x || '').toLowerCase().includes(ql))))
    .filter(r => (!dept || String(r.department || '').toLowerCase() === String(dept || '').toLowerCase()))
    .filter(r => (!employment || String(r.employment || '').toLowerCase() === String(employment || '').toLowerCase()));

  const dir = sortDir === 'asc' ? 1 : -1;

  const valueOf = (r, key) => {
    switch (key) {
      case 'faculty': return String(r.faculty || '');
      case 'department': return String(r.department || '');
      case 'employment': return String(r.employment || '');
      case 'load': return r.loadUnits || 0;
      case 'release': return r.releaseUnits || 0;
      case 'overload': return r.overloadUnits ?? r.overload ?? 0;
      case 'first': return r.overloadFirst || 0;
      case 'second': return r.overloadSecond || 0;
      case 'courses': return r.courseCount || 0;
      default: return '';
    }
  };

  const cmpStr = (a, b) =>
    String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' });

  return filtered.sort((a, b) => {
    // primary grouping order (always applied)
    const group =
      cmpStr(a.employment, b.employment) ||
      cmpStr(a.department, b.department) ||
      cmpStr(a.faculty, b.faculty);

    if (group !== 0) return group;

    // then apply user-selected sort within the same (employment, department, faculty)
    const va = valueOf(a, sortKey);
    const vb = valueOf(b, sortKey);

    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;

    const sa = String(va).toLowerCase();
    const sb = String(vb).toLowerCase();
    if (sa < sb) return -1 * dir;
    if (sa > sb) return 1 * dir;

    return 0;
  });
}, [decoratedRows, q, dept, employment, sortKey, sortDir]);


  const totals = React.useMemo(() => {
    const totalLoad = rows.reduce((s, r) => s + (Number(r.loadUnits) || 0), 0);
    const totalOverload = rows.reduce((s, r) => s + (Number(r.overloadUnits ?? r.overload) || 0), 0);
    const avgLoad = rows.length ? (totalLoad / rows.length) : 0;
    return {
      totalLoad,
      totalOverload,
      avgLoad: Number.isFinite(avgLoad) ? avgLoad.toFixed(1) : '0.0'
    };
  }, [rows]);

  const handleExport = () => {
    const headers = [
      'Faculty',
      'Department',
      'Employment',
      'Load Units',
      'Load Release',
      'Overload Total',
      '1st Term Overload (units)',
      '1st Term Hours',
      '2nd Term Overload (units)',
      '2nd Term Hours',
      'Courses'
    ];
    const data = rows.map(r => [
      r.faculty,
      r.department,
      r.employment,
      String(r.loadUnits),
      String(r.releaseUnits),
      String(r.overloadUnits ?? r.overload),
      String(r.overloadFirst),
      r.overloadFirstHours,
      String(r.overloadSecond),
      r.overloadSecondHours,
      String(r.courseCount)
    ]);
    const csv = [headers, ...data].map(row => row.map((v) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'faculty_overload_summary.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const headers = [
      'Faculty',
      'Department',
      'Employment',
      'Load Units',
      'Overload',
      '1st Term (units/hrs)',
      '2nd Term (units/hrs)'
    ];
    const compare = (a, b) =>
      String(a ?? "").localeCompare(String(b ?? ""), undefined, {
        numeric: true,
        sensitivity: "base"
      });

    const data = [...rows]
      .sort(
        (a, b) =>
          compare(a.employment, b.employment) ||
          compare(a.department, b.department) ||
          compare(a.faculty, b.faculty)
      )
      .map(r => [
        r.faculty,
        r.department,
        r.employment,
        String(r.loadUnits),
        String(r.overloadUnits ?? r.overload),
        formatTermPrint(r.overloadFirst, r.overloadFirstHours, r.nstpFirstUnits, r.nstpFirstHours),
        formatTermPrint(r.overloadSecond, r.overloadSecondHours, r.nstpSecondUnits, r.nstpSecondHours)
      ]);

    const subtitle = [
      settingsLoad?.school_year ? `SY ${settingsLoad.school_year}` : '',
      settingsLoad?.semester ? `Sem ${settingsLoad.semester}` : ''
    ].filter(Boolean).join('  |  ');
    const bodyHtml = buildTable(headers, data);
    printContent({ title: 'Faculty Overload Summary', subtitle, bodyHtml }, { orientation: 'portrait' });
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'faculty' ? 'asc' : 'desc'); }
  };

  const noLoadConfigured = !(settingsLoad?.school_year && settingsLoad?.semester);

  return (
    <VStack align="stretch" spacing={4}>
      <Box
        borderWidth="1px"
        borderColor={accentBorder}
        bgGradient={useColorModeValue('linear-gradient(120deg, #f8fafc, #e0f2fe)', 'linear-gradient(120deg, #1f2937, #111827)')}
        rounded="xl"
        p={4}
      >
        <HStack justify="space-between" align="center" flexWrap="wrap" spacing={3}>
          <VStack align="flex-start" spacing={1}>
            <Heading size="md">Faculty Summary</Heading>
            <HStack spacing={2} flexWrap="wrap">
              <Tag colorScheme="blue" variant="subtle">
                <TagLabel>SY {settingsLoad?.school_year || 'N/A'}</TagLabel>
              </Tag>
              <Tag colorScheme="blue" variant="subtle">
                <TagLabel>Semester {settingsLoad?.semester || 'N/A'}</TagLabel>
              </Tag>
              <Badge colorScheme="purple">{rows.length} faculty</Badge>
            </HStack>
            <Text fontSize="sm" color={muted}>
              Computed from current schedules load; overload split mirrors the faculty print notice.
            </Text>
          </VStack>
          <HStack spacing={2}>
            <Button size="sm" leftIcon={<FiDownload />} variant="outline" onClick={handleExport} isDisabled={!rows.length}>Export CSV</Button>
            <Button size="sm" leftIcon={<FiPrinter />} colorScheme="blue" onClick={handlePrint} isDisabled={!rows.length}>Print</Button>
          </HStack>
        </HStack>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3} mt={4}>
          <Box borderWidth="1px" borderColor={border} bg={panelBg} rounded="lg" p={3}>
            <Text fontSize="sm" color={muted}>Average Load</Text>
            <Heading size="lg">{totals.avgLoad} units</Heading>
          </Box>
          <Box borderWidth="1px" borderColor={border} bg={panelBg} rounded="lg" p={3}>
            <Text fontSize="sm" color={muted}>Total Load Units</Text>
            <Heading size="lg">{totals.totalLoad}</Heading>
          </Box>
          <Box borderWidth="1px" borderColor={border} bg={panelBg} rounded="lg" p={3}>
            <Text fontSize="sm" color={muted}>Total Overload</Text>
            <Heading size="lg" color={useColorModeValue('red.600', 'red.300')}>{totals.totalOverload}</Heading>
          </Box>
        </SimpleGrid>
      </Box>

      <Box borderWidth="1px" borderColor={border} bg={panelBg} rounded="xl" p={4}>
        <HStack spacing={3} flexWrap="wrap">
          <Input
            placeholder="Search faculty, department, employment"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxW="320px"
          />
          <Select placeholder="Department" value={dept} onChange={(e) => setDept(e.target.value)} maxW="220px">
            {deptOptions.map((opt) => <option key={opt} value={opt.toLowerCase()}>{opt}</option>)}
          </Select>
          <Select placeholder="Employment" value={employment} onChange={(e) => setEmployment(e.target.value)} maxW="200px">
            {employmentOptions.map((opt) => <option key={opt} value={opt.toLowerCase()}>{opt}</option>)}
          </Select>
          <Select value={sortKey} onChange={(e) => toggleSort(e.target.value)} maxW="200px">
            <option value="overload">Sort: Overload</option>
            <option value="load">Sort: Load</option>
            <option value="faculty">Sort: Name</option>
            <option value="department">Sort: Department</option>
            <option value="employment">Sort: Employment</option>
            <option value="first">Sort: 1st Term</option>
            <option value="second">Sort: 2nd Term</option>
            <option value="courses">Sort: Courses</option>
            <option value="release">Sort: Load Release</option>
          </Select>
          <Badge colorScheme="gray">{rows.length} result(s)</Badge>
        </HStack>
        {busy && (
          <Box mt={3} p={3} borderWidth="1px" borderColor={border} rounded="md">
            <Text color={muted} fontSize="sm">
              Loading faculty summary...
            </Text>
          </Box>
        )}
        {!busy && serverError && (
          <Box mt={3} p={3} borderWidth="1px" borderColor={border} rounded="md" bg={useColorModeValue('red.50','red.900')}>
            <Text color={useColorModeValue('red.700','red.200')} fontSize="sm">
              {serverError}
            </Text>
          </Box>
        )}
        {noLoadConfigured && (
          <Box mt={3} p={3} borderWidth="1px" borderColor={border} rounded="md" bg={accentBg}>
            <Text color={muted} fontSize="sm">
              Set School Year and Semester in Schedules Load to populate this summary.
            </Text>
          </Box>
        )}
      </Box>

      <Box display={{ base: 'block', md: 'none' }}>
        <VStack align="stretch" spacing={3}>
          {rows.map((r) => (
            <Box key={r.id} borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} p={4}>
              <VStack align="stretch" spacing={2}>
                <Text fontWeight="800" fontSize="md" noOfLines={2}>{r.faculty}</Text>
                <HStack spacing={2} flexWrap="wrap">
                  {r.department && <Badge>{r.department}</Badge>}
                  {r.employment && <Badge colorScheme="purple">{r.employment}</Badge>}
                </HStack>
                <SimpleGrid columns={2} spacing={2}>
                  <Box>
                    <Text fontSize="xs" color={muted}>Load</Text>
                    <Heading size="sm">{r.loadUnits}</Heading>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Overload</Text>
                    <Heading size="sm" color={useColorModeValue('red.600', 'red.300')}>{r.overloadUnits ?? r.overload}</Heading>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>1st Term</Text>
                    <Text fontWeight="700">{r.overloadFirst}u / {r.overloadFirstHours}h</Text>
                    {r.nstpFirstUnits > 0 && (
                      <Text fontSize="xs" color={nstpTone}>NSTP {r.nstpFirstUnits}u / {r.nstpFirstHours}h Saturday</Text>
                    )}
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>2nd Term</Text>
                    <Text fontWeight="700">{r.overloadSecond}u / {r.overloadSecondHours}h</Text>
                    {r.nstpSecondUnits > 0 && (
                      <Text fontSize="xs" color={nstpTone}>NSTP {r.nstpSecondUnits}u / {r.nstpSecondHours}h Saturday</Text>
                    )}
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Load Release</Text>
                    <Text fontWeight="700">{r.releaseUnits}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Courses</Text>
                    <Text fontWeight="700">{r.courseCount}</Text>
                  </Box>
                </SimpleGrid>
              </VStack>
            </Box>
          ))}
        </VStack>
      </Box>

      <Box borderWidth="1px" borderColor={border} bg={panelBg} rounded="xl" overflowX="auto" display={{ base: 'none', md: 'block' }}>
        <Table size="sm" variant="simple">
          <Thead>
            <Tr>
              <Th onClick={() => toggleSort('faculty')} cursor="pointer" userSelect="none">
                <HStack spacing={1}><Text>Faculty</Text>{sortKey === 'faculty' && (sortDir === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}</HStack>
              </Th>
              <Th onClick={() => toggleSort('department')} cursor="pointer" userSelect="none">
                <HStack spacing={1}><Text>Department</Text>{sortKey === 'department' && (sortDir === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}</HStack>
              </Th>
              <Th onClick={() => toggleSort('employment')} cursor="pointer" userSelect="none">
                <HStack spacing={1}><Text>Employment</Text>{sortKey === 'employment' && (sortDir === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}</HStack>
              </Th>
              <Th isNumeric onClick={() => toggleSort('load')} cursor="pointer" userSelect="none">
                <HStack spacing={1} justify="flex-end"><Text>Load</Text>{sortKey === 'load' && (sortDir === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}</HStack>
              </Th>
              <Th isNumeric onClick={() => toggleSort('release')} cursor="pointer" userSelect="none">
                <HStack spacing={1} justify="flex-end"><Text>Release</Text>{sortKey === 'release' && (sortDir === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}</HStack>
              </Th>
              <Th isNumeric onClick={() => toggleSort('overload')} cursor="pointer" userSelect="none">
                <HStack spacing={1} justify="flex-end"><Text>Overload</Text>{sortKey === 'overload' && (sortDir === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}</HStack>
              </Th>
              <Th isNumeric onClick={() => toggleSort('first')} cursor="pointer" userSelect="none">
                <HStack spacing={1} justify="flex-end"><Text>1st Term (u/h)</Text>{sortKey === 'first' && (sortDir === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}</HStack>
              </Th>
              <Th isNumeric onClick={() => toggleSort('second')} cursor="pointer" userSelect="none">
                <HStack spacing={1} justify="flex-end"><Text>2nd Term (u/h)</Text>{sortKey === 'second' && (sortDir === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}</HStack>
              </Th>
              <Th isNumeric onClick={() => toggleSort('courses')} cursor="pointer" userSelect="none">
                <HStack spacing={1} justify="flex-end"><Text>Courses</Text>{sortKey === 'courses' && (sortDir === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}</HStack>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td>
                  <Stack spacing={1}>
                    <Text fontWeight="700" noOfLines={1}>{r.faculty}</Text>
                    <HStack spacing={2}>
                      {r.termUnits?.['1st'] > 0 && <Badge colorScheme="blue" variant="subtle">1st: {r.termUnits['1st']}u</Badge>}
                      {r.termUnits?.['2nd'] > 0 && <Badge colorScheme="green" variant="subtle">2nd: {r.termUnits['2nd']}u</Badge>}
                      {r.termUnits?.Sem > 0 && <Badge colorScheme="orange" variant="subtle">Sem: {r.termUnits.Sem}u</Badge>}
                    </HStack>
                  </Stack>
                </Td>
                <Td>{r.department || '-'}</Td>
                <Td>{r.employment || '-'}</Td>
                <Td isNumeric fontWeight="700">{r.loadUnits}</Td>
                <Td isNumeric>{r.releaseUnits}</Td>
                <Td isNumeric color={useColorModeValue('red.600', 'red.300')}>{r.overloadUnits ?? r.overload}</Td>
                <Td isNumeric>
                  <Text fontWeight="700">{r.overloadFirst}u</Text>
                  <Text fontSize="xs" color={muted}>{r.overloadFirstHours} hrs</Text>
                  {r.nstpFirstUnits > 0 && (
                    <Text fontSize="xs" color={nstpTone}>NSTP {r.nstpFirstUnits}u / {r.nstpFirstHours}h Saturday</Text>
                  )}
                </Td>
                <Td isNumeric>
                  <Text fontWeight="700">{r.overloadSecond}u</Text>
                  <Text fontSize="xs" color={muted}>{r.overloadSecondHours} hrs</Text>
                  {r.nstpSecondUnits > 0 && (
                    <Text fontSize="xs" color={nstpTone}>NSTP {r.nstpSecondUnits}u / {r.nstpSecondHours}h Saturday</Text>
                  )}
                </Td>
                <Td isNumeric>{r.courseCount}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </VStack>
  );
}
