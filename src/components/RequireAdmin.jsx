import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

export default function RequireAdmin({ children, extraRoles = [] }) {
  const user = useSelector(s => s.auth.user);
  const loc = useLocation();
  const role = String(user?.role || '').toLowerCase();
  const extra = Array.isArray(extraRoles) ? extraRoles.map(r => String(r || '').toLowerCase()) : [];
  const isAdmin = role === 'admin' || role === 'manager' || extra.includes(role);
  if (!isAdmin) {
    return <Navigate to="/unauthorized" replace state={{ from: loc }} />;
  }
  return children;
}
