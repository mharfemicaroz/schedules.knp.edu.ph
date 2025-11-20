import { createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/apiService';

export const loadUserDeptOptionsThunk = createAsyncThunk('userdept/loadOptions', async () => {
  return await api.getUserDeptOptions();
});

export const listUserDepartmentsThunk = createAsyncThunk('userdept/list', async (filters = {}) => {
  return await api.listUserDepartments(filters);
});

export const getUserDepartmentsByUserThunk = createAsyncThunk('userdept/byUser', async (userId) => {
  return await api.getUserDepartmentsByUser(userId);
});

export const createUserDepartmentThunk = createAsyncThunk('userdept/create', async (payload) => {
  return await api.createUserDepartment(payload);
});

export const updateUserDepartmentThunk = createAsyncThunk('userdept/update', async ({ id, changes }) => {
  const row = await api.updateUserDepartment(id, changes);
  return { id, row };
});

export const deleteUserDepartmentThunk = createAsyncThunk('userdept/delete', async (id) => {
  await api.deleteUserDepartment(id);
  return { id };
});

