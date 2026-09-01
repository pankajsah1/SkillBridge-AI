/**
 * One list section of an academician profile: its cards, its add/edit form, and its
 * empty state.
 *
 * Rendered three times on the profile page with a different `section` config from
 * constants/academicianSections.js each time. The form is the portfolio's RecordForm,
 * imported unchanged — it renders whatever `section.fields` declares and knows
 * nothing about which role is looking at it.
 *
 * WHY THIS EXISTS RATHER THAN REUSING PortfolioSection. That component renders
 * RecordCard, and RecordCard renders DocumentControl and a verification pill
 * unconditionally. Academician records have neither an upload endpoint nor a
 * verification status, so reusing it would put a file picker on the page whose only
 * possible outcome is a 404. Everything else here — the single `editing` value, the
 * cap notice, the confirm before removing, closing only on success — is
 * PortfolioSection's behaviour kept deliberately identical.
 *
 * ONE PIECE OF STATE: `editing` is null, the string 'new', or a record id. A single
 * value makes the invariant structural — the add form and an edit form cannot both
 * be open, because there is nowhere to store "both".
 *
 * THE CARD ID IS `academician-<key>`, which is what the completion panel's "Add a
 * qualification" link scrolls to.
 */

import { useState } from 'react';

import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import RecordForm from '../portfolio/RecordForm.jsx';

/**
 * One record, reduced to the five slots every section's `toCard` produces.
 *
 * Never branches on which section it is rendering: a qualification's title is the
 * degree and a position's title is the role, and deciding that belongs in the section
 * config. Cards rather than table rows, for the reason RecordCard gives — a row of
 * cells with Edit/Delete buttons is exactly the "plain admin CRUD page" the brief
 * asks this not to look like.
 *
 * REMOVAL ASKS FIRST, via `window.confirm`, matching SkillsSection and RecordCard.
 * Deleting a publication somebody typed by hand is not undoable, and consistency
 * matters more here than a prettier modal.
 *
 * EXTERNAL LINKS CARRY rel="noreferrer". The URLs are academician-supplied and are
 * treated as untrusted: `noreferrer` withholds the referrer, and the `noopener` it
 * implies stops the opened page reaching back through `window.opener`.
 */
function RecordRow({ section, record, onEdit, onRemove, isBusy = false, disabled = false }) {
  const view = section.toCard(record);

  const handleRemove = async () => {
    const name = view.title || `this ${section.singular}`;
    if (!window.confirm(`Remove ${name} from your profile? This cannot be undone.`)) return;

    try {
      await onRemove();
    } catch {
      // The page banner reports it.
    }
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900">{view.title}</h3>

          {view.subtitle ? (
            <p className="mt-0.5 text-sm text-slate-600">{view.subtitle}</p>
          ) : null}
        </div>

        {view.period ? (
          <p className="shrink-0 text-xs tabular-nums text-slate-500">{view.period}</p>
        ) : null}
      </div>

      {view.description ? (
        // whitespace-pre-line so typed paragraph breaks survive.
        <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{view.description}</p>
      ) : null}

      {view.chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {view.chips.map((chip) => (
            <Badge key={chip} variant="neutral" size="sm">
              {chip}
            </Badge>
          ))}
        </div>
      ) : null}

      {view.links.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {view.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 transition hover:text-primary-800"
            >
              {link.label}
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={onEdit} disabled={disabled}>
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          isLoading={isBusy}
          disabled={disabled}
          className="text-error-600 hover:bg-error-50"
        >
          Remove
        </Button>
      </div>
    </article>
  );
}

/**
 * @param {object} props
 * @param {object} props.section one entry from ACADEMICIAN_SECTIONS
 * @param {Array<object>} props.records
 * @param {object} props.controller the useAcademicianProfile hook's return value
 */
export default function AcademicianRecordSection({ section, records = [], controller }) {
  const [editing, setEditing] = useState(null);

  const { isSaving, busyKey, fieldErrors, clearFeedback, addRecord, saveRecord, removeRecord } =
    controller;

  const isFull = records.length >= section.max;

  const open = (target) => {
    // Clears a stale banner and any field errors from a previous attempt, so a
    // freshly opened form is not pre-marked with someone else's mistakes.
    clearFeedback();
    setEditing(target);
  };

  const handleCreate = async (payload) => {
    await addRecord(section.key, payload);
    setEditing(null);
  };

  const handleUpdate = async (recordId, payload) => {
    await saveRecord(section.key, recordId, payload);
    setEditing(null);
  };

  const addButton = (
    <Button
      size="sm"
      onClick={() => open('new')}
      disabled={isSaving || isFull}
      // The tooltip carries the reason: a disabled button with no explanation reads
      // as broken rather than as a limit.
      title={isFull ? `You can add up to ${section.max}.` : undefined}
    >
      {section.addLabel}
    </Button>
  );

  return (
    <Card
      id={`academician-${section.key}`}
      title={section.title}
      description={section.description}
      // Hidden while the add form is open: the button would only re-open the form
      // already on screen.
      action={editing === 'new' ? null : addButton}
    >
      <div className="space-y-4">
        {editing === 'new' ? (
          <RecordForm
            section={section}
            serverFieldErrors={fieldErrors}
            isSaving={isSaving}
            onSubmit={handleCreate}
            onCancel={() => setEditing(null)}
          />
        ) : null}

        {records.length === 0 ? (
          editing === 'new' ? null : (
            <EmptyState
              title={section.emptyTitle}
              description={section.emptyDescription}
              action={addButton}
            />
          )
        ) : (
          <div className="space-y-3.5">
            {records.map((record) =>
              editing === record.id ? (
                <RecordForm
                  key={record.id}
                  section={section}
                  record={record}
                  serverFieldErrors={fieldErrors}
                  isSaving={isSaving}
                  onSubmit={(payload) => handleUpdate(record.id, payload)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <RecordRow
                  key={record.id}
                  section={section}
                  record={record}
                  onEdit={() => open(record.id)}
                  onRemove={() => removeRecord(section.key, record.id)}
                  // Matched per record, so one card's spinner does not appear on all
                  // of them — see the note on `busyKey` in hooks/useAcademicianProfile.js.
                  isBusy={busyKey === record.id}
                  disabled={isSaving}
                />
              ),
            )}
          </div>
        )}

        {isFull ? (
          <p className="text-xs text-slate-500">
            You have reached the limit of {section.max} {section.plural}. Remove one to add another.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
