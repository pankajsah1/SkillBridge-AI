/**
 * Interests editor — a chip list with an add box.
 *
 * Chips rather than a comma-separated text field, because the API stores an
 * array and a text field would push the parsing ("was that comma a separator or
 * part of the interest?") onto both sides. Here what is on screen is exactly
 * what gets sent.
 *
 * Enter adds; it does not submit the surrounding form. That is what the
 * preventDefault in handleKeyDown is for — without it, typing an interest and
 * pressing Enter would save the whole profile while the box still had text in
 * it, and that text would be lost.
 */

import { useState } from 'react';

import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import { MAX_INTERESTS, validateNewInterest } from '../../utils/profileValidation.js';

export default function InterestsField({ value = [], onChange, error, disabled = false }) {
  const [draft, setDraft] = useState('');
  const [localError, setLocalError] = useState(null);

  const isFull = value.length >= MAX_INTERESTS;

  const add = () => {
    const text = draft.trim();
    const message = validateNewInterest(text, value);

    if (message) {
      setLocalError(message);
      return;
    }

    onChange([...value, text]);
    setDraft('');
    setLocalError(null);
  };

  const remove = (interest) => {
    onChange(value.filter((item) => item !== interest));
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
        <span className="block text-sm font-medium text-slate-700">Career interests</span>
        <span className="text-xs tabular-nums text-slate-400">
          {value.length}/{MAX_INTERESTS}
        </span>
      </div>

      {value.length > 0 ? (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {value.map((interest) => (
            <Badge
              key={interest}
              variant="primary"
              removable={!disabled}
              onRemove={() => remove(interest)}
              removeLabel={`Remove ${interest}`}
            >
              {interest}
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
          placeholder={isFull ? 'You have added the maximum' : 'e.g. Web Development'}
          aria-label="Add a career interest"
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
          Add
        </Button>
      </div>

      {message ? (
        <p className="mt-1.5 text-xs text-error-600">{message}</p>
      ) : (
        <p className="mt-1.5 text-xs text-slate-500">
          The areas you want to work in. Press Enter to add each one.
        </p>
      )}
    </div>
  );
}
