import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
import { getUserDepartmentsByUserThunk } from '../store/userDeptThunks';

export default function RequireCourseLoadingAccess({ children }) {
  const authUser = useSelector(s => s.auth.user);
  const role = String(authUser?.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'manager';
  const dispatch = useDispatch();
  const items = useSelector(s => s.userdept.items || []);
  const [loaded, setLoaded] = React.useState(false);
  const location = useLocation();

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!authUser?.id) { if (alive) setLoaded(true); return; }
        if (!isAdmin) {
          await dispatch(getUserDepartmentsByUserThunk(authUser.id));
        }
      } catch {}
      finally { if (alive) setLoaded(true); }
    })();
    return () => { alive = false; };
  }, [dispatch, authUser?.id, isAdmin]);

  if (!authUser) return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  if (isAdmin) return children;

  // Non-admin: must have at least one mapping
  if (!loaded) return null;
  const hasMapping = Array.isArray(items) && items.length > 0;
  if (!hasMapping) return <Navigate to="/unauthorized" state={{ from: location }} replace />;

  return children;
}

