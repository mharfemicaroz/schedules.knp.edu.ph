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
  Tag,
  TagLabel,
} from '@chakra-ui/react';
import { FiBell, FiUpload, FiTrash2 } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { loadSettingsThunk, updateSettingsThunk } from '../store/settingsThunks';
import { selectSettings } from '../store/settingsSlice';

const DEFAULT_BELL = {
  enabled: false,
  intervalMinutes: 60,
  delayBeforeSeconds: 0,
  delayAfterSeconds: 0,
  loopCount: 1,
  loopGapSeconds: 2,
  volumePercent: 80,
  sessions: {
    am: { label: 'AM Session', enabled: true, start: '08:00', end: '12:00' },
    pm: { label: 'PM Session', enabled: true, start: '13:00', end: '17:00' },
    eve: { label: 'EVE Session', enabled: true, start: '17:00', end: '21:00' },
  },
  sound: null,
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
    sound: obj.sound === null ? null : (obj.sound && typeof obj.sound === 'object' ? { ...obj.sound } : base.sound),
  };
  delete bell.delaySeconds;
  delete bell.advanceSeconds;
  return bell;
}

function NumberField({ label, value, onChange, min = 0, max, step = 1, helper }) {
  const muted = useColorModeValue('gray.600', 'gray.300');
  return (
    <FormControl>
      <FormLabel fontSize="sm">{label}</FormLabel>
      <NumberInput
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
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

function SessionCard({ title, value, onChange }) {
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
        />
      </HStack>
      <SimpleGrid columns={{ base: 1, sm: 2 }} gap={3}>
        <FormControl>
          <FormLabel fontSize="sm">Start</FormLabel>
          <Input
            type="time"
            value={session.start || ''}
            onChange={(e) => onChange({ ...session, start: e.target.value })}
          />
        </FormControl>
        <FormControl>
          <FormLabel fontSize="sm">End</FormLabel>
          <Input
            type="time"
            value={session.end || ''}
            onChange={(e) => onChange({ ...session, end: e.target.value })}
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

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [orig, setOrig] = React.useState(DEFAULT_BELL);
  const [form, setForm] = React.useState(DEFAULT_BELL);
  const fileRef = React.useRef(null);

  const dirty = React.useMemo(() => JSON.stringify(form) !== JSON.stringify(orig), [form, orig]);

  const refresh = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await dispatch(loadSettingsThunk()).unwrap();
      const bell = normalizeBellSystem(data?.bellSystem);
      setOrig(bell);
      setForm(bell);
    } catch (e) {
      toast({ title: 'Failed to load bell settings', status: 'error' });
    } finally {
      setLoading(false);
    }
  }, [dispatch, toast]);

  React.useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    try {
      setSaving(true);
      const payload = { bellSystem: form };
      const data = await dispatch(updateSettingsThunk(payload)).unwrap();
      const bell = normalizeBellSystem(data?.bellSystem);
      setOrig(bell);
      setForm(bell);
      toast({ title: 'Bell settings saved', status: 'success' });
    } catch (e) {
      toast({ title: e?.message || 'Failed to save', status: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const onPickFile = () => {
    if (fileRef.current) fileRef.current.click();
  };

  const onFileChange = (event) => {
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
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setForm((prev) => ({
        ...prev,
        sound: {
          name: file.name,
          size: file.size,
          mime: file.type || 'audio/mpeg',
          dataUrl,
          updatedAt: new Date().toISOString(),
        },
      }));
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const clearSound = () => {
    setForm((prev) => ({ ...prev, sound: null }));
  };

  const sessions = form.sessions || {};
  const sessionTags = [
    { key: 'am', label: 'AM', color: 'green' },
    { key: 'pm', label: 'PM', color: 'blue' },
    { key: 'eve', label: 'EVE', color: 'purple' },
  ];

  return (
    <Box>
      <HStack justify="space-between" mb={4} flexWrap="wrap" spacing={3}>
        <HStack spacing={2}>
          <FiBell />
          <Heading size="md">Automated Bell System</Heading>
        </HStack>
        <HStack spacing={2}>
          <Button variant="outline" onClick={refresh} isLoading={loading} loadingText="Refreshing">Refresh</Button>
          <Button colorScheme="blue" onClick={save} isDisabled={!dirty || !isAdmin} isLoading={saving} loadingText="Saving">Save</Button>
        </HStack>
      </HStack>

      <Text fontSize="sm" color={muted} mb={2}>
        Configure bell intervals, session windows, and the sound file used for scheduled rings.
      </Text>
      {settings?.updatedAt && (
        <HStack mb={3}><Badge colorScheme="purple">Last Updated: {new Date(settings.updatedAt).toLocaleString()}</Badge></HStack>
      )}

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
              />
            </FormControl>
          </HStack>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
            <NumberField
              label="Interval (minutes)"
              value={form.intervalMinutes}
              min={1}
              onChange={(val) => setForm({ ...form, intervalMinutes: val })}
              helper="How often to play the bell during active sessions."
            />
            <NumberField
              label="Delay before ring (seconds)"
              value={form.delayBeforeSeconds}
              min={0}
              onChange={(val) => setForm({ ...form, delayBeforeSeconds: val })}
              helper="Play this many seconds before the scheduled time."
            />
            <NumberField
              label="Delay after ring (seconds)"
              value={form.delayAfterSeconds}
              min={0}
              onChange={(val) => setForm({ ...form, delayAfterSeconds: val })}
              helper="Wait time after the scheduled time before playing."
            />
            <NumberField
              label="Loop count"
              value={form.loopCount}
              min={1}
              onChange={(val) => setForm({ ...form, loopCount: val })}
              helper="How many repeats per bell play."
            />
            <NumberField
              label="Loop gap (seconds)"
              value={form.loopGapSeconds}
              min={0}
              onChange={(val) => setForm({ ...form, loopGapSeconds: val })}
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
              <Heading size="sm">Bell Sound</Heading>
              <Text fontSize="xs" color={muted}>Upload an audio file used for bell playback.</Text>
            </VStack>
            <HStack>
              <Button size="sm" leftIcon={<FiUpload />} onClick={onPickFile} variant="outline">Upload</Button>
              <Button size="sm" leftIcon={<FiTrash2 />} onClick={clearSound} variant="ghost" isDisabled={!form.sound}>Clear</Button>
            </HStack>
          </HStack>
          <Input
            ref={fileRef}
            type="file"
            accept="audio/*"
            onChange={onFileChange}
            display="none"
          />
          <VStack align="stretch" spacing={3}>
            {form.sound ? (
              <Box>
                <HStack justify="space-between" mb={2}>
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="600" fontSize="sm">{form.sound.name || 'Bell Sound'}</Text>
                    <Text fontSize="xs" color={muted}>
                      {(form.sound.size ? `${Math.round(form.sound.size / 1024)} KB` : 'Unknown size')}
                      {form.sound.mime ? ` • ${form.sound.mime}` : ''}
                    </Text>
                  </VStack>
                  <Badge colorScheme="green">Ready</Badge>
                </HStack>
                {form.sound.dataUrl && (
                  <Box borderWidth="1px" borderColor={border} rounded="md" p={2}>
                    <audio controls style={{ width: '100%' }} src={form.sound.dataUrl} />
                  </Box>
                )}
              </Box>
            ) : (
              <Box borderWidth="1px" borderColor={border} rounded="md" p={4} textAlign="center">
                <Text fontSize="sm" color={muted}>No bell sound uploaded yet.</Text>
              </Box>
            )}
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
        />
        <SessionCard
          title="PM Session"
          value={sessions.pm}
          onChange={(next) => setForm({ ...form, sessions: { ...sessions, pm: next } })}
        />
        <SessionCard
          title="EVE Session"
          value={sessions.eve}
          onChange={(next) => setForm({ ...form, sessions: { ...sessions, eve: next } })}
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
        <Button colorScheme="blue" onClick={save} isDisabled={!dirty || !isAdmin} isLoading={saving}>Save Changes</Button>
      </HStack>
    </Box>
  );
}
