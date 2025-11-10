import { createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../services/apiService';

export const loadSettingsThunk = createAsyncThunk('settings/load', async () => {
  const res = await apiService.getSettings();
  return res;
});

export const updateSettingsThunk = createAsyncThunk('settings/update', async (patch) => {
  const res = await apiService.updateSettings(patch || {});
  return res;
});

