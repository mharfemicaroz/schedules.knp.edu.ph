import React from 'react';
import { HStack, Wrap, WrapItem, Tag, TagLabel, Button, IconButton, useColorModeValue } from '@chakra-ui/react';
import { FiX } from 'react-icons/fi';

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export default function DayMultiSelect({ value = [], onChange, size = 'sm', showClear = true }) {
  const selected = new Set((Array.isArray(value) ? value : []).filter(Boolean));
  const onToggle = (d) => {
    const next = new Set(selected);
    if (next.has(d)) next.delete(d); else next.add(d);
    onChange?.(Array.from(DAYS.filter(x => next.has(x))));
  };
  const onClear = () => onChange?.([]);
  const tagColor = useColorModeValue('gray.100','whiteAlpha.200');

  return (
    <HStack justify="space-between" align="start">
      <Wrap spacing={2}>
        {DAYS.map(d => (
          <WrapItem key={d}>
            <Tag
              size={size}
              variant={selected.has(d) ? 'solid' : 'subtle'}
              colorScheme={selected.has(d) ? 'blue' : 'gray'}
              cursor="pointer"
              onClick={() => onToggle(d)}
            >
              <TagLabel>{d}</TagLabel>
            </Tag>
          </WrapItem>
        ))}
      </Wrap>
      {showClear && (
        <IconButton
          aria-label="Clear days"
          icon={<FiX />}
          size={size}
          variant="ghost"
          onClick={onClear}
        />
      )}
    </HStack>
  );
}

