import React from 'react';
import { Box, Heading, Text, HStack, VStack, SimpleGrid, Select, Button, useToast, useColorModeValue, Badge, Divider } from '@chakra-ui/react';
import apiService from '../services/apiService';
import { useDispatch, useSelector } from 'react-redux';
import { loadAllSchedules } from '../store/dataThunks';

const SEM_OPTS = [
  { value: '1st', label: '1st Semester' },
  { value: '2nd', label: '2nd Semester' },
  { value: 'Summer', label: 'Summer' },
];

function PairCard({ title, value, onChange, syOptions }) {
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
          <Select placeholder="Select school year" value={value.school_year || ''} onChange={(e)=>onChange({ ...value, school_year: e.target.value })}>
            {(syOptions || []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>
        </VStack>
        <VStack align="stretch" spacing={1}>
          <Text fontSize="sm" color={subtle}>Semester</Text>
          <Select placeholder="Select semester" value={value.semester || ''} onChange={(e)=>onChange({ ...value, semester: e.target.value })}>
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
  const [orig, setOrig] = React.useState({ schedulesView: { school_year: '', semester: '' }, schedulesLoad: { school_year: '', semester: '' }, updatedAt: null });
  const [form, setForm] = React.useState(orig);

  const dirty = React.useMemo(() => JSON.stringify(form.schedulesView) !== JSON.stringify(orig.schedulesView) || JSON.stringify(form.schedulesLoad) !== JSON.stringify(orig.schedulesLoad), [form, orig]);

  const refresh = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getSettings();
      const base = { schedulesView: { school_year: '', semester: '' }, schedulesLoad: { school_year: '', semester: '' }, updatedAt: null };
      const merged = { ...base, ...(data || {}) };
      setOrig(merged);
      setForm(merged);
    } catch (e) {
      toast({ title: 'Failed to load settings', status: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

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
      const payload = { schedulesView: form.schedulesView, schedulesLoad: form.schedulesLoad };
      const data = await apiService.updateSettings(payload);
      setOrig(data);
      setForm(data);
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

      <Text fontSize="sm" color={subtle} mb={2}>Set default School Year and Semester used by schedules views and data loading.</Text>
      {orig.updatedAt && (
        <HStack mb={3}><Badge colorScheme="purple">Last Updated: {new Date(orig.updatedAt).toLocaleString()}</Badge></HStack>
      )}

      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
        <PairCard title="Schedules View Defaults" value={form.schedulesView} onChange={(v)=>setForm({ ...form, schedulesView: v })} syOptions={syOptions} />
        <PairCard title="Schedules Load Defaults" value={form.schedulesLoad} onChange={(v)=>setForm({ ...form, schedulesLoad: v })} syOptions={syOptions} />
      </SimpleGrid>

      <Divider my={4} />
      <HStack justify="flex-end">
        <Button colorScheme="blue" onClick={save} isDisabled={!dirty || !isAdmin} isLoading={saving}>Save Changes</Button>
      </HStack>
    </Box>
  );
}
