/**
 * A list of short text values, edited as removable chips with an add box.
 *
 * Chips rather than a comma-separated text field, because the API stores an array
 * and a text field would push the parsing ("was that comma a separator or part of
 * the value?") onto both sides. What is on screen is exactly what gets sent.
 *
 * Enter adds; it does not submit the surrounding form. That is what the
 * preventDefault in handleKeyDown is for — without it, typing a value and pressing
 * Enter would save the whole form while the box still had text in it, and that text
 * would be lost.
 *
 * A raw <input> rather than ui/Input.jsx, for the same reason InterestsField uses
 * one: Input owns no key handling and this control is mostly key handling. The
 * classes are kept identical so the two look the same.
 *
 * RELATIONSHIP TO components/profile/InterestsField.jsx. That component does the
 * same job for one specific field and predates this one. It is shipped and tested,
 * so it has been left alone rather than rewritten to use this; if the profile form
 * is next touched for its own reasons, folding it in here is the obvious cleanup.
 */

import { useState } from 'react';

import Badge from './Badge.jsx';
import Button from './Button.jsx';

export default function ChipListField({
  label,
  value = [],
  onChange,
  /** (text, existing) => message | null. Runs before a chip is added. */
  validate,
  max,
  placeholder,
  hint,
  error,
  disabled = false,
  addLabel = 'Add',
  fullMessage = 'You have added the maximum',
}) {
  const [draft, setDraft] = useState('');
  const [localError, setLocalError] = useState(null);

  const isFull = typeof max === 'number' && value.length >= max;

  const add = () => {
    const text = draft.trim();
    const message = validate ? validate(text, value) : text ? null : 'Type something first.';

    if (message) {
      setLocalError(message);
      return;
    }

    onChange([...value, text]);
    setDraft('');
    setLocalError(null);
  };

  const remove = (item) => {
    onChange(value.filter((entry) => entry !== item));
    // Removing one frees a slot, so a "list is full" message is no longer true.
    setLocalError(null);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
      return;
    }

    // Backspace on an empty box removes the last chip — the behaviour people
    // expect from any tag input.
    if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      remove(value[value.length - 1]);
    }
  };

  const message = error ?? localError;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {typeof max === 'number' ? (
          <span className="text-xs tabular-nums text-slate-400">
            {value.length}/{max}
          </span>
        ) : null}
      </div>

      {value.length > 0 ? (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {value.map((item) => (
            <Badge
              key={item}
              variant="primary"
              removable={!disabled}
              onRemove={() => remove(item)}
              removeLabel={`Remove ${item}`}
            >
              {item}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setLocalError(null);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled || isFull}
          placeholder={isFull ? fullMessage : placeholder}
          aria-label={label}
          aria-invalid={message ? 'true' : undefined}
          className={[
            'w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900',
            'placeholder:text-slate-400',
            'focus:outline-none focus:ring-2',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
            message
              ? 'border-error-300 focus:border-error-500 focus:ring-error-100'
              : 'border-slate-300 focus:border-primary-500 focus:ring-primary-100',
          ].join(' ')}
        />

        <Button
          type="button"
          variant="secondary"
          onClick={add}
          disabled={disabled || isFull || draft.trim() === ''}
        >
          {addLabel}
        </Button>
      </div>

      {message ? (
        <p className="mt-1.5 text-xs text-error-600">{message}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
