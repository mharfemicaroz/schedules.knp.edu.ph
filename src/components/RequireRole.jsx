import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

export default function RequireRole({ roles = [], children }) {
  const user = useSelector(s => s.auth.user);
  const loc = useLocation();
  const role = String(user?.role || '').toLowerCase();
  const allowed = roles.map(r => String(r || '').toLowerCase());
  if (!user || (allowed.length && !allowed.includes(role))) {
    return <Navigate to="/unauthorized" replace state={{ from: loc }} />;
  }
  return children;
}

