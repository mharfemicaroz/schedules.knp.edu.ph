import React from 'react';
import { useSelector } from 'react-redux';
import { selectSettings } from '../store/settingsSlice';
import apiService from '../services/apiService';

export default function useEvaluationEnabled() {
  const settings = useSelector(selectSettings);
  const hasSettings = settings && settings.updatedAt != null;
  const storeVal = hasSettings ? settings?.evaluationsEnabled : undefined;
  const [enabled, setEnabled] = React.useState(typeof storeVal === 'boolean' ? storeVal : true);
  const [loading, setLoading] = React.useState(typeof storeVal !== 'boolean');

  React.useEffect(() => {
    let mounted = true;
    if (typeof storeVal === 'boolean') {
      setEnabled(storeVal);
      setLoading(false);
      return () => { mounted = false; };
    }
    (async () => {
      try {
        const res = await apiService.getPublicSettings();
        const val = res?.evaluationsEnabled;
        if (mounted) setEnabled(val === false ? false : true);
      } catch {
        if (mounted) setEnabled(true);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [storeVal]);

  return { enabled, loading };
}
