/**
 * The academician's core details: headline, summary, position, expertise areas,
 * research interests, and whether they are open to collaboration.
 *
 * A DELIBERATE PARALLEL OF components/profile/ProfileForm.jsx, which does this job
 * for a student — one always-visible form, `onSubmit(payload, {isCreate})`, a patch
 * carrying only what changed, and a server field error winning over the local one.
 * Following that file rather than inventing a second convention means the academician
 * form behaves exactly like the student one a reviewer has already read.
 *
 * SKILLS, EDUCATION, POSITIONS AND ACHIEVEMENTS ARE NOT HERE. Each is a list with its
 * own endpoints and its own section on the page, and PATCH /academicians/profile
 * answers a body containing any of them with a 400 naming the route that owns it.
 *
 * `designationOther` IS SENT AS '' WHENEVER THE DESIGNATION IS NOT "Other". The server
 * reads the pair as a single statement and rejects free text alongside a listed rank,
 * so text typed and then abandoned has to be cleared rather than carried along.
 */

import { useEffect, useState } from 'react';

import Button from '../ui/Button.jsx';
import ChipListField from '../ui/ChipListField.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Textarea from '../ui/Textarea.jsx';
import {
  ACADEMICIAN_DESIGNATIONS,
  ACADEMICIAN_LIMITS,
  DESIGNATION_OPTIONS,
} from '../../constants/academicians.js';

const EMPTY_FORM = Object.freeze({
  headline: '',
  bio: '',
  institutionName: '',
  department: '',
  designation: '',
  designationOther: '',
  location: '',
  expertiseAreas: [],
  researchInterests: [],
  // The model's default. Starting the box ticked matches what an untouched profile
  // actually stores, so the form never shows something the server does not hold.
  isOpenToCollaboration: true,
});

/**
 * An API profile turned into form state.
 *
 * Every null becomes '' because a controlled input with `value={null}` warns and then
 * behaves as uncontrolled; arrays are copied so editing chips cannot mutate the
 * profile object the page is still rendering from.
 */
const toFormState = (profile) => {
  if (!profile) return { ...EMPTY_FORM };

  return {
    headline: profile.headline ?? '',
    bio: profile.bio ?? '',
    institutionName: profile.institutionName ?? '',
    department: profile.department ?? '',
    designation: profile.designation ?? '',
    designationOther: profile.designationOther ?? '',
    location: profile.location ?? '',
    expertiseAreas: [...(profile.expertiseAreas ?? [])],
    researchInterests: [...(profile.researchInterests ?? [])],
    isOpenToCollaboration: profile.isOpenToCollaboration ?? true,
  };
};

/** The value actually sent: free text only survives alongside "Other". */
const effectiveDesignationOther = (form) =>
  form.designation === ACADEMICIAN_DESIGNATIONS.OTHER ? form.designationOther : '';

/**
 * Client-side checks, mirroring server/src/validators/academician.validator.js for
 * immediacy only — the server re-validates everything and its messages win.
 *
 * Length caps only. Nothing on this form is required: an academician who fills in one
 * field and saves gets a profile with one field, which is a better starting point than
 * a page that refuses to save until it is perfect.
 */
const validate = (form) => {
  const errors = {};

  const capped = [
    ['headline', ACADEMICIAN_LIMITS.maxHeadlineLength, 'Headline'],
    ['bio', ACADEMICIAN_LIMITS.maxBioLength, 'Summary'],
    ['institutionName', ACADEMICIAN_LIMITS.maxInstitutionLength, 'Institution'],
    ['department', ACADEMICIAN_LIMITS.maxDepartmentLength, 'Department'],
    ['designationOther', ACADEMICIAN_LIMITS.maxDesignationOtherLength, 'Designation'],
    ['location', ACADEMICIAN_LIMITS.maxLocationLength, 'Location'],
  ];

  for (const [field, max, label] of capped) {
    if (form[field].trim().length > max) {
      errors[field] = `${label} cannot exceed ${max} characters.`;
    }
  }

  return errors;
};

const sameList = (a, b) => a.length === b.length && a.every((item, index) => item === b[index]);

/**
 * Only what changed.
 *
 * Two reasons, both borrowed from ProfileForm: PATCH with an empty body is a 400, and
 * a diff is how a no-op save is caught before it becomes a round trip. Comparing
 * against `toFormState(profile)` rather than the raw profile means '' and null are the
 * same absence on both sides, so a field that was never filled in does not look like
 * an edit.
 *
 * Order matters inside the chip lists — an academician who reorders their expertise
 * areas has changed something the server stores — so `sameList` compares positionally.
 */
const buildPatch = (form, profile) => {
  const stored = toFormState(profile);
  const next = { ...form, designationOther: effectiveDesignationOther(form) };
  const patch = {};

  for (const key of Object.keys(EMPTY_FORM)) {
    const value = typeof next[key] === 'string' ? next[key].trim() : next[key];
    const previous = typeof stored[key] === 'string' ? stored[key].trim() : stored[key];

    if (Array.isArray(value)) {
      if (!sameList(value, previous)) patch[key] = value;
      continue;
    }

    if (value !== previous) patch[key] = value;
  }

  return patch;
};

/**
 * The create payload: everything filled in, and nothing that is not.
 *
 * Empty optional fields are omitted rather than sent as '' — the same rule
 * `payloadFromForm` follows in constants/portfolioSections.js. `isOpenToCollaboration`
 * is always included because a boolean has no empty state, and the academician has
 * seen the box either ticked or not.
 */
const buildCreate = (form) => {
  const payload = { isOpenToCollaboration: Boolean(form.isOpenToCollaboration) };
  const next = { ...form, designationOther: effectiveDesignationOther(form) };

  for (const key of Object.keys(EMPTY_FORM)) {
    const value = next[key];

    if (Array.isArray(value)) {
      if (value.length > 0) payload[key] = value;
      continue;
    }

    if (typeof value === 'string' && value.trim() !== '') payload[key] = value.trim();
  }

  return payload;
};

/**
 * @param {object} props
 * @param {object|null} props.profile null on a first visit, which switches the form to
 *   create mode and the button to "Create profile"
 * @param {boolean} [props.isSaving]
 * @param {Record<string, string>} [props.serverFieldErrors]
 * @param {(payload: object, meta: {isCreate: boolean}) => Promise<void>} props.onSubmit
 */
export default function AcademicianDetailsForm({
  profile = null,
  isSaving = false,
  serverFieldErrors = {},
  onSubmit,
}) {
  const [form, setForm] = useState(() => toFormState(profile));
  const [errors, setErrors] = useState({});
  const [nothingChanged, setNothingChanged] = useState(false);

  /**
   * Re-seeds from a freshly saved profile.
   *
   * Keyed on `updatedAt` and `id` rather than the object identity, so a re-render that
   * did not change the data leaves whatever is being typed alone.
   */
  useEffect(() => {
    setForm(toFormState(profile));
    setErrors({});
    setNothingChanged(false);
  }, [profile?.updatedAt, profile?.id]);

  const setField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => (previous[field] ? { ...previous, [field]: undefined } : previous));
    setNothingChanged(false);
  };

  const handleChange = (event) => setField(event.target.name, event.target.value);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setNothingChanged(false);

    const localErrors = validate(form);
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }
    setErrors({});

    if (!profile) {
      await onSubmit(buildCreate(form), { isCreate: true });
      return;
    }

    const patch = buildPatch(form, profile);
    if (Object.keys(patch).length === 0) {
      setNothingChanged(true);
      return;
    }

    await onSubmit(patch, { isCreate: false });
  };

  // The server's message for a field wins: it is authoritative and it arrived later.
  const errorFor = (field) => serverFieldErrors[field] ?? errors[field];
  const isOther = form.designation === ACADEMICIAN_DESIGNATIONS.OTHER;

  /**
   * One chip validator for both lists, differing only in the cap.
   *
   * Rejects a duplicate as well as an over-long value: the chips are stored as an
   * array of strings and `Set`-like uniqueness is not enforced server-side, so two
   * identical chips would both persist and both render.
   */
  const chipValidator = (max, label) => (text, existing) => {
    if (!text) return 'Type something first.';
    if (text.length > max) return `Keep each ${label} under ${max} characters.`;
    if (existing.includes(text)) return 'That is already on the list.';
    return null;
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <Input
        label="Headline"
        name="headline"
        value={form.headline}
        onChange={handleChange}
        error={errorFor('headline')}
        placeholder="Professor of Computer Vision, IIT Delhi"
        hint={`One line an industry partner reads first. Up to ${ACADEMICIAN_LIMITS.maxHeadlineLength} characters.`}
        disabled={isSaving}
      />

      <Textarea
        label="Professional summary"
        name="bio"
        value={form.bio}
        onChange={handleChange}
        error={errorFor('bio')}
        rows={4}
        maxLength={ACADEMICIAN_LIMITS.maxBioLength}
        placeholder="I lead a computer vision group working on industrial inspection, and I supervise final-year projects with two manufacturing partners…"
        hint="What you work on, who you work with, and what you are looking for from industry."
        disabled={isSaving}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Institution"
          name="institutionName"
          value={form.institutionName}
          onChange={handleChange}
          error={errorFor('institutionName')}
          placeholder="Indian Institute of Technology Delhi"
          disabled={isSaving}
        />

        <Input
          label="Department"
          name="department"
          value={form.department}
          onChange={handleChange}
          error={errorFor('department')}
          placeholder="Computer Science and Engineering"
          disabled={isSaving}
        />

        <Select
          label="Designation"
          name="designation"
          value={form.designation}
          onChange={handleChange}
          options={DESIGNATION_OPTIONS}
          placeholder="Choose your designation"
          error={errorFor('designation')}
          disabled={isSaving}
        />

        <Input
          label="Location"
          name="location"
          value={form.location}
          onChange={handleChange}
          error={errorFor('location')}
          placeholder="New Delhi, India"
          disabled={isSaving}
        />
      </div>

      {/* Only rendered alongside "Other", because that is the only pairing the server
          accepts — free text beside a listed rank is a 400. Below the grid rather than
          inside it so no cell has to be given up when it appears. */}
      {isOther ? (
        <Input
          label="Your designation"
          name="designationOther"
          value={form.designationOther}
          onChange={handleChange}
          error={errorFor('designationOther')}
          placeholder="Chair Professor of Practice"
          hint="Whatever your institution calls the post."
          disabled={isSaving}
        />
      ) : null}

      <ChipListField
        label="Areas of expertise"
        value={form.expertiseAreas}
        onChange={(value) => setField('expertiseAreas', value)}
        validate={chipValidator(ACADEMICIAN_LIMITS.maxExpertiseAreaLength, 'area')}
        max={ACADEMICIAN_LIMITS.maxExpertiseAreas}
        placeholder="Computer Vision"
        hint="What you teach or research in. Press Enter after each one."
        error={errorFor('expertiseAreas')}
        disabled={isSaving}
        addLabel="Add area"
        fullMessage="You have added the maximum number of areas"
      />

      <ChipListField
        label="Research interests"
        value={form.researchInterests}
        onChange={(value) => setField('researchInterests', value)}
        validate={chipValidator(ACADEMICIAN_LIMITS.maxResearchInterestLength, 'interest')}
        max={ACADEMICIAN_LIMITS.maxResearchInterests}
        placeholder="Defect detection on production lines"
        hint="The problems you want to work on with industry — more specific than an area of expertise."
        error={errorFor('researchInterests')}
        disabled={isSaving}
        addLabel="Add interest"
        fullMessage="You have added the maximum number of interests"
      />

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={Boolean(form.isOpenToCollaboration)}
          onChange={(event) => setField('isOpenToCollaboration', event.target.checked)}
          disabled={isSaving}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-2 focus:ring-primary-100"
        />
        <span className="text-sm text-slate-700">
          I am open to industry collaboration
          <span className="mt-0.5 block text-xs text-slate-500">
            Shown on your profile. Untick it while you are not taking on new work — it does not
            hide your profile or stop you applying.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
        <Button type="submit" isLoading={isSaving}>
          {profile ? 'Save changes' : 'Create profile'}
        </Button>

        {nothingChanged ? (
          <span className="text-sm text-slate-500">Nothing has changed yet.</span>
        ) : null}
      </div>
    </form>
  );
}
