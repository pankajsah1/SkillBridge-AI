/**
 * The attach / download / replace / remove control for one document.
 *
 * Used in two places with the same shape: the resume card, and any record card
 * with a file on it. Both need exactly the same four affordances, so this is one
 * component rather than the same four buttons written twice.
 *
 * THREE THINGS HERE ARE NOT OBVIOUS.
 *
 * 1. THE FILE INPUT IS HIDDEN AND DRIVEN BY A REF. A native `<input type="file">`
 *    cannot be styled to match the rest of the design system — browsers own its
 *    button — so the visible control is a real Button that forwards its click. The
 *    input is still a real input in the DOM, so keyboard and assistive tech reach
 *    it through the label.
 *
 * 2. THE INPUT IS RESET AFTER EVERY PICK. Without `event.target.value = ''`,
 *    choosing the same file twice in a row fires no `change` event the second
 *    time — the value has not changed — so a student whose upload failed could not
 *    retry with the same file. That is a genuinely baffling bug to hit, and one
 *    line prevents it.
 *
 * 3. DOWNLOAD IS A BUTTON, NOT A LINK. The download route is authenticated, and an
 *    `<a href>` sends no Authorization header, so a link would 401. The bytes are
 *    fetched through axios and handed to the browser from memory — see
 *    api/portfolio.api.js.
 */

import { useRef } from 'react';

import Button from '../ui/Button.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import {
  ACCEPTED_TYPES_SENTENCE,
  FILE_INPUT_ACCEPT,
  formatFileSize,
} from '../../constants/portfolio.js';

function FileIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-slate-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M14 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * @param {object} props
 * @param {{fileName: string, originalName: string, size: number, uploadedAt: string}|null} props.document
 * @param {string} props.label what this file is ("Resume", "Certificate", "Proof")
 * @param {string} [props.hint] shown under the picker when there is no file
 * @param {(file: File) => Promise<unknown>} props.onUpload
 * @param {() => Promise<unknown>} props.onRemove
 * @param {(metadata: object) => Promise<unknown>} props.onDownload
 * @param {boolean} [props.isBusy] this document has a request in flight
 * @param {boolean} [props.isDownloading]
 * @param {boolean} [props.disabled] something else on the page is mid-request
 * @param {'sm'|'md'} [props.size]
 */
export default function DocumentControl({
  document: metadata,
  label,
  hint,
  onUpload,
  onRemove,
  onDownload,
  isBusy = false,
  isDownloading = false,
  disabled = false,
  size = 'sm',
}) {
  const inputRef = useRef(null);

  const handlePick = async (event) => {
    const file = event.target.files?.[0];
    // See note 2 in the header: clearing lets the same file be chosen again.
    event.target.value = '';

    if (!file) return;

    try {
      await onUpload(file);
    } catch {
      // The page's banner renders the failure. Swallowed here so a rejected
      // upload does not also surface as an unhandled rejection in the console.
    }
  };

  const handleRemove = async () => {
    try {
      await onRemove();
    } catch {
      /* reported by the page banner */
    }
  };

  const handleDownload = async () => {
    try {
      await onDownload(metadata);
    } catch {
      /* reported by the page banner */
    }
  };

  const isLocked = disabled || isBusy;

  return (
    <div>
      {/* One input for both the first upload and a replacement. `sr-only` rather
          than display:none, so it stays focusable and reachable. */}
      <input
        ref={inputRef}
        type="file"
        accept={FILE_INPUT_ACCEPT}
        onChange={handlePick}
        disabled={isLocked}
        aria-label={metadata ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
        className="sr-only"
      />

      {metadata ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
          <FileIcon />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800" title={metadata.originalName}>
              {metadata.originalName}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {[label, formatFileSize(metadata.size)].filter(Boolean).join(' · ')}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="ghost"
              size={size}
              onClick={handleDownload}
              isLoading={isDownloading}
              disabled={isLocked}
            >
              Download
            </Button>

            <Button
              variant="secondary"
              size={size}
              onClick={() => inputRef.current?.click()}
              disabled={isLocked}
            >
              Replace
            </Button>

            <Button
              variant="ghost"
              size={size}
              onClick={handleRemove}
              isLoading={isBusy}
              disabled={isLocked}
              className="text-error-600 hover:bg-error-50"
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Button
            variant="secondary"
            size={size}
            onClick={() => inputRef.current?.click()}
            disabled={isLocked}
          >
            {isBusy ? <Spinner size="sm" /> : null}
            Attach {label.toLowerCase()}
          </Button>

          <p className="text-xs text-slate-500">
            {hint ? `${hint} ` : ''}
            {ACCEPTED_TYPES_SENTENCE}, up to 5 MB.
          </p>
        </div>
      )}
    </div>
  );
}
