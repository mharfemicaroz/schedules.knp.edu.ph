import React from 'react';
import {
  Box,
  Flex,
  useColorMode,
  IconButton,
  useColorModeValue,
  HStack,
  VStack,
  Text,
  Image,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  DrawerBody,
  useDisclosure,
  Button,
  Avatar,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  SimpleGrid,
  Tag,
  TagLabel,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import Sidebar from './Sidebar';
import { FiMoon, FiSun, FiMenu, FiSidebar, FiLogIn, FiUser, FiKey, FiLogOut } from 'react-icons/fi';
import LoaderOverlay from './LoaderOverlay';
import RouteProgress from './RouteProgress';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import SplashScreen from './SplashScreen';
import LoginModal from './LoginModal';
import ChangePasswordModal from './ChangePasswordModal';
import ProfileModal from './ProfileModal';
import { Badge } from '@chakra-ui/react';
import { loginThunk, changePasswordThunk, updateProfileThunk } from '../store/authThunks';
import { logout as logoutAction } from '../store/authSlice';

function Topbar({ onOpenMenu, onToggleSidebar, onOpenLogin, onLogout, authUser, onOpenChangePwd, onOpenProfile }) {
  const { colorMode, toggleColorMode } = useColorMode();
  const bg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  return (
    <Flex
      as="header"
      align="center"
      justify="space-between"
      px={4}
      py={3}
      bg={bg}
      borderBottomWidth="1px"
      borderColor={border}
      position="sticky"
      top={0}
      zIndex={10}
      className="glass"
    >
      <HStack spacing={3} align="center">
        <IconButton
          aria-label="Open menu"
          display={{ base: 'inline-flex', md: 'none' }}
          icon={<FiMenu />}
          variant="ghost"
          onClick={onOpenMenu}
        />
        <Image src="/logo.png" alt="Logo" boxSize={{ base: '24px', md: '28px' }} rounded="md" />
        <Box>
          <Text fontWeight="800" fontSize={{ base: 'sm', md: 'md' }} noOfLines={1}>
            Faculty Loading SY 2025-2026, 1st Semester
          </Text>
          <Text fontSize="xs" color={useColorModeValue('gray.600','gray.400')} display={{ base: 'none', md: 'block' }}>
            Office of the Vice President of Academic Affairs
          </Text>
        </Box>
      </HStack>
      <HStack>
        <IconButton
          aria-label="Toggle sidebar"
          display={{ base: 'none', md: 'inline-flex' }}
          icon={<FiSidebar />}
          variant="ghost"
          onClick={onToggleSidebar}
        />
        <IconButton
          aria-label="Toggle color mode"
          onClick={toggleColorMode}
          icon={colorMode === 'light' ? <FiMoon /> : <FiSun />}
          variant="ghost"
        />
        {authUser ? (
          <Menu>
            <MenuButton as={Button} variant="ghost" px={2}>
              <HStack>
                <Avatar size="sm" name={authUser.first_name ? `${authUser.first_name} ${authUser.last_name||''}` : (authUser.username || authUser.email)} src={authUser.avatar || undefined} />
                <Text display={{ base: 'none', md: 'block' }} fontSize="sm">{authUser.username || authUser.email}</Text>
              </HStack>
            </MenuButton>
            <MenuList>
              <MenuItem icon={<FiUser />} onClick={onOpenProfile}>Profile</MenuItem>
              <MenuItem icon={<FiKey />} onClick={onOpenChangePwd}>Change Password</MenuItem>
              <MenuDivider />
              <MenuItem icon={<FiLogOut />} onClick={onLogout}>Logout</MenuItem>
            </MenuList>
          </Menu>
        ) : (
          <Button leftIcon={<FiLogIn />} size="sm" colorScheme="blue" onClick={onOpenLogin}>Login</Button>
        )}
      </HStack>
    </Flex>
  );
}

export default function Layout({ children }) {
  const bg = useColorModeValue('gray.50', 'gray.900');
  const loading = useSelector(s => s.data.loading);
  const loc = useLocation();
  const [routeBusy, setRouteBusy] = React.useState(false);
  const menuDisc = useDisclosure();
  const loginDisc = useDisclosure();
  const changePwdDisc = useDisclosure();
  const profileDisc = useDisclosure();
  const dispatch = useDispatch();
  const user = useSelector(s => s.auth.user);
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

  const splash = showSplash;
  const isPublicRoomAuto = /^\/views\/rooms\/[^/]+\/auto$/.test(loc.pathname || '');
  const isSharePublic = /^\/share\//.test(loc.pathname || '');

  if (isPublicRoomAuto || isSharePublic) {
    // Public-facing view without app chrome (sidebar/topbar/footer)
    if (isSharePublic) {
      // Document-style wrapper for shared pages (PDF-like preview)
      const paperBg = useColorModeValue('white', 'gray.800');
      const frameBg = useColorModeValue('gray.100', 'gray.900');
      return (
        <Box bg={frameBg} minH="100vh" px={{ base: 3, md: 6 }} py={{ base: 4, md: 8 }}>
          <Box
            as="main"
            maxW="1100px"
            mx="auto"
            bg={paperBg}
            borderWidth="1px"
            borderColor={useColorModeValue('gray.200','gray.700')}
            rounded={{ base: 'lg', md: 'xl' }}
            boxShadow={{ base: 'md', md: 'xl' }}
            px={{ base: 0, md: 0 }}
            py={{ base: 0, md: 0 }}
          >
            {/* Header band with logo for shared pages */}
            <Box
              bg={useColorModeValue('gray.50','gray.700')}
              borderBottomWidth="1px"
              borderColor={useColorModeValue('gray.200','gray.600')}
              px={{ base: 4, md: 6 }}
              py={{ base: 3, md: 4 }}
              roundedTop={{ base: 'lg', md: 'xl' }}
            >
              <HStack spacing={3} align="center" justify="space-between">
                <HStack spacing={3} align="center">
                  <Image src="/logo.png" alt="Logo" boxSize={{ base: '28px', md: '36px' }} rounded="md" />
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="800" fontSize={{ base: 'sm', md: 'md' }}>Kolehiyo ng Pantukan</Text>
                    <Text fontSize={{ base: 'xs', md: 'sm' }} color={useColorModeValue('gray.700','gray.200')}>Office of the Vice President of Academic Affairs</Text>
                    <Text fontSize={{ base: 'xs', md: 'xs' }} color={useColorModeValue('gray.600','gray.300')}>Shared View</Text>
                  </VStack>
                </HStack>
              </HStack>
            </Box>
            {/* Body */}
            <Box px={{ base: 4, md: 6 }} py={{ base: 5, md: 8 }}>
              {splash ? <SplashScreen /> : children}
            </Box>
          </Box>
        </Box>
      );
    }
    return (
      <Box bg={bg} minH="100vh">
        <Box as="main" px={{ base: 0, md: 0 }} py={0} maxW="100%" mx="auto">
          {splash ? <SplashScreen /> : children}
        </Box>
      </Box>
    );
  }

  return (
    <Flex minH="100vh" align="stretch" bg={bg}>
      <RouteProgress />
      <AnimatePresence initial={false}>
        <Box
          as={motion.aside}
          display={{ base: 'none', md: 'block' }}
          style={{ width: sidebarVisible ? 280 : 0 }}
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
        <Topbar
          onOpenMenu={menuDisc.onOpen}
          onToggleSidebar={() => setSidebarVisible(v => !v)}
          onOpenLogin={loginDisc.onOpen}
          onLogout={() => dispatch(logoutAction())}
          authUser={user}
          onOpenChangePwd={changePwdDisc.onOpen}
          onOpenProfile={profileDisc.onOpen}
        />
        <Drawer isOpen={menuDisc.isOpen} placement="left" onClose={menuDisc.onClose} size="xs">
          <DrawerOverlay />
          <DrawerContent>
            <DrawerCloseButton />
            <DrawerBody px={0}>
              <Sidebar mobile onNavigate={menuDisc.onClose} />
            </DrawerBody>
          </DrawerContent>
        </Drawer>
        <Box as="main" px={{ base: 2, md: 3 }} py={3} maxW="100%" mx="auto">
          {splash ? <SplashScreen /> : children}
        </Box>
        <Box as="footer" borderTopWidth="1px" borderColor={useColorModeValue('gray.200','gray.700')} px={{ base: 2, md: 3 }} py={3} bg={useColorModeValue('white','gray.800')}>
          <VStack spacing={1} align="center">
            <Text fontSize="sm" fontWeight="700" color={useColorModeValue('gray.700','gray.200')}>Kolehiyo ng Pantukan</Text>
            <Text fontSize="xs" color={useColorModeValue('gray.600','gray.400')}>Office of the Vice President of Academic Affairs</Text>
            <Text fontSize="xs" color={useColorModeValue('gray.500','gray.500')}>© {new Date().getFullYear()}</Text>
          </VStack>
        </Box>
      </Box>
      {(loading || routeBusy) && (
        <LoaderOverlay label={loading ? 'Loading data.' : 'Loading view.'} />
      )}
      <LoginModal
        isOpen={loginDisc.isOpen}
        onClose={loginDisc.onClose}
        onSubmit={async ({ username, password }) => {
          try {
            await dispatch(loginThunk({ identifier: username, password })).unwrap();
            loginDisc.onClose();
          } catch (e) {
            // Global toaster handles errors
          }
        }}
      />
      <ChangePasswordModal
        isOpen={changePwdDisc.isOpen}
        onClose={changePwdDisc.onClose}
        onSubmit={async ({ old_password, new_password }) => {
          try {
            await dispatch(changePasswordThunk({ old_password, new_password })).unwrap();
            changePwdDisc.onClose();
            dispatch(logoutAction());
            loginDisc.onOpen();
          } catch (e) {
            // Global toaster handles errors
          }
        }}
      />
      <ProfileModal
        isOpen={profileDisc.isOpen}
        onClose={profileDisc.onClose}
        user={user}
        onSubmit={async (payload) => {
          try {
            await dispatch(updateProfileThunk(payload)).unwrap();
            profileDisc.onClose();
          } catch (e) {
            // Global toaster handles errors
          }
        }}
      />
    </Flex>
  );
}
