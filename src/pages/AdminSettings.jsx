import React from 'react';
import { Box, Heading, Text, HStack, VStack, SimpleGrid, Select, Button, useToast, useColorModeValue, Badge, Divider } from '@chakra-ui/react';
import apiService from '../services/apiService';
import { useDispatch, useSelector } from 'react-redux';
import { loadAllSchedules } from '../store/dataThunks';
import { loadSettingsThunk, updateSettingsThunk } from '../store/settingsThunks';

const SEM_OPTS = [
  { value: '1st', label: '1st Semester' },
  { value: '2nd', label: '2nd Semester' },
  { value: 'Summer', label: 'Summer' },
];

function PairCard({ title, value, onChange, syOptions }) {
  const safeValue = value || { school_year: '', semester: '' };
  const border = useColorModeValue('gray.200','gray.700');
  const bg = useColorModeValue('white','gray.800');
  const subtle = useColorModeValue('gray.600','gray.300');
  return (
    <Box borderWidth="1px" borderColor={border} rounded="lg" p={4} bg={bg}>
      <HStack justify="space-between" mb={2}>
        <Heading size="sm">{title}</Heading>
      </HStack>
      <SimpleGrid columns={{ base: 1, sm: 2 }} gap={3} alignItems="center">
        <VStack align="stretch" spacing={1}>
          <Text fontSize="sm" color={subtle}>School Year</Text>
          <Select placeholder="Select school year" value={safeValue.school_year || ''} onChange={(e)=>onChange({ ...safeValue, school_year: e.target.value })}>
            {(syOptions || []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>
        </VStack>
        <VStack align="stretch" spacing={1}>
          <Text fontSize="sm" color={subtle}>Semester</Text>
          <Select placeholder="Select semester" value={safeValue.semester || ''} onChange={(e)=>onChange({ ...safeValue, semester: e.target.value })}>
            {SEM_OPTS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </Select>
        </VStack>
      </SimpleGrid>
    </Box>
  );
}

export default function AdminSettings() {
  const toast = useToast();
  const dispatch = useDispatch();
  const border = useColorModeValue('gray.200','gray.700');
  const subtle = useColorModeValue('gray.600','gray.300');
  const authUser = useSelector(s => s.auth.user);
  const roleStr = String(authUser?.role || '').toLowerCase();
  const isAdmin = roleStr === 'admin';

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [orig, setOrig] = React.useState({
    schedulesView: { school_year: '', semester: '' },
    schedulesLoad: { school_year: '', semester: '' },
    gradesSubmission: { school_year: '', semester: '' },
    attendance: { school_year: '', semester: '' },
    evaluations: { school_year: '', semester: '' },
    updatedAt: null,
  });
  const [form, setForm] = React.useState(orig);

  const dirty = React.useMemo(() => {
    return (
      JSON.stringify(form.schedulesView) !== JSON.stringify(orig.schedulesView) ||
      JSON.stringify(form.schedulesLoad) !== JSON.stringify(orig.schedulesLoad) ||
      JSON.stringify(form.gradesSubmission) !== JSON.stringify(orig.gradesSubmission) ||
      JSON.stringify(form.attendance) !== JSON.stringify(orig.attendance) ||
      JSON.stringify(form.evaluations) !== JSON.stringify(orig.evaluations)
    );
  }, [form, orig]);

  const normalizeSettings = React.useCallback((data) => {
    const base = {
      schedulesView: { school_year: '', semester: '' },
      schedulesLoad: { school_year: '', semester: '' },
      gradesSubmission: { school_year: '', semester: '' },
      attendance: { school_year: '', semester: '' },
      evaluations: { school_year: '', semester: '' },
      updatedAt: null,
    };
    return { ...base, ...(data || {}) };
  }, []);

  const refresh = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await dispatch(loadSettingsThunk()).unwrap();
      const merged = normalizeSettings(data);
      setOrig(merged);
      setForm(merged);
    } catch (e) {
      toast({ title: 'Failed to load settings', status: 'error' });
    } finally {
      setLoading(false);
    }
  }, [dispatch, toast, normalizeSettings]);

  React.useEffect(() => { refresh(); }, [refresh]);

  // Build school year options: current year ±3, formatted as YYYY-YYYY+1
  const syOptions = React.useMemo(() => {
    const y = new Date().getFullYear();
    const out = [];
    for (let yr = y - 3; yr <= y + 3; yr++) {
      out.push(`${yr}-${yr + 1}`);
    }
    return out;
  }, []);

  const save = async () => {
    try {
      setSaving(true);
      const payload = {
        schedulesView: form.schedulesView,
        schedulesLoad: form.schedulesLoad,
        gradesSubmission: form.gradesSubmission,
        attendance: form.attendance,
        evaluations: form.evaluations,
      };
      const data = await dispatch(updateSettingsThunk(payload)).unwrap();
      const merged = normalizeSettings(data);
      setOrig(merged);
      setForm(merged);
      toast({ title: 'Settings saved', status: 'success' });
      // Refresh schedules across the app with new view filters
      dispatch(loadAllSchedules());
    } catch (e) {
      toast({ title: e?.message || 'Failed to save', status: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">System Settings</Heading>
        <HStack>
          <Button variant="outline" onClick={refresh} isLoading={loading} loadingText="Refreshing">Refresh</Button>
          <Button colorScheme="blue" onClick={save} isDisabled={!dirty || !isAdmin} isLoading={saving} loadingText="Saving">Save</Button>
        </HStack>
      </HStack>

      <Text fontSize="sm" color={subtle} mb={2}>Set default School Year and Semester used by schedules and admin modules.</Text>
      {orig.updatedAt && (
        <HStack mb={3}><Badge colorScheme="purple">Last Updated: {new Date(orig.updatedAt).toLocaleString()}</Badge></HStack>
      )}

      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
        <PairCard title="Schedules View Defaults" value={form.schedulesView} onChange={(v)=>setForm({ ...form, schedulesView: v })} syOptions={syOptions} />
        <PairCard title="Schedules Load Defaults" value={form.schedulesLoad} onChange={(v)=>setForm({ ...form, schedulesLoad: v })} syOptions={syOptions} />
        <PairCard title="Grades Submission Defaults" value={form.gradesSubmission} onChange={(v)=>setForm({ ...form, gradesSubmission: v })} syOptions={syOptions} />
        <PairCard title="Attendance Defaults" value={form.attendance} onChange={(v)=>setForm({ ...form, attendance: v })} syOptions={syOptions} />
        <PairCard title="Evaluations Defaults" value={form.evaluations} onChange={(v)=>setForm({ ...form, evaluations: v })} syOptions={syOptions} />
      </SimpleGrid>

      <Divider my={4} />
      <HStack justify="flex-end">
        <Button colorScheme="blue" onClick={save} isDisabled={!dirty || !isAdmin} isLoading={saving}>Save Changes</Button>
      </HStack>
    </Box>
  );
}
