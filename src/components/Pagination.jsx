import React from 'react';
import { HStack, IconButton, Text, Select } from '@chakra-ui/react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export default function Pagination({ page, pageCount, onPage, pageSize, onPageSize }) {
  const canPrev = page > 1;
  const canNext = page < pageCount;
  return (
    <HStack justify="space-between" w="full" spacing={4}>
      <HStack>
        <IconButton aria-label="Previous" icon={<FiChevronLeft />} onClick={() => canPrev && onPage(page - 1)} isDisabled={!canPrev} />
        <Text fontSize="sm">Page {page} / {pageCount}</Text>
        <IconButton aria-label="Next" icon={<FiChevronRight />} onClick={() => canNext && onPage(page + 1)} isDisabled={!canNext} />
      </HStack>
      <HStack>
        <Select size="sm" value={pageSize} onChange={e => onPageSize(Number(e.target.value))}>
          {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
        </Select>
      </HStack>
    </HStack>
  );
}

