import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useToast } from '@chakra-ui/react';
import { clearError, clearToast } from '../store/uiSlice';

export default function GlobalToaster() {
  const toast = useToast();
  const dispatch = useDispatch();
  const lastError = useSelector(s => s.ui.lastError);
  const lastToast = useSelector(s => s.ui.lastToast);

  useEffect(() => {
    if (lastError?.message) {
      toast({ status: 'error', title: 'Error', description: lastError.message });
      dispatch(clearError());
    }
  }, [lastError, toast, dispatch]);

  useEffect(() => {
    if (lastToast?.status) {
      toast({ status: lastToast.status, title: lastToast.title, description: lastToast.description });
      dispatch(clearToast());
    }
  }, [lastToast, toast, dispatch]);

  return null;
}
