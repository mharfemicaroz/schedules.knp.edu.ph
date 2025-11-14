import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  Input,
  Select,
  useColorModeValue,
  Text,
  Switch,
  Progress,
  Badge,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  UnorderedList,
  ListItem,
  Collapse,
  Box,
  SimpleGrid,
} from '@chakra-ui/react';
import { FiEdit } from 'react-icons/fi';
import FacultySelect from './FacultySelect';
import DayMultiSelect from './DayMultiSelect';
import { getTimeOptions } from '../utils/timeOptions';
import { useSelector } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
// import { selectAllFaculty } from '../store/facultySlice';
import { buildConflicts, parseF2FDays, parseTimeBlockToMinutes } from '../utils/conflicts';
import { useLocalStorage } from '../utils/scheduleUtils';

export default function EditScheduleModal({ isOpen, onClose, schedule, onSave, viewMode }) {
  const emptyForm = {
    day: '',
    time: '',
    room: '',
    f2fSched: '',
    f2fsched: '',
    session: '',
    examDay: '',
    examSession: '',
    examRoom: '',
    term: '',
    faculty: '',
    courseName: '',
    courseTitle: '',
  };

  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [facultyId, setFacultyId] = useState(null);
  const [f2fDaysSel, setF2fDaysSel] = useState([]);
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const headerBg = useColorModeValue('gray.50', 'gray.700');
  const subtleText = useColorModeValue('gray.600', 'gray.400');
  const allCourses = useSelector(selectAllCourses);
  // const allFaculty = useSelector(selectAllFaculty);
  const [preventSave, setPreventSave] = useLocalStorage('schedPreventSaveOnConflict', true);

  const [suggOpen, setSuggOpen] = useState(false);
  const [suggBusy, setSuggBusy] = useState(false);
  const [suggPlans, setSuggPlans] = useState([]);
  const [suggPercent, setSuggPercent] = useState(0);
  const [suggNote, setSuggNote] = useState('');
  // Suggestion mode no longer needed; single suggestions flow

  const isLocked = useMemo(() => {
    const v = schedule?.lock;
    if (typeof v === 'boolean') return v;
    const s = String(v || '').trim().toLowerCase();
    return s === 'yes' || s === 'true' || s === '1';
  }, [schedule]);

  useEffect(() => {
    // Reset suggestions state on open/close or when switching schedule
    setSuggOpen(false);
    setSuggBusy(false);
    setSuggPlans([]);
    setSuggPercent(0);
    setSuggNote('');

    if (schedule) {
      setForm({
        ...emptyForm,
        day: schedule.day || '',
        time: schedule.time || schedule.schedule || '',
        room: schedule.room || '',
        f2fSched: schedule.f2fSched || schedule.f2fsched || '',
        f2fsched: schedule.f2fSched || schedule.f2fsched || '',
        session: schedule.session || '',
        examDay: schedule.examDay || '',
        examSession: schedule.examSession || '',
        examRoom: schedule.examRoom || '',
        term: schedule.term || '',
        faculty: schedule.faculty || schedule.facultyName || '',
        courseName: schedule.code || schedule.courseName || '',
        courseTitle: schedule.title || schedule.courseTitle || '',
      });
      setFacultyId(schedule.facultyId || schedule.faculty_id || null);
      const initDays = String(schedule.f2fSched || schedule.f2fsched || '')
        .split(',').map(s => s.trim()).filter(Boolean);
      setF2fDaysSel(initDays);
      setIsEditingCourse(false);
    } else {
      setForm(emptyForm);
      setFacultyId(null);
      setF2fDaysSel([]);
      setIsEditingCourse(false);
    }
  }, [schedule, isOpen]);

  const normalizeName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const sameFaculty = (a, b) => {
    const aId = a && a.id != null ? String(a.id) : '';
    const bId = b && b.id != null ? String(b.id) : '';
    if (aId && bId && aId === bId) return true;
    const aName = normalizeName(a && a.name);
    const bName = normalizeName(b && b.name);
    return !!aName && aName === bName;
  };

  const hasFacultyChange = useMemo(() => {
    if (!schedule) return false;
    const prevId = schedule.facultyId || schedule.faculty_id || null;
    const prevName = schedule.faculty || schedule.facultyName || '';
    const idChanged = (facultyId ?? null) !== (prevId ?? null);
    const nameChanged = String(form.faculty || '') !== String(prevName || '');
    return idChanged || nameChanged;
  }, [schedule, facultyId, form.faculty]);

  const canSave = useMemo(() => {
    if (!schedule) return false;
    if (isLocked) return false;
    if (viewMode === 'examination') {
      return Boolean(form.examDay || form.examSession || form.examRoom || isEditingCourse || hasFacultyChange);
    }
    return Boolean(form.day && form.time && form.room);
  }, [form, schedule, viewMode, isEditingCourse, hasFacultyChange, isLocked]);

  const update = (key) => (e) => setForm((s) => ({ ...s, [key]: e.target.value }));

  const liveConflictGroups = useMemo(() => {
    if (!isOpen || !schedule || viewMode === 'examination') return [];
    const cand = { ...schedule };
    if (form?.time != null) { cand.time = form.time; cand.schedule = form.time; cand.scheduleKey = form.time; }
    if (form?.term != null) { cand.term = form.term; }
    if (form?.room != null) cand.room = form.room;
    if (form?.session != null) cand.session = form.session;
    if (form?.f2fSched != null || form?.f2fsched != null) {
      const f2f = String(form.f2fSched || form.f2fsched || '').trim();
      cand.f2fSched = f2f; cand.f2fsched = f2f;
    }
    if (facultyId != null) cand.facultyId = facultyId;
    if (form?.faculty) { cand.faculty = form.faculty; cand.facultyName = form.faculty; }

    const term = String(cand.term || '').trim().toLowerCase();
    const timeStr = String(cand.scheduleKey || cand.schedule || cand.time || '').trim();
    const candDays = (Array.isArray(f2fDaysSel) && f2fDaysSel.length)
      ? f2fDaysSel
      : (Array.isArray(cand.f2fDays) && cand.f2fDays.length)
        ? cand.f2fDays
        : parseF2FDays(cand.f2fSched || cand.f2fsched || cand.day);
    const candFac = { id: cand.facultyId || cand.faculty_id, name: cand.facultyName || cand.faculty };
    if ((!candFac.id && !candFac.name) || !term || !timeStr || !candDays || candDays.length === 0) return [];

    const tr = parseTimeBlockToMinutes(timeStr);
    const candStart = Number.isFinite(schedule?.timeStartMinutes) && schedule?.time === timeStr ? schedule.timeStartMinutes : tr.start;
    const candEnd = Number.isFinite(schedule?.timeEndMinutes) && schedule?.time === timeStr ? schedule.timeEndMinutes : tr.end;
    const candId = `cand-${schedule.id ?? 'x'}`;
    const candRow = { ...cand, id: candId, scheduleKey: timeStr, time: timeStr, timeStartMinutes: candStart, timeEndMinutes: candEnd, f2fDays: candDays, __cid: candId };

    const candSecNorm2 = normalizeName(cand.section || '');
    const rows = (allCourses || [])
      .filter(r => String(r.id) !== String(schedule.id))
      .filter(r => {
        const rFacObj = { id: r.facultyId || r.faculty_id, name: r.facultyName || r.faculty };
        const sameFac = sameFaculty({ id: cand.facultyId || cand.faculty_id, name: cand.facultyName || cand.faculty }, rFacObj);
        const rTerm = String(r.term || '').trim().toLowerCase();
        const rTimeStr = String(r.scheduleKey || r.schedule || r.time || '').trim();
        const rr = parseTimeBlockToMinutes(rTimeStr);
        const rStart = Number.isFinite(r.timeStartMinutes) ? r.timeStartMinutes : rr.start;
        const rEnd = Number.isFinite(r.timeEndMinutes) ? r.timeEndMinutes : rr.end;
        const sameTime = (Number.isFinite(candStart) && Number.isFinite(candEnd) && Number.isFinite(rStart) && Number.isFinite(rEnd) && candStart === rStart && candEnd === rEnd) || (!!timeStr && !!rTimeStr && timeStr === rTimeStr);
        const sameTerm = !!rTerm && rTerm === term;
        const sameSection = normalizeName(r.section || '') === candSecNorm2;
        const sameCode = normalizeName(r.code || r.courseName || '') === normalizeName(cand.code || cand.courseName || '');
        // Only treat as merged duplicate if code also matches
        const isMergedDup = sameFac && sameTerm && sameTime && sameSection && sameCode;
        return !isMergedDup;
      })
      .concat([candRow]);

    const groups = buildConflicts(rows);
    const candSecNorm = normalizeName(cand.section || '');
    let rel = groups
      .map(g => ({ reason: g.reason, key: g.key, items: g.items }))
      .filter(g => g.items.some(it => String(it.id) === candId || it.__cid === candId))
      .map(g => ({
        reason: g.reason,
        items: g.items.filter(it => (String(it.id) !== candId && it.__cid !== candId))
      }))
      .filter(g => g.items.length > 0)
      .filter(g => !/^Self-clash/i.test(String(g.reason || '')));

    const candTerm = term;
    const seenIds = new Set(rel.flatMap(g => g.items.map(it => String(it.id))));
    const extra = [];
    if (candSecNorm) {
      for (const r of allCourses || []) {
        if (!r || String(r.id) === String(schedule.id)) continue;
        const rTerm = String(r.term || '').trim().toLowerCase();
        if (!rTerm || rTerm !== candTerm) continue;
        if (normalizeName(r.section) !== candSecNorm) continue;
        const rFacObj = { id: r.facultyId || r.faculty_id, name: r.facultyName || r.faculty };
        const rTimeStr0 = String(r.scheduleKey || r.schedule || r.time || '').trim();
        const rrX = parseTimeBlockToMinutes(rTimeStr0);
        const rStartX = Number.isFinite(r.timeStartMinutes) ? r.timeStartMinutes : rrX.start;
        const rEndX = Number.isFinite(r.timeEndMinutes) ? r.timeEndMinutes : rrX.end;
        const sameTimeX = (Number.isFinite(candStart) && Number.isFinite(candEnd) && Number.isFinite(rStartX) && Number.isFinite(rEndX) && candStart === rStartX && candEnd === rEndX) || (rTimeStr0 && timeStr && rTimeStr0 === timeStr);
        if (sameFaculty({ id: cand.facultyId || cand.faculty_id, name: cand.facultyName || cand.faculty }, rFacObj) && sameTimeX) continue;
        const rDays = Array.isArray(r.f2fDays) && r.f2fDays.length ? r.f2fDays : parseF2FDays(r.f2fSched || r.f2fsched || r.day);
        if (!rDays || rDays.length === 0) continue;
        const dayHit = rDays.some(d => candDays.includes(d));
        if (!dayHit) continue;
        const rTimeStr = String(r.scheduleKey || r.schedule || r.time || '').trim();
        const rr = parseTimeBlockToMinutes(rTimeStr);
        const rStart = Number.isFinite(r.timeStartMinutes) ? r.timeStartMinutes : rr.start;
        const rEnd = Number.isFinite(r.timeEndMinutes) ? r.timeEndMinutes : rr.end;
        const sameKey = timeStr && rTimeStr && timeStr === rTimeStr;
        const timeHit = sameKey || (Number.isFinite(candStart) && Number.isFinite(candEnd) && Number.isFinite(rStart) && Number.isFinite(rEnd) && Math.max(candStart, rStart) < Math.min(candEnd, rEnd));
        if (!timeHit) continue;
        const idStr = String(r.id);
        if (!seenIds.has(idStr)) { seenIds.add(idStr); extra.push(r); }
      }
    }
    if (extra.length) rel.push({ reason: 'Time overlap (any faculty)', items: extra });

    const facExtra = [];
    const seen2 = new Set(rel.flatMap(g => g.items.map(it => String(it.id))));
    const candFacObj = { id: cand.facultyId || cand.faculty_id, name: cand.facultyName || cand.faculty };
    for (const r of allCourses || []) {
      if (!r || String(r.id) === String(schedule.id)) continue;
      const rFacObj = { id: r.facultyId || r.faculty_id, name: r.facultyName || r.faculty };
      const rTerm0 = String(r.term || '').trim().toLowerCase();
      const rTime0 = String(r.scheduleKey || r.schedule || r.time || '').trim();
      const rr0 = parseTimeBlockToMinutes(rTime0);
      const rStart0 = Number.isFinite(r.timeStartMinutes) ? r.timeStartMinutes : rr0.start;
      const rEnd0 = Number.isFinite(r.timeEndMinutes) ? r.timeEndMinutes : rr0.end;
      const sameTime0 = (Number.isFinite(candStart) && Number.isFinite(candEnd) && Number.isFinite(rStart0) && Number.isFinite(rEnd0) && candStart === rStart0 && candEnd === rEnd0) || (rTime0 && timeStr && rTime0 === timeStr);
      const sameSection0 = normalizeName(r.section || '') === candSecNorm2;
      const sameCode0 = normalizeName(r.code || r.courseName || '') === normalizeName(cand.code || cand.courseName || '');
      // Skip only exact duplicates (same code too); otherwise surface data-quality conflict
      if (sameFaculty(candFacObj, rFacObj) && rTerm0 === term && sameTime0 && sameSection0 && sameCode0) continue;
      if (!sameFaculty(candFacObj, rFacObj)) continue;
      const rTerm = rTerm0;
      if (!rTerm || rTerm !== term) continue;
      if (sameTime0 && !sameSection0) {
        const idStr0 = String(r.id);
        if (!seen2.has(idStr0)) { seen2.add(idStr0); facExtra.push(r); }
        continue;
      }
      const rDays = Array.isArray(r.f2fDays) && r.f2fDays.length ? r.f2fDays : (parseF2FDays(r.f2fSched || r.f2fsched || r.day));
      if (!rDays || rDays.length === 0) continue;
      const dayHit = rDays.some(d => candDays.includes(d));
      if (!dayHit) continue;
      const rTimeStr = String(r.scheduleKey || r.schedule || r.time || '').trim();
      const rr = parseTimeBlockToMinutes(rTimeStr);
      const rStart = Number.isFinite(r.timeStartMinutes) ? r.timeStartMinutes : rr.start;
      const rEnd = Number.isFinite(r.timeEndMinutes) ? r.timeEndMinutes : rr.end;
      const sameKey = timeStr && rTimeStr && timeStr === rTimeStr;
      const timeHit = sameKey || (Number.isFinite(candStart) && Number.isFinite(candEnd) && Number.isFinite(rStart) && Number.isFinite(rEnd) && Math.max(candStart, rStart) < Math.min(candEnd, rEnd));
      if (!timeHit) continue;
      const idStr = String(r.id);
      if (!seen2.has(idStr)) { seen2.add(idStr); facExtra.push(r); }
    }
    if (facExtra.length) rel.push({ reason: 'Double-booked: same faculty at this time', items: facExtra });

    return rel;
  }, [isOpen, schedule, viewMode, form, facultyId, f2fDaysSel, allCourses]);

  const handleSave = async () => {
    setBusy(true);
    try {
      const payload = facultyId ? { ...form, facultyId } : { ...form };
      if (payload.courseName != null) payload.course_name = payload.courseName;
      if (payload.courseTitle != null) payload.course_title = payload.courseTitle;
      if (facultyId && payload.faculty) delete payload.faculty;
      const isCleared = (facultyId == null) && (!payload.faculty || String(payload.faculty).trim() === '');
      if (isCleared) { payload.faculty = null; payload.facultyId = null; }
      await onSave?.(payload);
    } finally {
      setBusy(false);
    }
  };

  async function computeSuggestions({ schedule, form, allCourses, onStep, maxDepth = 3 }) {
    const stepNote = (p, note) => { try { onStep && onStep(p, note); } catch {} };
    try {
      const MAX_DEPTH = Math.max(1, Math.min(10, Number(maxDepth) || 3));

      const nname = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const facKey = (r) => (r.facultyId != null ? `id:${r.facultyId}` : `nm:${nname(r.facultyName || r.faculty || r.instructor)}`);
      const termOf = (r) => String(r.term || '').trim().toLowerCase();
      const sectionOf = (r) => nname(r.section || r.block_code || '');
      const rangeOf = (r) => {
        if (Number.isFinite(r.timeStartMinutes) && Number.isFinite(r.timeEndMinutes)) return { start: r.timeStartMinutes, end: r.timeEndMinutes };
        const src = String(r.time || r.schedule || r.scheduleKey || '').trim();
        const rr = parseTimeBlockToMinutes(src);
        return rr && Number.isFinite(rr.start) && Number.isFinite(rr.end) ? rr : null;
      };
      const keyOf = (rg) => `${rg.start}-${rg.end}`;
      const pad = (n) => String(n).padStart(2, '0');
      const toLabel = (rg) => `${pad(Math.floor(rg.start/60))}:${pad(rg.start%60)}-${pad(Math.floor(rg.end/60))}:${pad(rg.end%60)}`;
      const sessionOfMinutes = (m) => (m < 12*60 ? 'morning' : (m < 17*60 ? 'afternoon' : 'evening'));

      // Restrict suggestions to specific 1-hour slots only
      const allowedSuggestionTimes = new Set([
        '8-9AM','9-10AM','10-11AM','11-12NN',
        '12-1PM','1-2PM','2-3PM','3-4PM','4-5PM','5-6PM',
        '8-9PM',
      ]);
      const timeOpts = (getTimeOptions() || [])
        .map(s => String(s || '').trim())
        .filter(Boolean)
        .filter(t => allowedSuggestionTimes.has(t));
      const optRanges = timeOpts.map(t => ({ src: t, rg: parseTimeBlockToMinutes(t) }))
        .filter(x => x.rg && Number.isFinite(x.rg.start) && Number.isFinite(x.rg.end));
      const keyToSrc = new Map(optRanges.map(x => [keyOf(x.rg), x.src]));
      const keysBySession = optRanges.reduce((acc, x) => {
        const sess = sessionOfMinutes(x.rg.start);
        (acc[sess] = acc[sess] || []).push(keyOf(x.rg));
        return acc;
      }, {});
      const srcByKey = (k) => keyToSrc.get(k) || (() => {
        const [a,b] = k.split('-').map(Number);
        return (Number.isFinite(a) && Number.isFinite(b)) ? toLabel({ start: a, end: b }) : k;
      })();

      const cand = { ...schedule };
      if (form?.time) { cand.time = form.time; cand.schedule = form.time; cand.scheduleKey = form.time; }
      if (form?.term) { cand.term = form.term; }
      const myFac = facKey({ facultyId: cand.facultyId || cand.faculty_id, facultyName: cand.faculty || cand.facultyName });
      const myTerm = termOf(cand);
      const myRg = rangeOf(cand);
      if (!myRg || !myTerm) return [];
      const myKey = keyOf(myRg);
      const mySec = sectionOf(cand);
      const mySess = (String(cand.session || '').trim().toLowerCase()) || sessionOfMinutes(myRg.start);
      const sessionKeys = keysBySession[mySess] || [];
      const sameFacRows = (allCourses || []).filter(r => facKey(r) === myFac);
      const allTerms = Array.from(new Set((allCourses || []).map(termOf).filter(Boolean)));
      const prefTerms = [myTerm, ...allTerms.filter(t => t !== myTerm)];

      const hasSameSectionOverlap = (rg) => {
        for (const r of (allCourses || [])) {
          if (String(r.id) === String(cand.id)) continue;
          if (termOf(r) !== myTerm) continue;
          if (sectionOf(r) !== mySec) continue;
          const rr = rangeOf(r); if (!rr) continue;
          if (Math.max(rg.start, rr.start) < Math.min(rg.end, rr.end)) return true;
        }
        return false;
      };

      const canPlaceRow = (row, termKey, timeKey) => {
        const rowFac = facKey(row);
        const rowSec = sectionOf(row);
        for (const r of (allCourses || [])) {
          if (facKey(r) !== rowFac) continue;
          if (termOf(r) !== termKey) continue;
          const rr = rangeOf(r); if (!rr) continue;
          if (keyOf(rr) === timeKey) {
            if (String(r.id) === String(row.id)) continue;
            if (sectionOf(r) === rowSec) continue;
            return false;
          }
        }
        for (const r of (allCourses || [])) {
          if (termOf(r) !== termKey) continue;
          if (sectionOf(r) !== rowSec) continue;
          const rr = rangeOf(r); if (!rr) continue;
          if (keyOf(rr) === timeKey) return false;
        }
        return true;
      };

      const canPlaceCandidate = (termKey, timeKey) => {
        for (const r of (allCourses || [])) {
          if (facKey(r) !== myFac) continue;
          if (termOf(r) !== termKey) continue;
          const rr = rangeOf(r); if (!rr) continue;
          if (keyOf(rr) === timeKey) {
            if (String(r.id) === String(cand.id)) continue;
            if (sectionOf(r) === mySec) continue;
            return false;
          }
        }
        for (const r of (allCourses || [])) {
          if (termOf(r) !== termKey) continue;
          if (sectionOf(r) !== mySec) continue;
          const rr = rangeOf(r); if (!rr) continue;
          if (keyOf(rr) === timeKey) return false;
        }
        return true;
      };

      stepNote(5, 'Scanning conflicts…');

      const conflicts = (allCourses || [])
        .filter(r => String(r.id) !== String(cand.id))
        .filter(r => termOf(r) === myTerm && facKey(r) === myFac && sectionOf(r) !== mySec)
        .filter(r => {
          const rr = rangeOf(r); if (!rr) return false;
          return Math.max(myRg.start, rr.start) < Math.min(myRg.end, rr.end);
        });

      const plans = [];

      if (hasSameSectionOverlap(myRg)) {
        stepNote(15, 'Proposing candidate moves within same session…');
        let count = 0;
        for (const t of prefTerms) {
          for (const tk of sessionKeys) {
            if (t === myTerm && tk === myKey) continue;
            if (canPlaceCandidate(t, tk)) {
              plans.push({
                label: 'Move this course to avoid same-section overlap',
                candidateChange: { toTerm: t, toTime: srcByKey(tk) },
                steps: [{
                  node: 1,
                  course: cand.code || cand.courseName || 'Course',
                  section: cand.section || '',
                  from: `${cand.term || ''} ${cand.schedule || cand.time || ''}`,
                  to: `${t} ${srcByKey(tk)}`,
                }],
              });
              count++; if (count >= 3) break;
            }
          }
          if (count >= 3) break;
        }
      }

      if (conflicts.length === 0) {
        stepNote(25, 'No same-faculty conflict; proposing free slots for this course…');
        for (const t of prefTerms) {
          for (const tk of sessionKeys) {
            if (t === myTerm && tk === myKey) continue;
            if (canPlaceCandidate(t, tk)) {
              plans.push({
                label: 'Move this course to a free slot',
                candidateChange: { toTerm: t, toTime: srcByKey(tk) },
                steps: [{
                  node: 1,
                  course: cand.code || cand.courseName || 'Course',
                  section: cand.section || '',
                  from: `${cand.term || ''} ${cand.schedule || cand.time || ''}`,
                  to: `${t} ${srcByKey(tk)}`,
                }],
              });
              if (plans.length >= 3) break;
            }
          }
          if (plans.length >= 3) break;
        }
        return plans;
      }

      const target = conflicts[0];
      stepNote(35, 'Trying to move blocking course to keep this course time…');

      // 1-step direct: propose several direct moves for the blocking course
      {
        let added = 0;
        for (const t of prefTerms) {
          for (const tk of sessionKeys) {
            if (t === myTerm && tk === myKey) continue;
            if (canPlaceRow(target, t, tk)) {
              plans.push({
                label: 'Move blocking course to free this slot',
                candidateChange: null,
                steps: [{
                  node: 1,
                  course: target.code || target.courseName || 'Course',
                  section: target.section || '',
                  from: `${myTerm} ${target.schedule || target.time || ''}`,
                  to: `${t} ${srcByKey(tk)}`,
                }],
              });
              added++; if (added >= 3) break;
            }
          }
          if (added >= 3) break;
        }
      }

      const occByTerm = new Map();
      for (const r of sameFacRows) {
        const t = termOf(r); if (!t) continue;
        const rg = rangeOf(r); if (!rg) continue;
        const tk = keyOf(rg);
        const termMap = occByTerm.get(t) || new Map();
        const list = termMap.get(tk) || [];
        termMap.set(tk, list.concat([r]));
        occByTerm.set(t, termMap);
      }

      // Order session keys to prefer currently occupied slots first (to surface 2+/3-step chains),
      // then fall back to empty slots.
      const termMapForMy = occByTerm.get(myTerm) || new Map();
      const sessionKeysOrdered = (sessionKeys || []).slice().sort((a, b) => {
        const al = (termMapForMy.get(a) || []).length;
        const bl = (termMapForMy.get(b) || []).length;
        return bl - al;
      });

      stepNote(45, `Searching multi-step reallocations (up to ${MAX_DEPTH})…`);

      // Also propose moving this course to a free compatible slot (even if conflicts exist)
      {
        let added = 0;
        for (const t of prefTerms) {
          for (const tk of sessionKeysOrdered) {
            if (t === myTerm && tk === myKey) continue;
            if (canPlaceCandidate(t, tk)) {
              plans.push({
                label: 'Move this course to a free slot',
                candidateChange: { toTerm: t, toTime: srcByKey(tk) },
                steps: [{
                  node: 1,
                  course: cand.code || cand.courseName || 'Course',
                  section: cand.section || '',
                  from: `${cand.term || ''} ${cand.schedule || cand.time || ''}`,
                  to: `${t} ${srcByKey(tk)}`,
                }],
              });
              added++; if (added >= 3) break;
            }
          }
          if (added >= 3) break;
        }
      }

      const chainPlansByDepth = new Map();
      const addChainPlan = (plan) => {
        const d = plan.steps.length;
        if (d > MAX_DEPTH) return;
        const arr = chainPlansByDepth.get(d) || [];
        const sig = plan.steps.map(s => `${s.course}|${s.from}|${s.to}`).join('>');
        if (!arr.some(p => p._sig === sig)) {
          arr.push({ ...plan, _sig: sig });
          chainPlansByDepth.set(d, arr);
        }
      };

      const searchCollect = (termKey, targetKey) => {
        const snapshot0 = new Map();
        occByTerm.forEach((m, k) => {
          const m2 = new Map();
          m.forEach((arr, kk) => m2.set(kk, arr.slice()));
          snapshot0.set(k, m2);
        });
        const stack = [{ depth: 1, occ: snapshot0, path: [] }];
        while (stack.length) {
          const { depth, occ, path } = stack.pop();
          if (depth > MAX_DEPTH) continue;
          const termMap = occ.get(termKey) || new Map();
          const occupants = (termMap.get(targetKey) || []).filter(x => String(x.id) !== String(target.id));
          if (occupants.length === 0) {
            addChainPlan({
              label: 'Reallocate multiple courses to free this slot',
              candidateChange: null,
              steps: path.concat([{
                node: depth,
                course: target.code || target.courseName || 'Course',
                section: target.section || '',
                from: `${myTerm} ${target.schedule || target.time || ''}`,
                to: `${termKey} ${srcByKey(targetKey)}`,
              }]),
            });
            continue;
          }
          if (depth === MAX_DEPTH) continue;
          for (const blocker of occupants.slice(0, 3)) {
            const blockerRg = rangeOf(blocker);
            const blockerKey = blockerRg ? keyOf(blockerRg) : '';
            for (const altKey of sessionKeysOrdered) {
              if (altKey === targetKey || altKey === blockerKey) continue;
              if (!canPlaceRow(blocker, termKey, altKey)) continue;
              const nextOcc = new Map();
              occ.forEach((m, k) => {
                const m2 = new Map();
                m.forEach((arr, kk) => m2.set(kk, arr.slice()));
                nextOcc.set(k, m2);
              });
              const nextTermMap = nextOcc.get(termKey) || new Map();
              nextOcc.set(termKey, nextTermMap);
              nextTermMap.set(blockerKey, (nextTermMap.get(blockerKey) || []).filter(x => String(x.id) !== String(blocker.id)));
              nextTermMap.set(altKey, (nextTermMap.get(altKey) || []).concat([blocker]));
              const nextPath = path.concat([{
                node: depth,
                course: blocker.code || blocker.courseName || 'Course',
                section: blocker.section || '',
                from: `${termKey} ${blocker.schedule || blocker.time || ''}`,
                to: `${termKey} ${srcByKey(altKey)}`,
              }]);
              stack.push({ depth: depth + 1, occ: nextOcc, path: nextPath });
            }
          }
        }
      };

      for (const tk of sessionKeysOrdered) {
        if (tk === myKey) continue;
        searchCollect(myTerm, tk);
      }
      for (let d = MAX_DEPTH; d >= 1; d--) {
        const arr = (chainPlansByDepth.get(d) || []).slice(0, 3).map(p => { const { _sig, ...rest } = p; return rest; });
        plans.push(...arr);
      }

      if (plans.length === 0) stepNote(95, `No viable ${MAX_DEPTH}-node plan found.`);
      return plans;
    } catch (e) {
      console.error('[Suggestions] Error:', e);
      return [];
    }
  }

  // computeOtherFacultySuggestions removed per requirement

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered motionPreset="scale" size="5xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(6px)" />
      <ModalContent overflow="hidden" borderRadius="2xl" boxShadow="2xl" maxW="90vw">
        <ModalHeader bg={headerBg} borderBottomWidth="1px">Edit Schedule</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {isLocked && (
            <Alert status="warning" mb={4}>
              <AlertIcon />
              <VStack align="start" spacing={0}>
                <AlertTitle>Schedule is locked</AlertTitle>
                <AlertDescription>Editing is disabled because this schedule is locked.</AlertDescription>
              </VStack>
            </Alert>
          )}
          {schedule ? (
            <VStack align="stretch" spacing={4}>
              <HStack justify="space-between" align="center">
                <Text fontSize="sm" color={subtleText}>
                  {isEditingCourse ? 'Editing course info' : `${form.courseName || schedule.code} - ${form.courseTitle || schedule.title}`}
                </Text>
                <Button
                  aria-label={isEditingCourse ? 'Stop editing course' : 'Edit course'}
                  leftIcon={<FiEdit />}
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingCourse(v => !v)}
                  title={isEditingCourse ? 'Done editing course fields' : 'Edit course name/title'}
                >
                  {isEditingCourse ? 'Done' : 'Edit'}
                </Button>
              </HStack>

              {viewMode !== 'examination' && liveConflictGroups.length > 0 && (
                <Alert status="error" variant="subtle" borderRadius="md">
                  <AlertIcon />
                  <VStack align="start" spacing={1} w="full">
                    <AlertTitle>Potential conflicts detected</AlertTitle>
                    <AlertDescription w="full">
                      {liveConflictGroups.slice(0, 4).map((grp, idx) => (
                        <VStack key={idx} align="start" spacing={1} mb={2}>
                          <Text fontWeight="semibold" color="red.600">{grp.reason}</Text>
                          <UnorderedList ml={6} spacing={1}>
                            {grp.items.slice(0, 6).map(item => (
                              <ListItem key={item.id}>
                                <Text as="span" fontWeight="semibold">{item.code || item.courseName || 'Course'}</Text>
                                <Text as="span"> / {item.section || ''} {(item.f2fSched || item.f2fsched || item.day || '')} {item.schedule || item.time || ''}</Text>
                              </ListItem>
                            ))}
                            {grp.items.length > 6 && (
                              <ListItem>and {grp.items.length - 6} more…</ListItem>
                            )}
                          </UnorderedList>
                        </VStack>
                      ))}
                      {liveConflictGroups.length > 4 && (
                        <Text color="red.600">and {liveConflictGroups.length - 4} more conflict groups…</Text>
                      )}
                      <VStack align="stretch" mt={3} spacing={2}>
                        <HStack flexWrap="wrap" columnGap={3} rowGap={2}>
                          <Button
                            size="sm"
                            colorScheme="blue"
                            variant="outline"
                            onClick={async () => {
                              setSuggOpen(true);
                              setSuggBusy(true);
                              setSuggPlans([]);
                              setSuggPercent(0);
                              setSuggNote('Starting analysis…');
                              setTimeout(async () => {
                                try {
                                  const plans = await computeSuggestions({
                                    schedule,
                                    form,
                                    allCourses,
                                    onStep: (p, note) => {
                                      setSuggPercent(Math.min(100, Math.max(0, p || 0)));
                                      if (note) setSuggNote(note);
                                    },
                                    maxDepth: 3,
                                  });
                                  setSuggPlans(plans || []);
                                } finally {
                                  setSuggBusy(false);
                                  setSuggPercent(100);
                                }
                              }, 30);
                            }}
                          >
                            Find Suggestions
                          </Button>
                          {suggBusy && (
                            <HStack spacing={2}>
                              <Progress size="sm" value={suggPercent} max={100} hasStripe w="240px" />
                              <Text fontSize="xs" color="gray.600">{suggNote}</Text>
                            </HStack>
                          )}
                          {!suggBusy && suggPlans.length > 0 && (
                            <Badge colorScheme="green">
                              {suggPlans.length} plan{(suggPlans.length > 1) ? 's' : ''} suggested
                            </Badge>
                          )}
                        </HStack>
                        <Collapse in={suggOpen} animateOpacity>
                          {suggBusy ? (
                            <Text fontSize="sm" color="gray.600">Analyzing suggestions…</Text>
                          ) : (
                            <VStack align="stretch" spacing={3}>
                              {suggPlans.length === 0 ? (
                                <Text fontSize="sm" color="gray.600">No suggestions found for the selected depth.</Text>
                              ) : (
                                suggPlans.map((plan, i) => {
                                  const maxNode = Math.max(...plan.steps.map(s => s.node || 1));
                                  return (
                                    <Box key={i} p={3} borderWidth="1px" borderRadius="md">
                                      <Text fontSize="sm" fontWeight="semibold" mb={2}>
                                        Plan {i + 1}: {plan.label} • Steps: {plan.steps.length} • Max node: {Number.isFinite(maxNode) ? maxNode : 1}
                                      </Text>
                                      <UnorderedList ml={6} spacing={1}>
                                        {plan.steps.map((s, j) => (
                                          <ListItem key={j}>
                                            Node {s.node || 1}: Move <b>{s.course}</b> ({s.section}) from <b>{s.from}</b> to <b>{s.to}</b>
                                          </ListItem>
                                        ))}
                                      </UnorderedList>
                                      {plan.candidateChange?.toTerm || plan.candidateChange?.toTime ? (
                                        <Text mt={2} fontSize="xs" color="gray.600">
                                          Outcome if applied: set this course to {plan.candidateChange?.toTerm || form.term} {plan.candidateChange?.toTime || form.time}
                                          {plan.candidateChange?.toFacultyName ? ` • Faculty: ${plan.candidateChange?.toFacultyName}` : ''}
                                        </Text>
                                      ) : (
                                        <Text mt={2} fontSize="xs" color="gray.600">
                                          Outcome if applied: keep this course time; move other course(s) to free the slot
                                        </Text>
                                      )}
                                    </Box>
                                  );
                                })
                              )}
                            </VStack>
                          )}
                        </Collapse>
                      </VStack>
                    </AlertDescription>
                  </VStack>
                </Alert>
              )}

              {isEditingCourse && (
                <HStack>
                  <FormControl>
                    <FormLabel>Course Code</FormLabel>
                    <Input value={form.courseName} onChange={update('courseName')} placeholder="e.g., CS101" />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Course Title</FormLabel>
                    <Input value={form.courseTitle} onChange={update('courseTitle')} placeholder="e.g., Introduction to Computing" />
                  </FormControl>
                </HStack>
              )}

              <Text fontSize="sm" color={subtleText} display="none">
                {schedule.code} {schedule.title}
              </Text>
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4} w="full">
                <FormControl>
                  <FormLabel>Term</FormLabel>
                  <Select value={form.term} onChange={update('term')} w="full">
                    <option value=""></option>
                    <option value="1st">1st</option>
                    <option value="2nd">2nd</option>
                    <option value="Sem">Sem</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Session</FormLabel>
                  <Select value={form.session} onChange={update('session')} w="full">
                    <option value="">-</option>
                    <option>Morning</option>
                    <option>Afternoon</option>
                    <option>Evening</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Faculty</FormLabel>
                  <FacultySelect
                    value={form.faculty}
                    onChange={(v) => setForm(s => ({ ...s, faculty: v }))}
                    onChangeId={setFacultyId}
                    allowClear
                  />
                </FormControl>
              </SimpleGrid>
              {viewMode === 'examination' ? (
                <>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} w="full">
                    <FormControl>
                      <FormLabel>Exam Day</FormLabel>
                      <Input value={form.examDay} onChange={update('examDay')} placeholder="Mon/Tue/..." />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Exam Session</FormLabel>
                      <Select value={form.examSession} onChange={update('examSession')}>
                        <option value="">-</option>
                        <option>Morning</option>
                        <option>Afternoon</option>
                        <option>Evening</option>
                      </Select>
                    </FormControl>
                  </SimpleGrid>
                  <FormControl>
                    <FormLabel>Exam Room</FormLabel>
                    <Input value={form.examRoom} onChange={update('examRoom')} />
                  </FormControl>
                </>
              ) : (
                <>
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4} w="full">
                    <FormControl>
                      <FormLabel>Day</FormLabel>
                      <Input value={form.day} onChange={update('day')} placeholder="Mon/Tue or Mon/Wed/Fri" />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Time</FormLabel>
                      <Select value={form.time} onChange={update('time')} w="full">
                        {getTimeOptions().map((t, i) => (
                          <option key={`${t}-${i}`} value={t}>{t || ''}</option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Room</FormLabel>
                      <Input value={form.room} onChange={update('room')} />
                    </FormControl>
                  </SimpleGrid>
                  <FormControl>
                    <FormLabel>F2F Sched</FormLabel>
                    <VStack align="stretch" spacing={2}>
                      <DayMultiSelect
                        value={f2fDaysSel}
                        onChange={(days) => {
                          setF2fDaysSel(days);
                          const joined = days.join(',');
                          setForm(s => ({ ...s, f2fSched: joined, f2fsched: joined }));
                        }}
                      />
                      <Input
                        value={form.f2fSched}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm(s => ({ ...s, f2fSched: v, f2fsched: v }));
                        }}
                        placeholder="Optional notes (will override days if edited)"
                      />
                    </VStack>
                  </FormControl>
                </>
              )}
            </VStack>
          ) : null}
        </ModalBody>
        <ModalFooter gap={3} justifyContent="space-between">
          <HStack align="center" spacing={3}>
            <Switch size="md" colorScheme="red" isChecked={preventSave} onChange={(e) => setPreventSave(e.target.checked)} />
            <Text fontSize="sm" color={subtleText}>Prevent save when conflicts exist</Text>
          </HStack>
          <HStack>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              colorScheme="blue"
              onClick={handleSave}
              isDisabled={isLocked || !canSave || (preventSave && (viewMode !== 'examination') && (liveConflictGroups.length > 0))}
              isLoading={busy}
            >
              Save changes
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
