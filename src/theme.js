import { extendTheme, theme as base } from '@chakra-ui/react';

const colors = {
  brand: {
    50: '#e7f5ff',
    100: '#d0ebff',
    200: '#a5d8ff',
    300: '#74c0fc',
    400: '#4dabf7',
    500: '#339af0',
    600: '#228be6',
    700: '#1c7ed6',
    800: '#1971c2',
    900: '#1864ab',
  },
};

const components = {
  Button: {
    baseStyle: {
      rounded: 'md',
      fontWeight: '600',
    },
  },
  Card: {
    baseStyle: {
      container: {
        rounded: 'xl',
        shadow: 'sm',
      },
    },
  },
};

const config = {
  initialColorMode: 'system',
  useSystemColorMode: true,
};

const fonts = {
  heading: `Inter, ${base.fonts?.heading}`,
  body: `Inter, ${base.fonts?.body}`,
};

const theme = extendTheme({ colors, components, config, fonts });
export default theme;

