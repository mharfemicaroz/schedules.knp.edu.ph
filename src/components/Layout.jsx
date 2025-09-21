import React from 'react';
import { Box, Flex, useColorMode, IconButton, useColorModeValue, HStack, Text, Image, Drawer, DrawerOverlay, DrawerContent, DrawerCloseButton, DrawerBody, useDisclosure } from '@chakra-ui/react';
import Sidebar from './Sidebar';
import { FiMoon, FiSun, FiMenu, FiSidebar } from 'react-icons/fi';
import LoaderOverlay from './LoaderOverlay';
import RouteProgress from './RouteProgress';
import { useData } from '../context/DataContext';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import SplashScreen from './SplashScreen';

function Topbar({ onOpenMenu, onToggleSidebar }) {
  const { colorMode, toggleColorMode } = useColorMode();
  const bg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  return (
    <Flex as="header" align="center" justify="space-between" px={4} py={3} bg={bg} borderBottomWidth="1px" borderColor={border} position="sticky" top={0} zIndex={10} className="glass">
      <HStack spacing={3} align="center">
        <IconButton aria-label="Open menu" display={{ base: 'inline-flex', md: 'none' }} icon={<FiMenu />} variant="ghost" onClick={onOpenMenu} />
        <Image src="/logo.png" alt="Logo" boxSize={{ base: '24px', md: '28px' }} rounded="md" />
        <Box>
          <Text fontWeight="800" fontSize={{ base: 'sm', md: 'md' }} noOfLines={1}>
            Faculty Loading SY 2025-2026, 1st Semester
          </Text>
          <Text fontSize="xs" color={useColorModeValue('gray.600','gray.400')} display={{ base: 'none', md: 'block' }}>Office of the Vice President of Academic Affairs</Text>
        </Box>
      </HStack>
      <HStack>
        <IconButton aria-label="Toggle sidebar" display={{ base: 'none', md: 'inline-flex' }} icon={<FiSidebar />} variant="ghost" onClick={onToggleSidebar} />
        <IconButton aria-label="Toggle color mode" onClick={toggleColorMode} icon={colorMode === 'light' ? <FiMoon /> : <FiSun />} variant="ghost" />
      </HStack>
    </Flex>
  );
}

export default function Layout({ children }) {
  const bg = useColorModeValue('gray.50', 'gray.900');
  const footerColor = useColorModeValue('gray.600','gray.400');
  const { loading } = useData();
  const loc = useLocation();
  const [routeBusy, setRouteBusy] = React.useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [sidebarVisible, setSidebarVisible] = React.useState(true);
  const [showSplash, setShowSplash] = React.useState(true);
  const splashStartRef = React.useRef(Date.now());
  const minSplash = 1000; // ms
  React.useEffect(() => {
    setRouteBusy(true);
    const t = setTimeout(() => setRouteBusy(false), 350);
    return () => clearTimeout(t);
  }, [loc.pathname]);
  React.useEffect(() => {
    if (!loading) {
      const elapsed = Date.now() - splashStartRef.current;
      const wait = Math.max(0, minSplash - elapsed);
      const t = setTimeout(() => setShowSplash(false), wait);
      return () => clearTimeout(t);
    }
  }, [loading]);
  // Avoid early-return to keep hook order consistent
  const splash = showSplash;
  return (
    <Flex minH="100vh" bg={bg}>
      <RouteProgress />
      <AnimatePresence initial={false}>
        <Box
          as={motion.aside}
          display={{ base: 'none', md: 'block' }}
          // Keep a standard width when open; collapse fully when closed
          style={{ width: sidebarVisible ? 280 : 0 }}
          h="100vh"
          initial={{ x: -280, opacity: 0 }}
          animate={{ x: sidebarVisible ? 0 : -280, opacity: sidebarVisible ? 1 : 0 }}
          exit={{ x: -280, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22, bounce: 0.3 }}
          overflow="hidden"
        >
          <Sidebar />
        </Box>
      </AnimatePresence>
      <Box flex="1">
        <Topbar onOpenMenu={onOpen} onToggleSidebar={() => setSidebarVisible(v => !v)} />
        <Drawer isOpen={isOpen} placement="left" onClose={onClose} size="xs">
          <DrawerOverlay />
          <DrawerContent>
            <DrawerCloseButton />
            <DrawerBody px={0}>
              <Sidebar mobile onNavigate={onClose} />
            </DrawerBody>
          </DrawerContent>
        </Drawer>
        <Box as="main" px={{ base: 4, md: 6 }} py={6} maxW="1400px" mx="auto">
          {splash ? <SplashScreen /> : children}
        </Box>
        <Box as="footer" px={{ base: 4, md: 6 }} py={6} textAlign="center" color={useColorModeValue('gray.600','gray.400')}>
          © {new Date().getFullYear()} Office of the Vice President of Academic Affairs
        </Box>
      </Box>
      {(loading || routeBusy) && <LoaderOverlay label={loading ? 'Loading data…' : 'Loading view…'} />}
    </Flex>
  );
}
