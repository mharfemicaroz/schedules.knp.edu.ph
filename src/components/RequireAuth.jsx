import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

export default function RequireAuth({ children }) {
  const user = useSelector(s => s.auth.user);
  const loc = useLocation();
  if (!user) {
    return <Navigate to="/unauthorized" replace state={{ from: loc }} />;
  }
  return children;
}

