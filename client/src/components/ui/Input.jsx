/**
 * Text input with label, hint, error message and an optional password toggle.
 *
 * Wiring label/hint/error to the input via ids is what makes a screen reader
 * announce "Email, invalid, enter a valid email address" instead of just
 * "edit text" — so it lives here once rather than being re-done per form.
 */

import { useId, useState } from 'react';

/** Inline eye icons; no icon dependency needed for two glyphs. */
function EyeIcon({ isOpen }) {
  return isOpen ? (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 3l18 18" strokeLinecap="round" />
      <path
        d="M10.6 5.2A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.4 3.3M6.5 6.7A17 17 0 0 0 2 12s3.5 7 10 7a9.4 9.4 0 0 0 3.6-.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Input({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  hint,
  placeholder,
  autoComplete,
  disabled = false,
  required = false,
  showPasswordToggle = false,
}) {
  const generatedId = useId();
  const inputId = `${name}-${generatedId}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const [isRevealed, setIsRevealed] = useState(false);
  const canToggle = showPasswordToggle && type === 'password';
  const resolvedType = canToggle && isRevealed ? 'text' : type;

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required ? (
          <span className="ml-0.5 text-error-600" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <div className="relative">
        <input
          id={inputId}
          name={name}
          type={resolvedType}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          // Announced by screen readers; the red border alone is invisible to them.
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={[
            'w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900',
            'placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
            canToggle ? 'pr-11' : '',
            error
              ? 'border-error-300 focus:border-error-500 focus:ring-error-100'
              : 'border-slate-300 focus:border-primary-500 focus:ring-primary-100',
          ]
            .filter(Boolean)
            .join(' ')}
        />

        {canToggle ? (
          <button
            type="button"
            // tabIndex -1 keeps Tab going straight from password to submit;
            // the toggle is a mouse convenience, and the field is still fully
            // usable without it.
            tabIndex={-1}
            onClick={() => setIsRevealed((previous) => !previous)}
            aria-label={isRevealed ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition hover:text-slate-600"
          >
            <EyeIcon isOpen={isRevealed} />
          </button>
        ) : null}
      </div>

      {/* Error replaces the hint rather than stacking, so the message that
          matters right now is the only one on screen. */}
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-error-600">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
