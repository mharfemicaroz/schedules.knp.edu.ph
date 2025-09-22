import React, { createContext, useContext, useEffect, useState } from 'react';

const VisitorContext = createContext();

export function VisitorProvider({ children }) {
  const [visitorRole, setVisitorRole] = useState(null);
  const [visitorLoading, setVisitorLoading] = useState(false);

  // Function to fetch visitor role from server
  const fetchVisitorRole = async () => {
    try {
      setVisitorLoading(true);
      const clientIp = await fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => data.ip)
        .catch(() => null);

      if (!clientIp) {
        setVisitorLoading(false);
        return;
      }

      const apiBase = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
      const visitorPath = import.meta.env.VITE_VISITOR_PATH || '/visitor';
      const url = `${apiBase}${visitorPath}?ip=${encodeURIComponent(clientIp)}`;

      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const visitorData = await response.json();
      if (visitorData.exists) {
        // Since we can't directly get role from the check endpoint,
        // we'll need to implement a new endpoint or use localStorage approach
        // For now, we'll check if visitor info was submitted
        const localSeen = localStorage.getItem('visit_info_submitted');
        if (localSeen === '1') {
          // Try to get role from localStorage if stored there
          const storedRole = localStorage.getItem('visitor_role');
          if (storedRole) {
            setVisitorRole(storedRole);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch visitor role:', error);
    } finally {
      setVisitorLoading(false);
    }
  };

  // Function to update visitor role (called after form submission)
  const updateVisitorRole = (role) => {
    setVisitorRole(role);
    localStorage.setItem('visitor_role', role);
  };

  // Load visitor role on mount
  useEffect(() => {
    const localSeen = localStorage.getItem('visit_info_submitted');
    if (localSeen === '1') {
      const storedRole = localStorage.getItem('visitor_role');
      if (storedRole) {
        setVisitorRole(storedRole);
      } else {
        // Try to fetch from server
        fetchVisitorRole();
      }
    }
  }, []);

  const value = {
    visitorRole,
    visitorLoading,
    fetchVisitorRole,
    updateVisitorRole,
  };

  return (
    <VisitorContext.Provider value={value}>{children}</VisitorContext.Provider>
  );
}

export function useVisitor() {
  const ctx = useContext(VisitorContext);
  if (!ctx) throw new Error('useVisitor must be used within VisitorProvider');
  return ctx;
}
