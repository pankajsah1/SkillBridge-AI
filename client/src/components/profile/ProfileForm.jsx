/**
 * The profile details form — headline, about, education, location, interests.
 *
 * Handles both creation and editing. The only difference is which API call the
 * parent makes: on a first visit there is no profile yet, so the form starts
 * empty and submits a POST; afterwards it submits a PATCH containing only the
 * fields that actually changed (see buildProfilePatch, which also stops a
 * no-op save from hitting the API's "empty patch" 400).
 *
 * Skills and career goals are NOT here. They have their own endpoints and their
 * own sections, because add/update/remove on a list is a different interaction
 * from editing a set of text fields — and the API rejects them on this route
 * with a message saying where they belong.
 */

import { useEffect, useState } from 'react';

import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Textarea from '../ui/Textarea.jsx';
import InterestsField from './InterestsField.jsx';
import {
  BIO_MAX,
  HEADLINE_MAX,
  buildProfilePatch,
  isValid,
  validateProfileForm,
} from '../../utils/profileValidation.js';

const EMPTY_FORM = {
  headline: '',
  bio: '',
  institutionName: '',
  degree: '',
  branch: '',
  graduationYear: '',
  currentYear: '',
  cgpa: '',
  location: '',
  interests: [],
};

/**
 * Turns an API profile into form state.
 *
 * Every null becomes '' because a controlled React input with `value={null}`
 * warns and behaves as uncontrolled. The reverse mapping ('' back to null)
 * happens on the server, which reads an empty string as "clear this field".
 */
const toFormState = (profile) => {
  if (!profile) return { ...EMPTY_FORM };

  return {
    headline: profile.headline ?? '',
    bio: profile.bio ?? '',
    institutionName: profile.institutionName ?? '',
    degree: profile.degree ?? '',
    branch: profile.branch ?? '',
    graduationYear: profile.graduationYear ?? '',
    currentYear: profile.currentYear ?? '',
    cgpa: profile.cgpa ?? '',
    location: profile.location ?? '',
    interests: [...(profile.interests ?? [])],
  };
};

/** A window wide enough for current students and recent graduates. */
const graduationYearOptions = () => {
  const thisYear = new Date().getFullYear();
  const years = [];
  for (let year = thisYear + 6; year >= thisYear - 10; year -= 1) {
    years.push({ value: year, label: String(year) });
  }
  return years;
};

const YEAR_OF_STUDY_OPTIONS = [
  { value: 1, label: 'First year' },
  { value: 2, label: 'Second year' },
  { value: 3, label: 'Third year' },
  { value: 4, label: 'Fourth year' },
  { value: 5, label: 'Fifth year' },
  { value: 6, label: 'Sixth year' },
];

const DEGREE_OPTIONS = [
  'B.Tech',
  'B.E.',
  'B.Sc',
  'BCA',
  'B.Com',
  'M.Tech',
  'M.Sc',
  'MCA',
  'MBA',
  'Diploma',
  'PhD',
].map((degree) => ({ value: degree, label: degree }));

export default function ProfileForm({
  profile,
  isSaving = false,
  serverFieldErrors = {},
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState(() => toFormState(profile));
  const [errors, setErrors] = useState({});
  const [nothingChanged, setNothingChanged] = useState(false);

  /**
   * Re-seeds the form when a save succeeds and a fresh profile arrives.
   *
   * Keyed on `updatedAt` rather than the object identity so that re-renders
   * which do not change the data leave what the student is typing alone.
   */
  useEffect(() => {
    setForm(toFormState(profile));
    setErrors({});
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

    const localErrors = validateProfileForm(form);
    if (!isValid(localErrors)) {
      setErrors(localErrors);
      return;
    }
    setErrors({});

    // On a first save the whole form is the payload. On an edit, only the
    // difference — which is also how a genuinely empty save is detected before
    // the API has to reject it.
    if (!profile) {
      await onSubmit(form, { isCreate: true });
      return;
    }

    const patch = buildProfilePatch(form, profile);
    if (Object.keys(patch).length === 0) {
      setNothingChanged(true);
      return;
    }

    await onSubmit(patch, { isCreate: false });
  };

  // A server-side message for a field wins over the local one: it is the
  // authoritative answer and it arrived later.
  const errorFor = (field) => serverFieldErrors[field] ?? errors[field];

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <Input
        label="Headline"
        name="headline"
        value={form.headline}
        onChange={handleChange}
        error={errorFor('headline')}
        hint={`One line about you, e.g. "Final-year CS student". Up to ${HEADLINE_MAX} characters.`}
        placeholder="Final-year Computer Science student"
        disabled={isSaving}
      />

      <Textarea
        label="About"
        name="bio"
        value={form.bio}
        onChange={handleChange}
        error={errorFor('bio')}
        hint="What you are working on and what you want to do next."
        placeholder="I build web applications and I am currently learning backend engineering…"
        maxLength={BIO_MAX}
        rows={4}
        disabled={isSaving}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Institution"
          name="institutionName"
          value={form.institutionName}
          onChange={handleChange}
          error={errorFor('institutionName')}
          placeholder="Your college or university"
          disabled={isSaving}
        />

        <Input
          label="Location"
          name="location"
          value={form.location}
          onChange={handleChange}
          error={errorFor('location')}
          placeholder="City, Country"
          disabled={isSaving}
        />

        <Select
          label="Degree"
          name="degree"
          value={form.degree}
          onChange={handleChange}
          options={DEGREE_OPTIONS}
          placeholder="Select your degree"
          error={errorFor('degree')}
          disabled={isSaving}
        />

        <Input
          label="Branch or field of study"
          name="branch"
          value={form.branch}
          onChange={handleChange}
          error={errorFor('branch')}
          placeholder="Computer Science"
          disabled={isSaving}
        />

        <Select
          label="Year of study"
          name="currentYear"
          value={form.currentYear}
          onChange={handleChange}
          options={YEAR_OF_STUDY_OPTIONS}
          placeholder="Select your year"
          error={errorFor('currentYear')}
          disabled={isSaving}
        />

        <Select
          label="Graduation year"
          name="graduationYear"
          value={form.graduationYear}
          onChange={handleChange}
          options={graduationYearOptions()}
          placeholder="Select a year"
          error={errorFor('graduationYear')}
          disabled={isSaving}
        />

        <Input
          label="CGPA"
          name="cgpa"
          type="number"
          value={form.cgpa}
          onChange={handleChange}
          error={errorFor('cgpa')}
          hint="Optional. On a 10-point scale."
          placeholder="8.4"
          disabled={isSaving}
        />
      </div>

      <InterestsField
        value={form.interests}
        onChange={(interests) => setField('interests', interests)}
        error={errorFor('interests')}
        disabled={isSaving}
      />

      {nothingChanged ? (
        <p className="text-sm text-slate-500">
          Nothing has changed yet — edit a field and the save will go through.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
        <Button type="submit" isLoading={isSaving}>
          {isSaving ? 'Saving…' : profile ? 'Save changes' : 'Create profile'}
        </Button>

        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
