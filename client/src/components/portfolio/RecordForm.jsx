/**
 * One record's form, rendered from the section's field declarations.
 *
 * The same component is the "add a project" form and the "edit this certification"
 * form for all four sections — it reads `section.fields` from
 * constants/portfolioSections.js and renders the matching primitive for each
 * entry's `type`. That is what keeps four forms from drifting: a fix to date
 * handling or error display lands in one place.
 *
 * VALIDATION RUNS TWICE AND THAT IS THE DESIGN. `validateSectionForm` checks
 * required fields, lengths, URL shape and date order from the same declarations the
 * inputs came from — so the checks cannot describe a field the form does not show.
 * The server then re-validates everything, and its per-field messages arrive as
 * `serverFieldErrors` and are shown in the same slots. The client's copy exists for
 * speed of feedback; the server's is the one that decides.
 *
 * A DISABLED END DATE IS NOT A HIDDEN ONE. When "still ongoing" is ticked, the end
 * date is cleared and disabled rather than removed, because a field that vanishes
 * makes people wonder whether their earlier value was kept. The server nulls
 * `endDate` for an ongoing record regardless, so leaving an editable value in the
 * box would show the student something that is not going to be saved.
 */

import { useState } from 'react';

import Button from '../ui/Button.jsx';
import ChipListField from '../ui/ChipListField.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Textarea from '../ui/Textarea.jsx';
import {
  emptyFormFor,
  formFromRecord,
  payloadFromForm,
  validateSectionForm,
} from '../../constants/portfolioSections.js';

/** Fields that read better side by side than stacked. */
const isHalfWidth = (field) => field.type === 'date' || field.type === 'select';

/**
 * @param {object} props
 * @param {object} props.section one entry from PORTFOLIO_SECTIONS
 * @param {object|null} [props.record] the record being edited, or null to create
 * @param {Record<string, string>} [props.serverFieldErrors]
 * @param {boolean} [props.isSaving]
 * @param {(payload: object, meta: {isCreate: boolean}) => Promise<unknown>} props.onSubmit
 * @param {() => void} props.onCancel
 */
export default function RecordForm({
  section,
  record = null,
  serverFieldErrors = {},
  isSaving = false,
  onSubmit,
  onCancel,
}) {
  const isCreate = !record;

  const [form, setForm] = useState(() =>
    record ? formFromRecord(section, record) : emptyFormFor(section),
  );
  const [localErrors, setLocalErrors] = useState({});
  /**
   * Only fields the student has actually touched, or that a submit attempt has
   * flagged, show an error. Without this the form would open covered in "required"
   * messages for boxes nobody has been given a chance to fill in yet.
   */
  const [touched, setTouched] = useState({});

  const setField = (name, value) => {
    setForm((previous) => ({ ...previous, [name]: value }));
    // Clearing on change rather than waiting for the next submit: the message was
    // about the old value, and leaving it up while the student fixes the field is
    // both wrong and discouraging.
    setLocalErrors((previous) =>
      previous[name] ? { ...previous, [name]: undefined } : previous,
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const errors = validateSectionForm(section, form);

    if (Object.keys(errors).length > 0) {
      setLocalErrors(errors);
      // Everything with a problem becomes "touched", so every message is visible
      // at once instead of appearing one field at a time.
      setTouched((previous) => ({
        ...previous,
        ...Object.fromEntries(Object.keys(errors).map((key) => [key, true])),
      }));
      return;
    }

    try {
      await onSubmit(payloadFromForm(section, form, { isCreate }), { isCreate });
    } catch {
      // The page banner and `serverFieldErrors` report it. Swallowed so the form
      // stays open with the student's text still in it.
    }
  };

  /** Server message wins: it is the authoritative one, and it is more specific. */
  const errorFor = (name) =>
    serverFieldErrors[name] ?? (touched[name] ? localErrors[name] : undefined);

  const renderField = (field) => {
    const value = form[field.name];
    const error = errorFor(field.name);
    const commonProps = {
      label: field.label,
      name: field.name,
      value,
      error,
      hint: field.hint,
      required: field.required,
      disabled: isSaving,
      onBlur: () => setTouched((previous) => ({ ...previous, [field.name]: true })),
    };

    if (field.type === 'textarea') {
      return (
        <Textarea
          {...commonProps}
          rows={field.rows}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          onChange={(event) => setField(field.name, event.target.value)}
        />
      );
    }

    if (field.type === 'select') {
      return (
        <Select
          {...commonProps}
          options={field.options}
          placeholder={field.placeholder}
          onChange={(event) => setField(field.name, event.target.value)}
        />
      );
    }

    if (field.type === 'chips') {
      return (
        <ChipListField
          label={field.label}
          value={value}
          onChange={(next) => setField(field.name, next)}
          max={field.max}
          placeholder={field.placeholder}
          hint={field.hint}
          error={error}
          disabled={isSaving}
          validate={(text, existing) => {
            if (!text) return 'Type something first.';
            if (field.maxItemLength && text.length > field.maxItemLength) {
              return `Keep each one under ${field.maxItemLength} characters.`;
            }
            // Case-insensitive, because "React" and "react" in the same list is
            // noise rather than two facts.
            if (existing.some((item) => item.toLowerCase() === text.toLowerCase())) {
              return 'That one is already in the list.';
            }
            return null;
          }}
        />
      );
    }

    if (field.type === 'checkbox') {
      return (
        <label className="flex items-start gap-2.5 pt-1">
          <input
            type="checkbox"
            checked={Boolean(value)}
            disabled={isSaving}
            onChange={(event) => {
              const isChecked = event.target.checked;
              setForm((previous) => {
                const next = { ...previous, [field.name]: isChecked };

                // Ticking "ongoing" empties the end date in the same update, so
                // the box the student is looking at agrees with what will be sent.
                if (isChecked) {
                  for (const other of section.fields) {
                    if (other.clearedBy === field.name) next[other.name] = '';
                  }
                }

                return next;
              });
            }}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-2 focus:ring-primary-100"
          />
          <span className="text-sm text-slate-700">{field.label}</span>
        </label>
      );
    }

    // text, url and date all render as an Input; `type` differs only for the
    // browser's benefit (a date picker, a URL keyboard on mobile).
    const isCleared = field.clearedBy ? Boolean(form[field.clearedBy]) : false;

    return (
      <Input
        {...commonProps}
        type={field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : 'text'}
        placeholder={field.placeholder}
        disabled={isSaving || isCleared}
        hint={isCleared ? 'Not needed while this is ongoing.' : field.hint}
        onChange={(event) => setField(field.name, event.target.value)}
      />
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-primary-100 bg-primary-50/30 p-4 sm:p-5"
      // Stops a browser autofill from putting an address into "Organisation".
      autoComplete="off"
    >
      <p className="mb-4 text-sm font-medium text-slate-800">
        {isCreate ? `New ${section.singular}` : `Editing this ${section.singular}`}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {section.fields.map((field) => (
          <div
            key={field.name}
            className={isHalfWidth(field) || field.type === 'checkbox' ? '' : 'sm:col-span-2'}
          >
            {renderField(field)}
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button type="submit" isLoading={isSaving}>
          {isCreate ? `Add ${section.singular}` : 'Save changes'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
      </div>

      {/* Said once, here, rather than on every card: a student adding their first
          record deserves to know nothing is being checked yet. */}
      <p className="mt-3 text-xs text-slate-500">
        Records you add are marked as self-reported until someone can verify them.
      </p>
    </form>
  );
}
