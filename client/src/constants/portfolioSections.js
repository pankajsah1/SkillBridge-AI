/**
 * The four repeatable portfolio sections, declared as data.
 *
 * WHY ONE CONFIG INSTEAD OF FOUR HAND-WRITTEN FORMS. Projects, certifications,
 * achievements and experience are the same interaction four times over: a list of
 * cards, an inline form of labelled fields, and an optional file attached to each
 * record. Written out four times that is four places for a max-length to be wrong
 * and four places to fix a date bug. Declared here, the four are side by side —
 * which is exactly where an inconsistency between them becomes visible.
 *
 * The limits mirror server/src/constants/portfolio.js PORTFOLIO_LIMITS. They are
 * duplicated so a student is told "150 characters" while typing rather than after
 * submitting; the server's copy is the one that decides. If they ever disagree the
 * symptom is a redundant message, never an accepted-but-invalid record.
 *
 * NOTHING HERE IS A SECURITY CONTROL. A field absent from a `fields` array is
 * absent from the form, but the reason a student cannot set `verificationStatus`
 * is that the server rejects it — see the note at the top of
 * server/src/validators/portfolio.validator.js.
 */

import {
  ACHIEVEMENT_TYPE_LABELS,
  ACHIEVEMENT_TYPE_OPTIONS,
  EXPERIENCE_TYPE_LABELS,
  EXPERIENCE_TYPE_OPTIONS,
} from './portfolio.js';

const LIMITS = Object.freeze({
  title: 150,
  description: 1000,
  organization: 150,
  role: 120,
  url: 500,
  credentialId: 120,
  technologies: 20,
  technologyLength: 40,
  skillsUsed: 20,
  skillUsedLength: 40,
});

/** "Mar 2025", or "" for a missing date. Month precision: a portfolio entry is a
 *  period, and a student rarely remembers the day they started a project. */
export const formatMonthYear = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

/** "Jan 2025 – Jun 2025", "Jan 2025 – Present", "Jan 2025", or "". */
const formatPeriod = (startDate, endDate, isOngoing, ongoingWord = 'Present') => {
  const start = formatMonthYear(startDate);
  const end = isOngoing ? ongoingWord : formatMonthYear(endDate);

  if (start && end) return `${start} – ${end}`;
  return start || end || '';
};

/** `<input type="date">` wants `yyyy-mm-dd`; the API sends ISO timestamps. */
export const toDateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

/**
 * Freezes a section and everything reachable inside it.
 *
 * `Object.freeze` on the outer array alone would leave every entry — and every
 * field inside every entry — writable, and this config is shared by all four
 * rendered sections. A component that assigned to `section.fields[0].label` would
 * therefore be editing the form for the whole page. Frozen, that assignment throws
 * in development (ES modules are strict mode) instead of quietly rewriting the UI.
 */
export const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

const SECTION_LIST = [
  {
    key: 'projects',
    singular: 'project',
    plural: 'projects',
    title: 'Projects',
    description: 'What you have built, and what you built it with.',
    addLabel: 'Add project',
    emptyTitle: 'No projects yet',
    emptyDescription:
      'A project is the most convincing thing in a student portfolio — it shows what you can actually do, not just what you have studied. Coursework counts.',
    max: 30,
    /** Attachments here are supporting material: a report, a poster, a screenshot. */
    documentLabel: 'Attachment',
    documentHint: 'A report, poster or screenshot — optional.',
    fields: [
      {
        name: 'title',
        label: 'Project title',
        type: 'text',
        required: true,
        maxLength: LIMITS.title,
        placeholder: 'Academia–industry collaboration portal',
      },
      {
        name: 'description',
        label: 'What it does, and what you did',
        type: 'textarea',
        required: true,
        maxLength: LIMITS.description,
        rows: 4,
        placeholder:
          'A portal that matches students to internships using their assessed skills. I built the matching service and the React dashboard.',
        hint: 'Say what the project does and which part was yours. Two or three sentences is plenty.',
      },
      {
        name: 'role',
        label: 'Your role',
        type: 'text',
        maxLength: LIMITS.role,
        placeholder: 'Backend developer',
      },
      {
        name: 'technologies',
        label: 'Technologies',
        type: 'chips',
        max: LIMITS.technologies,
        maxItemLength: LIMITS.technologyLength,
        placeholder: 'React, Node.js, MongoDB…',
        hint: 'Press Enter after each one.',
      },
      {
        name: 'githubUrl',
        label: 'Repository link',
        type: 'url',
        maxLength: LIMITS.url,
        placeholder: 'https://github.com/you/project',
        hint: 'Optional — plenty of good coursework has no public repo.',
      },
      {
        name: 'liveUrl',
        label: 'Live link',
        type: 'url',
        maxLength: LIMITS.url,
        placeholder: 'https://your-project.example.com',
      },
      { name: 'startDate', label: 'Started', type: 'date' },
      {
        name: 'endDate',
        label: 'Finished',
        type: 'date',
        /** Cleared and disabled while `isOngoing` is ticked — the server nulls it
         *  anyway, and an input that keeps a value the server discards is a lie. */
        clearedBy: 'isOngoing',
      },
      { name: 'isOngoing', label: 'Still working on this', type: 'checkbox' },
    ],
    toCard: (record) => ({
      title: record.title,
      subtitle: record.role,
      period: formatPeriod(record.startDate, record.endDate, record.isOngoing, 'Ongoing'),
      description: record.description,
      chips: record.technologies ?? [],
      links: [
        record.githubUrl ? { label: 'Repository', href: record.githubUrl } : null,
        record.liveUrl ? { label: 'Live', href: record.liveUrl } : null,
      ].filter(Boolean),
    }),
  },

  {
    key: 'certifications',
    singular: 'certification',
    plural: 'certifications',
    title: 'Certifications',
    description: 'Courses and credentials you have completed.',
    addLabel: 'Add certification',
    emptyTitle: 'No certifications yet',
    emptyDescription:
      'Online courses, workshops and platform certificates all belong here. Add the credential link if you have one — it is what makes the entry checkable.',
    max: 30,
    documentLabel: 'Certificate',
    documentHint: 'The certificate itself, as a PDF or an image.',
    fields: [
      {
        name: 'title',
        label: 'Certification title',
        type: 'text',
        required: true,
        maxLength: LIMITS.title,
        placeholder: 'Full-Stack Web Development',
      },
      {
        name: 'issuingOrganization',
        label: 'Issued by',
        type: 'text',
        required: true,
        maxLength: LIMITS.organization,
        placeholder: 'NPTEL',
      },
      { name: 'issueDate', label: 'Issued on', type: 'date' },
      {
        name: 'expiryDate',
        label: 'Expires on',
        type: 'date',
        // The one date in the portfolio that is allowed to be in the future.
        allowFuture: true,
        hint: 'Leave blank if it does not expire.',
      },
      {
        name: 'credentialId',
        label: 'Credential ID',
        type: 'text',
        maxLength: LIMITS.credentialId,
        placeholder: 'NPTEL25CS03S123456789',
      },
      {
        name: 'credentialUrl',
        label: 'Credential link',
        type: 'url',
        maxLength: LIMITS.url,
        placeholder: 'https://verify.example.com/abc123',
        hint: 'The page that confirms this credential, if the issuer provides one.',
      },
    ],
    toCard: (record) => ({
      title: record.title,
      subtitle: record.issuingOrganization,
      period: [
        record.issueDate ? `Issued ${formatMonthYear(record.issueDate)}` : '',
        record.expiryDate ? `expires ${formatMonthYear(record.expiryDate)}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      description: '',
      chips: record.credentialId ? [`ID ${record.credentialId}`] : [],
      links: record.credentialUrl
        ? [{ label: 'Verify credential', href: record.credentialUrl }]
        : [],
    }),
  },

  {
    key: 'achievements',
    singular: 'achievement',
    plural: 'achievements',
    title: 'Achievements',
    description: 'Hackathons, competitions, awards, scholarships and publications.',
    addLabel: 'Add achievement',
    emptyTitle: 'No achievements yet',
    emptyDescription:
      'A hackathon you placed in, a paper you published, a scholarship you hold. These are the entries a recruiter reads first.',
    max: 30,
    documentLabel: 'Proof',
    documentHint: 'A certificate, letter or screenshot of the result.',
    fields: [
      {
        name: 'title',
        label: 'What you achieved',
        type: 'text',
        required: true,
        maxLength: LIMITS.title,
        placeholder: 'Runner-up, Smart India Hackathon',
      },
      {
        name: 'achievementType',
        label: 'Type',
        type: 'select',
        required: true,
        options: ACHIEVEMENT_TYPE_OPTIONS,
        placeholder: 'Choose a type',
      },
      {
        name: 'description',
        label: 'Details',
        type: 'textarea',
        required: true,
        maxLength: LIMITS.description,
        rows: 3,
        placeholder:
          'Placed second out of 180 teams for a portal matching students to internships.',
      },
      { name: 'date', label: 'When', type: 'date', required: true },
      {
        name: 'issuingOrganization',
        label: 'Awarded by',
        type: 'text',
        maxLength: LIMITS.organization,
        placeholder: 'Ministry of Education',
      },
    ],
    toCard: (record) => ({
      title: record.title,
      subtitle: record.issuingOrganization,
      period: formatMonthYear(record.date),
      description: record.description,
      chips: record.achievementType
        ? [ACHIEVEMENT_TYPE_LABELS[record.achievementType] ?? record.achievementType]
        : [],
      links: [],
    }),
  },

  {
    key: 'experiences',
    singular: 'experience record',
    plural: 'experience records',
    title: 'Internships and experience',
    description: 'Internships, training, freelance work and jobs.',
    addLabel: 'Add experience',
    emptyTitle: 'No experience recorded yet',
    emptyDescription:
      'Internships, industrial training, freelance work — anything where you did the job. Add it yourself: applications you make on this portal are not turned into experience records, because applying is not the same as having worked somewhere.',
    max: 20,
    documentLabel: 'Proof',
    documentHint: 'An offer letter, completion certificate or letter of recommendation.',
    fields: [
      {
        name: 'organization',
        label: 'Organisation',
        type: 'text',
        required: true,
        maxLength: LIMITS.organization,
        placeholder: 'Infosys',
      },
      {
        name: 'role',
        label: 'Your role',
        type: 'text',
        required: true,
        maxLength: LIMITS.role,
        placeholder: 'Backend intern',
      },
      {
        name: 'experienceType',
        label: 'Type',
        type: 'select',
        required: true,
        options: EXPERIENCE_TYPE_OPTIONS,
        placeholder: 'Choose a type',
      },
      { name: 'startDate', label: 'Started', type: 'date', required: true },
      { name: 'endDate', label: 'Ended', type: 'date', clearedBy: 'isCurrent' },
      { name: 'isCurrent', label: 'I am still here', type: 'checkbox' },
      {
        name: 'description',
        label: 'What you worked on',
        type: 'textarea',
        maxLength: LIMITS.description,
        rows: 3,
        placeholder: 'Built the reporting API and moved the nightly job onto a queue.',
      },
      {
        name: 'skillsUsed',
        label: 'Skills used',
        type: 'chips',
        max: LIMITS.skillsUsed,
        maxItemLength: LIMITS.skillUsedLength,
        placeholder: 'Node.js, SQL, Docker…',
        hint: 'Free text — these are what you used on the job, separate from your assessed skills.',
      },
    ],
    toCard: (record) => ({
      title: record.role,
      subtitle: record.organization,
      period: formatPeriod(record.startDate, record.endDate, record.isCurrent, 'Present'),
      description: record.description,
      chips: [
        record.experienceType
          ? EXPERIENCE_TYPE_LABELS[record.experienceType] ?? record.experienceType
          : null,
        ...(record.skillsUsed ?? []),
      ].filter(Boolean),
      links: [],
    }),
  },
];

export const PORTFOLIO_SECTIONS = Object.freeze(SECTION_LIST.map(deepFreeze));

/** Section config by key, for a component that knows which one it is. */
export const sectionByKey = Object.freeze(
  Object.fromEntries(PORTFOLIO_SECTIONS.map((section) => [section.key, section])),
);

/**
 * A blank form state for one section.
 *
 * Every field starts as `''`, `false` or `[]` rather than undefined, so each input
 * is controlled from the first render — React warns about switching an input from
 * uncontrolled to controlled, and the value would be lost when it happens.
 */
export const emptyFormFor = (section) => {
  const initial = {};

  for (const field of section.fields) {
    if (field.type === 'checkbox') initial[field.name] = false;
    else if (field.type === 'chips') initial[field.name] = [];
    else initial[field.name] = '';
  }

  return initial;
};

/**
 * Fills a form from an existing record, for editing.
 *
 * Dates are converted to `yyyy-mm-dd` because that is the only format
 * `<input type="date">` accepts — handed an ISO timestamp it silently shows blank,
 * which reads as "this record has no date" and quietly erases it on save.
 */
export const formFromRecord = (section, record) => {
  const form = emptyFormFor(section);

  for (const field of section.fields) {
    const value = record?.[field.name];

    if (field.type === 'checkbox') form[field.name] = Boolean(value);
    else if (field.type === 'chips') form[field.name] = Array.isArray(value) ? [...value] : [];
    else if (field.type === 'date') form[field.name] = toDateInputValue(value);
    else form[field.name] = value ?? '';
  }

  return form;
};

/**
 * Client-side checks, mirroring the server's validator for immediacy only.
 *
 * THE SERVER IS THE AUTHORITY. This runs so a student sees "Project title is
 * required" against the input instead of a banner after a round trip; the server
 * re-validates everything and its field errors are merged over these. Deliberately
 * light — it checks required, length and date order, and leaves anything subtler
 * to the one implementation that matters.
 *
 * @returns {Record<string, string>} field name -> message
 */
export const validateSectionForm = (section, form) => {
  const errors = {};
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

  for (const field of section.fields) {
    const value = form[field.name];

    if (field.required) {
      const isBlank =
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0);

      if (isBlank) {
        errors[field.name] = `${field.label} is required.`;
        continue;
      }
    }

    if (typeof value === 'string' && field.maxLength && value.trim().length > field.maxLength) {
      errors[field.name] = `${field.label} cannot exceed ${field.maxLength} characters.`;
      continue;
    }

    if (field.type === 'url' && typeof value === 'string' && value.trim().length > 0) {
      let parsed = null;
      try {
        parsed = new URL(value.trim());
      } catch {
        parsed = null;
      }

      if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
        errors[field.name] = `${field.label} must start with http:// or https://.`;
        continue;
      }
    }

    if (field.type === 'date' && value && !field.allowFuture) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime()) && parsed > tomorrow) {
        errors[field.name] = `${field.label} cannot be in the future.`;
      }
    }
  }

  // Date order, checked once per section rather than per field: the ongoing flag
  // decides whether an end date is even meaningful.
  const ongoingField = section.fields.find((field) => field.clearedBy)?.clearedBy;
  const isOngoing = ongoingField ? Boolean(form[ongoingField]) : false;

  if (!isOngoing && form.startDate && form.endDate && !errors.endDate) {
    if (new Date(form.endDate) < new Date(form.startDate)) {
      errors.endDate = 'The end date cannot be before the start date.';
    }
  }

  if (form.issueDate && form.expiryDate && !errors.expiryDate) {
    if (new Date(form.expiryDate) < new Date(form.issueDate)) {
      errors.expiryDate = 'The expiry date cannot be before the issue date.';
    }
  }

  return errors;
};

/**
 * Turns form state into a request payload.
 *
 * Trims strings, drops empty optional strings so the server stores `null` rather
 * than `''`, and sends `endDate: ''` explicitly when it was cleared — an omitted
 * field means "leave it alone" on a PATCH, so omitting a cleared date would make
 * it impossible to undo a date entered by mistake.
 */
export const payloadFromForm = (section, form, { isCreate }) => {
  const payload = {};
  const ongoingField = section.fields.find((field) => field.clearedBy)?.clearedBy;
  const isOngoing = ongoingField ? Boolean(form[ongoingField]) : false;

  for (const field of section.fields) {
    const value = form[field.name];

    if (field.type === 'checkbox') {
      payload[field.name] = Boolean(value);
      continue;
    }

    if (field.type === 'chips') {
      const list = (value ?? []).map((item) => item.trim()).filter(Boolean);
      if (list.length > 0 || !isCreate) payload[field.name] = list;
      continue;
    }

    if (field.clearedBy && isOngoing) {
      // Ticked "still ongoing": send the clear explicitly so a previously saved
      // end date is removed rather than left behind.
      if (!isCreate) payload[field.name] = '';
      continue;
    }

    const text = typeof value === 'string' ? value.trim() : value;

    if (text === '' || text === null || text === undefined) {
      // On an update an empty box means "clear this"; on a create it means
      // "never set", and sending '' would fail the server's required check with a
      // less helpful message than omitting it.
      if (!isCreate && !field.required) payload[field.name] = '';
      continue;
    }

    payload[field.name] = text;
  }

  return payload;
};

export default {
  PORTFOLIO_SECTIONS,
  sectionByKey,
  emptyFormFor,
  formFromRecord,
  formatMonthYear,
  toDateInputValue,
  validateSectionForm,
  payloadFromForm,
};
