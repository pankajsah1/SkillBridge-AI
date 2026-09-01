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
 *
 * AUDIENCE IS THE FIRST REAL DECISION ON THIS FORM (Step 7). It decides which
 * opportunity types exist, whether graduation years are a sensible question, and who
 * will ever see the posting — so it is asked before the type and it is create-only,
 * because the API refuses to change it afterwards. Everything downstream of it
 * changes wording rather than structure: this is still one form, not two.
 */

import { useEffect, useState } from 'react';

import {
  AUDIENCE_LABELS,
  AUDIENCE_VALUES,
  DEFAULT_AUDIENCE,
  hasMeaningfulDuration,
  isTypeAllowedForAudience,
  OPPORTUNITY_LIMITS,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPE_LABELS,
  typeOrderFor,
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

const audienceOptions = AUDIENCE_VALUES.map((audience) => ({
  value: audience,
  label: AUDIENCE_LABELS[audience],
}));

/**
 * The type list depends on the audience, so it is built per render rather than once
 * at module scope. Twelve types share one enum but no type is legal for both
 * audiences — the server enforces that pair, and offering an option it would reject
 * is the kind of form that teaches employers to distrust their own screen.
 */
const typeOptionsFor = (audience) =>
  typeOrderFor(audience).map((type) => ({
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

  /**
   * Changing the audience clears the type, because no type is legal for both.
   *
   * The alternative — leaving "Internship" selected after switching to faculty —
   * would show a valid-looking form that the API refuses, and the refusal would
   * arrive on `type`, a field the employer had not touched. Clearing is the honest
   * move: it says plainly that this choice has to be made again.
   *
   * The duration goes with it, for the same reason `changeType` drops it.
   */
  const changeAudience = (audience) => {
    setForm((previous) =>
      previous.audience === audience
        ? previous
        : {
            ...previous,
            audience,
            type: '',
            durationMonths: '',
            // Graduation years are a student question. Leaving a typed value behind
            // when the audience becomes faculty would send an eligibility rule the
            // employer can no longer see, and the form must never hold data it does
            // not show.
            eligibility: {
              ...previous.eligibility,
              minGraduationYear: '',
              maxGraduationYear: '',
            },
          },
    );
    clearError('audience');
    clearError('type');
    clearError('durationMonths');
    clearError('eligibility.minGraduationYear');
    clearError('eligibility.maxGraduationYear');
  };

  const showsDuration = hasMeaningfulDuration(form.type);
  const isCreating = mode === 'create';

  const audience = form.audience ?? DEFAULT_AUDIENCE;
  const typeOptions = typeOptionsFor(audience);
  const isForAcademicians = audience !== DEFAULT_AUDIENCE;

  /**
   * A stored type that does not belong to the stored audience.
   *
   * Only reachable if the two ever disagreed in the database, which the model
   * prevents — but a Select whose value is absent from its options renders as blank
   * and silently loses the employer's data on the next save, so it gets a real
   * message instead of a shrug.
   */
  const typeOutOfRange = Boolean(form.type) && !isTypeAllowedForAudience(form.type, audience);

  const submit = (statusOverride) => {
    const candidate = statusOverride ? { ...form, status: statusOverride } : form;
    const found = validateOpportunityForm(candidate);

    setClientErrors(found);
    setHasSubmitted(true);

    if (!isValid(found)) return;

    if (statusOverride) setForm(candidate);
    onSubmit(candidate);
  };

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
        description={
          isForAcademicians
            ? 'What faculty will see first in the listing.'
            : 'What students will see first in the listing.'
        }
      >
        <Input
          label="Title"
          name="title"
          value={form.title}
          onChange={(event) => setField('title', event.target.value)}
          error={errors.title}
          placeholder={
            isForAcademicians
              ? 'Industry-Academia Computer Vision Research Collaboration'
              : 'Frontend Developer Intern'
          }
          hint={`Up to ${OPPORTUNITY_LIMITS.titleMax} characters.`}
          disabled={isSaving}
          required
        />

        {/* Audience precedes type because it decides which types exist. Asked in the
            other order, the employer would pick a type and then watch it disappear. */}
        <Select
          label="Who is this for?"
          name="audience"
          value={audience}
          onChange={(event) => changeAudience(event.target.value)}
          options={audienceOptions}
          error={errors.audience}
          hint={
            isCreating
              ? 'Faculty postings — FDPs, research collaborations, consultancy — appear on the academician side of the platform, never in student search.'
              : 'Set when the posting was created and fixed afterwards. To reach the other audience, close this posting and create a new one.'
          }
          disabled={isSaving || !isCreating}
          required
        />

        <Select
          label="Opportunity type"
          name="type"
          value={form.type}
          onChange={(event) => changeType(event.target.value)}
          options={typeOptions}
          placeholder="Choose a type"
          error={
            errors.type ??
            (typeOutOfRange
              ? 'This type does not belong to the selected audience. Choose one from the list.'
              : undefined)
          }
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
          placeholder={
            isForAcademicians
              ? 'The problem you want to work on, what the collaboration involves, and what the department gets out of it.'
              : 'What the work involves, what the team is like, and what a student will learn.'
          }
          hint={`At least ${OPPORTUNITY_LIMITS.descriptionMin} characters. Be specific — this is what makes ${
            isForAcademicians ? 'a department engage' : 'a student apply'
          }.`}
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
              hint="Optional. Only shown for the types that run for a stretch of months."
              disabled={isSaving}
            />
          ) : null}
        </div>
      </FormSection>

      <FormSection
        title="Skills"
        description={
          isForAcademicians
            ? 'Chosen from the shared catalogue, so the expertise you ask for is matched against the same vocabulary academicians describe themselves in.'
            : 'Chosen from the shared catalogue, so the same skill means the same thing on every posting and on every student profile.'
        }
      >
        <SkillRequirementPicker
          label="Required skills"
          description={
            isForAcademicians
              ? 'The expertise this needs, each with the depth you expect. At least one — this is what the match explanation is built from.'
              : 'Must-haves, each with the level you expect. At least one.'
          }
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
          description={
            isForAcademicians
              ? 'Nice-to-haves. No level needed — these show up as "additional relevant expertise" in the match explanation rather than as a requirement.'
              : 'Nice-to-haves. No level needed — a student who has one is a bonus, not a requirement.'
          }
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
        description={
          isForAcademicians
            ? 'All optional. Left empty, the posting is open to every academician.'
            : 'All optional. Left empty, the posting is open to every student.'
        }
      >
        <ChipListField
          label={isForAcademicians ? 'Eligible departments' : 'Eligible branches'}
          value={form.eligibility.branches}
          onChange={(branches) => setEligibilityField('branches', branches)}
          validate={validateNewBranch}
          max={OPPORTUNITY_LIMITS.maxBranches}
          placeholder="Computer Science and Engineering"
          addLabel={isForAcademicians ? 'Add department' : 'Add branch'}
          fullMessage={`You have listed the maximum number of ${
            isForAcademicians ? 'departments' : 'branches'
          }`}
          hint={`Press Enter to add. Leave empty to accept every ${
            isForAcademicians ? 'department' : 'branch'
          }.`}
          error={errors['eligibility.branches']}
          disabled={isSaving}
        />

        {/* Graduation years are a student question and nothing else. An FDP does not
            have a graduating cohort, so the fields are absent rather than disabled —
            a greyed-out input still implies the question was worth asking. */}
        {isForAcademicians ? null : (
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
        )}

        <Textarea
          label="Anything else"
          name="eligibilityNotes"
          value={form.eligibility.notes}
          onChange={(event) => setEligibilityField('notes', event.target.value)}
          error={errors['eligibility.notes']}
          rows={3}
          maxLength={OPPORTUNITY_LIMITS.eligibilityNotesMax}
          placeholder={
            isForAcademicians
              ? 'Minimum years of teaching experience, prior publications, institutional approval — anything a faculty member should know before registering.'
              : 'Minimum CGPA, ongoing coursework, anything a student should know before applying.'
          }
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
            A published opportunity is visible to{' '}
            {isForAcademicians ? 'academicians' : 'students'} straight away. A draft is
            visible only to you.
          </p>
        ) : null}
      </div>
    </form>
  );
}
