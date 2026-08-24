/**
 * Token and session persistence.
 *
 * A separate module so both axiosInstance (which reads the token to sign
 * requests) and AuthContext (which writes it on login) can share it without
 * importing each other and creating a cycle.
 *
 * WHY localStorage — and the honest trade-off:
 *
 * localStorage is readable by any JavaScript running on the page, so a
 * cross-site-scripting bug would expose the token. The more secure option is an
 * httpOnly cookie, which JavaScript cannot read at all, but that needs CSRF
 * protection and server-side cookie handling.
 *
 * For this MVP: localStorage. It survives reload (a requirement), it is simple,
 * and the step instructions asked not to over-engineer token handling. The
 * project docs specify no storage strategy either way. This is the file to
 * change if the app later moves to httpOnly cookies — nothing else reads
 * storage directly.
 */

const TOKEN_KEY = 'skillbridge.token';
const USER_KEY = 'skillbridge.user';

/**
 * Storage access is wrapped because it genuinely throws in the wild: Safari
 * private mode, disabled cookies, or a full quota. Auth should degrade to
 * "logged out" rather than crash the whole app on boot.
 */
const safeGet = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const safeRemove = (key) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* nothing useful to do */
  }
};

export const getToken = () => safeGet(TOKEN_KEY);
export const setToken = (token) => safeSet(TOKEN_KEY, token);

/**
 * Caches the user so a reload can render the correct dashboard immediately
 * instead of flashing a spinner while /auth/me resolves.
 *
 * This cache is a rendering hint, not a source of truth — it is user-editable
 * like anything in localStorage. AuthContext always revalidates against
 * /auth/me, and every protected API call is authorised server-side, so editing
 * it grants nothing.
 */
export const getStoredUser = () => {
  const raw = safeGet(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    safeRemove(USER_KEY); // corrupt entry — drop it
    return null;
  }
};

export const setStoredUser = (user) => safeSet(USER_KEY, JSON.stringify(user));

export const clearSession = () => {
  safeRemove(TOKEN_KEY);
  safeRemove(USER_KEY);
};

export default { getToken, setToken, getStoredUser, setStoredUser, clearSession };
