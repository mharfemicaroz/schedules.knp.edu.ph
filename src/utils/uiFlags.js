import { useLocation } from 'react-router-dom';

export function usePublicView() {
  const loc = useLocation();
  const path = String(loc?.pathname || '');
  return /^\/share\//.test(path) || /^\/views\/rooms\/[^/]+\/auto$/.test(path);
}

