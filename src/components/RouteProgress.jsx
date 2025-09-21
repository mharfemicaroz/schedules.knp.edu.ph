import React from 'react';
import { Box, useColorModeValue } from '@chakra-ui/react';
import { useLocation } from 'react-router-dom';

export default function RouteProgress({ minDuration = 400 }) {
  const [active, setActive] = React.useState(false);
  const loc = useLocation();
  const bg = useColorModeValue('linear-gradient(90deg, #74c0fc, #1864ab)', 'linear-gradient(90deg, #74c0fc, #4dabf7)');

  React.useEffect(() => {
    setActive(true);
    const t = setTimeout(() => setActive(false), minDuration);
    return () => clearTimeout(t);
  }, [loc.pathname, minDuration]);

  if (!active) return null;
  return (
    <Box position="fixed" top={0} left={0} right={0} height="3px" zIndex={1200} bg="transparent">
      <Box height="100%" w="40%" bgGradient={bg} className="loader-bar" />
    </Box>
  );
}

