import React from 'react';
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Button,
  HStack,
  VStack,
  Text,
  IconButton,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiCopy, FiEdit2, FiExternalLink, FiEye, FiX } from 'react-icons/fi';
import MeetPaginationBar from './MeetPaginationBar';
import FacultySelect from './FacultySelect';

function formatStatusColor(status) {
  if (status === 'LIVE') return 'green';
  return 'gray';
}

export default function MeetClassesTable({
  items,
  onViewTimeline,
  onCopyMeetingCode,
  onOpenMeet,
  onAssignMeetCode,
  facultyOptions,
  facultyLoading,
  pagination,
  onPageChange,
}) {
  const border = useColorModeValue('gray.200', 'gray.700');
  const subtle = useColorModeValue('gray.600', 'gray.400');
  const [expanded, setExpanded] = React.useState({});
  const [editing, setEditing] = React.useState({});

  const toggleExpanded = React.useCallback((key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const setEditingState = React.useCallback((key, value) => {
    setEditing((prev) => ({ ...prev, [key]: value }));
  }, []);

  const rowKeyOf = (row) => row.meetingKey || row.meetingCode || row.conferenceId;

  return (
    <Box borderWidth="1px" borderColor={border} rounded="xl" overflowX="auto" bg={useColorModeValue('white','gray.800')}>
      <Table size="sm">
        <Thead bg={useColorModeValue('gray.50','gray.900')}>
          <Tr>
            <Th>Status</Th>
            <Th>Actor</Th>
            <Th>Faculty</Th>
            <Th>Org Unit</Th>
            <Th>Last activity</Th>
            <Th>Meeting code</Th>
            <Th>Mapped faculty</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {items.map((row) => {
            const rowKey = rowKeyOf(row);
            const isEditing = editing[rowKey];
            const hasMapping = Boolean(row.mappedFacultyName || row.mappedFacultyEmail);
            return (
              <Tr key={`${rowKey}-${row.lastActivityAt}`}>
              <Td>
                <HStack spacing={2}>
                  <Badge colorScheme={formatStatusColor(row.status)} variant="solid">{row.status}</Badge>
                  <Text fontSize="xs" color={subtle}>{Number.isFinite(row.confidenceScore) ? row.confidenceScore.toFixed(2) : '-'}</Text>
                </HStack>
              </Td>
              <Td>
                <Text>{row.actorEmail || 'Unknown'}</Text>
              </Td>
              <Td>
                {row.facultyActors && row.facultyActors.length ? (
                  <Box>
                    <Text>
                      {row.facultyActors[0]}
                      {row.facultyActors.length > 1 ? (
                        <Button
                          onClick={() => toggleExpanded(row.meetingKey)}
                          variant="link"
                          size="sm"
                          ml={2}
                          colorScheme="blue"
                          aria-expanded={!!expanded[row.meetingKey]}
                        >
                          {expanded[row.meetingKey] ? 'Hide' : `+${row.facultyActors.length - 1}`}
                        </Button>
                      ) : null}
                    </Text>
                    {expanded[row.meetingKey] && row.facultyActors.length > 1 && (
                      <Box mt={2} fontSize="xs" color={subtle}>
                        {row.facultyActors.slice(1).join(', ')}
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Text>-</Text>
                )}
              </Td>
              <Td>
                <Text>{row.orgUnit || '-'}</Text>
              </Td>
              <Td>
                <Text>{row.lastActivityAt ? new Date(row.lastActivityAt).toLocaleString() : '-'}</Text>
              </Td>
              <Td>
                <Text>{row.meetingCode || '-'}</Text>
              </Td>
              <Td>
                <VStack align="start" spacing={2} minW="220px">
                  <HStack spacing={2} flexWrap="wrap">
                    {row.mappedFacultyName ? (
                      <Badge colorScheme="blue" variant="subtle">{row.mappedFacultyName}</Badge>
                    ) : (
                      <Text fontSize="xs" color={subtle}>Unassigned</Text>
                    )}
                    {row.mappedFacultyEmail ? (
                      <Text fontSize="xs" color={subtle}>{row.mappedFacultyEmail}</Text>
                    ) : null}
                    {hasMapping && !isEditing && (
                      <Tooltip label="Edit mapping">
                        <IconButton
                          size="xs"
                          aria-label="Edit mapping"
                          icon={<FiEdit2 />}
                          variant="ghost"
                          onClick={() => setEditingState(rowKey, true)}
                          isDisabled={!row.meetingCode}
                        />
                      </Tooltip>
                    )}
                  </HStack>
                  {(!hasMapping || isEditing) && (
                    <HStack w="full" spacing={2}>
                      <Box flex="1">
                        <FacultySelect
                          value={row.mappedFacultyName || ''}
                          onChangeId={(id) => {
                            onAssignMeetCode?.(row, id);
                            setEditingState(rowKey, false);
                          }}
                          allowClear
                          placeholder="Assign faculty..."
                          options={facultyOptions}
                          loading={facultyLoading}
                          disabled={!row.meetingCode}
                          maxHeight="220px"
                        />
                      </Box>
                      {hasMapping && (
                        <IconButton
                          size="sm"
                          aria-label="Cancel edit"
                          icon={<FiX />}
                          variant="ghost"
                          onClick={() => setEditingState(rowKey, false)}
                        />
                      )}
                    </HStack>
                  )}
                </VStack>
              </Td>
              <Td>
                <HStack spacing={1}>
                  <Tooltip label="View timeline">
                    <IconButton size="sm" aria-label="View timeline" icon={<FiEye />} onClick={() => onViewTimeline(row)} />
                  </Tooltip>
                  <Tooltip label="Copy meeting code">
                    <IconButton size="sm" aria-label="Copy meeting code" icon={<FiCopy />} onClick={() => onCopyMeetingCode(row)} isDisabled={!row.meetingCode} />
                  </Tooltip>
                  {row.meetingCode && onOpenMeet && (
                    <Tooltip label="Open Meet">
                      <IconButton size="sm" aria-label="Open Meet" icon={<FiExternalLink />} onClick={() => onOpenMeet(row)} />
                    </Tooltip>
                  )}
                </HStack>
              </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
      <MeetPaginationBar pagination={pagination} onPageChange={onPageChange} />
    </Box>
  );
}

