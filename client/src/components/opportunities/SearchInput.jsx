/**
 * Search box that waits for a pause in typing before it asks the server.
 *
 * WHY DEBOUNCE AT ALL. Every keystroke would otherwise be a request: "react" is
 * five queries for one intention, and the answers can arrive out of order. The
 * hooks that own the lists already ignore stale responses, so this is about not
 * making the requests in the first place.
 *
 * 350ms is short enough to feel immediate and long enough to skip the letters in
 * the middle of a word.
 *
 * Enter searches now rather than waiting, because someone who has finished typing
 * and pressed Enter has told us they are done. That needs a key handler, which is
 * why this uses a raw <input> with ui/Input.jsx's classes rather than the
 * component — the same trade InterestsField makes.
 */

import { useEffect, useId, useRef, useState } from 'react';

/** The default glyph. */
const MagnifierIcon = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" strokeLinecap="round" />
  </svg>
);

export default function SearchInput({
  value = '',
  onChange,
  label = 'Search',
  placeholder = 'Search…',
  hint,
  disabled = false,
  delay = 350,
  /**
   * Overrides the leading glyph.
   *
   * The student's location filter is the same control — free text, matched on the
   * server, and just as wrong to send per keystroke — but a magnifying glass beside
   * "Location" describes the wrong thing. Only the icon differs, so only the icon
   * is a prop.
   */
  icon = MagnifierIcon,
}) {
  const generatedId = useId();
  const inputId = `search-${generatedId}`;
  const hintId = `${inputId}-hint`;

  const [text, setText] = useState(value);

  /**
   * The last value this component handed upwards.
   *
   * It is what distinguishes "the parent reset the filters" from "the parent is
   * echoing back what I just sent". Without the distinction, either an external
   * reset fails to clear the box, or every emit bounces back and wipes out the
   * characters typed since.
   */
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    if (text === lastEmitted.current) return undefined;

    const timer = setTimeout(() => {
      lastEmitted.current = text;
      onChange(text);
    }, delay);

    // Cleared on every keystroke, which is what makes this a debounce rather than
    // a queue of pending searches.
    return () => clearTimeout(timer);
  }, [text, delay, onChange]);

  const commitNow = () => {
    if (text === lastEmitted.current) return;
    lastEmitted.current = text;
    onChange(text);
  };

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          {icon}
        </span>

        <input
          id={inputId}
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitNow();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          aria-describedby={hint ? hintId : undefined}
          className={[
            'w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3.5 text-sm text-slate-900',
            'placeholder:text-slate-400',
            'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
          ].join(' ')}
        />
      </div>

      {hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
