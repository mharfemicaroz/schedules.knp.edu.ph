import React from 'react';
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Button, VStack, HStack, Text, Box, useColorModeValue, Badge, Code, Icon, Divider, Wrap, WrapItem, Tag } from '@chakra-ui/react';
import { FiArrowRight } from 'react-icons/fi';
import api from '../services/apiService';

export default function ScheduleHistoryModal({ scheduleId, isOpen, onClose }) {
  const [loading, setLoading] = React.useState(false);
  const [text, setText] = React.useState('');
  const [entries, setEntries] = React.useState([]);
  const muted = useColorModeValue('gray.600','gray.300');
  const border = useColorModeValue('gray.200','gray.700');

  React.useEffect(() => {
    let alive = true;
    if (!isOpen || !scheduleId) { setText(''); setEntries([]); return; }
    (async () => {
      setLoading(true);
      try {
        // Prefer dedicated history endpoint
        let textVal = '';
        try { const res = await api.getScheduleHistory(scheduleId); textVal = res?.history || ''; } catch {}
        // Also try to fetch entries via schedule object if available
        let entriesVal = [];
        try { const s = await api.getScheduleById(scheduleId); entriesVal = Array.isArray(s?.historyEntries) ? s.historyEntries : []; if (!textVal && s?.history) textVal = s.history; } catch {}
        if (alive) { setText(textVal || 'No history yet.'); setEntries(Array.isArray(entriesVal) ? entriesVal : []); }
      } catch (e) {
        if (alive) { setText(e?.message || 'Failed to load history.'); setEntries([]); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [isOpen, scheduleId]);

  const fmtAction = (a) => {
    const s = String(a || '').toLowerCase();
    if (s === 'create' || s.startsWith('create')) return { label: 'Created', color: 'green' };
    if (s === 'update') return { label: 'Updated', color: 'blue' };
    if (s === 'delete') return { label: 'Deleted', color: 'red' };
    if (s === 'resolve') return { label: 'Resolved', color: 'purple' };
    if (s === 'swap') return { label: 'Swapped', color: 'orange' };
    return { label: a, color: 'gray' };
  };

  const prettyLabel = (raw) => {
    const m = String(raw || '').trim();
    const map = {
      Term: 'Term', Time: 'Time', Faculty: 'Faculty', FacultyId: 'Faculty ID', Day: 'Day', Session: 'Session',
      SchoolYear: 'School Year', Semester: 'Semester', Lock: 'Lock',
    };
    return map[m] || m;
  };

  const normalizeTermShort = (v) => {
    const str = String(v || '').trim().toLowerCase();
    if (!str) return '';
    if (str.startsWith('1')) return '1st';
    if (str.startsWith('2')) return '2nd';
    if (str.startsWith('s')) return 'Sem';
    return String(v || '').trim();
  };
  const normalizeLock = (v) => {
    const t = typeof v;
    if (t === 'boolean') return v ? 'yes' : 'no';
    const s = String(v || '').trim().toLowerCase();
    if (['1','true','yes','y'].includes(s)) return 'yes';
    if (['0','false','no','n',''].includes(s)) return 'no';
    return s;
  };
  const normByLabel = (label, val) => {
    const l = String(label || '').trim().toLowerCase();
    if (l === 'term') return normalizeTermShort(val);
    if (l === 'lock') return normalizeLock(val);
    return String(val ?? '').trim();
  };
  const parseUpdateDetails = (s) => {
    const parts = String(s || '').split('|').map(p => p.trim()).filter(Boolean);
    const changes = [];
    const assigns = [];
    parts.forEach((p) => {
      // Match change: Label: 'from' -> 'to'
      const m = p.match(/^([^:]+):\s*'(.*)'\s*->\s*'(.*)'$/);
      if (m) {
        const rawLabel = m[1];
        const label = prettyLabel(rawLabel);
        const from = m[2];
        const to = m[3];
        // Filter out no-op changes (e.g., lock no -> ''), using normalization per label
        const a = normByLabel(label, from);
        const b = normByLabel(label, to);
        if (a !== b) {
          changes.push({ label, from, to });
        }
        return;
      }
      // Match assign: Label=Value
      const m2 = p.match(/^([^=]+)=(.*)$/);
      if (m2) {
        assigns.push({ label: prettyLabel(m2[1]), value: m2[2] });
        return;
      }
      assigns.push({ label: '', value: p });
    });
    return { changes, assigns };
  };

  const ValueText = ({ value, mutedText }) => (
    <Text fontSize="sm" color={value ? undefined : mutedText}>
      {value ? value : '—'}
    </Text>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Schedule History #{scheduleId}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {Array.isArray(entries) && entries.length > 0 ? (
            <VStack align="stretch" spacing={3}>
              {entries.map((e) => {
                const act = fmtAction(e.action);
                const { changes, assigns } = parseUpdateDetails(e.details || '');
                const hasChanges = changes.length > 0;
                const hasAssigns = assigns.length > 0;
                return (
                  <Box key={e.id} p={3} borderWidth="1px" borderColor={border} rounded="md">
                    <HStack justify="space-between" mb={1}>
                      <Text fontSize="sm" color={muted}>{new Date(e.createdAt).toLocaleString()}</Text>
                      <Badge colorScheme={act.color}>{act.label}</Badge>
                    </HStack>
                    <Text fontSize="sm" fontWeight="600">{e.user || (e.userId != null ? `user#${e.userId}` : 'system')}</Text>
                    {(hasChanges || hasAssigns) ? (
                      <VStack align="stretch" spacing={2} mt={2}>
                        {hasChanges && (
                          <VStack align="stretch" spacing={2}>
                            {changes.map((c, idx) => (
                              <HStack key={idx} spacing={3} align="center">
                                <Badge colorScheme="gray" fontSize="0.65rem">{c.label}</Badge>
                                <ValueText value={c.from} mutedText={muted} />
                                <Icon as={FiArrowRight} />
                                <ValueText value={c.to} mutedText={muted} />
                              </HStack>
                            ))}
                          </VStack>
                        )}
                        {hasChanges && hasAssigns && <Divider />}
                        {hasAssigns && (
                          <Wrap>
                            {assigns.map((a, j) => (
                              <WrapItem key={j}>
                                <Tag colorScheme="gray" size="sm">{a.label ? `${a.label}: ${a.value}` : a.value}</Tag>
                              </WrapItem>
                            ))}
                          </Wrap>
                        )}
                      </VStack>
                    ) : (
                      <Text fontSize="sm" color={muted} mt={1}>{e.details || 'No details'}</Text>
                    )}
                  </Box>
                );
              })}
            </VStack>
          ) : (
            <Box>
              <Text fontSize="sm" color={muted} mb={2}>{loading ? 'Loading…' : 'No structured entries. Showing raw log:'}</Text>
              <Box p={3} borderWidth="1px" borderColor={border} rounded="md" bg={useColorModeValue('gray.50','gray.800')}>
                <Code whiteSpace="pre-wrap" width="100%">{text || 'No history yet.'}</Code>
              </Box>
            </Box>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
