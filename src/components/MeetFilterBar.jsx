import React from 'react';
import {
  Box,
  HStack,
  VStack,
  Text,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Button,
  ButtonGroup,
  Switch,
  FormControl,
  FormLabel,
  Badge,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiRefreshCw, FiSearch } from 'react-icons/fi';

export default function MeetFilterBar({
  orgUnit,
  onOrgUnitChange,
  orgUnitOptions,
  isCustomOrgUnit,
  customOrgUnit,
  onCustomOrgUnitChange,
  windowPreset,
  onWindowPresetChange,
  fromValue,
  toValue,
  onFromChange,
  onToChange,
  status,
  onStatusChange,
  search,
  onSearchChange,
  showUnique,
  onShowUniqueChange,
  autoRefresh,
  onAutoRefreshChange,
  refreshInterval,
  onRefreshIntervalChange,
  onRefresh,
  isRefreshing,
  isStale,
}) {
  const border = useColorModeValue('gray.200', 'gray.700');
  const bg = useColorModeValue('white', 'gray.800');
  const subtle = useColorModeValue('gray.600', 'gray.400');

  return (
    <Box borderWidth="1px" borderColor={border} rounded="xl" bg={bg} p={4} w="full">
      <VStack align="stretch" spacing={4}>
        <HStack justify="space-between" spacing={4} flexWrap="wrap">
          <HStack spacing={3} flexWrap="wrap">
            <Box>
              <Text fontSize="xs" color={subtle} mb={1}>Org Unit</Text>
              <Select size="sm" value={orgUnit} onChange={(e) => onOrgUnitChange(e.target.value)} w={{ base: '220px', md: '240px' }}>
                {orgUnitOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </Box>
            {isCustomOrgUnit && (
              <Box>
                <Text fontSize="xs" color={subtle} mb={1}>Custom path</Text>
                <Input size="sm" placeholder="/Faculty/Science" value={customOrgUnit} onChange={(e) => onCustomOrgUnitChange(e.target.value)} />
              </Box>
            )}
            <Box>
              <Text fontSize="xs" color={subtle} mb={1}>Time window</Text>
              <Select size="sm" value={windowPreset} onChange={(e) => onWindowPresetChange(e.target.value)} w={{ base: '160px', md: '180px' }}>
                <option value="1">Last 1 hour</option>
                <option value="2">Last 2 hours</option>
                <option value="4">Last 4 hours</option>
                <option value="8">Last 8 hours</option>
                <option value="168">Last 7 days</option>
                <option value="custom">Custom</option>
              </Select>
            </Box>
            {windowPreset === 'custom' && (
              <HStack spacing={2} flexWrap="wrap">
                <Box>
                  <Text fontSize="xs" color={subtle} mb={1}>From</Text>
                  <Input size="sm" type="datetime-local" value={fromValue} onChange={(e) => onFromChange(e.target.value)} />
                </Box>
                <Box>
                  <Text fontSize="xs" color={subtle} mb={1}>To</Text>
                  <Input size="sm" type="datetime-local" value={toValue} onChange={(e) => onToChange(e.target.value)} />
                </Box>
              </HStack>
            )}
          </HStack>
          <HStack spacing={3} flexWrap="wrap">
            <ButtonGroup isAttached size="sm" variant="outline">
              <Button onClick={() => onStatusChange('live')} variant={status === 'live' ? 'solid' : 'outline'} colorScheme="green">Live</Button>
              <Button onClick={() => onStatusChange('all')} variant={status === 'all' ? 'solid' : 'outline'} colorScheme="gray">All</Button>
            </ButtonGroup>
            <Button size="sm" leftIcon={<FiRefreshCw />} onClick={onRefresh} isLoading={isRefreshing}>Refresh</Button>
          </HStack>
        </HStack>

        <HStack justify="space-between" spacing={4} flexWrap="wrap">
          <HStack spacing={2} flexWrap="wrap">
            <InputGroup size="sm" maxW={{ base: '100%', md: '360px' }}>
              <InputLeftElement pointerEvents="none">
                <FiSearch />
              </InputLeftElement>
              <Input
                placeholder="Search teacher email, meeting code, conference ID"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </InputGroup>
            {isStale && (
              <Badge colorScheme="orange" rounded="full" px={3}>Stale data</Badge>
            )}
          </HStack>
          <HStack spacing={3} flexWrap="wrap">
            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="auto-refresh" mb="0" fontSize="sm">Auto refresh</FormLabel>
              <Switch id="auto-refresh" isChecked={autoRefresh} onChange={(e) => onAutoRefreshChange(e.target.checked)} />
            </FormControl>
            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="unique-meetings" mb="0" fontSize="sm">Unique meeting codes</FormLabel>
              <Switch id="unique-meetings" isChecked={showUnique} onChange={(e) => onShowUniqueChange(e.target.checked)} />
            </FormControl>
            <Select size="sm" value={refreshInterval} onChange={(e) => onRefreshIntervalChange(Number(e.target.value))} isDisabled={!autoRefresh} w="120px">
              <option value={15000}>15s</option>
              <option value={30000}>30s</option>
              <option value={60000}>60s</option>
            </Select>
          </HStack>
        </HStack>
      </VStack>
    </Box>
  );
}

