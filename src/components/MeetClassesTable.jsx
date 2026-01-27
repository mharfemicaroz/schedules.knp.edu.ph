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
  HStack,
  Text,
  IconButton,
  Tooltip,
  Button,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiCopy, FiExternalLink, FiEye } from 'react-icons/fi';

function formatStatusColor(status) {
  if (status === 'LIVE') return 'green';
  return 'gray';
}

export default function MeetClassesTable({
  items,
  onViewTimeline,
  onCopyMeetingCode,
  onOpenMeet,
  hasMore,
  onLoadMore,
  loadingMore,
}) {
  const border = useColorModeValue('gray.200', 'gray.700');
  const subtle = useColorModeValue('gray.600', 'gray.400');
  const [expanded, setExpanded] = React.useState({});

  const toggleExpanded = React.useCallback((key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

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
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {items.map((row) => (
            <Tr key={`${row.meetingKey}-${row.lastActivityAt}`}>
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
          ))}
        </Tbody>
      </Table>
      {hasMore && (
        <Box p={3} textAlign="center" borderTopWidth="1px" borderColor={border}>
          <Button size="sm" onClick={onLoadMore} isLoading={loadingMore} variant="outline" colorScheme="blue">
            Load more
          </Button>
        </Box>
      )}
    </Box>
  );
}

