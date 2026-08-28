/** Session state, shared across the app and restored on every page load. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [context, setContext] = useState({});
  const [status, setStatus] = useState('loading'); // loading | signed-in | signed-out

  const applySession = useCallback((data) => {
    const { user: nextUser, ...rest } = data || {};
    setUser(nextUser || null);
    setContext(rest || {});
    setStatus(nextUser ? 'signed-in' : 'signed-out');
  }, []);

  // Restore on mount. A failure here means signed out, not an app-level error.
  useEffect(() => {
    let canceled = false;
    api.session()
      .then((data) => { if (!canceled) applySession(data); })
      .catch(() => { if (!canceled) applySession(null); });
    return () => { canceled = true; };
  }, [applySession]);

  const signIn = useCallback(async (identifier, secret) => {
    const data = await api.login(identifier, secret);
    applySession(data);
    return data.user;
  }, [applySession]);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      applySession(null);
    }
  }, [applySession]);

  /** Re-fetch after a change that alters what the session can see. */
  const refresh = useCallback(async () => {
    try {
      applySession(await api.session());
    } catch {
      applySession(null);
    }
  }, [applySession]);

  const value = useMemo(() => ({
    user,
    role: user?.role || null,
    classes: context.classes || [],
    children: context.children || [],
    status,
    isLoading: status === 'loading',
    isSignedIn: status === 'signed-in',
    signIn,
    signOut,
    refresh,
    setUser,
  }), [user, context, status, signIn, signOut, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}

/** Where each role lands after signing in. */
export const HOME_FOR_ROLE = {
  admin: '/admin',
  teacher: '/teacher',
  parent: '/family',
};
