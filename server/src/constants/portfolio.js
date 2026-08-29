/**
 * Portfolio vocabulary — verification states, record types, document types and
 * the deterministic completion weights.
 *
 * WHY A CONSTANTS FILE. Three separate layers need to agree on these strings:
 * the Mongoose enums, the validators that reject bad input before it reaches the
 * model, and the completion scorer. Declaring them once means a new achievement
 * type is one edit, not three, and a typo is a missing key rather than a value
 * that silently validates.
 *
 * The client has its own parallel copy at `client/src/constants/portfolio.js` for
 * labels only — `client/` and `server/` are separate npm projects and cannot
 * share imports. The server file is authoritative: it is what actually rejects a
 * request.
 */

/**
 * Verification lifecycle for every student-supplied portfolio record.
 *
 * IMPORTANT — this step does NOT build a verification workflow. There is no
 * reviewer UI, no approval endpoint and no automatic promotion. Every record a
 * student creates is born PENDING and stays PENDING, because nothing in the
 * system has actually checked it. `VERIFIED` and `REJECTED` exist so the later
 * academician/institution review step has states to move records into without a
 * schema migration — they are reachable only from the database today.
 *
 * A student can never send this field: it is absent from every editable-field
 * whitelist in the validators, so "self-verified" is unrepresentable rather than
 * merely forbidden.
 */
export const VERIFICATION_STATUSES = Object.freeze({
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
});

export const VERIFICATION_STATUS_VALUES = Object.freeze(Object.values(VERIFICATION_STATUSES));

/** Human labels, kept beside the values so a state cannot be shown unlabelled. */
export const VERIFICATION_STATUS_LABELS = Object.freeze({
  [VERIFICATION_STATUSES.PENDING]: 'Awaiting verification',
  [VERIFICATION_STATUSES.VERIFIED]: 'Verified',
  [VERIFICATION_STATUSES.REJECTED]: 'Not accepted',
});

/**
 * What a student can claim they achieved. Free-text would make the portfolio
 * unsortable and unfilterable later, so this is a closed set — with `OTHER` as
 * the honest escape hatch instead of forcing a wrong choice.
 */
export const ACHIEVEMENT_TYPES = Object.freeze({
  HACKATHON: 'hackathon',
  COMPETITION: 'competition',
  AWARD: 'award',
  SCHOLARSHIP: 'scholarship',
  PUBLICATION: 'publication',
  OTHER: 'other',
});

export const ACHIEVEMENT_TYPE_VALUES = Object.freeze(Object.values(ACHIEVEMENT_TYPES));

export const ACHIEVEMENT_TYPE_LABELS = Object.freeze({
  [ACHIEVEMENT_TYPES.HACKATHON]: 'Hackathon',
  [ACHIEVEMENT_TYPES.COMPETITION]: 'Competition',
  [ACHIEVEMENT_TYPES.AWARD]: 'Award',
  [ACHIEVEMENT_TYPES.SCHOLARSHIP]: 'Scholarship',
  [ACHIEVEMENT_TYPES.PUBLICATION]: 'Publication',
  [ACHIEVEMENT_TYPES.OTHER]: 'Other',
});

/**
 * Kinds of work history. Deliberately wider than "internship" — a student who
 * freelanced or did an apprenticeship has real experience to show, and forcing it
 * into an internship label would make the record a lie.
 */
export const EXPERIENCE_TYPES = Object.freeze({
  INTERNSHIP: 'internship',
  FULL_TIME: 'full_time',
  PART_TIME: 'part_time',
  FREELANCE: 'freelance',
  APPRENTICESHIP: 'apprenticeship',
  TRAINING: 'training',
});

export const EXPERIENCE_TYPE_VALUES = Object.freeze(Object.values(EXPERIENCE_TYPES));

export const EXPERIENCE_TYPE_LABELS = Object.freeze({
  [EXPERIENCE_TYPES.INTERNSHIP]: 'Internship',
  [EXPERIENCE_TYPES.FULL_TIME]: 'Full-time',
  [EXPERIENCE_TYPES.PART_TIME]: 'Part-time',
  [EXPERIENCE_TYPES.FREELANCE]: 'Freelance',
  [EXPERIENCE_TYPES.APPRENTICESHIP]: 'Apprenticeship',
  [EXPERIENCE_TYPES.TRAINING]: 'Training',
});

/**
 * The five document kinds the MVP actually needs — one per portfolio section
 * that can carry proof. This is intentionally not a general file store: an
 * upload must name which portfolio purpose it serves, so an orphaned file with
 * no meaning cannot be created.
 */
export const DOCUMENT_TYPES = Object.freeze({
  RESUME: 'resume',
  CERTIFICATE: 'certificate',
  ACHIEVEMENT_PROOF: 'achievement_proof',
  EXPERIENCE_PROOF: 'experience_proof',
  PROJECT_ATTACHMENT: 'project_attachment',
});

export const DOCUMENT_TYPE_VALUES = Object.freeze(Object.values(DOCUMENT_TYPES));

export const DOCUMENT_TYPE_LABELS = Object.freeze({
  [DOCUMENT_TYPES.RESUME]: 'Resume',
  [DOCUMENT_TYPES.CERTIFICATE]: 'Certificate',
  [DOCUMENT_TYPES.ACHIEVEMENT_PROOF]: 'Achievement proof',
  [DOCUMENT_TYPES.EXPERIENCE_PROOF]: 'Experience proof',
  [DOCUMENT_TYPES.PROJECT_ATTACHMENT]: 'Project attachment',
});

/**
 * Upload limits.
 *
 * `maxFileBytes` is enforced twice on purpose: the reader aborts the stream once
 * the cap is passed (so a 2 GB upload never lands on disk), and the metadata is
 * re-checked afterwards. A Content-Length header is a claim, not a fact.
 *
 * 5 MB clears a scanned multi-page certificate comfortably while staying small
 * enough that a hostile client cannot fill the demo machine's disk quickly.
 */
export const UPLOAD_LIMITS = Object.freeze({
  maxFileBytes: 5 * 1024 * 1024,
  maxFileNameLength: 200,
  maxDocumentsPerStudent: 40,
});

/**
 * Allowed MIME types, each mapped to the extension we will store it under and
 * the magic-byte prefixes that prove it.
 *
 * The client's Content-Type is attacker-controlled, so it is treated as a
 * *request* for a format, and the file's own leading bytes are what decide.
 * A .exe renamed to .pdf fails the signature check and is refused.
 *
 * `signatures: null` means "no reliable magic number" — that is only used for
 * plain text, which cannot carry an executable payload in this context.
 */
export const ALLOWED_DOCUMENT_MIME_TYPES = Object.freeze({
  'application/pdf': { extension: '.pdf', signatures: [[0x25, 0x50, 0x44, 0x46]] }, // %PDF
  'image/png': {
    extension: '.png',
    signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  },
  'image/jpeg': { extension: '.jpg', signatures: [[0xff, 0xd8, 0xff]] },
  // DOCX is a ZIP container: PK\x03\x04 normally, PK\x05\x06 when empty.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extension: '.docx',
    signatures: [
      [0x50, 0x4b, 0x03, 0x04],
      [0x50, 0x4b, 0x05, 0x06],
    ],
  },
  'text/plain': { extension: '.txt', signatures: null },
});

export const ALLOWED_DOCUMENT_MIME_VALUES = Object.freeze(
  Object.keys(ALLOWED_DOCUMENT_MIME_TYPES),
);

/** For the `accept` attribute on the file input and for error messages. */
export const ALLOWED_DOCUMENT_EXTENSIONS = Object.freeze(
  Object.values(ALLOWED_DOCUMENT_MIME_TYPES).map((entry) => entry.extension),
);

/** Field length caps, in one place so validator and schema cannot drift apart. */
export const PORTFOLIO_LIMITS = Object.freeze({
  maxProjects: 30,
  maxCertifications: 30,
  maxAchievements: 30,
  maxExperiences: 20,

  maxTitleLength: 150,
  maxDescriptionLength: 1000,
  maxOrganizationLength: 150,
  maxRoleLength: 120,
  maxUrlLength: 500,
  maxCredentialIdLength: 120,

  maxTechnologies: 20,
  maxTechnologyLength: 40,
  maxSkillsUsed: 20,
  maxSkillUsedLength: 40,
});

/**
 * The completion score, section by section.
 *
 * DETERMINISTIC AND BACKEND-OWNED. No AI, no randomness, no client input — the
 * same profile always scores the same number, and the number is computed from
 * the stored document rather than sent by the browser. Weights sum to 100
 * (asserted by the verification script), so the score cannot exceed 100 without
 * the clamp even being reached.
 *
 * `filled` receives the raw Mongoose document. `label` is what the UI shows in
 * the "still to add" list, and `action` is the concrete next step — a missing
 * section that does not say what to do about it is just a complaint.
 */
export const PORTFOLIO_COMPLETION_SECTIONS = Object.freeze([
  {
    key: 'summary',
    label: 'Profile summary',
    weight: 15,
    action: 'Write a short headline and about section on your profile.',
    filled: (profile) =>
      Boolean(profile.headline?.trim()) && Boolean(profile.bio?.trim()),
  },
  {
    key: 'education',
    label: 'Education details',
    weight: 15,
    action: 'Add your institution, degree, branch and graduation year.',
    filled: (profile) =>
      Boolean(profile.institutionName?.trim()) &&
      Boolean(profile.degree?.trim()) &&
      Boolean(profile.graduationYear),
  },
  {
    key: 'skills',
    label: 'Skills',
    weight: 15,
    action: 'Add at least three skills, then take an assessment to verify them.',
    filled: (profile) => (profile.skills?.length ?? 0) >= 3,
  },
  {
    key: 'resume',
    label: 'Resume',
    weight: 15,
    action: 'Upload your resume as a PDF.',
    filled: (profile) => Boolean(profile.resume?.fileName),
  },
  {
    key: 'projects',
    label: 'Projects',
    weight: 15,
    action: 'Add at least one project with a description of what you built.',
    filled: (profile) => (profile.projects?.length ?? 0) >= 1,
  },
  {
    key: 'certifications',
    label: 'Certifications',
    weight: 10,
    action: 'Add a certification or course completion.',
    filled: (profile) => (profile.certifications?.length ?? 0) >= 1,
  },
  {
    key: 'experience',
    label: 'Experience',
    weight: 10,
    action: 'Add an internship, training or freelance record.',
    filled: (profile) => (profile.experiences?.length ?? 0) >= 1,
  },
  {
    key: 'achievements',
    label: 'Achievements',
    weight: 5,
    action: 'Add a hackathon, award or publication.',
    filled: (profile) => (profile.achievements?.length ?? 0) >= 1,
  },
]);

export default {
  VERIFICATION_STATUSES,
  VERIFICATION_STATUS_VALUES,
  VERIFICATION_STATUS_LABELS,
  ACHIEVEMENT_TYPES,
  ACHIEVEMENT_TYPE_VALUES,
  ACHIEVEMENT_TYPE_LABELS,
  EXPERIENCE_TYPES,
  EXPERIENCE_TYPE_VALUES,
  EXPERIENCE_TYPE_LABELS,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_VALUES,
  DOCUMENT_TYPE_LABELS,
  UPLOAD_LIMITS,
  ALLOWED_DOCUMENT_MIME_TYPES,
  ALLOWED_DOCUMENT_MIME_VALUES,
  ALLOWED_DOCUMENT_EXTENSIONS,
  PORTFOLIO_LIMITS,
  PORTFOLIO_COMPLETION_SECTIONS,
};
