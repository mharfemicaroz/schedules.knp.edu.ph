import React from 'react';
import {
  Badge, Box, Button, Collapse, HStack, SimpleGrid, Table, TableContainer,
  Tbody, Td, Text, Th, Thead, Tr, VStack, useColorModeValue,
} from '@chakra-ui/react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { computeTeachingOverload } from '../utils/teachingOverload';

const format = (value) => Number.isFinite(Number(value))
  ? Number(Number(value).toFixed(2)).toString() : '0';

export default function FacultyLoadDetails({ faculty, items = [], override, settingsLoad, loading = false }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  const border = useColorModeValue('gray.200', 'gray.700');
  const muted = useColorModeValue('gray.600', 'gray.400');
  const background = useColorModeValue('gray.50', 'gray.800');
  const partTime = /part\s*-?\s*time/i.test(faculty?.employment || '');
  const data = React.useMemo(() => {
    const terms = { '1st': 0, '2nd': 0, Sem: 0 };
    const nstp = { '1st': 0, '2nd': 0, Sem: 0 };
    let drafts = 0, missingTerms = 0;
    for (const item of items) {
      if (item._draft || String(item.id || '').startsWith('tmp:')) drafts++;
      const raw = String(item.term || '').trim().toLowerCase();
      const term = raw.startsWith('1') ? '1st' : raw.startsWith('2') ? '2nd' : raw.startsWith('s') ? 'Sem' : '';
      if (!term) { missingTerms++; continue; }
      const amount = Number(item.unit ?? item.units ?? 0);
      const units = Number.isFinite(amount) ? Math.max(0, amount) : 0;
      terms[term] += units;
      const name = [item.code, item.courseName, item.course_name, item.title, item.courseTitle, item.course_title].filter(Boolean).join(' ');
      if (/NSTP/i.test(name)) nstp[term] += units;
    }
    const release = Number(faculty?.loadReleaseUnits ?? faculty?.load_release_units ?? 0) || 0;
    return { terms, nstp, drafts, missingTerms, release,
      accounting: computeTeachingOverload(terms, nstp, release, faculty?.employment || '') };
  }, [faculty, items]);
  React.useEffect(() => { setOpen(false); }, [faculty?.id, faculty?.name, settingsLoad?.school_year, settingsLoad?.semester]);
  if (!faculty) return null;
  const a = data.accounting;
  const metrics = [
    ['Teaching units (non-NSTP)', `${format(a.teachingUnits)} units`],
    ['Actual teaching overload', `${format(a.teachingOverloadUnits)} units / ${format(a.teachingOverloadHours)} hrs`],
    ['Assigned load release', `${format(data.release)} units`],
    ['Release credit after deduction', `${format(a.releaseCreditUnits)} units / ${format(a.releaseCreditHours)} hrs`],
  ];
  const rows = [
    ['Term-only teaching units (non-NSTP)', Math.max(0, data.terms['1st'] - data.nstp['1st']), Math.max(0, data.terms['2nd'] - data.nstp['2nd'])],
    ['Sem teaching contribution (non-NSTP)', Math.max(0, data.terms.Sem - data.nstp.Sem) / (partTime ? 1 : 2), Math.max(0, data.terms.Sem - data.nstp.Sem) / (partTime ? 1 : 2)],
    ['Effective teaching units', a.effectiveFirstUnits, a.effectiveSecondUnits],
    ['Initial term overload (before offset)', a.initialFirstUnits, a.initialSecondUnits],
    ['Teaching overload after offset / allocation', a.teachingFirstUnits, a.teachingSecondUnits],
    ['Net release credit', a.releaseFirstUnits, a.releaseSecondUnits],
    ['Calculated credited units', a.first, a.second],
    ['Calculated credited hours', a.firstHours, a.secondHours],
  ];
  if (override) rows.push(
    ['Manual credited units', override.firstUnits, override.secondUnits],
    ['Manual credited hours', override.firstHours, override.secondHours],
  );

  return (
    <Box borderWidth="1px" borderColor={border} rounded="md" overflow="hidden" aria-busy={loading}>
      <HStack px={3} py={2} justify="space-between" flexWrap="wrap">
        <Box>
          <Text fontWeight="600">Teaching load &amp; overload details</Text>
          <Text fontSize="xs" color={muted}>Teaching overload, release deductions, NSTP and credited hours</Text>
        </Box>
        <Button size="sm" variant="outline" colorScheme="blue" rightIcon={open ? <FiChevronUp /> : <FiChevronDown />}
          aria-expanded={open} aria-controls={id} isDisabled={loading} onClick={() => setOpen(value => !value)}>
          {open ? 'Show Less' : 'Show More'}
        </Button>
      </HStack>
      <Collapse in={open} animateOpacity>
        <VStack id={id} role="region" aria-label="Faculty load computation details" align="stretch" p={3} spacing={4} borderTopWidth="1px" borderColor={border}>
          <HStack spacing={2} flexWrap="wrap">
            <Badge>{settingsLoad?.school_year || 'School year not set'}</Badge>
            <Badge>{settingsLoad?.semester || 'Semester not set'}</Badge>
            <Badge>{faculty.employment || 'Employment not set'}</Badge>
            {override && <Badge colorScheme="purple">Manual override active</Badge>}
            {data.drafts > 0 && <Badge colorScheme="orange">{data.drafts} draft schedule(s) included</Badge>}
          </HStack>
          <Text fontSize="sm" color={muted}>Matches the current faculty printout, including listed drafts. Save inline edits to include them in this computation.</Text>
          {loading && <Text fontSize="sm" role="status">Refreshing faculty load details...</Text>}
          {data.missingTerms > 0 && <Text fontSize="sm" color={muted}>{data.missingTerms} schedule(s) without a valid 1st, 2nd or Sem term are excluded from the term computation.</Text>}
          <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={3}>
            {metrics.map(([label, value]) => (
              <Box key={label} p={3} bg={background} rounded="md">
                <Text fontSize="xs" color={muted}>{label}</Text>
                <Text fontWeight="700">{value}</Text>
              </Box>
            ))}
          </SimpleGrid>
          <Box bg={background} p={3} rounded="md">
            <Text fontSize="sm">Raw term units: <b>1st {format(data.terms['1st'])}</b> / <b>2nd {format(data.terms['2nd'])}</b> / <b>Sem {format(data.terms.Sem)}</b> (includes NSTP).</Text>
            {!partTime ? (
              <>
                <Text fontSize="sm" mt={2}>Regular baseline: <b>24 units per semester</b> (12 per term). Non-NSTP Sem units are split equally; an underloaded term offsets the other term.</Text>
                <Text fontSize="sm" mt={2}>Teaching shortfall: <b>{format(a.teachingShortfallUnits)} units</b>. Release deduction: <b>{format(a.releaseDeductedUnits)} units</b>.</Text>
                <Text fontSize="sm">Assigned release {format(a.assignedReleaseUnits)} − deduction {format(a.releaseDeductedUnits)} = <b>{format(a.releaseCreditUnits)} credited release units</b>, split equally between terms.</Text>
              </>
            ) : <Text fontSize="sm" mt={2}>Part-time teaching and Sem calculations follow the existing part-time rules. Load release is not added to part-time credited hours.</Text>}
            {a.underloadOffsetUnits > 0 && <Text fontSize="sm" mt={2}><b>{format(a.underloadOffsetUnits)} units</b> of initial term overload are offset by the other term's underload.</Text>}
          </Box>
          <TableContainer borderWidth="1px" borderColor={border} rounded="md">
            <Table size="sm">
              <Thead><Tr><Th>Computation</Th><Th isNumeric>1st Term</Th><Th isNumeric>2nd Term</Th></Tr></Thead>
              <Tbody>{rows.map(([label, first, second]) => (
                <Tr key={label}><Td whiteSpace="normal">{label}</Td><Td isNumeric>{format(first)}</Td><Td isNumeric>{format(second)}</Td></Tr>
              ))}</Tbody>
            </Table>
          </TableContainer>
          <Text fontSize="sm"><b>Calculated semester total:</b> {format(a.teachingOverloadUnits)} teaching overload units + {format(a.releaseCreditUnits)} release credit units = <b>{format(a.total)} units / {format(a.totalCreditedHours)} hours</b>.</Text>
          {override && <Text fontSize="sm" color="purple.500">The printout currently uses manual credited totals: <b>{format(Number(override.firstUnits) + Number(override.secondUnits))} units / {format(Number(override.firstHours) + Number(override.secondHours))} hours</b>. The calculated figures above remain visible for comparison.</Text>}
          <Box borderWidth="1px" borderColor={border} p={3} rounded="md">
            <Text fontWeight="600" mb={1}>NSTP — separate from regular overload</Text>
            <Text fontSize="sm">NSTP scheduled units: <b>{format(data.nstp['1st'] + data.nstp['2nd'] + data.nstp.Sem)}</b>.</Text>
            <Text fontSize="sm">1st Term: <b>{format(data.nstp['1st'] + data.nstp.Sem)} units / {format(data.nstp['1st'] + data.nstp.Sem)} hours per Saturday</b>.</Text>
            <Text fontSize="sm">2nd Term: <b>{format(data.nstp['2nd'] + data.nstp.Sem)} units / {format(data.nstp['2nd'] + data.nstp.Sem)} hours per Saturday</b>.</Text>
            <Text fontSize="xs" color={muted} mt={1}>NSTP follows the existing 1 unit = 1 hour rule; Sem NSTP applies to both terms.</Text>
          </Box>
          <Text fontSize="xs" color={muted}>Regular credited hours use 3 units = 1 hour. Only the computed allocation is redistributed; course records are unchanged. Displayed hours are rounded to two decimals.</Text>
        </VStack>
      </Collapse>
    </Box>
  );
}
