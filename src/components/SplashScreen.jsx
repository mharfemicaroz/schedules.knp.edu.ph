import React from 'react';
import { Box, Center, Image, Text, useColorModeValue, VStack } from '@chakra-ui/react';
import { motion } from 'framer-motion';

export default function SplashScreen() {
  const bg = useColorModeValue('white', 'gray.900');
  const subtle = useColorModeValue('gray.600', 'gray.400');
  return (
    <Box position="fixed" inset={0} bg={bg} zIndex={2000}>
      <Center w="100%" h="100%">
        <VStack spacing={4}>
          <Box as={motion.div}
               animate={{ y: [0, -14, 0] }}
               transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}>
            <Image src="/logo.png" alt="Logo" boxSize={{ base: '64px', md: '80px' }} rounded="md" shadow="md" />
          </Box>
          <Text fontWeight="800" fontSize={{ base: 'md', md: 'lg' }} textAlign="center">
            Office of the Vice President of Academic Affairs
          </Text>
          <Text fontSize={{ base: 'sm', md: 'md' }} color={subtle} textAlign="center">
            Kolehiyo ng Pantukan Faculty Loading
          </Text>
        </VStack>
      </Center>
    </Box>
  );
}

