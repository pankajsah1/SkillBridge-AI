/**
 * Native select with the same label/hint/error treatment as Input.jsx.
 *
 * Native `<select>` rather than a custom dropdown, because the native control
 * already gets keyboard navigation, type-to-jump, screen reader support and a
 * usable mobile picker for free — all of which a div-based replacement has to
 * rebuild, usually incompletely.
 */

import { useId } from 'react';

/** Chevron drawn here so the control looks consistent across browsers. */
function ChevronIcon() {
  return (
    <svg
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * @param {object} props
 * @param {Array<{value: string|number, label: string, disabled?: boolean}>} props.options
 * @param {string} [props.placeholder] rendered as a disabled empty first option
 */
export default function Select({
  label,
  name,
  value,
  onChange,
  onBlur,
  options = [],
  placeholder,
  error,
  hint,
  disabled = false,
  required = false,
}) {
  const generatedId = useId();
  const fieldId = `${name}-${generatedId}`;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  return (
    <div>
      {label ? (
        <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
          {required ? (
            <span className="ml-0.5 text-error-600" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      <div className="relative">
        <select
          id={fieldId}
          name={name}
          value={value ?? ''}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={[
            'w-full appearance-none rounded-lg border bg-white py-2.5 pl-3.5 pr-10 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
            // An unchosen placeholder should read as placeholder text, not as a
            // real value that happens to be selected.
            value === '' || value === null || value === undefined
              ? 'text-slate-400'
              : 'text-slate-900',
            error
              ? 'border-error-300 focus:border-error-500 focus:ring-error-100'
              : 'border-slate-300 focus:border-primary-500 focus:ring-primary-100',
          ].join(' ')}
        >
          {placeholder ? (
            <option value="" disabled={required}>
              {placeholder}
            </option>
          ) : null}

          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>

        <ChevronIcon />
      </div>

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
