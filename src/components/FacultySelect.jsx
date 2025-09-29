import React from 'react';
import {
  Box,
  Input,
  InputGroup,
  InputRightElement,
  IconButton,
  Spinner,
  Text,
  VStack,
  HStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiChevronDown, FiX } from 'react-icons/fi';
import useFaculties from '../hooks/useFaculties';

export default function FacultySelect({
  value,
  onChange,
  onChangeId,
  placeholder = 'Select faculty...',
  disabled = false,
  autoFocus = false,
  maxHeight = '220px',
  allowClear = false,
}) {
  const { data: options, loading } = useFaculties();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef(null);
  const listRef = React.useRef(null);
  const bg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const highlight = useColorModeValue('gray.100', 'whiteAlpha.200');
  const [activeIndex, setActiveIndex] = React.useState(0);

  const filtered = React.useMemo(() => {
    const q = String(query || '').toLowerCase().trim();
    const base = options || [];
    if (!q) return base;
    return base.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  React.useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // When opening, highlight and scroll to the current selection
  React.useEffect(() => {
    if (!open) return;
    const arr = filtered || [];
    const idx = arr.findIndex(o => o.value === value || o.label === value);
    const nextIdx = idx >= 0 ? idx : 0;
    setActiveIndex(nextIdx);
    // Defer scroll to after render
    setTimeout(() => scrollIntoView(nextIdx), 0);
  }, [open, value, filtered]);

  const commit = (val, id) => {
    onChange?.(val);
    onChangeId?.(id);
    setOpen(false);
  };

  const selectedLabel = React.useMemo(() => {
    if (!value) return '';
    const found = (options || []).find(o => o.value === value);
    return found ? found.label : value;
  }, [value, options]);

  const hasSelection = Boolean(selectedLabel);

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, filtered.length - 1)); scrollIntoView(activeIndex + 1); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); scrollIntoView(activeIndex - 1); }
    if (e.key === 'Enter')     { e.preventDefault(); const item = filtered[activeIndex]; if (item) commit(item.value); }
    if (e.key === 'Escape')    { e.preventDefault(); setOpen(false); }
  };

  const scrollIntoView = (idx) => {
    const el = listRef.current?.children?.[idx];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
  };

  return (
    <Box position="relative" w="full">
      <HStack
        as="div"
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); }
        }}
        justify="space-between"
        w="full"
        borderWidth="1px"
        borderColor={border}
        rounded="md"
        px={3}
        py={2}
        bg={bg}
        cursor={disabled ? 'not-allowed' : 'pointer'}
      >
        <Text noOfLines={1} color={selectedLabel ? undefined : 'gray.500'}>
          {selectedLabel || placeholder}
        </Text>
        <HStack spacing={1}>
          {allowClear && hasSelection && (
            <IconButton
              aria-label="Clear selection"
              icon={<FiX />}
              size="xs"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); commit('', null); }}
            />
          )}
          <FiChevronDown />
        </HStack>
      </HStack>

      {open && (
        <Box position="absolute" top="100%" left={0} right={0} mt={1} bg={bg} borderWidth="1px" borderColor={border} rounded="md" zIndex={20} boxShadow="xl">
          <VStack align="stretch" spacing={2} p={2}>
            <InputGroup size="sm">
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
                onKeyDown={onKeyDown}
                placeholder={loading ? 'Loading faculty...' : 'Search faculty...'}
                isDisabled={disabled}
                autoFocus={autoFocus}
              />
              {query && (
                <InputRightElement>
                  <IconButton aria-label="Clear" icon={<FiX />} size="xs" variant="ghost" onClick={() => setQuery('')} />
                </InputRightElement>
              )}
            </InputGroup>
            <Box maxH={maxHeight} overflowY="auto" ref={listRef}>
              {loading ? (
                <HStack p={3} spacing={2}><Spinner size="sm" /><Text>Loading…</Text></HStack>
              ) : (
                (filtered.length === 0 ? (
                  <Text p={3} color="gray.500">No matches</Text>
                ) : (
                  filtered.map((opt, i) => (
                    <HStack
                      key={`${opt.id}-${opt.value}`}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => commit(opt.value, opt.id)}
                      spacing={2}
                      px={3}
                      py={2}
                      _hover={{ bg: highlight }}
                      bg={i === activeIndex ? highlight : 'transparent'}
                      cursor="pointer"
                    >
                      <Text noOfLines={1}>{opt.label}</Text>
                      {opt.dept && <Text ml="auto" color="gray.500" fontSize="xs">{opt.dept}</Text>}
                    </HStack>
                  ))
                ))
              )}
            </Box>
          </VStack>
        </Box>
      )}
    </Box>
  );
}
