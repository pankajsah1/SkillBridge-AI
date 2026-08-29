/**
 * One portfolio section: its cards, its add/edit form, and its empty state.
 *
 * Rendered four times on the page with a different `section` config each time.
 * Everything specific to projects vs certifications vs achievements vs experience
 * lives in constants/portfolioSections.js; this file owns only the interaction
 * shared by all four.
 *
 * TWO PIECES OF STATE, AND WHY THEY ARE ONE VALUE. `editing` is either null, the
 * string 'new', or a record id. A single value makes the invariant structural: the
 * add form and an edit form cannot both be open, because there is nowhere to store
 * "both". With two booleans that would be possible, and a student could end up
 * looking at two forms with different contents and no clue which one saves.
 *
 * THE FORM CLOSES ONLY ON SUCCESS. `onSubmit` rethrows on failure, so a rejected
 * save leaves the form open with everything the student typed still in it. Closing
 * optimistically and showing an error banner would lose the text, which on a
 * thousand-character project description is a real loss.
 *
 * THE ID IS `portfolio-<key>` because PortfolioCompletionPanel links to exactly
 * that — "Add a project" in the missing-sections list scrolls here.
 */

import { useState } from 'react';

import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import RecordCard from './RecordCard.jsx';
import RecordForm from './RecordForm.jsx';

/**
 * @param {object} props
 * @param {object} props.section one entry from PORTFOLIO_SECTIONS
 * @param {Array<object>} props.records
 * @param {object} props.portfolio the usePortfolio hook's return value
 */
export default function PortfolioSection({ section, records = [], portfolio }) {
  const [editing, setEditing] = useState(null);

  const {
    isSaving,
    busyKey,
    fieldErrors,
    clearFeedback,
    addRecord,
    saveRecord,
    removeRecord,
    saveRecordDocument,
    removeRecordDocument,
    download,
    downloadingFileName,
  } = portfolio;

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
      // The tooltip carries the reason, because a disabled button with no
      // explanation reads as broken rather than as a limit.
      title={isFull ? `You can add up to ${section.max}.` : undefined}
    >
      {section.addLabel}
    </Button>
  );

  return (
    <Card
      id={`portfolio-${section.key}`}
      title={section.title}
      description={section.description}
      // Hidden while the add form is open: the button would only re-open the form
      // that is already on screen.
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
                <RecordCard
                  key={record.id}
                  section={section}
                  record={record}
                  onEdit={() => open(record.id)}
                  onRemove={() => removeRecord(section.key, record.id)}
                  onUploadDocument={(file) => saveRecordDocument(section.key, record.id, file)}
                  onRemoveDocument={() => removeRecordDocument(section.key, record.id)}
                  onDownloadDocument={download}
                  // The busy flags are matched per record, so one card's spinner
                  // does not appear on all of them — see the note on `busyKey` in
                  // hooks/usePortfolio.js.
                  isBusy={busyKey === record.id}
                  isDocumentBusy={busyKey === `document:${record.id}`}
                  isDownloading={
                    Boolean(record.document) &&
                    downloadingFileName === record.document.fileName
                  }
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
