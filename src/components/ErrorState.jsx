import React from 'react';
import { Center, VStack, Text, Button } from '@chakra-ui/react';

export default function ErrorState({ error, onRetry }) {
  return (
    <Center py={20}>
      <VStack spacing={4}>
        <Text fontWeight="700">Something went wrong</Text>
        <Text color="gray.500" maxW="480px" textAlign="center">{error?.message || 'Failed to load data.'}</Text>
        {onRetry && <Button onClick={onRetry} colorScheme="brand">Retry</Button>}
      </VStack>
    </Center>
  );
}

