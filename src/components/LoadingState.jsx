import React from 'react';
import { Center, Spinner, VStack, Text } from '@chakra-ui/react';

export default function LoadingState({ label = 'Loading data...' }) {
  return (
    <Center py={20}>
      <VStack spacing={4}>
        <Spinner size="lg" thickness='4px' />
        <Text color="gray.500">{label}</Text>
      </VStack>
    </Center>
  );
}

