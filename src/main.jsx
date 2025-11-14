import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import { HashRouter } from 'react-router-dom';
import App from './App';
import theme from './theme';
import './index.css';
// AuthProvider removed; using Redux directly
import { Provider } from 'react-redux';
import store from './store/store';
import { setTokens as setTokensAction, setUser as setUserAction, logout as logoutAction } from './store/authSlice';
import apiService from './services/apiService';

const root = createRoot(document.getElementById('root'));

// Bootstrap auth from localStorage
try {
  const a = localStorage.getItem('auth:accessToken');
  const r = localStorage.getItem('auth:refreshToken');
  const u = localStorage.getItem('auth:user');
  if (a || r) store.dispatch(setTokensAction({ accessToken: a || null, refreshToken: r || null }));
  if (u) store.dispatch(setUserAction(JSON.parse(u)));
  apiService.setAuthToken(a);
} catch {}

// Wire up global unauthorized handler after store is ready
try {
  apiService.setUnauthorizedHandler(() => {
    try {
      localStorage.removeItem('auth:accessToken');
      localStorage.removeItem('auth:refreshToken');
      localStorage.removeItem('auth:user');
    } catch {}
    try {
      store.dispatch(setTokensAction({ accessToken: null, refreshToken: null }));
      store.dispatch(setUserAction(null));
      store.dispatch(logoutAction());
    } catch {}
  });
} catch {}

root.render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <Provider store={store}>
          <HashRouter>
            <App />
          </HashRouter>
      </Provider>
    </ChakraProvider>
  </React.StrictMode>
);
