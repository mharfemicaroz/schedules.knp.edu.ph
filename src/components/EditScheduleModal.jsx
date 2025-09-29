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
  InputGroup,
  InputRightElement,
  IconButton,
  useColorModeValue,
  Text,
  Switch,
} from '@chakra-ui/react';
import { FiX, FiEdit } from 'react-icons/fi';
import FacultySelect from './FacultySelect';
import DayMultiSelect from './DayMultiSelect';
import { getTimeOptions } from '../utils/timeOptions';
import { useSelector } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
import { Alert, AlertIcon, AlertTitle, AlertDescription, UnorderedList, ListItem } from '@chakra-ui/react';
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
  const [facQuery] = useState('');
  const [facultyId, setFacultyId] = useState(null);
  const [f2fDaysSel, setF2fDaysSel] = useState([]);
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const headerBg = useColorModeValue('gray.50', 'gray.700');
  const subtleText = useColorModeValue('gray.600','gray.400');
  const allCourses = useSelector(selectAllCourses);
  const [preventSave, setPreventSave] = useLocalStorage('schedPreventSaveOnConflict', true);
  

  useEffect(() => {
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
        term: schedule.semester || schedule.term || '',
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

  // Faculty options provided by useFaculties

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
    if (viewMode === 'examination') {
      return Boolean(form.examDay || form.examSession || form.examRoom || isEditingCourse || hasFacultyChange);
    }
    return Boolean(form.day && form.time && form.room);
  }, [form, schedule, viewMode, isEditingCourse, hasFacultyChange]);

  const update = (key) => (e) => setForm((s) => ({ ...s, [key]: e.target.value }));
  const filteredFacs = [];

  function normalizeName(s){
    return String(s || '').toLowerCase().replace(/[^a-z0-9]/g,'');
  }
  function sameFaculty(a, b){
    const aId = a && a.id != null ? String(a.id) : '';
    const bId = b && b.id != null ? String(b.id) : '';
    if (aId && bId && aId === bId) return true;
    const aName = normalizeName(a && a.name);
    const bName = normalizeName(b && b.name);
    return !!aName && aName === bName;
  }

  // Compute conflicts live as user edits (regular view only): use same rules as ConflictSchedules
  const liveConflictGroups = useMemo(() => {
    if (!isOpen || !schedule || viewMode === 'examination') return [];
    const cand = { ...schedule };
    // apply form changes into candidate
    if (form?.time != null) { cand.time = form.time; cand.schedule = form.time; cand.scheduleKey = form.time; }
    if (form?.term != null) { cand.term = form.term; cand.semester = form.term; }
    if (form?.room != null) cand.room = form.room;
    if (form?.session != null) cand.session = form.session;
    if (form?.f2fSched != null || form?.f2fsched != null) {
      const f2f = String(form.f2fSched || form.f2fsched || '').trim();
      cand.f2fSched = f2f; cand.f2fsched = f2f;
    }
    if (facultyId != null) cand.facultyId = facultyId;
    if (form?.faculty) { cand.faculty = form.faculty; cand.facultyName = form.faculty; }

    const term = String(cand.semester || cand.term || '').trim().toLowerCase();
    const timeStr = String(cand.scheduleKey || cand.schedule || cand.time || '').trim();
    const candDays = (Array.isArray(f2fDaysSel) && f2fDaysSel.length)
      ? f2fDaysSel
      : (Array.isArray(cand.f2fDays) && cand.f2fDays.length)
        ? cand.f2fDays
        : parseF2FDays(cand.f2fSched || cand.f2fsched || cand.day);
    const candFac = { id: cand.facultyId || cand.faculty_id, name: cand.facultyName || cand.faculty };
    if ((!candFac.id && !candFac.name) || !term || !timeStr || !candDays || candDays.length === 0) return [];

    // Prepare candidate minutes for overlap checks used in buildConflicts
    const tr = parseTimeBlockToMinutes(timeStr);
    const candStart = Number.isFinite(schedule?.timeStartMinutes) && schedule?.time === timeStr ? schedule.timeStartMinutes : tr.start;
    const candEnd = Number.isFinite(schedule?.timeEndMinutes) && schedule?.time === timeStr ? schedule.timeEndMinutes : tr.end;
    const candId = `cand-${schedule.id ?? 'x'}`;
    const candRow = { ...cand, id: candId, scheduleKey: timeStr, time: timeStr, timeStartMinutes: candStart, timeEndMinutes: candEnd, f2fDays: candDays, __cid: candId };

    // Exclude the original row and also exclude rows that are considered "merged duplicates"
    // Merged duplicates: same faculty, same term, same time, same section (block)
    const candSecNorm2 = normalizeName(cand.section || '');
    const rows = (allCourses || [])
      .filter(r => String(r.id) !== String(schedule.id))
      .filter(r => {
        const rFacObj = { id: r.facultyId || r.faculty_id, name: r.facultyName || r.faculty };
        const sameFac = sameFaculty({ id: cand.facultyId || cand.faculty_id, name: cand.facultyName || cand.faculty }, rFacObj);
        const rTerm = String(r.semester || r.term || '').trim().toLowerCase();
        const rTimeStr = String(r.scheduleKey || r.schedule || r.time || '').trim();
        const rr = parseTimeBlockToMinutes(rTimeStr);
        const rStart = Number.isFinite(r.timeStartMinutes) ? r.timeStartMinutes : rr.start;
        const rEnd = Number.isFinite(r.timeEndMinutes) ? r.timeEndMinutes : rr.end;
        const sameTime = (Number.isFinite(candStart) && Number.isFinite(candEnd) && Number.isFinite(rStart) && Number.isFinite(rEnd) && candStart === rStart && candEnd === rEnd) || (!!timeStr && !!rTimeStr && timeStr === rTimeStr);
        const sameTerm = !!rTerm && rTerm === term;
        const sameSection = normalizeName(r.section || '') === candSecNorm2;
        const isMergedDup = sameFac && sameTerm && sameTime && sameSection;
        return !isMergedDup;
      })
      .concat([candRow]);
    const groups = buildConflicts(rows);
    const candSecNorm = normalizeName(cand.section || '');
    // Keep only groups that include the candidate row
    let rel = groups
      .map(g => ({ reason: g.reason, key: g.key, items: g.items }))
      .filter(g => g.items.some(it => String(it.id) === candId || it.__cid === candId))
      .map(g => ({
        reason: g.reason,
        // Same-faculty conflicts from buildConflicts: include regardless of section/course code
        items: g.items.filter(it => (String(it.id) !== candId && it.__cid !== candId))
      }))
      .filter(g => g.items.length > 0)
      // Exclude self-clash groups in the edit modal
      .filter(g => !/^Self-clash/i.test(String(g.reason || '')));
    // Additional broad overlaps (any faculty): same term + any F2F day intersect + overlapping time
    const candTerm = term;
    const seenIds = new Set(rel.flatMap(g => g.items.map(it => String(it.id))));
    const extra = [];
    // Require same section as candidate for broad overlaps
    if (candSecNorm) {
    for (const r of allCourses || []) {
      if (!r || String(r.id) === String(schedule.id)) continue;
      const rTerm = String(r.semester || r.term || '').trim().toLowerCase();
      if (!rTerm || rTerm !== candTerm) continue;
      if (normalizeName(r.section) !== candSecNorm) continue;
      // If same faculty+term+time+section, treat as merged duplicate; skip
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
    if (extra.length) {
      rel.push({ reason: 'Time overlap (any faculty)', items: extra });
    }

    // Additional explicit same-faculty double booking (robust, regardless of section/course code)
    const facExtra = [];
    const seen2 = new Set(rel.flatMap(g => g.items.map(it => String(it.id))));
    const candFacObj = { id: cand.facultyId || cand.faculty_id, name: cand.facultyName || cand.faculty };
    for (const r of allCourses || []) {
      if (!r || String(r.id) === String(schedule.id)) continue;
      const rFacObj = { id: r.facultyId || r.faculty_id, name: r.facultyName || r.faculty };
      // Skip merged duplicates relative to candidate
      const rTerm0 = String(r.semester || r.term || '').trim().toLowerCase();
      const rTime0 = String(r.scheduleKey || r.schedule || r.time || '').trim();
      const rr0 = parseTimeBlockToMinutes(rTime0);
      const rStart0 = Number.isFinite(r.timeStartMinutes) ? r.timeStartMinutes : rr0.start;
      const rEnd0 = Number.isFinite(r.timeEndMinutes) ? r.timeEndMinutes : rr0.end;
      const sameTime0 = (Number.isFinite(candStart) && Number.isFinite(candEnd) && Number.isFinite(rStart0) && Number.isFinite(rEnd0) && candStart === rStart0 && candEnd === rEnd0) || (rTime0 && timeStr && rTime0 === timeStr);
      const sameSection0 = normalizeName(r.section || '') === candSecNorm2;
      if (sameFaculty(candFacObj, rFacObj) && rTerm0 === term && sameTime0 && sameSection0) continue; // merged duplicate
      if (!sameFaculty(candFacObj, rFacObj)) continue;
      const rTerm = rTerm0;
      if (!rTerm || rTerm !== term) continue;
      // New: flag double-booked regardless of F2F day when time collides and section differs
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
    if (facExtra.length) {
      rel.push({ reason: 'Double-booked: same faculty at this time', items: facExtra });
    }
    return rel;
  }, [isOpen, schedule, viewMode, form, facultyId, f2fDaysSel, allCourses]);

  const handleSave = async () => {
    // no conflict gating
    setBusy(true);
    try {
      const payload = facultyId ? { ...form, facultyId } : { ...form };
      // Include snake_case variants for backend compatibility if needed
      if (payload.courseName != null) payload.course_name = payload.courseName;
      if (payload.courseTitle != null) payload.course_title = payload.courseTitle;
      if (facultyId && payload.faculty) delete payload.faculty;
      // If cleared via UI, explicitly null out faculty fields
      const isCleared = (facultyId == null) && (!payload.faculty || String(payload.faculty).trim() === '');
      if (isCleared) { payload.faculty = null; payload.facultyId = null; }
      await onSave?.(payload);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered motionPreset="scale">
      <ModalOverlay backdropFilter="blur(6px)" />
      <ModalContent overflow="hidden" borderRadius="xl" boxShadow="2xl">
        <ModalHeader bg={headerBg} borderBottomWidth="1px">Edit Schedule</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {schedule ? (
            <VStack align="stretch" spacing={4}>

              <HStack justify="space-between" align="center">
                <Text fontSize="sm" color={subtleText}>
                  {isEditingCourse ? 'Editing course info' : `${form.courseName || schedule.code} - ${form.courseTitle || schedule.title}`}
                </Text>
                <IconButton
                  aria-label={isEditingCourse ? 'Stop editing course' : 'Edit course'}
                  icon={<FiEdit />}
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingCourse(v => !v)}
                  title={isEditingCourse ? 'Done editing course fields' : 'Edit course name/title'}
                />
              </HStack>

              {viewMode !== 'examination' && liveConflictGroups.length > 0 && (
                <Alert status="error" variant="subtle" borderRadius="md">
                  <AlertIcon />
                  <VStack align="start" spacing={1} w="full">
                    <AlertTitle>Potential conflicts detected</AlertTitle>
                    <AlertDescription w="full">
                      {liveConflictGroups.slice(0,4).map((grp, idx) => (
                        <VStack key={idx} align="start" spacing={1} mb={2}>
                          <Text fontWeight="semibold" color="red.600">{grp.reason}</Text>
                          <UnorderedList ml={6} spacing={1}>
                            {grp.items.slice(0,6).map(item => (
                              <ListItem key={item.id}>
                                <Text as="span" fontWeight="semibold">{item.code || item.courseName || 'Course'}</Text>
                                <Text as="span"> / {item.section || ''} — {(item.f2fSched || item.f2fsched || item.day || '')} • {item.schedule || item.time || ''}</Text>
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
                {schedule.code} • {schedule.title}
              </Text>
              <HStack>
                <FormControl>
                  <FormLabel>Term</FormLabel>
                  <Select value={form.term} onChange={update('term')}>
                    <option value="">—</option>
                    <option value="1st">1st</option>
                    <option value="2nd">2nd</option>
                    <option value="Sem">Sem</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Session</FormLabel>
                  <Select value={form.session} onChange={update('session')}>
                    <option value="">-</option>
                    <option>Morning</option>
                    <option>Afternoon</option>
                    <option>Evening</option>
                  </Select>
                </FormControl>
              </HStack>
              <FormControl>
                <FormLabel>Faculty</FormLabel>
                <FacultySelect
                  value={form.faculty}
                  onChange={(v) => setForm(s => ({ ...s, faculty: v }))}
                  onChangeId={setFacultyId}
                  allowClear
                />
              </FormControl>
              {viewMode === 'examination' ? (
                <>
                  <HStack>
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
                  </HStack>
                  <FormControl>
                    <FormLabel>Exam Room</FormLabel>
                    <Input value={form.examRoom} onChange={update('examRoom')} />
                  </FormControl>
                </>
              ) : (
                <>
                  <HStack>
                    <FormControl>
                      <FormLabel>Day</FormLabel>
                      <Input value={form.day} onChange={update('day')} placeholder="Mon/Tue or Mon/Wed/Fri" />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Time</FormLabel>
                      <Select value={form.time} onChange={update('time')}>
                        {getTimeOptions().map((t, i) => (
                          <option key={`${t}-${i}`} value={t}>{t || '—'}</option>
                        ))}
                      </Select>
                    </FormControl>
                  </HStack>
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
                  <FormControl>
                    <FormLabel>Room</FormLabel>
                    <Input value={form.room} onChange={update('room')} />
                  </FormControl>
                </>
              )}
            </VStack>
          ) : null}
        </ModalBody>
        <ModalFooter gap={3} justifyContent="space-between">
          <HStack align="center" spacing={3}>
            <Switch size="md" colorScheme="red" isChecked={preventSave} onChange={(e)=>setPreventSave(e.target.checked)} />
            <Text fontSize="sm" color={subtleText}>Prevent save when conflicts exist</Text>
          </HStack>
          <HStack>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button colorScheme="blue" onClick={handleSave} isDisabled={!canSave || (preventSave && (viewMode !== 'examination') && (liveConflictGroups.length > 0))} isLoading={busy}>Save changes</Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}



