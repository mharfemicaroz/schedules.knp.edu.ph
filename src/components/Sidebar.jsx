import React from 'react';
import { Box, VStack, Text, useColorModeValue, HStack, Icon, Image } from '@chakra-ui/react';
import { NavLink, useLocation } from 'react-router-dom';
import { FiGrid, FiLayers, FiMapPin, FiSun } from 'react-icons/fi';

function NavItem({ to, icon, children, onClick }) {
  const { pathname } = useLocation();
  const active = pathname === to;
  const color = useColorModeValue(active ? 'brand.700' : 'gray.600', active ? 'brand.200' : 'gray.300');
  const bg = useColorModeValue(active ? 'brand.50' : 'transparent', active ? 'whiteAlpha.200' : 'transparent');
  return (
    <HStack as={NavLink} to={to} spacing={3} px={3} py={2} rounded="md" cursor="pointer" _hover={{ bg: useColorModeValue('gray.100','whiteAlpha.100') }} bg={bg} color={color} w="full" style={{ textDecoration: 'none' }} onClick={onClick}>
      <Icon as={icon} />
      <Text fontWeight={active ? '700' : '500'}>{children}</Text>
    </HStack>
  );
}

export default function Sidebar({ mobile = false, onNavigate }) {
  const bg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  return (
    <Box as="nav" w={mobile ? '100%' : { base: '60px', md: '280px' }} h={mobile ? 'auto' : '100vh'} display={mobile ? 'block' : { base: 'none', md: 'block' }} borderRightWidth={mobile ? '0' : '1px'} borderColor={border} bg={bg} px={4} py={6}>
      <VStack align="stretch" spacing={2}>
        <HStack px={2} mb={4} spacing={3}>
          <Image src="/logo.png" alt="Logo" boxSize="28px" rounded="md" />
          <Text fontWeight="800" fontSize="sm">Kolehiyo ng Pantukan</Text>
        </HStack>
        <Text fontSize="sm" fontWeight="700" color={useColorModeValue('gray.700','gray.300')} px={2} mb={1}>Overview</Text>
        <NavItem to="/" icon={FiGrid} onClick={onNavigate}>Dashboard</NavItem>
        <Text fontSize="sm" fontWeight="700" color={useColorModeValue('gray.700','gray.300')} px={2} mt={4} mb={1}>Views</Text>
        <NavItem to="/views/departments" icon={FiLayers} onClick={onNavigate}>By Department</NavItem>
        <NavItem to="/views/rooms" icon={FiMapPin} onClick={onNavigate}>By Rooms</NavItem>
        <NavItem to="/views/session" icon={FiSun} onClick={onNavigate}>By Session</NavItem>
      </VStack>
    </Box>
  );
}
