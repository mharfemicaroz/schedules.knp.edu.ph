import React from 'react';
import { SimpleGrid } from '@chakra-ui/react';
import { FiActivity, FiDatabase, FiRefreshCcw } from 'react-icons/fi';
import StatCard from './StatCard';

export default function MeetSummaryCards({ totalLive, totalEvents, lastRefreshLabel }) {
  return (
    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} w="full">
      <StatCard icon={FiActivity} label="Live meetings" value={totalLive} accent="green" />
      <StatCard icon={FiDatabase} label="Events fetched" value={totalEvents} accent="blue" />
      <StatCard icon={FiRefreshCcw} label="Last refresh" value={lastRefreshLabel} accent="purple" />
    </SimpleGrid>
  );
}

