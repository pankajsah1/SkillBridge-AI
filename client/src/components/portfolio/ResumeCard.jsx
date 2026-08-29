/**
 * The resume section.
 *
 * A section of its own rather than a fifth PortfolioSection, because a resume is
 * not a list. A student has one current CV, uploading a new one replaces it, and
 * there is no title or date to type — so the generic card/form machinery would be
 * mostly switched off. This is the file control and a sentence explaining what
 * happens to it.
 *
 * REPLACEMENT IS THE SERVER'S BEHAVIOUR, NOT A UI TRICK. `POST
 * /students/portfolio/resume` overwrites the metadata and deletes the previous file
 * once the new one is safely saved. Nothing here has to remember to clean up, and
 * nothing here could leave two resumes behind.
 */

import Card from '../ui/Card.jsx';
import DocumentControl from './DocumentControl.jsx';

/** "Uploaded 12 March 2026" — day precision, because a CV gets replaced often. */
const formatUploadedAt = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};

export default function ResumeCard({ portfolio }) {
  const {
    profile,
    isSaving,
    busyKey,
    saveResume,
    removeResume,
    download,
    downloadingFileName,
  } = portfolio;

  const resume = profile?.resume ?? null;

  return (
    <Card
      id="portfolio-resume"
      title="Resume"
      description="One current CV. Uploading a new one replaces it."
    >
      <div className="space-y-3">
        <DocumentControl
          document={resume}
          label="Resume"
          hint="A PDF is what most recruiters expect."
          onUpload={saveResume}
          onRemove={removeResume}
          onDownload={download}
          isBusy={busyKey === 'resume'}
          isDownloading={Boolean(resume) && downloadingFileName === resume.fileName}
          disabled={isSaving}
          size="sm"
        />

        {resume ? (
          <p className="text-xs text-slate-500">
            {formatUploadedAt(resume.uploadedAt)
              ? `Uploaded ${formatUploadedAt(resume.uploadedAt)}. `
              : ''}
            Only you can download this — the link is authenticated, so it is not a
            public file on the internet.
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            Your resume is worth 15% of your portfolio score, and it is the first thing most
            employers open.
          </p>
        )}
      </div>
    </Card>
  );
}
