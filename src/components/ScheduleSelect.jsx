import React from 'react';
import {
  Box, HStack, VStack, Text, Input, InputGroup, InputRightElement, IconButton,
  Spinner, useColorModeValue
} from '@chakra-ui/react';
import { FiChevronDown, FiX } from 'react-icons/fi';
import { useSelector } from 'react-redux';

export default function ScheduleSelect({
  value, // scheduleId
  onChangeId,
  placeholder = 'Select schedule...',
  disabled = false,
  autoFocus = false,
  maxHeight = '280px',
  allowClear = false,
}) {
  const bg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const highlight = useColorModeValue('gray.100', 'whiteAlpha.200');
  const raw = useSelector(s => Array.isArray(s.data.raw) ? s.data.raw : []);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef(null);
  const listRef = React.useRef(null);

  const options = React.useMemo(() => {
    try {
      return (raw || []).map(r => ({
        id: r.id,
        label: `${r.programcode || ''} • ${r.courseName || r.course_name || ''}${r.blockCode ? ` • ${r.blockCode}` : ''}`.trim(),
        meta: `${r.day || ''} ${r.time || ''} • ${r.instructor || r.faculty || ''}`.trim(),
        search: `${r.programcode || ''} ${r.courseName || ''} ${r.courseTitle || ''} ${r.blockCode || ''} ${r.day || ''} ${r.time || ''} ${r.instructor || ''} ${r.room || ''}`.toLowerCase(),
      }));
    } catch { return []; }
  }, [raw]);

  const filtered = React.useMemo(() => {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return options.slice(0, 200);
    const arr = options.filter(o => o.search.includes(q));
    return arr.slice(0, 200);
  }, [options, query]);

  const selectedLabel = React.useMemo(() => {
    const id = Number(value);
    const found = (options || []).find(o => Number(o.id) === id);
    return found ? `${found.label} — ${found.meta}` : '';
  }, [options, value]);

  React.useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);
  React.useEffect(() => {
    if (!open) return;
    const arr = filtered || [];
    const idx = arr.findIndex(o => Number(o.id) === Number(value));
    setActiveIndex(idx >= 0 ? idx : 0);
    setTimeout(() => scrollIntoView(idx >= 0 ? idx : 0), 0);
  }, [open, value, filtered]);

  const commit = (id) => {
    onChangeId?.(id);
    setOpen(false);
  };

  const scrollIntoView = (idx) => {
    const el = listRef.current?.children?.[idx];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
  };

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, filtered.length - 1)); scrollIntoView(activeIndex + 1); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); scrollIntoView(activeIndex - 1); }
    if (e.key === 'Enter')     { e.preventDefault(); const item = filtered[activeIndex]; if (item) commit(item.id); }
    if (e.key === 'Escape')    { e.preventDefault(); setOpen(false); }
  };

  const hasSelection = Boolean(selectedLabel);

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
        <Text noOfLines={1} color={hasSelection ? undefined : 'gray.500'}>
          {selectedLabel || placeholder}
        </Text>
        <HStack spacing={1}>
          {allowClear && hasSelection && (
            <IconButton
              aria-label="Clear selection"
              icon={<FiX />}
              size="xs"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); commit(null); }}
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
                placeholder={'Search courses, block, faculty...'}
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
              {filtered.length === 0 ? (
                <HStack p={3} spacing={2}><Spinner size="sm" /><Text>No matches</Text></HStack>
              ) : (
                filtered.map((opt, i) => (
                  <VStack
                    key={opt.id}
                    align="start"
                    spacing={0}
                    px={3}
                    py={2}
                    _hover={{ bg: highlight }}
                    bg={i === activeIndex ? highlight : 'transparent'}
                    cursor="pointer"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => commit(opt.id)}
                  >
                    <Text noOfLines={1} fontWeight="600">{opt.label}</Text>
                    <Text noOfLines={1} fontSize="xs" color="gray.500">{opt.meta}</Text>
                  </VStack>
                ))
              )}
            </Box>
          </VStack>
        </Box>
      )}
    </Box>
  );
}

