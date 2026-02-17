import React from 'react';
import {
  Box,
  Heading,
  Text,
  HStack,
  VStack,
  SimpleGrid,
  Button,
  useToast,
  useColorModeValue,
  Badge,
  Divider,
  Switch,
  FormControl,
  FormLabel,
  Input,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Progress,
  Tag,
  TagLabel,
  Icon,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Textarea,
  Select,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import {
  FiBell,
  FiUpload,
  FiTrash2,
  FiClock,
  FiPlay,
  FiMic,
  FiSend,
  FiVolume2,
} from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { loadSettingsThunk, updateSettingsThunk } from '../store/settingsThunks';
import { selectSettings } from '../store/settingsSlice';
import apiService from '../services/apiService';
import { listenToBellOverride } from '../utils/firebaseOverride';
import FacultySelect from '../components/FacultySelect';

const DEFAULT_BELL = {
  enabled: false,
  intervalMinutes: 60,
  delayBeforeSeconds: 0,
  delayAfterSeconds: 0,
  loopCount: 1,
  loopGapSeconds: 2,
  volumePercent: 80,
  sounds: {
    before: null,
    on: null,
    after: null,
  },
  sessions: {
    am: { label: 'AM Session', enabled: true, start: '08:00', end: '12:00' },
    pm: { label: 'PM Session', enabled: true, start: '13:00', end: '17:00' },
    eve: { label: 'EVE Session', enabled: true, start: '17:00', end: '21:00' },
  },
};

function normalizeBellSystem(raw) {
  const base = DEFAULT_BELL;
  const obj = (raw && typeof raw === 'object') ? raw : {};
  const sessions = (obj.sessions && typeof obj.sessions === 'object') ? obj.sessions : {};
  const mergeSession = (key) => {
    const fallback = base.sessions[key];
    const val = (sessions && typeof sessions[key] === 'object') ? sessions[key] : {};
    return {
      label: String(val.label || fallback.label),
      enabled: typeof val.enabled === 'boolean' ? val.enabled : fallback.enabled,
      start: String(val.start || fallback.start),
      end: String(val.end || fallback.end),
    };
  };
  const soundsRaw = (obj.sounds && typeof obj.sounds === 'object') ? obj.sounds : {};
  const fallbackSound = (obj.sound && typeof obj.sound === 'object') ? obj.sound : null;
  const pickSound = (val) => (val && typeof val === 'object' ? { ...val } : null);
  const sounds = {
    before: pickSound(soundsRaw.before),
    on: pickSound(soundsRaw.on) || pickSound(fallbackSound),
    after: pickSound(soundsRaw.after),
  };
  const bell = {
    ...base,
    ...obj,
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : base.enabled,
    intervalMinutes: Number.isFinite(Number(obj.intervalMinutes)) ? Number(obj.intervalMinutes) : base.intervalMinutes,
    delayBeforeSeconds: Number.isFinite(Number(obj.delayBeforeSeconds ?? obj.advanceSeconds))
      ? Number(obj.delayBeforeSeconds ?? obj.advanceSeconds)
      : base.delayBeforeSeconds,
    delayAfterSeconds: Number.isFinite(Number(obj.delayAfterSeconds ?? obj.delaySeconds))
      ? Number(obj.delayAfterSeconds ?? obj.delaySeconds)
      : base.delayAfterSeconds,
    loopCount: Number.isFinite(Number(obj.loopCount)) ? Number(obj.loopCount) : base.loopCount,
    loopGapSeconds: Number.isFinite(Number(obj.loopGapSeconds)) ? Number(obj.loopGapSeconds) : base.loopGapSeconds,
    volumePercent: Number.isFinite(Number(obj.volumePercent)) ? Number(obj.volumePercent) : base.volumePercent,
    sessions: {
      am: mergeSession('am'),
      pm: mergeSession('pm'),
      eve: mergeSession('eve'),
    },
    sounds,
  };
  delete bell.delaySeconds;
  delete bell.advanceSeconds;
  return bell;
}

const SESSION_KEYS = ['am', 'pm', 'eve'];
const SOUND_KEYS = ['before', 'on', 'after'];
const KIND_LABELS = {
  before: 'Early',
  after: 'After',
  on: 'On Time',
};
const KIND_SCHEMES = {
  before: 'purple',
  after: 'blue',
  on: 'green',
};
const SOUND_TITLES = {
  before: 'Before (Early) Sound',
  on: 'On-time Sound',
  after: 'After Sound',
};
const OVERRIDE_MIN_HOLD_MS = 5000;
const GENERAL_ANNOUNCEMENT_TEMPLATES = [
  {
    id: 'admin-office',
    label: 'Admin office notice',
    text: 'Attention all faculty, please proceed to the admin office.',
  },
  {
    id: 'meeting',
    label: 'Faculty meeting',
    text: 'Attention all faculty, please proceed to {location} for the meeting.',
    needsLocation: true,
  },
  {
    id: 'assembly',
    label: 'Assembly',
    text: 'Attention everyone, please proceed to {location} for the assembly.',
    needsLocation: true,
  },
  {
    id: 'dismissal',
    label: 'Class dismissal',
    text: 'Classes are dismissed for today. Thank you.',
  },
];

 

function parseTimeToMinutes(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return (hh * 60) + mm;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  if (hh > 0) {
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function buildEventsForDay(day, bell) {
  const events = [];
  const intervalMinutes = Math.max(1, Number(bell.intervalMinutes) || 0);
  const intervalMs = intervalMinutes * 60 * 1000;
  const beforeMs = Math.max(0, Number(bell.delayBeforeSeconds) || 0) * 1000;
  const afterMs = Math.max(0, Number(bell.delayAfterSeconds) || 0) * 1000;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return events;
  const sessions = bell.sessions || {};
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayStartMs = dayStart.getTime();

  SESSION_KEYS.forEach((key) => {
    const session = sessions[key];
    if (!session || !session.enabled) return;
    const startMin = parseTimeToMinutes(session.start);
    const endMin = parseTimeToMinutes(session.end);
    if (startMin == null || endMin == null || endMin <= startMin) return;
    const startMs = dayStartMs + startMin * 60 * 1000;
    const endMs = dayStartMs + endMin * 60 * 1000;
    const label = String(session.label || key.toUpperCase());
    for (let t = startMs; t <= endMs; t += intervalMs) {
      const addEvent = (timeMs, kind) => {
        if (timeMs < startMs || timeMs > endMs) return;
        events.push({ time: new Date(timeMs), sessionKey: key, sessionLabel: label, kind });
      };
      if (beforeMs > 0) addEvent(t - beforeMs, 'before');
      if (afterMs > 0) addEvent(t + afterMs, 'after');
      addEvent(t, 'on');
    }
  });

  events.sort((a, b) => a.time.getTime() - b.time.getTime());
  const seen = new Set();
  const unique = [];
  for (const ev of events) {
    const key = ev.time.getTime();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(ev);
  }
  return unique;
}

function buildEventsAround(now, bell) {
  const days = [-1, 0, 1].map((offset) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return d;
  });
  const all = [];
  days.forEach((d) => {
    all.push(...buildEventsForDay(d, bell));
  });
  all.sort((a, b) => a.time.getTime() - b.time.getTime());
  return all;
}

function NumberField({ label, value, onChange, min = 0, max, step = 1, helper, isDisabled = false }) {
  const muted = useColorModeValue('gray.600', 'gray.300');
  return (
    <FormControl>
      <FormLabel fontSize="sm">{label}</FormLabel>
      <NumberInput
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        isDisabled={isDisabled}
        onChange={(_, val) => onChange(Number.isFinite(val) ? val : min)}
      >
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
      {helper && (
        <Text fontSize="xs" color={muted} mt={1}>{helper}</Text>
      )}
    </FormControl>
  );
}

function SessionCard({ title, value, onChange, isDisabled = false }) {
  const border = useColorModeValue('gray.200', 'gray.700');
  const bg = useColorModeValue('white', 'gray.800');
  const muted = useColorModeValue('gray.600', 'gray.300');
  const session = value || {};
  return (
    <Box borderWidth="1px" borderColor={border} rounded="lg" p={4} bg={bg}>
      <HStack justify="space-between" mb={3}>
        <VStack align="start" spacing={0}>
          <Heading size="sm">{title}</Heading>
          <Text fontSize="xs" color={muted}>Runs only within this window.</Text>
        </VStack>
        <Switch
          isChecked={!!session.enabled}
          onChange={(e) => onChange({ ...session, enabled: e.target.checked })}
          colorScheme="blue"
          isDisabled={isDisabled}
        />
      </HStack>
      <SimpleGrid columns={{ base: 1, sm: 2 }} gap={3}>
        <FormControl>
          <FormLabel fontSize="sm">Start</FormLabel>
          <Input
            type="time"
            value={session.start || ''}
            onChange={(e) => onChange({ ...session, start: e.target.value })}
            isDisabled={isDisabled}
          />
        </FormControl>
        <FormControl>
          <FormLabel fontSize="sm">End</FormLabel>
          <Input
            type="time"
            value={session.end || ''}
            onChange={(e) => onChange({ ...session, end: e.target.value })}
            isDisabled={isDisabled}
          />
        </FormControl>
      </SimpleGrid>
    </Box>
  );
}

export default function AdminBellSystem() {
  const toast = useToast();
  const dispatch = useDispatch();
  const settings = useSelector(selectSettings);
  const authUser = useSelector(s => s.auth.user);
  const roleStr = String(authUser?.role || '').toLowerCase();
  const isAdmin = roleStr === 'admin';

  const border = useColorModeValue('gray.200', 'gray.700');
  const bg = useColorModeValue('white', 'gray.800');
  const muted = useColorModeValue('gray.600', 'gray.300');
  const highlight = useColorModeValue('blue.600', 'blue.300');
  const softBg = useColorModeValue('gray.50', 'gray.900');

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [orig, setOrig] = React.useState(DEFAULT_BELL);
  const [form, setForm] = React.useState(DEFAULT_BELL);
  const fileRef = React.useRef(null);
  const [uploadKind, setUploadKind] = React.useState('on');
  const [lastUpdated, setLastUpdated] = React.useState(settings?.updatedAt || null);
  const [now, setNow] = React.useState(() => new Date());
  const [audioUnlocked, setAudioUnlocked] = React.useState(false);
  const [unlocking, setUnlocking] = React.useState(false);
  const [overrideActive, setOverrideActive] = React.useState(false);
  const audioRef = React.useRef(null);
  const [previewing, setPreviewing] = React.useState('');
  const slotAudioRefs = React.useRef({});
  const ringLockRef = React.useRef(false);
  const lastEventRef = React.useRef(null);
  const overrideDelayRef = React.useRef(null);
  const lastOverrideEventRef = React.useRef('');
  const lastLocalOverrideRef = React.useRef('');
  const overrideAudioWarnRef = React.useRef(false);
  const [announceMode, setAnnounceMode] = React.useState('faculty');
  const [announceFaculty, setAnnounceFaculty] = React.useState('');
  const [announceFacultyId, setAnnounceFacultyId] = React.useState(null);
  const [announceLocation, setAnnounceLocation] = React.useState('admin office');
  const [announceTemplate, setAnnounceTemplate] = React.useState('admin-office');
  const [announceCustom, setAnnounceCustom] = React.useState('');
  const [announceVoice, setAnnounceVoice] = React.useState('');
  const [announceRate, setAnnounceRate] = React.useState(1);
  const [announcePitch, setAnnouncePitch] = React.useState(1);
  const [announcePreChime, setAnnouncePreChime] = React.useState(true);
  const [announcePostChime, setAnnouncePostChime] = React.useState(true);
  const [announceChimeCount, setAnnounceChimeCount] = React.useState(1);
  const [announceChimeGapSeconds, setAnnounceChimeGapSeconds] = React.useState(0.4);
  const [announceRepeatCount, setAnnounceRepeatCount] = React.useState(1);
  const [announceRepeatGapSeconds, setAnnounceRepeatGapSeconds] = React.useState(3);
  const [announceSending, setAnnounceSending] = React.useState(false);
  const [voices, setVoices] = React.useState([]);
  const [ttsSupported, setTtsSupported] = React.useState(true);
  const announceLockRef = React.useRef(false);
  const audioCtxRef = React.useRef(null);
  const lastAnnouncementEventRef = React.useRef('');
  const lastLocalAnnouncementRef = React.useRef('');
  const announceAudioWarnRef = React.useRef(false);
  const announcementListenAtRef = React.useRef(Date.now());
  const firebaseConfigured = React.useMemo(() => (
    !!import.meta.env.VITE_FB_API_KEY && !!import.meta.env.VITE_FB_DATABASE_URL
  ), []);

  const dirty = React.useMemo(() => JSON.stringify(form) !== JSON.stringify(orig), [form, orig]);
  const controlsDisabled = overrideActive;
  const dirtyRef = React.useRef(dirty);
  const overrideActiveRef = React.useRef(overrideActive);
  const savingRef = React.useRef(saving);

  React.useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  React.useEffect(() => { overrideActiveRef.current = overrideActive; }, [overrideActive]);
  React.useEffect(() => { savingRef.current = saving; }, [saving]);

  const resolveSoundUrl = React.useCallback((sound) => {
    if (!sound) return '';
    const raw = typeof sound === 'string'
      ? sound
      : (sound.dataUrl || sound.url || sound.path || '');
    const trimmed = String(raw || '').trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('data:') || trimmed.startsWith('http')) return trimmed;
    const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    try {
      const base = apiService.baseURL || window.location.origin;
      const baseUrl = /^https?:\/\//i.test(base) ? base : `${window.location.origin}${base}`;
      return new URL(normalized, baseUrl).toString();
    } catch {
      return trimmed;
    }
  }, []);
  const sounds = form.sounds || {};
  const primarySound = sounds.on || sounds.before || sounds.after || null;
  const primarySoundUrl = resolveSoundUrl(primarySound);
  const pickSoundForKind = React.useCallback((kind) => {
    const pool = form.sounds || {};
    return pool[kind] || pool.on || pool.before || pool.after || null;
  }, [form.sounds]);
  const selectedAnnouncementTemplate = React.useMemo(() => (
    GENERAL_ANNOUNCEMENT_TEMPLATES.find((t) => t.id === announceTemplate)
      || GENERAL_ANNOUNCEMENT_TEMPLATES[0]
  ), [announceTemplate]);
  const announcementLocationNeeded = React.useMemo(() => (
    announceMode === 'faculty'
    || (announceMode === 'general' && selectedAnnouncementTemplate?.needsLocation)
  ), [announceMode, selectedAnnouncementTemplate]);
  const announcementMessage = React.useMemo(() => {
    const faculty = String(announceFaculty || '').trim();
    const location = String(announceLocation || '').trim() || 'admin office';
    if (announceMode === 'faculty') {
      if (!faculty) return '';
      return `Attention ${faculty}, please proceed to ${location} now.`;
    }
    if (announceMode === 'general') {
      const template = selectedAnnouncementTemplate || GENERAL_ANNOUNCEMENT_TEMPLATES[0];
      if (!template) return '';
      let text = String(template.text || '');
      if (text.includes('{location}')) {
        text = text.replace('{location}', location);
      }
      return text;
    }
    if (announceMode === 'custom') {
      return String(announceCustom || '').trim();
    }
    return '';
  }, [announceMode, announceFaculty, announceLocation, announceCustom, selectedAnnouncementTemplate]);
  const visibleVoices = React.useMemo(() => (
    (voices || []).filter((v) => v.lang === 'en-US')
  ), [voices]);
  const selectedAnnouncementVoice = React.useMemo(() => (
    visibleVoices.find((v) => v.name === announceVoice) || null
  ), [visibleVoices, announceVoice]);

  React.useEffect(() => {
    setLastUpdated(settings?.updatedAt || null);
  }, [settings?.updatedAt]);

  const buildSnapshot = React.useCallback((data) => {
    const bell = normalizeBellSystem(data?.bellSystem);
    const updatedAt = data?.updatedAt || null;
    return { bell, updatedAt, hash: JSON.stringify({ updatedAt, bell }) };
  }, []);

  const applySnapshot = React.useCallback((snap, { force = false } = {}) => {
    if (force || (!dirtyRef.current && !overrideActiveRef.current && !savingRef.current)) {
      setOrig(snap.bell);
      setForm(snap.bell);
    }
    if (snap.updatedAt != null) setLastUpdated(snap.updatedAt);
  }, []);

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    setAudioUnlocked(false);
  }, [primarySoundUrl]);

  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.src = primarySoundUrl || '';
      if (audioRef.current.load) audioRef.current.load();
    }
  }, [primarySoundUrl]);

  React.useEffect(() => {
    if (audioRef.current) {
      const vol = Math.min(1, Math.max(0, Number(form.volumePercent) || 0) / 100);
      audioRef.current.volume = vol;
    }
  }, [form.volumePercent, primarySoundUrl]);

  React.useEffect(() => {
    const supported = typeof window !== 'undefined'
      && 'speechSynthesis' in window
      && typeof window.SpeechSynthesisUtterance !== 'undefined';
    setTtsSupported(supported);
    if (!supported) return () => {};
    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices() || [];
      setVoices(list);
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);


  React.useEffect(() => {
    if (!visibleVoices.length) return;
    const inList = visibleVoices.find((v) => v.name === announceVoice);
    if (inList) return;
    setAnnounceVoice(visibleVoices[0].name);
  }, [visibleVoices, announceVoice]);


  const refresh = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await dispatch(loadSettingsThunk()).unwrap();
      const snap = buildSnapshot(data);
      applySnapshot(snap, { force: true });
    } catch (e) {
      toast({ title: 'Failed to load bell settings', status: 'error' });
    } finally {
      setLoading(false);
    }
  }, [dispatch, toast, buildSnapshot, applySnapshot]);

  React.useEffect(() => { refresh(); }, [refresh]);

  const refreshSilent = React.useCallback(async () => {
    if (dirtyRef.current || overrideActiveRef.current || savingRef.current) return;
    try {
      const data = await dispatch(loadSettingsThunk()).unwrap();
      const snap = buildSnapshot(data);
      applySnapshot(snap);
    } catch {}
  }, [dispatch, buildSnapshot, applySnapshot]);

  const refreshSilentRef = React.useRef(refreshSilent);
  React.useEffect(() => { refreshSilentRef.current = refreshSilent; }, [refreshSilent]);

  const save = async () => {
    try {
      setSaving(true);
      const payload = { bellSystem: form };
      const data = await dispatch(updateSettingsThunk(payload)).unwrap();
      const snap = buildSnapshot(data);
      applySnapshot(snap, { force: true });
      toast({ title: 'Bell settings saved', status: 'success' });
    } catch (e) {
      toast({ title: e?.message || 'Failed to save', status: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const onPickFile = (kind) => {
    if (!fileRef.current) return;
    setUploadKind(kind);
    fileRef.current.click();
  };

  const onFileChange = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      toast({ title: 'Please select an audio file', status: 'warning' });
      event.target.value = '';
      return;
    }
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: 'Audio file is too large (max 20 MB)', status: 'warning' });
      event.target.value = '';
      return;
    }
    const kind = SOUND_KEYS.includes(uploadKind) ? uploadKind : 'on';
    try {
      setUploading(true);
      const res = await apiService.uploadBellSound(file, kind);
      const nextSound = res?.sound || res?.bellSystem?.sounds?.[kind] || res?.bellSystem?.sound;
      if (!nextSound) {
        throw new Error('Upload failed');
      }
      setForm((prev) => ({ ...prev, sounds: { ...(prev.sounds || {}), [kind]: nextSound } }));
      setOrig((prev) => ({ ...prev, sounds: { ...(prev.sounds || {}), [kind]: nextSound } }));
      if (res?.updatedAt) setLastUpdated(res.updatedAt);
      toast({ title: 'Bell sound uploaded', status: 'success' });
    } catch (e) {
      toast({ title: e?.message || 'Failed to upload', status: 'error' });
    } finally {
      setUploading(false);
    }
    event.target.value = '';
  };

  const clearSound = async (kind) => {
    const key = SOUND_KEYS.includes(kind) ? kind : 'on';
    try {
      setUploading(true);
      const res = await apiService.clearBellSound(key);
      setForm((prev) => ({ ...prev, sounds: { ...(prev.sounds || {}), [key]: null } }));
      setOrig((prev) => ({ ...prev, sounds: { ...(prev.sounds || {}), [key]: null } }));
      if (res?.updatedAt) setLastUpdated(res.updatedAt);
      toast({ title: 'Bell sound cleared', status: 'success' });
    } catch (e) {
      toast({ title: e?.message || 'Failed to clear sound', status: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const unlockAudio = async ({ silent = false } = {}) => {
    if (!primarySoundUrl) {
      if (!silent) toast({ title: 'Upload a bell sound first', status: 'info' });
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    try {
      setUnlocking(true);
      if (audio.src !== primarySoundUrl) {
        audio.src = primarySoundUrl;
        if (audio.load) audio.load();
      }
      const prevVolume = audio.volume;
      audio.volume = 0;
      audio.currentTime = 0;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.volume = prevVolume;
      setAudioUnlocked(true);
      if (!silent) toast({ title: 'Audio ready', status: 'success' });
    } catch (e) {
      setAudioUnlocked(false);
      if (!silent) toast({ title: 'Audio blocked by browser', status: 'warning' });
    } finally {
      setUnlocking(false);
    }
  };

  const pickAnnouncementVoice = React.useCallback((voiceName, voiceLang) => {
    const list = voices || [];
    if (!list.length) return null;
    if (voiceName) {
      const found = list.find((v) => v.name === voiceName);
      if (found) return found;
    }
    if (voiceLang) {
      const exact = list.find((v) => v.lang === voiceLang);
      if (exact) return exact;
      const short = String(voiceLang).split('-')[0];
      const match = list.find((v) => String(v.lang || '').startsWith(short));
      if (match) return match;
    }
    const enUs = list.find((v) => v.lang === 'en-US');
    if (enUs) return enUs;
    const english = list.find((v) => String(v.lang || '').toLowerCase().startsWith('en'));
    return english || list[0];
  }, [voices]);

  const speakAnnouncement = React.useCallback(async (message, opts = {}) => {
    if (!message) return false;
    if (!ttsSupported || typeof window === 'undefined' || !window.speechSynthesis) return false;
    const utter = new SpeechSynthesisUtterance(message);
    const voice = pickAnnouncementVoice(opts.voiceName, opts.lang);
    if (voice) utter.voice = voice;
    const rate = Number.isFinite(Number(opts.rate)) ? Number(opts.rate) : announceRate;
    const pitch = Number.isFinite(Number(opts.pitch)) ? Number(opts.pitch) : announcePitch;
    utter.rate = Math.min(2, Math.max(0.5, rate));
    utter.pitch = Math.min(2, Math.max(0.5, pitch));
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        resolve(ok);
      };
      utter.onend = () => finish(true);
      utter.onerror = () => finish(false);
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      } catch {
        finish(false);
      }
      const timeoutMs = Math.max(8000, message.length * 60);
      setTimeout(() => finish(false), timeoutMs);
    });
  }, [announceRate, announcePitch, pickAnnouncementVoice, ttsSupported]);

  const ensureAudioContext = React.useCallback(() => {
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new Ctor();
    }
    return audioCtxRef.current;
  }, []);

  const playTone = React.useCallback((ctx, freq, durationMs, volume = 0.28) => (
    new Promise((resolve) => {
      try {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        const now = ctx.currentTime;
        const dur = Math.max(0.05, durationMs / 1000);
        osc.type = 'sine';
        osc2.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc2.frequency.setValueAtTime(freq * 2.01, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(volume, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc2.start(now);
        osc.stop(now + dur + 0.05);
        osc2.stop(now + dur + 0.05);
        setTimeout(() => resolve(true), (dur * 1000) + 120);
      } catch {
        resolve(false);
      }
    })
  ), []);

  const playChimeOnce = React.useCallback(async () => {
    const ctx = ensureAudioContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    const ok1 = await playTone(ctx, 784, 420, 0.3);
    if (!ok1) return false;
    await new Promise((resolve) => setTimeout(resolve, 120));
    const ok2 = await playTone(ctx, 523, 520, 0.26);
    return ok2;
  }, [ensureAudioContext, playTone]);

  const playChimeSequence = React.useCallback(async (count, gapMs) => {
    const loops = Math.max(1, Math.round(Number(count) || 1));
    const gap = Math.max(0, Number(gapMs) || 0);
    for (let i = 0; i < loops; i += 1) {
      const ok = await playChimeOnce();
      if (!ok) return false;
      if (gap && i < loops - 1) {
        await new Promise((resolve) => setTimeout(resolve, gap));
      }
    }
    return true;
  }, [playChimeOnce]);

  const playAnnouncementSequence = React.useCallback(async (message, opts = {}) => {
    if (!message) return false;
    if (announceLockRef.current || ringLockRef.current) return false;
    announceLockRef.current = true;
    const repeatCount = Math.max(1, Math.round(Number(opts.repeatCount ?? announceRepeatCount) || 1));
    const repeatGapMs = Math.max(0, Number(opts.repeatGapSeconds ?? announceRepeatGapSeconds) * 1000);
    const preChime = opts.preChime ?? announcePreChime;
    const postChime = opts.postChime ?? announcePostChime;
    const chimeCount = opts.chimeCount ?? announceChimeCount;
    const chimeGapMs = (Number(opts.chimeGapSeconds ?? announceChimeGapSeconds) || 0) * 1000;
    try {
      for (let i = 0; i < repeatCount; i += 1) {
        if (preChime) {
          const chimeOk = await playChimeSequence(chimeCount, chimeGapMs);
          if (!chimeOk) return false;
        }
        const spoke = await speakAnnouncement(message, {
          voiceName: opts.voiceName,
          lang: opts.lang,
          rate: opts.rate,
          pitch: opts.pitch,
        });
        if (!spoke) return false;
        if (postChime) {
          const chimeOk = await playChimeSequence(chimeCount, chimeGapMs);
          if (!chimeOk) return false;
        }
        if (repeatGapMs && i < repeatCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, repeatGapMs));
        }
      }
      return true;
    } finally {
      announceLockRef.current = false;
    }
  }, [
    announceChimeCount,
    announceChimeGapSeconds,
    announcePostChime,
    announcePreChime,
    announceRepeatCount,
    announceRepeatGapSeconds,
    playChimeSequence,
    speakAnnouncement,
  ]);

  React.useEffect(() => {
    if (!primarySoundUrl || audioUnlocked) return;
    void unlockAudio({ silent: true });
    const handler = () => {
      void unlockAudio({ silent: true });
    };
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, [primarySoundUrl, audioUnlocked, unlockAudio]);

  const triggerBell = React.useCallback(async (eventKey, ringUrl, { force = false } = {}) => {
    if ((!audioUnlocked && !force) || !ringUrl) return;
    if (ringLockRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    ringLockRef.current = true;
    lastEventRef.current = eventKey;
    const loops = Math.max(1, Math.round(Number(form.loopCount) || 1));
    const gapMs = Math.max(0, Math.round(Number(form.loopGapSeconds) || 0) * 1000);
    const volume = Math.min(1, Math.max(0, Number(form.volumePercent) || 0) / 100);
    let played = false;
    try {
      for (let i = 0; i < loops; i += 1) {
        audio.pause();
        audio.currentTime = 0;
        if (audio.src !== ringUrl) {
          audio.src = ringUrl;
          if (audio.load) audio.load();
        }
        audio.volume = volume;
        try {
          const playedNow = await Promise.race([
            audio.play().then(() => true).catch(() => false),
            new Promise((resolve) => setTimeout(() => resolve(false), 3000)),
          ]);
          if (!playedNow) break;
          played = true;
        } catch {
          break;
        }
        const maxWaitMs = Number.isFinite(audio.duration) && audio.duration > 0
          ? Math.ceil(audio.duration * 1000) + 500
          : 8000;
        await new Promise((resolve) => {
          let done = false;
          const finalize = () => {
            if (done) return;
            done = true;
            audio.removeEventListener('ended', finalize);
            audio.removeEventListener('error', finalize);
            resolve();
          };
          audio.addEventListener('ended', finalize);
          audio.addEventListener('error', finalize);
          setTimeout(finalize, maxWaitMs);
        });
        if (gapMs && i < loops - 1) {
          await new Promise((resolve) => setTimeout(resolve, gapMs));
        }
      }
    } finally {
      ringLockRef.current = false;
    }
    return played;
  }, [audioUnlocked, form.loopCount, form.loopGapSeconds, form.volumePercent]);

  const handleRemoteOverride = React.useCallback(async (payload) => {
    if (overrideActiveRef.current || ringLockRef.current) return;
    const rawKey = payload?.updatedAt || payload?.ts || '';
    const key = String(rawKey || '');
    if (!key || key === lastOverrideEventRef.current) return;
    if (key === lastLocalOverrideRef.current) return;
    lastOverrideEventRef.current = key;
    const soundEntry = pickSoundForKind('on');
    const ringUrl = resolveSoundUrl(soundEntry);
    if (!ringUrl) return;
    const played = await triggerBell(`remote-override-${key}`, ringUrl, { force: true });
    if (!played && !overrideAudioWarnRef.current) {
      overrideAudioWarnRef.current = true;
      toast({ title: 'Realtime bell needs a click to enable audio', status: 'info' });
    }
  }, [pickSoundForKind, resolveSoundUrl, triggerBell, toast]);

  const handleRemoteOverrideRef = React.useRef(handleRemoteOverride);
  React.useEffect(() => { handleRemoteOverrideRef.current = handleRemoteOverride; }, [handleRemoteOverride]);

  const handleRemoteAnnouncement = React.useCallback(async (payload) => {
    const ts = Number(payload?.ts);
    if (Number.isFinite(ts) && ts < (announcementListenAtRef.current - 1000)) return;
    const rawKey = payload?.eventId || payload?.updatedAt || payload?.ts || '';
    const key = String(rawKey || '');
    if (!key || key === lastAnnouncementEventRef.current) return;
    if (key === lastLocalAnnouncementRef.current) return;
    lastAnnouncementEventRef.current = key;
    const message = String(payload?.message || '').trim();
    if (!message) return;
    if (!ttsSupported) {
      if (!announceAudioWarnRef.current) {
        announceAudioWarnRef.current = true;
        toast({ title: 'Text-to-speech is not supported on this browser', status: 'info' });
      }
      return;
    }
    const played = await playAnnouncementSequence(message, {
      voiceName: payload?.voice,
      lang: payload?.lang,
      rate: payload?.rate,
      pitch: payload?.pitch,
      preChime: payload?.preChime,
      postChime: payload?.postChime,
      chimeCount: payload?.chimeCount,
      chimeGapSeconds: payload?.chimeGapSeconds,
      repeatCount: payload?.repeatCount,
      repeatGapSeconds: payload?.repeatGapSeconds,
    });
    if (!played && !announceAudioWarnRef.current) {
      announceAudioWarnRef.current = true;
      toast({ title: 'Realtime announcement needs a click to enable audio', status: 'info' });
    }
  }, [playAnnouncementSequence, toast, ttsSupported]);

  const handleRemoteAnnouncementRef = React.useRef(handleRemoteAnnouncement);
  React.useEffect(() => { handleRemoteAnnouncementRef.current = handleRemoteAnnouncement; }, [handleRemoteAnnouncement]);

  React.useEffect(() => {
    if (!firebaseConfigured) {
      return () => {};
    }
    announcementListenAtRef.current = Date.now();
    const unsubOverride = listenToBellOverride((payload) => {
      const type = payload?.type || '';
      if (type === 'override' || type === 'settings') {
        const refreshNow = refreshSilentRef.current;
        if (refreshNow) void refreshNow();
      }
      if (type === 'override') {
        const handler = handleRemoteOverrideRef.current;
        if (handler) void handler(payload);
      }
      if (type === 'announcement') {
        const handler = handleRemoteAnnouncementRef.current;
        if (handler) void handler(payload);
      }
    });
    return () => {
      unsubOverride();
    };
  }, [firebaseConfigured]);

  const previewSound = React.useCallback(async (kind) => {
    if (overrideActive) return;
    const sound = sounds[kind];
    const url = resolveSoundUrl(sound);
    if (!url) {
      toast({ title: 'No sound assigned for this slot', status: 'info' });
      return;
    }
    const audio = slotAudioRefs.current[kind] || audioRef.current;
    if (!audio) return;
    if (ringLockRef.current) {
      toast({ title: 'Bell is currently playing', status: 'info' });
      return;
    }
    try {
      ringLockRef.current = true;
      setPreviewing(kind);
      audio.pause();
      audio.currentTime = 0;
      if (audio.src !== url) {
        audio.src = url;
        if (audio.load) audio.load();
      }
      audio.volume = Math.min(1, Math.max(0, Number(form.volumePercent) || 0) / 100);
      await audio.play();
      setAudioUnlocked(true);
      await new Promise((resolve) => {
        const onEnd = () => {
          audio.removeEventListener('ended', onEnd);
          audio.removeEventListener('error', onEnd);
          resolve();
        };
        audio.addEventListener('ended', onEnd);
        audio.addEventListener('error', onEnd);
      });
    } catch (e) {
      toast({ title: 'Unable to preview sound', status: 'warning' });
    } finally {
      ringLockRef.current = false;
      setPreviewing('');
    }
  }, [overrideActive, sounds, resolveSoundUrl, form.volumePercent, toast]);

  const getNextOnTimeEvent = React.useCallback(() => {
    const base = { ...form, delayBeforeSeconds: 0, delayAfterSeconds: 0 };
    const events = buildEventsAround(new Date(), base).filter((ev) => ev.kind === 'on');
    const nowMs = Date.now();
    return events.find((ev) => ev.time.getTime() >= nowMs) || null;
  }, [form]);

  const handleOverride = React.useCallback(async () => {
    if (overrideActive) return;
    if (ringLockRef.current) {
      toast({ title: 'Bell is currently playing', status: 'info' });
      return;
    }
    const soundEntry = pickSoundForKind('on');
    const ringUrl = resolveSoundUrl(soundEntry);
    if (!ringUrl) {
      toast({ title: 'On-time sound is not set', status: 'warning' });
      return;
    }
    setOverrideActive(true);
    const originalDelay = form.delayBeforeSeconds;
    overrideDelayRef.current = originalDelay;
    const nextOn = getNextOnTimeEvent();
    const overrideDelay = nextOn
      ? Math.max(0, (nextOn.time.getTime() - Date.now()) / 1000)
      : 0;
    setForm((prev) => ({ ...prev, delayBeforeSeconds: overrideDelay }));
    let overrideSavedAt = null;
    try {
      const overrideBell = { ...orig, delayBeforeSeconds: overrideDelay };
      try {
        const data = await dispatch(updateSettingsThunk({ bellSystem: overrideBell, _rtEvent: 'override' })).unwrap();
        if (data?.updatedAt) setLastUpdated(data.updatedAt);
        if (data?.updatedAt) lastLocalOverrideRef.current = String(data.updatedAt);
        overrideSavedAt = Date.now();
      } catch (e) {
        toast({ title: e?.message || 'Failed to update bell settings', status: 'error' });
      }
      const played = await triggerBell(`override-${Date.now()}`, ringUrl, { force: true });
      if (played) {
        setAudioUnlocked(true);
      } else {
        toast({ title: 'Unable to play sound', status: 'warning' });
      }
      if (overrideSavedAt) {
        const elapsed = Date.now() - overrideSavedAt;
        const waitMs = Math.max(OVERRIDE_MIN_HOLD_MS - elapsed, 0);
        if (waitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }
    } finally {
      const restoreDelay = overrideDelayRef.current;
      setForm((prev) => ({
        ...prev,
        delayBeforeSeconds: Number.isFinite(restoreDelay) ? restoreDelay : prev.delayBeforeSeconds,
      }));
      overrideDelayRef.current = null;
      try {
        const data = await dispatch(updateSettingsThunk({ bellSystem: orig, _rtEvent: 'settings' })).unwrap();
        if (data?.updatedAt) setLastUpdated(data.updatedAt);
      } catch (e) {
        toast({ title: e?.message || 'Failed to restore bell settings', status: 'error' });
      }
      setOverrideActive(false);
    }
  }, [overrideActive, toast, form.delayBeforeSeconds, getNextOnTimeEvent, pickSoundForKind, resolveSoundUrl, triggerBell, dispatch, orig]);

  const previewAnnouncement = React.useCallback(async () => {
    const message = String(announcementMessage || '').trim();
    if (!message) {
      toast({ title: 'Add an announcement message first', status: 'info' });
      return;
    }
    if (!ttsSupported) {
      toast({ title: 'Text-to-speech is not supported on this browser', status: 'warning' });
      return;
    }
    const played = await playAnnouncementSequence(message, {
      voiceName: selectedAnnouncementVoice?.name || announceVoice,
      lang: selectedAnnouncementVoice?.lang,
      rate: announceRate,
      pitch: announcePitch,
      preChime: announcePreChime,
      postChime: announcePostChime,
      chimeCount: announceChimeCount,
      chimeGapSeconds: announceChimeGapSeconds,
      repeatCount: announceRepeatCount,
      repeatGapSeconds: announceRepeatGapSeconds,
    });
    if (!played) {
      toast({ title: 'Unable to play announcement audio', status: 'warning' });
    }
  }, [
    announcementMessage,
    announceVoice,
    announceRate,
    announcePitch,
    announcePreChime,
    announcePostChime,
    announceChimeCount,
    announceChimeGapSeconds,
    announceRepeatCount,
    announceRepeatGapSeconds,
    selectedAnnouncementVoice,
    playAnnouncementSequence,
    toast,
    ttsSupported,
  ]);

  const sendAnnouncement = React.useCallback(async () => {
    const message = String(announcementMessage || '').trim();
    if (!message) {
      toast({ title: 'Add an announcement message first', status: 'info' });
      return;
    }
    if (!isAdmin) {
      toast({ title: 'Only admins can send announcements', status: 'warning' });
      return;
    }
    const eventId = `announce-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    lastLocalAnnouncementRef.current = eventId;
    setAnnounceSending(true);
    try {
    const payload = {
      eventId,
      message,
      voice: selectedAnnouncementVoice?.name || announceVoice || null,
      lang: selectedAnnouncementVoice?.lang || null,
      rate: announceRate,
      pitch: announcePitch,
        faculty: announceMode === 'faculty' ? announceFaculty : null,
        location: announcementLocationNeeded ? announceLocation : null,
        template: announceMode === 'general' ? announceTemplate : null,
        mode: announceMode,
        preChime: announcePreChime,
        postChime: announcePostChime,
        chimeCount: announceChimeCount,
        chimeGapSeconds: announceChimeGapSeconds,
        repeatCount: announceRepeatCount,
        repeatGapSeconds: announceRepeatGapSeconds,
      };
    const res = await apiService.broadcastAnnouncement(payload);
    const event = res?.event || {};
    if (event?.eventId) lastLocalAnnouncementRef.current = String(event.eventId);
    if (!ttsSupported) {
        toast({
          title: 'Announcement sent',
          description: 'This browser does not support text-to-speech.',
          status: 'info',
        });
        return;
      }
      const played = await playAnnouncementSequence(message, {
        voiceName: event?.voice || payload.voice,
        lang: event?.lang || payload.lang,
        rate: event?.rate ?? announceRate,
        pitch: event?.pitch ?? announcePitch,
        preChime: event?.preChime ?? payload.preChime,
        postChime: event?.postChime ?? payload.postChime,
        chimeCount: event?.chimeCount ?? payload.chimeCount,
        chimeGapSeconds: event?.chimeGapSeconds ?? payload.chimeGapSeconds,
        repeatCount: event?.repeatCount ?? payload.repeatCount,
        repeatGapSeconds: event?.repeatGapSeconds ?? payload.repeatGapSeconds,
      });
      if (!played && !announceAudioWarnRef.current) {
        announceAudioWarnRef.current = true;
        toast({ title: 'Announcement sent, but this browser needs a click to enable audio', status: 'info' });
      } else {
        toast({ title: 'Announcement sent', status: 'success' });
      }
    } catch (e) {
      toast({ title: e?.message || 'Failed to send announcement', status: 'error' });
    } finally {
      setAnnounceSending(false);
    }
  }, [
    announcementMessage,
    announceVoice,
    announceRate,
    announcePitch,
    announceMode,
    announceFaculty,
    announceLocation,
    announceTemplate,
    announcePreChime,
    announcePostChime,
    announceChimeCount,
    announceChimeGapSeconds,
    announceRepeatCount,
    announceRepeatGapSeconds,
    announcementLocationNeeded,
    isAdmin,
    selectedAnnouncementVoice,
    playAnnouncementSequence,
    ttsSupported,
    toast,
  ]);


  const countdown = React.useMemo(() => {
    if (!form.enabled) {
      return { state: 'disabled' };
    }
    const intervalMinutes = Number(form.intervalMinutes);
    if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
      return { state: 'invalid' };
    }
    const events = buildEventsAround(now, form);
    if (!events.length) {
      return { state: 'none' };
    }
    const nowMs = now.getTime();
    let prev = null;
    let next = null;
    for (const ev of events) {
      if (ev.time.getTime() >= nowMs) {
        next = ev;
        break;
      }
      prev = ev;
    }
    if (!next) {
      return { state: 'none' };
    }
    const remainingMs = Math.max(0, next.time.getTime() - nowMs);
    const totalMs = prev ? Math.max(1, next.time.getTime() - prev.time.getTime()) : Math.max(remainingMs, intervalMinutes * 60 * 1000);
    const progress = Math.min(100, Math.max(0, ((totalMs - remainingMs) / totalMs) * 100));
    return { state: 'active', next, prev, remainingMs, totalMs, progress };
  }, [form, now]);

  const nextLabel = React.useMemo(() => {
    if (countdown.state !== 'active' || !countdown.next) return '';
    const next = countdown.next;
    const timeStr = next.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dayStr = sameDay(next.time, now)
      ? 'Today'
      : next.time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    return `${timeStr} • ${dayStr}`;
  }, [countdown, now]);

  React.useEffect(() => {
    if (overrideActive) return;
    if (countdown.state !== 'active' || !countdown.next) return;
    if (!form.enabled || !primarySoundUrl || !audioUnlocked) return;
    const nextTimeMs = countdown.next.time.getTime();
    const eventKey = `${nextTimeMs}-${countdown.next.kind}`;
    if (lastEventRef.current === eventKey) return;
    const soundEntry = pickSoundForKind(countdown.next.kind);
    const ringUrl = resolveSoundUrl(soundEntry);
    if (!ringUrl) return;
    const delay = Math.max(0, nextTimeMs - Date.now());
    const timer = setTimeout(() => {
      if (lastEventRef.current === eventKey) return;
      void triggerBell(eventKey, ringUrl);
    }, delay);
    return () => clearTimeout(timer);
  }, [overrideActive, countdown, form.enabled, primarySoundUrl, audioUnlocked, triggerBell, pickSoundForKind, resolveSoundUrl]);

  const sessions = form.sessions || {};
  const sessionTags = [
    { key: 'am', label: 'AM', color: 'green' },
    { key: 'pm', label: 'PM', color: 'blue' },
    { key: 'eve', label: 'EVE', color: 'purple' },
  ];

  return (
    <Box>
      <audio
        ref={audioRef}
        preload="auto"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        aria-hidden="true"
      />
      <Tabs variant="enclosed-colored" colorScheme="blue">
        <TabList>
          <Tab>
            <HStack spacing={2}>
              <Icon as={FiBell} />
              <Text>Bell System</Text>
            </HStack>
          </Tab>
          <Tab>
            <HStack spacing={2}>
              <Icon as={FiMic} />
              <Text>Announcements</Text>
            </HStack>
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel p={0} pt={4}>
            <HStack justify="space-between" mb={4} flexWrap="wrap" spacing={3}>
              <HStack spacing={2}>
                <FiBell />
                <Heading size="md">Automated Bell System</Heading>
              </HStack>
              <HStack spacing={3} flexWrap="wrap">
                <Button variant="outline" onClick={refresh} isLoading={loading} isDisabled={controlsDisabled} loadingText="Refreshing">Refresh</Button>
                <Button colorScheme="blue" onClick={save} isDisabled={!dirty || !isAdmin || uploading || controlsDisabled} isLoading={saving} loadingText="Saving">Save</Button>
              </HStack>
            </HStack>

      <Text fontSize="sm" color={muted} mb={2}>
        Configure bell intervals, session windows, and the sound file used for scheduled rings.
      </Text>
      {lastUpdated && (
        <HStack mb={3}><Badge colorScheme="purple">Last Updated: {new Date(lastUpdated).toLocaleString()}</Badge></HStack>
      )}

      <Box borderWidth="1px" borderColor={border} rounded="lg" p={4} bg={bg} mb={4}>
        <HStack justify="space-between" flexWrap="wrap" spacing={3} mb={2}>
          <HStack spacing={2}>
            <Icon as={FiClock} color={highlight} />
            <Heading size="sm">Next Bell Countdown</Heading>
          </HStack>
          <HStack spacing={2} flexWrap="wrap" justify="flex-end">
            {countdown.state === 'active' && (
              <>
                <Badge colorScheme="blue">{countdown.next.sessionLabel}</Badge>
                <Badge colorScheme={KIND_SCHEMES[countdown.next.kind] || 'gray'} variant="subtle">
                  {KIND_LABELS[countdown.next.kind] || 'Scheduled'}
                </Badge>
              </>
            )}
            <Badge colorScheme={primarySoundUrl ? (audioUnlocked ? 'green' : 'orange') : 'gray'}>
              {primarySoundUrl ? (audioUnlocked ? 'Audio Ready' : (unlocking ? 'Arming...' : 'Auto-arming')) : 'No Sound'}
            </Badge>
          </HStack>
        </HStack>

        {countdown.state === 'disabled' && (
          <Text fontSize="sm" color={muted}>Bell system is disabled.</Text>
        )}
        {countdown.state === 'invalid' && (
          <Text fontSize="sm" color={muted}>Set a valid interval to see the countdown.</Text>
        )}
        {countdown.state === 'none' && (
          <Text fontSize="sm" color={muted}>No upcoming bell events found in the current schedule.</Text>
        )}
        {countdown.state === 'active' && (
          <VStack align="stretch" spacing={2}>
            <HStack justify="space-between" flexWrap="wrap">
              <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="700">
                {formatDuration(countdown.remainingMs)}
              </Text>
              <VStack align="end" spacing={0}>
                <Text fontSize="xs" color={muted}>Next ring</Text>
                <Text fontSize="sm" fontWeight="600">{nextLabel}</Text>
              </VStack>
            </HStack>
            <Progress value={countdown.progress} size="sm" colorScheme="blue" hasStripe isAnimated />
            <Text fontSize="xs" color={muted}>
              {Math.round(countdown.progress)}% to the next ring.
            </Text>
            {!audioUnlocked && primarySoundUrl && (
              <Text fontSize="xs" color={muted}>
                Audio will auto-arm on the next click or keypress in this browser session.
              </Text>
            )}
          </VStack>
        )}
        <HStack justify="flex-end" mt={3}>
          <Button
            size="sm"
            leftIcon={<FiPlay />}
            colorScheme="red"
            variant="solid"
            onClick={handleOverride}
            isLoading={overrideActive}
            isDisabled={!isAdmin || controlsDisabled}
            loadingText="Overriding"
          >
            Override: Play On-time Now
          </Button>
        </HStack>
      </Box>

      <SimpleGrid columns={{ base: 1, lg: 2 }} gap={4}>
        <Box borderWidth="1px" borderColor={border} rounded="lg" p={4} bg={bg}>
          <HStack justify="space-between" mb={3}>
            <VStack align="start" spacing={0}>
              <Heading size="sm">Playback Rules</Heading>
              <Text fontSize="xs" color={muted}>Bell rings follow enabled sessions below.</Text>
            </VStack>
            <FormControl display="flex" alignItems="center" w="auto">
              <FormLabel htmlFor="bell-enabled" mb="0" fontSize="sm" fontWeight="600">
                Enabled
              </FormLabel>
              <Switch
                id="bell-enabled"
                colorScheme="blue"
                isChecked={!!form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                isDisabled={controlsDisabled}
              />
            </FormControl>
          </HStack>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
            <NumberField
              label="Interval (minutes)"
              value={form.intervalMinutes}
              min={1}
              onChange={(val) => setForm({ ...form, intervalMinutes: val })}
              isDisabled={controlsDisabled}
              helper="How often to play the bell during active sessions."
            />
            <NumberField
              label="Delay before ring (seconds)"
              value={form.delayBeforeSeconds}
              min={0}
              onChange={(val) => setForm({ ...form, delayBeforeSeconds: val })}
              isDisabled={controlsDisabled}
              helper="Play this many seconds before the scheduled time."
            />
            <NumberField
              label="Delay after ring (seconds)"
              value={form.delayAfterSeconds}
              min={0}
              onChange={(val) => setForm({ ...form, delayAfterSeconds: val })}
              isDisabled={controlsDisabled}
              helper="Wait time after the scheduled time before playing."
            />
            <NumberField
              label="Loop count"
              value={form.loopCount}
              min={1}
              onChange={(val) => setForm({ ...form, loopCount: val })}
              isDisabled={controlsDisabled}
              helper="How many repeats per bell play."
            />
            <NumberField
              label="Loop gap (seconds)"
              value={form.loopGapSeconds}
              min={0}
              onChange={(val) => setForm({ ...form, loopGapSeconds: val })}
              isDisabled={controlsDisabled}
              helper="Pause between loop repeats."
            />
          </SimpleGrid>
          <Box mt={4}>
            <FormLabel fontSize="sm">Volume</FormLabel>
            <HStack spacing={3}>
              <Slider
                value={form.volumePercent}
                onChange={(val) => setForm({ ...form, volumePercent: val })}
                min={0}
                max={100}
                colorScheme="blue"
                isDisabled={controlsDisabled}
              >
                <SliderTrack>
                  <SliderFilledTrack />
                </SliderTrack>
                <SliderThumb />
              </Slider>
              <NumberInput
                value={form.volumePercent}
                min={0}
                max={100}
                onChange={(_, val) => setForm({ ...form, volumePercent: Number.isFinite(val) ? val : 0 })}
                w="90px"
                isDisabled={controlsDisabled}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </HStack>
          </Box>
        </Box>

        <Box borderWidth="1px" borderColor={border} rounded="lg" p={4} bg={bg}>
          <HStack justify="space-between" mb={3} flexWrap="wrap" spacing={2}>
            <VStack align="start" spacing={0}>
              <Heading size="sm">Bell Sounds</Heading>
              <Text fontSize="xs" color={muted}>Assign distinct sounds for early, on-time, and after rings.</Text>
            </VStack>
            <Badge colorScheme="blue" variant="subtle">3 Slots</Badge>
          </HStack>
          <Input
            ref={fileRef}
            type="file"
            accept="audio/*"
            onChange={onFileChange}
            isDisabled={controlsDisabled}
            display="none"
          />
          <VStack align="stretch" spacing={3}>
            {SOUND_KEYS.map((key) => {
              const sound = sounds[key];
              const url = resolveSoundUrl(sound);
              const helperText = key === 'before'
                ? `Plays ${form.delayBeforeSeconds || 0}s before the scheduled time.`
                : key === 'after'
                  ? `Plays ${form.delayAfterSeconds || 0}s after the scheduled time.`
                  : 'Plays exactly on the scheduled time.';
              return (
                <Box key={key} borderWidth="1px" borderColor={border} rounded="md" p={3}>
                  <HStack justify="space-between" mb={2} flexWrap="wrap" spacing={2}>
                    <VStack align="start" spacing={0}>
                      <Text fontWeight="600" fontSize="sm">{SOUND_TITLES[key]}</Text>
                      <Text fontSize="xs" color={muted}>{helperText}</Text>
                    </VStack>
                    <HStack>
                      <Button
                        size="xs"
                        leftIcon={<FiUpload />}
                        onClick={() => onPickFile(key)}
                        variant="outline"
                        isLoading={uploading && uploadKind === key}
                        isDisabled={!isAdmin || controlsDisabled}
                      >
                        Upload
                      </Button>
                      <Button
                        size="xs"
                        leftIcon={<FiPlay />}
                        onClick={() => previewSound(key)}
                        variant="ghost"
                        isDisabled={!sound || uploading || previewing === key || controlsDisabled}
                      >
                        Preview
                      </Button>
                      <Button
                        size="xs"
                        leftIcon={<FiTrash2 />}
                        onClick={() => clearSound(key)}
                        variant="ghost"
                        isDisabled={!sound || uploading || !isAdmin || controlsDisabled}
                      >
                        Clear
                      </Button>
                    </HStack>
                  </HStack>
                  {sound ? (
                    <VStack align="stretch" spacing={2}>
                      <HStack justify="space-between">
                        <Text fontSize="xs" color={muted}>
                          {sound.name || 'Audio File'}
                          {sound.size ? ` • ${Math.round(sound.size / 1024)} KB` : ''}
                        </Text>
                        <Badge colorScheme="green">Ready</Badge>
                      </HStack>
                      {url && (
                        <Box borderWidth="1px" borderColor={border} rounded="md" p={2}>
                          <audio
                            ref={(el) => {
                              if (el) slotAudioRefs.current[key] = el;
                            }}
                            controls
                            style={{ width: '100%' }}
                            src={url}
                            preload="auto"
                          />
                        </Box>
                      )}
                    </VStack>
                  ) : (
                    <Box borderWidth="1px" borderColor={border} rounded="md" p={3} textAlign="center">
                      <Text fontSize="xs" color={muted}>No sound assigned.</Text>
                    </Box>
                  )}
                </Box>
              );
            })}
            <Text fontSize="xs" color={muted}>
              Supported: MP3, WAV, or OGG. Max upload size 20 MB.
            </Text>
          </VStack>
        </Box>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, lg: 3 }} gap={4} mt={4}>
        <SessionCard
          title="AM Session"
          value={sessions.am}
          onChange={(next) => setForm({ ...form, sessions: { ...sessions, am: next } })}
          isDisabled={controlsDisabled}
        />
        <SessionCard
          title="PM Session"
          value={sessions.pm}
          onChange={(next) => setForm({ ...form, sessions: { ...sessions, pm: next } })}
          isDisabled={controlsDisabled}
        />
        <SessionCard
          title="EVE Session"
          value={sessions.eve}
          onChange={(next) => setForm({ ...form, sessions: { ...sessions, eve: next } })}
          isDisabled={controlsDisabled}
        />
      </SimpleGrid>

      <Box borderWidth="1px" borderColor={border} rounded="lg" p={4} bg={bg} mt={4}>
        <HStack justify="space-between" mb={2} flexWrap="wrap" spacing={2}>
          <Heading size="sm">Summary</Heading>
          <Badge colorScheme={form.enabled ? 'green' : 'gray'}>
            {form.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </HStack>
        <Text fontSize="sm" color={muted} mb={3}>
          Rings every {form.intervalMinutes || 0} minutes with {form.loopCount || 1} loop(s).
          {' '}Plays {form.delayBeforeSeconds || 0}s before and {form.delayAfterSeconds || 0}s after the scheduled time.
        </Text>
        <HStack spacing={2} flexWrap="wrap">
          {sessionTags.map((item) => {
            const session = sessions[item.key] || {};
            const active = !!session.enabled;
            const range = session.start && session.end ? `${session.start} - ${session.end}` : 'Time not set';
            return (
              <Tag key={item.key} size="md" variant="subtle" colorScheme={active ? item.color : 'gray'}>
                <TagLabel>{item.label}: {range}</TagLabel>
              </Tag>
            );
          })}
        </HStack>
      </Box>

      <Divider my={4} />
      <HStack justify="flex-end">
        <Button colorScheme="blue" onClick={save} isDisabled={!dirty || !isAdmin || uploading || controlsDisabled} isLoading={saving}>Save Changes</Button>
      </HStack>
          </TabPanel>
          <TabPanel p={0} pt={4}>
            <HStack justify="space-between" mb={4} flexWrap="wrap" spacing={3}>
              <HStack spacing={2}>
                <Icon as={FiMic} />
                <Heading size="md">Realtime Announcements</Heading>
              </HStack>
              <HStack spacing={2} flexWrap="wrap">
                <Badge colorScheme={ttsSupported ? 'green' : 'red'}>
                  {ttsSupported ? 'TTS Ready' : 'TTS Unavailable'}
                </Badge>
                <Badge colorScheme={announcementMessage ? 'blue' : 'gray'}>
                  {announcementMessage ? 'Message Ready' : 'Message Empty'}
                </Badge>
              </HStack>
            </HStack>

            <Text fontSize="sm" color={muted} mb={4}>
              Send spoken announcements to all connected devices using Firebase realtime updates.
            </Text>

            <SimpleGrid columns={{ base: 1, lg: 2 }} gap={4}>
              <Box borderWidth="1px" borderColor={border} rounded="lg" p={4} bg={bg}>
                <VStack align="stretch" spacing={3}>
                  <HStack justify="space-between" flexWrap="wrap">
                    <Heading size="sm">Message Builder</Heading>
                    <Badge colorScheme="purple" variant="subtle">Realtime</Badge>
                  </HStack>
                  <Text fontSize="xs" color={muted}>
                    Choose a target audience and compose a short announcement.
                  </Text>

                  <FormControl>
                    <FormLabel fontSize="sm">Announcement type</FormLabel>
                    <Wrap spacing={2}>
                      {[
                        { id: 'faculty', label: 'Faculty Call' },
                        { id: 'general', label: 'General Notice' },
                        { id: 'custom', label: 'Custom' },
                      ].map((opt) => (
                        <WrapItem key={opt.id}>
                          <Button
                            size="sm"
                            variant={announceMode === opt.id ? 'solid' : 'outline'}
                            colorScheme="blue"
                            onClick={() => setAnnounceMode(opt.id)}
                          >
                            {opt.label}
                          </Button>
                        </WrapItem>
                      ))}
                    </Wrap>
                  </FormControl>

                  {announceMode === 'faculty' && (
                    <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                      <FormControl>
                        <FormLabel fontSize="sm">Faculty</FormLabel>
                        <FacultySelect
                          value={announceFaculty}
                          onChange={setAnnounceFaculty}
                          onChangeId={setAnnounceFacultyId}
                          placeholder="Select faculty"
                          allowClear
                        />
                      </FormControl>
                      {announcementLocationNeeded && (
                        <FormControl>
                          <FormLabel fontSize="sm">Location</FormLabel>
                          <Input
                            value={announceLocation}
                            onChange={(e) => setAnnounceLocation(e.target.value)}
                            placeholder="admin office"
                          />
                        </FormControl>
                      )}
                    </SimpleGrid>
                  )}

                  {announceMode === 'general' && (
                    <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                      <FormControl>
                        <FormLabel fontSize="sm">Template</FormLabel>
                        <Select
                          value={announceTemplate}
                          onChange={(e) => setAnnounceTemplate(e.target.value)}
                        >
                          {GENERAL_ANNOUNCEMENT_TEMPLATES.map((tpl) => (
                            <option key={tpl.id} value={tpl.id}>{tpl.label}</option>
                          ))}
                        </Select>
                      </FormControl>
                      {announcementLocationNeeded && (
                        <FormControl>
                          <FormLabel fontSize="sm">Location</FormLabel>
                          <Input
                            value={announceLocation}
                            onChange={(e) => setAnnounceLocation(e.target.value)}
                            placeholder="auditorium"
                          />
                        </FormControl>
                      )}
                    </SimpleGrid>
                  )}

                  {announceMode === 'custom' && (
                    <FormControl>
                      <FormLabel fontSize="sm">Custom message</FormLabel>
                      <Textarea
                        value={announceCustom}
                        onChange={(e) => setAnnounceCustom(e.target.value)}
                        placeholder="Type the announcement..."
                        rows={4}
                      />
                    </FormControl>
                  )}

                  <Box borderWidth="1px" borderColor={border} rounded="md" p={3} bg={softBg}>
                    <Text fontSize="xs" color={muted} mb={1}>Message Preview</Text>
                    <Text fontSize="sm" fontWeight="600" whiteSpace="pre-wrap">
                      {announcementMessage || 'No message yet.'}
                    </Text>
                  </Box>
                </VStack>
              </Box>

              <Box borderWidth="1px" borderColor={border} rounded="lg" p={4} bg={bg}>
                <VStack align="stretch" spacing={3}>
                  <HStack justify="space-between" flexWrap="wrap">
                    <Heading size="sm">Voice and Playback</Heading>
                    <Badge colorScheme={visibleVoices.length ? 'green' : 'gray'} variant="subtle">
                      {visibleVoices.length ? `${visibleVoices.length} en-US voices` : 'No en-US voices'}
                    </Badge>
                  </HStack>
                  <FormControl>
                    <FormLabel fontSize="sm">Voice</FormLabel>
                    <Select
                      value={announceVoice}
                      onChange={(e) => setAnnounceVoice(e.target.value)}
                      isDisabled={!visibleVoices.length}
                    >
                      {visibleVoices.map((v) => (
                        <option key={`${v.name}-${v.lang}`} value={v.name}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                    <NumberField
                      label="Rate"
                      value={announceRate}
                      min={0.5}
                      max={2}
                      step={0.1}
                      onChange={setAnnounceRate}
                      helper="1.0 = normal speed"
                    />
                    <NumberField
                      label="Pitch"
                      value={announcePitch}
                      min={0.5}
                      max={2}
                      step={0.1}
                      onChange={setAnnouncePitch}
                      helper="1.0 = default pitch"
                    />
                  </SimpleGrid>
                  <Divider />
                  <HStack justify="space-between">
                    <Heading size="xs" textTransform="uppercase" color={muted}>Chime & Repeat</Heading>
                    <Badge colorScheme="purple" variant="subtle">Paging style</Badge>
                  </HStack>
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                    <FormControl display="flex" alignItems="center" justifyContent="space-between">
                      <FormLabel mb="0" fontSize="sm">Pre-chime</FormLabel>
                      <Switch
                        colorScheme="blue"
                        isChecked={announcePreChime}
                        onChange={(e) => setAnnouncePreChime(e.target.checked)}
                      />
                    </FormControl>
                    <FormControl display="flex" alignItems="center" justifyContent="space-between">
                      <FormLabel mb="0" fontSize="sm">Post-chime</FormLabel>
                      <Switch
                        colorScheme="blue"
                        isChecked={announcePostChime}
                        onChange={(e) => setAnnouncePostChime(e.target.checked)}
                      />
                    </FormControl>
                  </SimpleGrid>
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                    <NumberField
                      label="Chime count"
                      value={announceChimeCount}
                      min={1}
                      max={5}
                      step={1}
                      onChange={setAnnounceChimeCount}
                      helper="How many chimes per sequence."
                    />
                    <NumberField
                      label="Chime gap (seconds)"
                      value={announceChimeGapSeconds}
                      min={0}
                      max={5}
                      step={0.1}
                      onChange={setAnnounceChimeGapSeconds}
                      helper="Pause between chimes."
                    />
                  </SimpleGrid>
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                    <NumberField
                      label="Repeat count"
                      value={announceRepeatCount}
                      min={1}
                      max={5}
                      step={1}
                      onChange={setAnnounceRepeatCount}
                      helper="How many times to repeat the message."
                    />
                    <NumberField
                      label="Repeat gap (seconds)"
                      value={announceRepeatGapSeconds}
                      min={0}
                      max={30}
                      step={0.5}
                      onChange={setAnnounceRepeatGapSeconds}
                      helper="Pause between message repeats."
                    />
                  </SimpleGrid>
                  <HStack spacing={2} flexWrap="wrap">
                    <Button
                      size="sm"
                      leftIcon={<FiVolume2 />}
                      variant="outline"
                      onClick={previewAnnouncement}
                      isDisabled={!announcementMessage || !ttsSupported || !visibleVoices.length}
                    >
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      colorScheme="blue"
                      leftIcon={<FiSend />}
                      onClick={sendAnnouncement}
                      isLoading={announceSending}
                      isDisabled={!announcementMessage || !isAdmin}
                      loadingText="Sending"
                    >
                      Announce Now
                    </Button>
                  </HStack>
                  {!ttsSupported && (
                    <Text fontSize="xs" color={muted}>
                      Text-to-speech is not available in this browser.
                    </Text>
                  )}
                  {ttsSupported && !visibleVoices.length && (
                    <Text fontSize="xs" color={muted}>
                      No en-US voices are installed on this device. Install an English (US) voice in system settings.
                    </Text>
                  )}
                </VStack>
              </Box>
            </SimpleGrid>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}
