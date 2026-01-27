import React from 'react';
import {
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerCloseButton,
  VStack,
  HStack,
  Text,
  Badge,
  Box,
  Divider,
  useColorModeValue,
} from '@chakra-ui/react';

export default function MeetTimelineDrawer({ isOpen, onClose, meeting, events, loading, error }) {
  const border = useColorModeValue('gray.200', 'gray.700');
  const subtle = useColorModeValue('gray.600', 'gray.400');

  return (
    <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="md">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>
          <VStack align="start" spacing={1}>
            <Text fontSize="lg" fontWeight="700">Meet timeline</Text>
            <Text fontSize="sm" color={subtle}>{meeting?.meetingCode || meeting?.conferenceId || ''}</Text>
          </VStack>
        </DrawerHeader>
        <DrawerBody>
          {loading && (
            <Text fontSize="sm" color={subtle}>Loading timeline...</Text>
          )}
          {error && (
            <Box p={3} borderWidth="1px" borderColor={border} rounded="md">
              <Text fontSize="sm" fontWeight="600">Unable to load timeline</Text>
              <Text fontSize="xs" color={subtle}>{error}</Text>
            </Box>
          )}
          {!loading && !error && (
            <VStack align="stretch" spacing={4}>
              {events.length === 0 ? (
                <Box p={3} borderWidth="1px" borderColor={border} rounded="md">
                  <Text fontSize="sm" color={subtle}>No events recorded in this window.</Text>
                </Box>
              ) : (
                events.map((event, idx) => (
                  <Box key={`${event.timestamp}-${idx}`} p={3} borderWidth="1px" borderColor={border} rounded="md">
                    <HStack justify="space-between" mb={2}>
                      <Badge colorScheme="blue" variant="subtle">{event.eventName}</Badge>
                      <Text fontSize="xs" color={subtle}>{new Date(event.timestamp).toLocaleString()}</Text>
                    </HStack>
                    <Text fontSize="sm" fontWeight="600">{event.description}</Text>
                    <Divider my={2} />
                    <VStack align="start" spacing={1}>
                      <Text fontSize="xs" color={subtle}>Actor: {event.actorEmail || 'Unknown'}</Text>
                      {event.orgUnit && <Text fontSize="xs" color={subtle}>Org Unit: {event.orgUnit}</Text>}
                      {event.ipAddress && <Text fontSize="xs" color={subtle}>IP: {event.ipAddress}</Text>}
                      {event.deviceType && <Text fontSize="xs" color={subtle}>Device: {event.deviceType}</Text>}
                    </VStack>
                  </Box>
                ))
              )}
            </VStack>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

