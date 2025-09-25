import React from 'react';
import {
  Box,
  Flex,
  useColorMode,
  IconButton,
  useColorModeValue,
  HStack,
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
} from '@chakra-ui/react';
import Sidebar from './Sidebar';
import { FiMoon, FiSun, FiMenu, FiSidebar, FiLogIn, FiUser, FiKey, FiLogOut } from 'react-icons/fi';
import LoaderOverlay from './LoaderOverlay';
import RouteProgress from './RouteProgress';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import SplashScreen from './SplashScreen';
import FirstVisitModal from './FirstVisitModal';
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
        <Box as="main" px={{ base: 4, md: 6 }} py={6} maxW="1400px" mx="auto">
          {splash ? <SplashScreen /> : children}
        </Box>
        <Box as="footer" px={{ base: 4, md: 6 }} py={6} textAlign="center" color={useColorModeValue('gray.600','gray.400')}>
          Ac {new Date().getFullYear()} Office of the Vice President of Academic Affairs
        </Box>
      </Box>
      {(loading || routeBusy) && (
        <LoaderOverlay label={loading ? 'Loading data.' : 'Loading view.'} />
      )}
      <FirstVisitModal />
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
