import React from 'react';
import { Box, Text, useColorModeValue } from '@chakra-ui/react';

export default function MiniBarChart({ data = [], maxItems = 6, labelKey = 'key', valueKey = 'value', unit = '' }) {
  const track = useColorModeValue('gray.200', 'gray.700');
  const fill = useColorModeValue('brand.600', 'brand.300');
  const items = data.slice(0, maxItems);
  const max = Math.max(1, ...items.map(d => d[valueKey] || 0));
  return (
    <Box>
      {items.map((d, i) => (
        <Box key={i} mb={2}>
          <Text fontSize="xs" mb={1}
            title={String(d[labelKey])}
            noOfLines={1}
          >{d[labelKey]} • {d[valueKey]}{unit}</Text>
          <Box h="8px" bg={track} rounded="full">
            <Box h="8px" w={`${((d[valueKey] || 0) / max) * 100}%`} bg={fill} rounded="full" />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

