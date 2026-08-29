/**
 * One portfolio record as a card: what it is, when, its verification state, its
 * attached file, and the edit/remove actions.
 *
 * Generic across all four sections. Each section's `toCard(record)` in
 * constants/portfolioSections.js reduces its own fields to the same five slots —
 * title, subtitle, period, description, chips, links — so this component never
 * branches on which section it is rendering. A project's title is its name and an
 * experience record's title is the role held; deciding that belongs in the section
 * config, not here.
 *
 * WHY IT LOOKS LIKE A CARD AND NOT A TABLE ROW. The brief asks that the portfolio
 * "should not look like a plain admin CRUD page". A row of cells with Edit/Delete
 * buttons is exactly that. A card can carry a description, a technology list and a
 * verification pill without the layout fighting it, and it is what a student would
 * recognise from a portfolio site.
 *
 * REMOVAL ASKS FIRST, via `window.confirm` — the same choice made for removing a
 * skill (components/profile/SkillsSection.jsx) and for the destructive opportunity
 * actions. Consistency matters more here than a prettier modal, and deleting a
 * record the student typed by hand is not undoable.
 *
 * EXTERNAL LINKS CARRY rel="noreferrer". The URLs are student-supplied, so they are
 * treated as untrusted: `noreferrer` withholds the referrer, and `noopener` (which
 * `noreferrer` implies) stops the opened page reaching back through
 * `window.opener`.
 */

import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import DocumentControl from './DocumentControl.jsx';
import VerificationBadge from './VerificationBadge.jsx';

/** A small outward arrow, so a link that leaves the app says so. */
function ExternalIcon() {
  return (
    <svg
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M14 4h6v6M20 4l-8 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * @param {object} props
 * @param {object} props.section the section config this record belongs to
 * @param {object} props.record the record as the API returned it
 * @param {() => void} props.onEdit
 * @param {() => Promise<unknown>} props.onRemove
 * @param {(file: File) => Promise<unknown>} props.onUploadDocument
 * @param {() => Promise<unknown>} props.onRemoveDocument
 * @param {(metadata: object) => Promise<unknown>} props.onDownloadDocument
 * @param {boolean} [props.isBusy] this record has a request in flight
 * @param {boolean} [props.isDocumentBusy]
 * @param {boolean} [props.isDownloading]
 * @param {boolean} [props.disabled] another request is in flight elsewhere
 */
export default function RecordCard({
  section,
  record,
  onEdit,
  onRemove,
  onUploadDocument,
  onRemoveDocument,
  onDownloadDocument,
  isBusy = false,
  isDocumentBusy = false,
  isDownloading = false,
  disabled = false,
}) {
  const view = section.toCard(record);

  const handleRemove = async () => {
    const name = view.title || `this ${section.singular}`;
    if (!window.confirm(`Remove ${name} from your portfolio? This cannot be undone.`)) return;

    try {
      await onRemove();
    } catch {
      // The page banner reports it.
    }
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900">{view.title}</h3>

          {view.subtitle ? (
            <p className="mt-0.5 text-sm text-slate-600">{view.subtitle}</p>
          ) : null}

          {view.period ? (
            <p className="mt-1 text-xs tabular-nums text-slate-500">{view.period}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <VerificationBadge status={record.verificationStatus} short />
        </div>
      </div>

      {view.description ? (
        // whitespace-pre-line so the paragraph breaks a student typed survive.
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
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 transition hover:text-primary-800"
            >
              {link.label}
              <ExternalIcon />
            </a>
          ))}
        </div>
      ) : null}

      <div className="mt-4 border-t border-slate-100 pt-3.5">
        <DocumentControl
          document={record.document}
          label={section.documentLabel}
          hint={section.documentHint}
          onUpload={onUploadDocument}
          onRemove={onRemoveDocument}
          onDownload={onDownloadDocument}
          isBusy={isDocumentBusy}
          isDownloading={isDownloading}
          disabled={disabled}
        />
      </div>

      <div className="mt-3.5 flex flex-wrap gap-2">
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
