/**
 * useNotifications — the bell's state: a polled unread count and an on-demand feed.
 *
 * WHY POLLING, NOT SOCKETS. Step 10 §7/§15 explicitly rule out real-time infrastructure
 * "merely for appearance". The unread count is cheap (a count query, no derivation), so
 * a slow poll keeps the badge fresh without a socket. The full feed — which triggers the
 * server-side derivation — is fetched only when the user opens the dropdown, so opening
 * the bell is what materialises new notifications.
 *
 * The count query never derives, the list query does; that asymmetry is the whole reason
 * the badge can poll without cost.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api/notification.api.js';

const POLL_INTERVAL_MS = 60000;

export default function useNotifications({ pollIntervalMs = POLL_INTERVAL_MS } = {}) {
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  /** Cheap: count only, safe to run on a timer. Failures are swallowed — a badge
      that briefly shows a stale number is better than an error banner in the chrome. */
  const refreshCount = useCallback(async () => {
    try {
      const next = await fetchUnreadCount();
      if (isMounted.current) setUnread(next);
    } catch {
      /* ignore — the next poll or an open will correct it */
    }
  }, []);

  /** Expensive: derives, then reads. Run when the dropdown opens. */
  const loadFeed = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await fetchNotifications({ limit: 20 });
      if (isMounted.current) {
        setNotifications(result.notifications ?? []);
        setUnread(result.unread ?? 0);
        setHasLoaded(true);
      }
      return result;
    } catch (error) {
      if (isMounted.current) setLoadError(error);
      return null;
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, []);

  const markOneRead = useCallback(async (id) => {
    /* Optimistic: flip the row and drop the count now, reconcile on failure. */
    setNotifications((prev) =>
      prev.map((n) => (n.id === id && !n.read ? { ...n, read: true } : n)),
    );
    setUnread((prev) => Math.max(0, prev - 1));
    try {
      await markNotificationRead(id);
    } catch {
      if (isMounted.current) {
        await loadFeed();
      }
    }
  }, [loadFeed]);

  const markAllRead = useCallback(async () => {
    const hadUnread = notifications.some((n) => !n.read);
    if (!hadUnread) return;
    setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
    setUnread(0);
    try {
      await markAllNotificationsRead();
    } catch {
      if (isMounted.current) await loadFeed();
    }
  }, [notifications, loadFeed]);

  useEffect(() => {
    refreshCount();
    if (!pollIntervalMs) return undefined;
    const timer = setInterval(refreshCount, pollIntervalMs);
    return () => clearInterval(timer);
  }, [refreshCount, pollIntervalMs]);

  return {
    unread,
    notifications,
    isLoading,
    loadError,
    hasLoaded,
    loadFeed,
    refreshCount,
    markOneRead,
    markAllRead,
  };
}
