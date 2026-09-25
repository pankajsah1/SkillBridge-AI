/**
 * NotificationBell — the header bell, its unread badge, and the feed dropdown.
 *
 * Opening the dropdown is what loads (and therefore derives) the feed; the badge is
 * kept fresh by the hook's slow poll. Every row is a link the server chose; clicking it
 * marks that one read. There is a "Mark all read" affordance and the four async states
 * (loading / error+retry / empty / list) the rest of the app uses.
 *
 * No identity is sent anywhere — the server scopes the feed to the signed-in account.
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import useNotifications from '../../hooks/useNotifications.js';
import { Spinner } from '../ui/Spinner.jsx';
import Button from '../ui/Button.jsx';

/** A compact "3m ago" / "2d ago" from an ISO timestamp — no dependency. */
const relativeTime = (iso) => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

export default function NotificationBell() {
  const {
    unread,
    notifications,
    isLoading,
    loadError,
    hasLoaded,
    loadFeed,
    markOneRead,
    markAllRead,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  /* Load (and derive) the feed the first time the dropdown is opened, and refresh
     it on every subsequent open so a freshly-derived event appears. */
  const toggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) loadFeed();
      return next;
    });
  };

  /* Close on an outside click or Escape — a dropdown that traps focus is a dead end. */
  useEffect(() => {
    if (!isOpen) return undefined;
    const onClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const badgeLabel = unread > 99 ? '99+' : String(unread);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-600"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-4-5.7V5a2 2 0 1 0-4 0v.3A6 6 0 0 0 6 11v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 0 1-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-error-600 px-1 text-[10px] font-semibold leading-4 text-white">
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {notifications.some((n) => !n.read) ? (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-primary-700 hover:text-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-600"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading && !hasLoaded ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500">
                <Spinner size="sm" /> Loading…
              </div>
            ) : loadError ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-error-600">Could not load notifications.</p>
                <div className="mt-3">
                  <Button size="sm" variant="secondary" onClick={loadFeed}>
                    Try again
                  </Button>
                </div>
              </div>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                You&apos;re all caught up. New updates will appear here.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notifications.map((n) => {
                  const body = (
                    <div className="flex gap-2.5">
                      {!n.read ? (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-600" aria-hidden="true" />
                      ) : (
                        <span className="mt-1.5 h-2 w-2 shrink-0" aria-hidden="true" />
                      )}
                      <div className="min-w-0">
                        <p className={`truncate text-sm ${n.read ? 'font-medium text-slate-700' : 'font-semibold text-slate-900'}`}>
                          {n.title}
                        </p>
                        {n.body ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p> : null}
                        <p className="mt-1 text-[11px] text-slate-400">{relativeTime(n.createdAt)}</p>
                      </div>
                    </div>
                  );

                  const commonClass = 'block w-full px-4 py-3 text-left transition hover:bg-slate-50';

                  return (
                    <li key={n.id}>
                      {n.link ? (
                        <Link
                          to={n.link}
                          className={commonClass}
                          onClick={() => {
                            markOneRead(n.id);
                            setIsOpen(false);
                          }}
                        >
                          {body}
                        </Link>
                      ) : (
                        <button type="button" className={commonClass} onClick={() => markOneRead(n.id)}>
                          {body}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
