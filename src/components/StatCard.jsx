import React from 'react';
import { Box, HStack, VStack, Text, useColorModeValue, Icon } from '@chakra-ui/react';

export default function StatCard({ icon, label, value, accent }) {
  const bg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const color = useColorModeValue(`${accent}.600`, `${accent}.300`);
  return (
    <HStack as={Box} p={4} bg={bg} borderWidth="1px" borderColor={border} rounded="xl" spacing={4} shadow="xs">
      <Box p={3} rounded="md" bg={useColorModeValue(`${accent}.50`, 'whiteAlpha.200')} color={color}>
        <Icon as={icon} boxSize={5} />
      </Box>
      <VStack align="start" spacing={0}>
        <Text fontSize="sm" color={useColorModeValue('gray.600','gray.400')}>{label}</Text>
        <Text fontSize="xl" fontWeight="800">{value}</Text>
      </VStack>
    </HStack>
  );
}

