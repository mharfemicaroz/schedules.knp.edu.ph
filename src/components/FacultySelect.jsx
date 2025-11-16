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
  Badge,
  useColorModeValue,
  Tooltip,
  useOutsideClick,
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
  options: optionsOverride,
  loading: loadingOverride,
}) {
  const { data: fetched, loading: loadingHook } = useFaculties();
  const options = optionsOverride || fetched;
  const loading =
    typeof loadingOverride === 'boolean'
      ? loadingOverride
      : !optionsOverride && loadingHook;

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [selectedText, setSelectedText] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);

  const inputRef = React.useRef(null);
  const listRef = React.useRef(null);
  const rootRef = React.useRef(null);

  const bg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const highlight = useColorModeValue('gray.100', 'whiteAlpha.200');

  const filtered = React.useMemo(() => {
    const q = String(query || '').toLowerCase().trim();
    const base = options || [];
    if (!q) return base;
    return base.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const renderParts = (p) => {
    if (!p) return null;
    const fmt = (x) => (typeof x === 'number' ? x.toFixed(2) : '-');
    return (
      <VStack align="start" spacing={0} p={1}>
        <Text fontSize="xs">
          Dept: {fmt(p.dept)} | Emp: {fmt(p.employment)} | Deg: {fmt(p.degree)}
        </Text>
        <Text fontSize="xs">
          Time: {fmt(p.time)} | Load: {fmt(p.load)} | Over: {fmt(p.overload)}
        </Text>
        <Text fontSize="xs">
          Exp: {fmt(p.termExp)} | Match: {fmt(p.match)}
        </Text>
      </VStack>
    );
  };

  // Focus the search input when opening
  React.useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Close on outside click via Chakra hook (safe with React events)
  useOutsideClick({
    ref: rootRef,
    handler: () => setOpen(false),
  });

  // Close on Escape / Tab / window blur / tab hidden
  React.useEffect(() => {
    if (!open) return;

    const handleKeydown = (e) => {
      if (e.key === 'Escape' || e.key === 'Tab') {
        setOpen(false);
      }
    };
    const handleBlur = () => setOpen(false);
    const handleVisibility = () => {
      if (document.hidden) setOpen(false);
    };

    window.addEventListener('keydown', handleKeydown, true);
    window.addEventListener('blur', handleBlur, true);
    document.addEventListener('visibilitychange', handleVisibility, true);

    return () => {
      window.removeEventListener('keydown', handleKeydown, true);
      window.removeEventListener('blur', handleBlur, true);
      document.removeEventListener('visibilitychange', handleVisibility, true);
    };
  }, [open]);

  // When opening, highlight and scroll to the current selection
  React.useEffect(() => {
    if (!open) return;
    const arr = filtered || [];
    const idx = arr.findIndex((o) => o.value === value || o.label === value);
    const nextIdx = idx >= 0 ? idx : 0;
    setActiveIndex(nextIdx);
    setTimeout(() => scrollIntoView(nextIdx), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value, filtered]);

  const commit = (val, id) => {
    onChangeId?.(id);
    onChange?.(val);
    setSelectedText(String(val || ''));
    setOpen(false);
  };

  // Sync local display when parent controls `value`
  React.useEffect(() => {
    if (value !== undefined) {
      setSelectedText(String(value || ''));
    }
  }, [value]);

  const hasSelection = Boolean(selectedText);

  const scrollIntoView = (idx) => {
    const el = listRef.current?.children?.[idx];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
  };

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => {
        const next = Math.min(i + 1, filtered.length - 1);
        scrollIntoView(next);
        return next;
      });
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => {
        const next = Math.max(i - 1, 0);
        scrollIntoView(next);
        return next;
      });
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) commit(item.label, item.id);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <Box position="relative" w="full" ref={rootRef}>
      <HStack
        as="div"
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
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
        <Text noOfLines={1} color={selectedText ? undefined : 'gray.500'}>
          {selectedText || placeholder}
        </Text>
        <HStack spacing={1}>
          {allowClear && hasSelection && !disabled && (
            <IconButton
              aria-label="Clear selection"
              icon={<FiX />}
              size="xs"
              variant="ghost"
              isDisabled={disabled}
              onClick={(e) => {
                if (disabled) return;
                e.stopPropagation();
                commit('', null);
              }}
            />
          )}
          <FiChevronDown />
        </HStack>
      </HStack>

      {open && (
        <Box
          position="absolute"
          top="100%"
          left={0}
          right={0}
          mt={1}
          bg={bg}
          borderWidth="1px"
          borderColor={border}
          rounded="md"
          zIndex={20}
          boxShadow="xl"
        >
          <VStack align="stretch" spacing={2} p={2}>
            <InputGroup size="sm">
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onKeyDown}
                placeholder={loading ? 'Loading faculty...' : 'Search faculty...'}
                isDisabled={disabled}
                autoFocus={autoFocus}
              />
              {query && (
                <InputRightElement>
                  <IconButton
                    aria-label="Clear"
                    icon={<FiX />}
                    size="xs"
                    variant="ghost"
                    onClick={() => setQuery('')}
                  />
                </InputRightElement>
              )}
            </InputGroup>
            <Box maxH={maxHeight} overflowY="auto" ref={listRef}>
              {loading ? (
                <HStack p={3} spacing={2}>
                  <Spinner size="sm" />
                  <Text>Loading…</Text>
                </HStack>
              ) : filtered.length === 0 ? (
                <Text p={3} color="gray.500">
                  No matches
                </Text>
              ) : (
                filtered.map((opt, i) => {
                  const s = typeof opt.score === 'number' ? opt.score : null;
                  const color =
                    s == null
                      ? 'gray'
                      : s >= 9
                      ? 'green'
                      : s >= 8
                      ? 'teal'
                      : s >= 7
                      ? 'blue'
                      : s >= 6
                      ? 'yellow'
                      : s >= 4
                      ? 'orange'
                      : 'red';
                  return (
                    <Tooltip
                      key={`${opt.id}-${opt.value}`}
                      placement="right"
                      hasArrow
                      label={renderParts(opt.parts)}
                      openDelay={200}
                    >
                        <Box
                          onMouseEnter={() => setActiveIndex(i)}
                          onMouseDown={(e) => {
                            e.preventDefault();     // don't let it steal focus / trigger extra click
                            e.stopPropagation();    // don't let it reach outside-click handlers
                            commit(opt.label, opt.id);
                          }}
                          px={3}
                          py={2}
                          _hover={{ bg: highlight }}
                          bg={i === activeIndex ? highlight : 'transparent'}
                          cursor="pointer"
                        >

                        <HStack justify="space-between" align="center" w="full">
                          <VStack align="start" spacing={0} flex="1">
                            <Text noOfLines={1}>{opt.label}</Text>
                            {opt.dept && (
                              <Text
                                color="gray.500"
                                fontSize="xs"
                                noOfLines={1}
                              >
                                {opt.dept}
                              </Text>
                            )}
                          </VStack>
                          {s != null && (
                            <Badge colorScheme={color} variant="subtle">
                              {s.toFixed(2)}
                            </Badge>
                          )}
                        </HStack>
                      </Box>
                    </Tooltip>
                  );
                })
              )}
            </Box>
          </VStack>
        </Box>
      )}
    </Box>
  );
}
