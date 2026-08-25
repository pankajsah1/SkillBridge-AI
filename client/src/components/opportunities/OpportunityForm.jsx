/**
 * The create/edit form for an opportunity.
 *
 * ONE FORM FOR BOTH. Creating and editing ask for exactly the same fields, so a
 * second component would be the first one plus a diff — and the diff would rot.
 * What differs is only how it is saved, which the page decides: `mode` changes the
 * buttons and nothing else.
 *
 * WHO OWNS WHAT. This component owns what the employer has typed. The page's
 * useOpportunityEditor owns what is stored and what the server said about it. That
 * split is what makes the PATCH diff possible at all — you cannot compare "typed"
 * with "stored" if the same state is both.
 *
 * ERROR KEYS ARE THE API'S FIELD PATHS. `eligibility.branches`,
 * `requiredSkills[0].requiredLevel`. Client-side messages use the same keys as the
 * server's 400 response, so both land on the same input and there is no mapping
 * layer in between — mapping layers are where "the error appeared on the wrong
 * field" comes from. Client validation here is a courtesy that saves a round trip;
 * server/src/validators/opportunity.validator.js is what actually enforces the
 * rules.
 */

import { useEffect, useState } from 'react';

import {
  hasMeaningfulDuration,
  OPPORTUNITY_LIMITS,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPE_LABELS,
  OPPORTUNITY_TYPE_ORDER,
  WORK_MODE_LABELS,
  WORK_MODE_ORDER,
} from '../../constants/opportunities.js';
import {
  emptyOpportunityForm,
  isValid,
  validateNewBranch,
  validateOpportunityForm,
} from '../../utils/opportunityValidation.js';
import Alert from '../ui/Alert.jsx';
import Button from '../ui/Button.jsx';
import ChipListField from '../ui/ChipListField.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Textarea from '../ui/Textarea.jsx';
import SkillRequirementPicker from './SkillRequirementPicker.jsx';

const typeOptions = OPPORTUNITY_TYPE_ORDER.map((type) => ({
  value: type,
  label: OPPORTUNITY_TYPE_LABELS[type],
}));

const workModeOptions = WORK_MODE_ORDER.map((mode) => ({
  value: mode,
  label: WORK_MODE_LABELS[mode],
}));

/** A section heading, so the form reads as four short forms rather than one long one. */
function FormSection({ title, description, children }) {
  return (
    <section className="border-t border-slate-100 pt-6 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export default function OpportunityForm({
  /** The stored opportunity when editing; null or undefined when creating. */
  initialValues = null,
  mode = 'create',
  /** (form) => void | Promise. Only called once client validation passes. */
  onSubmit,
  onCancel,
  isSaving = false,
  /** Field errors from the API, keyed by its field paths. */
  serverErrors = {},
  /** (field) => void, so a server message clears when its input is edited. */
  onClearFieldError,
  catalogue = [],
  isLoadingCatalogue = false,
  catalogueError = null,
}) {
  const [form, setForm] = useState(() => initialValues ?? emptyOpportunityForm());
  const [clientErrors, setClientErrors] = useState({});
  const [hasSubmitted, setHasSubmitted] = useState(false);

  /**
   * Re-seeds when the page finishes loading the posting being edited.
   *
   * Keyed on identity, not contents: the editor hook replaces `initialValues` with
   * a new object only when the server sends a new version. Re-seeding on every
   * render would overwrite what is being typed.
   */
  useEffect(() => {
    if (initialValues) {
      setForm(initialValues);
      setClientErrors({});
      setHasSubmitted(false);
    }
  }, [initialValues]);

  /**
   * The messages on screen: client checks, overlaid by the server's.
   *
   * Only *defined* server messages overlay, which is not pedantry. Clearing an
   * error leaves the key behind holding `undefined`, and a plain spread would let
   * that undefined win over a live client message — the field would fall silent
   * while still being wrong.
   */
  const errors = { ...clientErrors };
  for (const [field, message] of Object.entries(serverErrors)) {
    if (message) errors[field] = message;
  }

  const clearError = (field) => {
    setClientErrors((previous) =>
      previous[field] ? { ...previous, [field]: undefined } : previous,
    );
    if (serverErrors[field] && onClearFieldError) onClearFieldError(field);
  };

  /**
   * Clears every message under a list field.
   *
   * A skill list reports under `requiredSkills`, `requiredSkills[2]` and
   * `requiredSkills[2].requiredLevel`. Editing the list invalidates all of them,
   * and — more importantly — the indices shift when an entry is removed, so a
   * surviving message would attach itself to a different skill than the one it was
   * written about.
   */
  const clearListErrors = (field) => {
    setClientErrors((previous) => {
      const next = {};
      let changed = false;

      for (const [key, message] of Object.entries(previous)) {
        if (key.startsWith(field)) changed = true;
        else next[key] = message;
      }

      return changed ? next : previous;
    });

    if (!onClearFieldError) return;
    for (const key of Object.keys(serverErrors)) {
      if (key.startsWith(field)) onClearFieldError(key);
    }
  };

  const setField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    clearError(field);
  };

  const setEligibilityField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      eligibility: { ...previous.eligibility, [field]: value },
    }));
    clearError(`eligibility.${field}`);
  };

  const setSkillList = (field, entries) => {
    setForm((previous) => ({ ...previous, [field]: entries }));
    clearListErrors(field);
    // The overlap rule reports on `preferredSkills` whichever list caused it, so
    // changing the required list has to clear that message too.
    clearError(field === 'requiredSkills' ? 'preferredSkills' : 'requiredSkills');
  };

  /**
   * Changing the type may take the duration field away with it.
   *
   * Not only cosmetic: the API rejects a duration sent in the same request as a
   * type that has none ("only internships, apprenticeships and projects have a
   * duration"), so a number typed while this said "internship" must not survive a
   * switch to "entry-level job".
   */
  const changeType = (type) => {
    setForm((previous) => ({
      ...previous,
      type,
      durationMonths: hasMeaningfulDuration(type) ? previous.durationMonths : '',
    }));
    clearError('type');
    clearError('durationMonths');
  };

  const submit = (statusOverride) => {
    const candidate = statusOverride ? { ...form, status: statusOverride } : form;
    const found = validateOpportunityForm(candidate);

    setClientErrors(found);
    setHasSubmitted(true);

    if (!isValid(found)) return;

    if (statusOverride) setForm(candidate);
    onSubmit(candidate);
  };

  const showsDuration = hasMeaningfulDuration(form.type);
  const isCreating = mode === 'create';

  // `body` is the server's key for "something about the request as a whole" — there
  // is no input to hang it on, so it goes in the banner.
  const formLevelMessage =
    errors.body ??
    (hasSubmitted && !isValid(clientErrors)
      ? 'Some details still need a change. They are marked below.'
      : null);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        // Enter in a text field lands here. For a new posting that is the primary
        // intention — publish — and for an edit there is only one way to save.
        submit(isCreating ? OPPORTUNITY_STATUSES.ACTIVE : null);
      }}
      className="space-y-6"
    >
      {formLevelMessage ? <Alert variant="error" message={formLevelMessage} /> : null}

      <FormSection
        title="The role"
        description="What students will see first in the listing."
      >
        <Input
          label="Title"
          name="title"
          value={form.title}
          onChange={(event) => setField('title', event.target.value)}
          error={errors.title}
          placeholder="Frontend Developer Intern"
          hint={`Up to ${OPPORTUNITY_LIMITS.titleMax} characters.`}
          disabled={isSaving}
          required
        />

        <Select
          label="Opportunity type"
          name="type"
          value={form.type}
          onChange={(event) => changeType(event.target.value)}
          options={typeOptions}
          placeholder="Choose a type"
          error={errors.type}
          disabled={isSaving}
          required
        />

        <Textarea
          label="Description"
          name="description"
          value={form.description}
          onChange={(event) => setField('description', event.target.value)}
          error={errors.description}
          rows={8}
          maxLength={OPPORTUNITY_LIMITS.descriptionMax}
          placeholder="What the work involves, what the team is like, and what a student will learn."
          hint={`At least ${OPPORTUNITY_LIMITS.descriptionMin} characters. Be specific — this is what makes a student apply.`}
          disabled={isSaving}
          required
        />
      </FormSection>

      <FormSection title="Where, how long, and by when">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Location"
            name="location"
            value={form.location}
            onChange={(event) => setField('location', event.target.value)}
            error={errors.location}
            placeholder="Bengaluru, Karnataka"
            disabled={isSaving}
            required
          />

          <Select
            label="Work mode"
            name="workMode"
            value={form.workMode}
            onChange={(event) => setField('workMode', event.target.value)}
            options={workModeOptions}
            placeholder="Choose a work mode"
            error={errors.workMode}
            hint="A remote role still needs a location — it is where the team is."
            disabled={isSaving}
            required
          />

          <Input
            label="Application deadline"
            name="deadline"
            type="date"
            value={form.deadline}
            onChange={(event) => setField('deadline', event.target.value)}
            error={errors.deadline}
            hint="Applications close at the end of this day. Today is allowed."
            disabled={isSaving}
            required
          />

          <Input
            label="Number of openings"
            name="openings"
            type="number"
            value={form.openings}
            onChange={(event) => setField('openings', event.target.value)}
            error={errors.openings}
            placeholder="1"
            hint="Leave blank for a single opening."
            disabled={isSaving}
          />

          {showsDuration ? (
            <Input
              label="Duration in months"
              name="durationMonths"
              type="number"
              value={form.durationMonths}
              onChange={(event) => setField('durationMonths', event.target.value)}
              error={errors.durationMonths}
              placeholder="6"
              hint="Optional. Only internships, apprenticeships and projects have one."
              disabled={isSaving}
            />
          ) : null}
        </div>
      </FormSection>

      <FormSection
        title="Skills"
        description="Chosen from the shared catalogue, so the same skill means the same thing on every posting and on every student profile."
      >
        <SkillRequirementPicker
          label="Required skills"
          description="Must-haves, each with the level you expect. At least one."
          field="requiredSkills"
          entries={form.requiredSkills}
          onChange={(entries) => setSkillList('requiredSkills', entries)}
          excludeIds={form.preferredSkills.map((entry) => entry.skillId)}
          max={OPPORTUNITY_LIMITS.maxRequiredSkills}
          withLevel
          errors={errors}
          catalogue={catalogue}
          isLoadingCatalogue={isLoadingCatalogue}
          catalogueError={catalogueError}
          disabled={isSaving}
        />

        <SkillRequirementPicker
          label="Preferred skills"
          description="Nice-to-haves. No level needed — a student who has one is a bonus, not a requirement."
          field="preferredSkills"
          entries={form.preferredSkills}
          onChange={(entries) => setSkillList('preferredSkills', entries)}
          excludeIds={form.requiredSkills.map((entry) => entry.skillId)}
          max={OPPORTUNITY_LIMITS.maxPreferredSkills}
          errors={errors}
          catalogue={catalogue}
          isLoadingCatalogue={isLoadingCatalogue}
          catalogueError={catalogueError}
          disabled={isSaving}
        />
      </FormSection>

      <FormSection
        title="Who can apply"
        description="All optional. Left empty, the posting is open to every student."
      >
        <ChipListField
          label="Eligible branches"
          value={form.eligibility.branches}
          onChange={(branches) => setEligibilityField('branches', branches)}
          validate={validateNewBranch}
          max={OPPORTUNITY_LIMITS.maxBranches}
          placeholder="Computer Science and Engineering"
          addLabel="Add branch"
          fullMessage="You have listed the maximum number of branches"
          hint="Press Enter to add. Leave empty to accept every branch."
          error={errors['eligibility.branches']}
          disabled={isSaving}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Earliest graduation year"
            name="minGraduationYear"
            type="number"
            value={form.eligibility.minGraduationYear}
            onChange={(event) => setEligibilityField('minGraduationYear', event.target.value)}
            error={errors['eligibility.minGraduationYear']}
            placeholder="2026"
            disabled={isSaving}
          />

          <Input
            label="Latest graduation year"
            name="maxGraduationYear"
            type="number"
            value={form.eligibility.maxGraduationYear}
            onChange={(event) => setEligibilityField('maxGraduationYear', event.target.value)}
            error={errors['eligibility.maxGraduationYear']}
            placeholder="2027"
            disabled={isSaving}
          />
        </div>

        <Textarea
          label="Anything else"
          name="eligibilityNotes"
          value={form.eligibility.notes}
          onChange={(event) => setEligibilityField('notes', event.target.value)}
          error={errors['eligibility.notes']}
          rows={3}
          maxLength={OPPORTUNITY_LIMITS.eligibilityNotesMax}
          placeholder="Minimum CGPA, ongoing coursework, anything a student should know before applying."
          disabled={isSaving}
        />
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
        {isCreating ? (
          <>
            <Button type="submit" isLoading={isSaving}>
              Publish opportunity
            </Button>

            {/* A draft is saved through the same validator as a published posting.
                A half-finished draft that cannot be published later would be worse
                than being asked to finish it now. */}
            <Button
              type="button"
              variant="secondary"
              onClick={() => submit(OPPORTUNITY_STATUSES.DRAFT)}
              disabled={isSaving}
            >
              Save as draft
            </Button>
          </>
        ) : (
          <Button type="submit" isLoading={isSaving}>
            Save changes
          </Button>
        )}

        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        ) : null}

        {isCreating ? (
          <p className="text-xs text-slate-500">
            A published opportunity is visible to students straight away. A draft is
            visible only to you.
          </p>
        ) : null}
      </div>
    </form>
  );
}
