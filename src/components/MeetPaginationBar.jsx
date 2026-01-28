import React from 'react';
import {
  Box,
  HStack,
  Text,
  Button,
  IconButton,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';

function getPageWindow(current, total, size = 5) {
  if (total <= size) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const half = Math.floor(size / 2);
  let start = Math.max(1, current - half);
  let end = Math.min(total, start + size - 1);
  start = Math.max(1, end - size + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default function MeetPaginationBar({ pagination, onPageChange }) {
  if (!pagination) return null;
  const border = useColorModeValue('gray.200', 'gray.700');
  const subtle = useColorModeValue('gray.600', 'gray.400');
  const page = pagination.page || 1;
  const perPage = pagination.perPage || 10;
  const totalItems = pagination.totalItems || 0;
  const totalPages = pagination.totalPages || 1;
  const startItem = pagination.startItem ?? (totalItems ? (page - 1) * perPage + 1 : 0);
  const endItem = pagination.endItem ?? (totalItems ? Math.min(page * perPage, totalItems) : 0);
  const pages = getPageWindow(page, totalPages, 5);
  const disableNav = totalItems === 0 || totalPages <= 1;

  return (
    <Box borderTopWidth="1px" borderColor={border} px={4} py={3}>
      <HStack justify="space-between" flexWrap="wrap" spacing={3}>
        <Text fontSize="sm" color={subtle}>
          {totalItems ? `Showing ${startItem}-${endItem} of ${totalItems}` : 'No results'}
        </Text>
        <HStack spacing={1}>
          <IconButton
            size="sm"
            variant="ghost"
            aria-label="First page"
            icon={<FiChevronsLeft />}
            onClick={() => onPageChange(1)}
            isDisabled={disableNav || page <= 1}
          />
          <IconButton
            size="sm"
            variant="ghost"
            aria-label="Previous page"
            icon={<FiChevronLeft />}
            onClick={() => onPageChange(page - 1)}
            isDisabled={disableNav || page <= 1}
          />
          {pages.map((pageNumber) => (
            <Button
              key={pageNumber}
              size="sm"
              minW="34px"
              variant={pageNumber === page ? 'solid' : 'ghost'}
              colorScheme={pageNumber === page ? 'blue' : 'gray'}
              onClick={() => onPageChange(pageNumber)}
              isDisabled={disableNav}
            >
              {pageNumber}
            </Button>
          ))}
          <IconButton
            size="sm"
            variant="ghost"
            aria-label="Next page"
            icon={<FiChevronRight />}
            onClick={() => onPageChange(page + 1)}
            isDisabled={disableNav || page >= totalPages}
          />
          <IconButton
            size="sm"
            variant="ghost"
            aria-label="Last page"
            icon={<FiChevronsRight />}
            onClick={() => onPageChange(totalPages)}
            isDisabled={disableNav || page >= totalPages}
          />
        </HStack>
      </HStack>
    </Box>
  );
}
