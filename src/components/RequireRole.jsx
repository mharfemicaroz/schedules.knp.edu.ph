import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
import { selectUserDeptItems } from '../store/userDeptSlice';

export default function RequireRole({ roles = [], allowDeptMapping = false, children }) {
  const user = useSelector(s => s.auth.user);
  const userDeptItems = useSelector(selectUserDeptItems);
  const loc = useLocation();
  const role = String(user?.role || '').toLowerCase();
  const allowed = roles.map(r => String(r || '').toLowerCase());
  const hasDeptMapping = allowDeptMapping && Array.isArray(userDeptItems) && userDeptItems.length > 0;
  const roleAllowed = allowed.length === 0 || allowed.includes(role);
  const canPass = !!user && (roleAllowed || hasDeptMapping);
  if (!canPass) {
    return <Navigate to="/unauthorized" replace state={{ from: loc }} />;
  }
  return children;
}
