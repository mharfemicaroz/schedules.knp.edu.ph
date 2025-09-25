import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import dataReducer from './dataSlice';
import visitorReducer from './visitorSlice';
import uiReducer, { setError, setToast } from './uiSlice';

const toastMiddleware = storeAPI => next => action => {
  const result = next(action);
  if (action && typeof action.type === 'string' && action.type.endsWith('/rejected')) {
    const message = action.error?.message || 'Operation failed';
    storeAPI.dispatch(setError({ action: action.type, message }));
  }
  // Success notifications for key actions
  if (action && typeof action.type === 'string' && action.type.endsWith('/fulfilled')) {
    const t = action.type;
    if (t.startsWith('data/updateSchedule/')) {
      storeAPI.dispatch(setToast({ status: 'success', title: 'Schedule updated' }));
    } else if (t.startsWith('data/deleteSchedule/')) {
      storeAPI.dispatch(setToast({ status: 'success', title: 'Schedule deleted' }));
    } else if (t.startsWith('auth/login/')) {
      storeAPI.dispatch(setToast({ status: 'success', title: 'Signed in' }));
    } else if (t.startsWith('auth/changePassword/')) {
      storeAPI.dispatch(setToast({ status: 'success', title: 'Password updated' }));
    } else if (t.startsWith('auth/updateProfile/')) {
      storeAPI.dispatch(setToast({ status: 'success', title: 'Profile updated' }));
    }
  }
  return result;
};

const store = configureStore({
  reducer: {
    auth: authReducer,
    data: dataReducer,
    visitor: visitorReducer,
    ui: uiReducer,
  },
  middleware: (getDefault) => getDefault().concat(toastMiddleware),
});

export default store;
