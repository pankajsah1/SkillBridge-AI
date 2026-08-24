/**
 * Multi-line text input.
 *
 * Deliberately a sibling of Input.jsx rather than a `multiline` prop on it: the
 * two share almost no internals (no password toggle, different sizing, a
 * character counter) and threading a branch through Input would make the common
 * case harder to read.
 *
 * The label/hint/error wiring is copied exactly, so a screen reader announces a
 * textarea the same way it announces an input.
 */

import { useId } from 'react';

export default function Textarea({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  hint,
  placeholder,
  rows = 4,
  maxLength,
  disabled = false,
  required = false,
}) {
  const generatedId = useId();
  const fieldId = `${name}-${generatedId}`;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const countId = `${fieldId}-count`;

  const length = String(value ?? '').length;
  // Stays quiet until it is nearly relevant. A counter that is always visible
  // reads as a quota; one that appears at 80% reads as a warning.
  const showCount = Boolean(maxLength) && length > maxLength * 0.8;
  const isOverLimit = Boolean(maxLength) && length > maxLength;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700">
          {label}
          {required ? (
            <span className="ml-0.5 text-error-600" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>

        {showCount ? (
          <span
            id={countId}
            className={`text-xs tabular-nums ${isOverLimit ? 'text-error-600' : 'text-slate-400'}`}
          >
            {length}/{maxLength}
          </span>
        ) : null}
      </div>

      <textarea
        id={fieldId}
        name={name}
        value={value ?? ''}
        onChange={onChange}
        onBlur={onBlur}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        // No `maxLength` attribute on purpose: the browser would silently
        // truncate a paste, losing text without saying so. The counter and the
        // validator tell the user instead.
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={
          [error ? errorId : hint ? hintId : null, showCount ? countId : null]
            .filter(Boolean)
            .join(' ') || undefined
        }
        className={[
          'w-full resize-y rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900',
          'placeholder:text-slate-400',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
          error || isOverLimit
            ? 'border-error-300 focus:border-error-500 focus:ring-error-100'
            : 'border-slate-300 focus:border-primary-500 focus:ring-primary-100',
        ].join(' ')}
      />

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
