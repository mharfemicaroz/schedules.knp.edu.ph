import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import FacultyDetail from './FacultyDetail';
import FacultyPublicCode from './FacultyPublicCode';

const CODE_RE = /^[a-z0-9]{6}$/i;

export default function FacultyAccess() {
  const { id } = useParams();
  const authUser = useSelector(s => s.auth.user);
  const code = String(id || '').trim();

  if (CODE_RE.test(code)) return <FacultyPublicCode />;
  if (authUser) return <FacultyDetail />;
  return <Navigate to="/unauthorized" replace />;
}
