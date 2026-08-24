/**
 * Authentication state for the whole app.
 *
 * Plain React Context + useState — no Redux, no extra dependency. Auth is a
 * small, slow-changing slice of state read by many components, which is exactly
 * what Context is for.
 *
 * Deliberately knows nothing about routing. On session loss it just clears
 * state; the route guards react to that and redirect. That keeps this file
 * testable and stops navigation logic from leaking into state management.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import * as authApi from '../api/auth.api.js';
import { setUnauthorizedHandler } from '../api/axiosInstance.js';
import {
  clearSession,
  getStoredUser,
  getToken,
  setStoredUser,
  setToken,
} from '../utils/tokenStorage.js';

const AuthContext = createContext(null);

const SESSION_EXPIRED_MESSAGE = 'Your session has ended. Please log in again.';

export function AuthProvider({ children }) {
  /**
   * Seeded from storage so a reload renders the right dashboard immediately
   * instead of flashing the login page. Treated as unverified until /auth/me
   * confirms it below.
   */
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setTokenState] = useState(() => getToken());

  /**
   * True only during the initial token check. Route guards wait on this —
   * without it, the first render of a protected page would redirect to login
   * before the token had a chance to be validated.
   */
  const [isInitialising, setIsInitialising] = useState(() => Boolean(getToken()));

  /** Surfaced on the login page after an expired session, so the bounce is explained. */
  const [sessionNotice, setSessionNotice] = useState(null);

  /** Wipes local state and storage. Does not call the API. */
  const clearAuthState = useCallback(() => {
    clearSession();
    setUser(null);
    setTokenState(null);
  }, []);

  const persistSession = useCallback((nextUser, nextToken) => {
    setToken(nextToken);
    setStoredUser(nextUser);
    setTokenState(nextToken);
    setUser(nextUser);
    setSessionNotice(null);
  }, []);

  /**
   * Lets axios tell us a protected request came back 401 — expired token,
   * deleted account, or a secret rotation. Registered via a setter instead of
   * an import so the two modules do not depend on each other.
   */
  useEffect(() => {
    setUnauthorizedHandler(() => {
      // Only announce an expiry if we believed we were logged in.
      if (getToken()) setSessionNotice(SESSION_EXPIRED_MESSAGE);
      clearAuthState();
    });

    return () => setUnauthorizedHandler(null);
  }, [clearAuthState]);

  /**
   * Revalidates the stored token once on mount.
   *
   * The cached user in localStorage is user-editable, so it is a rendering hint
   * only. This call is what establishes who the token actually belongs to — and
   * it also picks up a role change or deactivation made since the token was
   * issued, because the server reads the live database record.
   */
  useEffect(() => {
    if (!getToken()) {
      setIsInitialising(false);
      return;
    }

    let isCancelled = false;

    (async () => {
      try {
        const currentUser = await authApi.fetchCurrentUser();

        if (!isCancelled) {
          setUser(currentUser);
          setStoredUser(currentUser);
        }
      } catch (error) {
        // A 401/403 has already been handled by the axios interceptor. For a
        // network error we keep the cached session rather than logging someone
        // out because their wifi dropped — every protected call is still
        // authorised server-side, so nothing is granted by staying optimistic.
        if (!isCancelled && !error?.isNetworkError && error?.status !== 401) {
          clearAuthState();
        }
      } finally {
        if (!isCancelled) setIsInitialising(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
    // Runs once: this is the boot-time check, not a reaction to state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (credentials) => {
      const { user: nextUser, token: nextToken } = await authApi.login(credentials);
      persistSession(nextUser, nextToken);
      return nextUser;
    },
    [persistSession],
  );

  const register = useCallback(
    async (payload) => {
      const { user: nextUser, token: nextToken } = await authApi.register(payload);
      persistSession(nextUser, nextToken);
      return nextUser;
    },
    [persistSession],
  );

  /**
   * Clears local state unconditionally.
   *
   * The API call is best-effort and its failure is ignored on purpose: the token
   * is stateless, so discarding it locally is what ends the session. A failed
   * network request must never leave someone stuck logged in.
   */
  const logout = useCallback(async () => {
    try {
      if (getToken()) await authApi.logout();
    } catch {
      /* ignored by design — see above */
    } finally {
      clearAuthState();
      setSessionNotice(null);
    }
  }, [clearAuthState]);

  const value = useMemo(
    () => ({
      user,
      token,
      role: user?.role ?? null,
      isAuthenticated: Boolean(token && user),
      isInitialising,
      sessionNotice,
      clearSessionNotice: () => setSessionNotice(null),
      login,
      register,
      logout,
    }),
    [user, token, isInitialising, sessionNotice, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Throws rather than returning undefined when used outside the provider — a
 * clear error at the call site beats a confusing "cannot read property of
 * undefined" three components away.
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>.');
  }

  return context;
}

export default AuthContext;
