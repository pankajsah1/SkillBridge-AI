/**
 * The create/edit form for a learning programme.
 *
 * ONE FORM FOR BOTH, exactly as OpportunityForm is: creating and editing ask the same
 * questions, so a second component would be this one plus a diff, and the diff would
 * rot. `mode` changes the buttons and nothing else.
 *
 * WHO OWNS WHAT. This component owns what the publisher has typed. The page's
 * useLearningProgramEditor owns what is stored and what the server said about it. That
 * split is what makes the PATCH diff possible: you cannot compare "typed" against
 * "stored" when one piece of state is both.
 *
 * ERROR KEYS ARE THE API'S FIELD PATHS — `targetSkills[0]`, `prerequisites[2]`,
 * `endDate`. Client messages use the same keys as the server's 400 response, so both
 * land on the same input with no mapping layer between them. The client checks are a
 * courtesy that saves a round trip; server/src/validators/learning.validator.js is what
 * enforces the rules.
 *
 * NO PUBLISHER FIELD, NO OWNER FIELD, NO AVAILABILITY FIELD. Ownership comes from the
 * token and availability is derived from the status and the end date, so the form does
 * not ask and the API rejects all three by name if anything tries.
 *
 * STATUS IS NOT A DROPDOWN HERE. Creating offers "Publish" and "Save as draft", which
 * are the only two statuses a programme can start in; changing it afterwards is a
 * transition with its own rules and its own buttons on the management list. A select
 * offering "archived" on an edit form would be a fourth place for those rules to live.
 *
 * SkillRequirementPicker AND SearchInput ARE REUSED FROM components/opportunities/
 * rather than copied. The picker's whole point is that every skill on the platform comes
 * from one catalogue — a second picker would be a second chance to diverge. It is passed
 * `withLevel` off, because a programme teaches a skill rather than demanding a level in
 * it.
 */

import { useEffect, useState } from 'react';

import {
  DELIVERY_MODE_LABELS,
  DELIVERY_MODE_ORDER,
  LEARNING_LIMITS,
  LEARNING_PROGRAM_STATUSES,
  LEARNING_PROGRAM_TYPE_LABELS,
  LEARNING_PROGRAM_TYPE_ORDER,
  PROGRAM_LEVEL_LABELS,
  PROGRAM_LEVEL_ORDER,
} from '../../constants/learning.js';
import {
  emptyLearningProgramForm,
  isValid,
  validateLearningProgramForm,
  validateNewPrerequisite,
} from '../../utils/learningValidation.js';
import SkillRequirementPicker from '../opportunities/SkillRequirementPicker.jsx';
import Alert from '../ui/Alert.jsx';
import Button from '../ui/Button.jsx';
import ChipListField from '../ui/ChipListField.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Textarea from '../ui/Textarea.jsx';

/** Every option list comes from the constants, in the constants' own display order. */
const typeOptions = LEARNING_PROGRAM_TYPE_ORDER.map((type) => ({
  value: type,
  label: LEARNING_PROGRAM_TYPE_LABELS[type],
}));

const levelOptions = PROGRAM_LEVEL_ORDER.map((level) => ({
  value: level,
  label: PROGRAM_LEVEL_LABELS[level],
}));

const deliveryModeOptions = DELIVERY_MODE_ORDER.map((mode) => ({
  value: mode,
  label: DELIVERY_MODE_LABELS[mode],
}));

/** A section heading, so this reads as four short forms rather than one long one. */
function FormSection({ title, description, children }) {
  return (
    <section className="border-t border-slate-100 pt-6 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export default function LearningProgramForm({
  /** The stored programme when editing; null or undefined when creating. */
  initialValues = null,
  mode = 'create',
  /** (form) => void | Promise. Only called once the client checks pass. */
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
  const [form, setForm] = useState(() => initialValues ?? emptyLearningProgramForm());
  const [clientErrors, setClientErrors] = useState({});
  const [hasSubmitted, setHasSubmitted] = useState(false);

  /**
   * Re-seeds when the page finishes loading the programme being edited. Keyed on
   * identity: the editor hook hands over a new object only when the server sent a new
   * version, and re-seeding on every render would overwrite what is being typed.
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
   * Only *defined* server messages overlay. Clearing one leaves its key behind holding
   * `undefined`, and a plain spread would let that undefined win over a live client
   * message — the field would fall silent while still being wrong.
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
   * The skill list reports under `targetSkills` and `targetSkills[2]`; prerequisites do
   * the same. Editing the list invalidates all of them, and the indices shift when an
   * entry is removed — so a surviving message would attach itself to a different entry
   * than the one it was written about.
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

  const setList = (field, entries) => {
    setForm((previous) => ({ ...previous, [field]: entries }));
    clearListErrors(field);
  };

  const isCreating = mode === 'create';

  /**
   * Validates, then hands the form up. `statusOverride` is how the two create buttons
   * differ — both run the same validator, because a draft that cannot be published
   * later would be worse than being asked to finish it now.
   *
   * On an edit there is no override: the status the form was seeded with is passed
   * through unchanged, so `buildLearningProgramPatch` leaves it out of the patch and a
   * title edit cannot read as a publish.
   */
  const submit = (statusOverride) => {
    const candidate = statusOverride ? { ...form, status: statusOverride } : form;
    const found = validateLearningProgramForm(candidate);

    setClientErrors(found);
    setHasSubmitted(true);

    if (!isValid(found)) return;

    if (statusOverride) setForm(candidate);
    onSubmit(candidate);
  };

  // `body` is the server's key for "something about the request as a whole" — there is
  // no input to hang it on, so it goes in the banner. The editor hook also reports the
  // empty-patch case here, which is information rather than a failure.
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
        // Enter in a text field lands here. On a new programme the primary intention is
        // to publish; on an edit there is only one way to save.
        submit(isCreating ? LEARNING_PROGRAM_STATUSES.PUBLISHED : null);
      }}
      className="space-y-6"
    >
      {formLevelMessage ? <Alert variant="error" message={formLevelMessage} /> : null}

      <FormSection title="The program" description="What a learner sees first in the catalogue.">
        <Input
          label="Title"
          name="title"
          value={form.title}
          onChange={(event) => setField('title', event.target.value)}
          error={errors.title}
          placeholder="AWS Cloud Fundamentals"
          hint={`Up to ${LEARNING_LIMITS.titleMax} characters.`}
          disabled={isSaving}
          required
        />

        <Input
          label="Provider"
          name="provider"
          value={form.provider}
          onChange={(event) => setField('provider', event.target.value)}
          error={errors.provider}
          placeholder="Amazon Web Services"
          hint="Who runs the program. It can differ from your organisation if you are listing someone else's course."
          disabled={isSaving}
          required
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Program type"
            name="type"
            value={form.type}
            onChange={(event) => setField('type', event.target.value)}
            options={typeOptions}
            placeholder="Choose a type"
            error={errors.type}
            disabled={isSaving}
            required
          />

          <Select
            label="Level"
            name="level"
            value={form.level}
            onChange={(event) => setField('level', event.target.value)}
            options={levelOptions}
            placeholder="Choose a level"
            error={errors.level}
            disabled={isSaving}
            required
          />

          <Select
            label="Delivery mode"
            name="deliveryMode"
            value={form.deliveryMode}
            onChange={(event) => setField('deliveryMode', event.target.value)}
            options={deliveryModeOptions}
            placeholder="Choose a mode"
            error={errors.deliveryMode}
            disabled={isSaving}
            required
          />
        </div>

        <Textarea
          label="Description"
          name="description"
          value={form.description}
          onChange={(event) => setField('description', event.target.value)}
          error={errors.description}
          rows={7}
          maxLength={LEARNING_LIMITS.descriptionMax}
          placeholder="What the program covers, how it is taught, and what a learner will be able to do at the end."
          hint={`At least ${LEARNING_LIMITS.descriptionMin} characters. Be specific — this is what makes a student enroll.`}
          disabled={isSaving}
          required
        />
      </FormSection>

      <FormSection
        title="Skills it teaches"
        description="Chosen from the shared catalogue, so the skills a program teaches are the same vocabulary students' gaps are measured in — this is what lets it be recommended to the right people."
      >
        <SkillRequirementPicker
          label="Skills covered"
          description="At least one. A recommendation is only made when a program covers a skill the student is actually short on, so this list is what puts it in front of anyone."
          field="targetSkills"
          entries={form.targetSkills}
          onChange={(entries) => setList('targetSkills', entries)}
          max={LEARNING_LIMITS.maxSkills}
          errors={errors}
          catalogue={catalogue}
          isLoadingCatalogue={isLoadingCatalogue}
          catalogueError={catalogueError}
          disabled={isSaving}
        />

        <ChipListField
          label="Prerequisites"
          value={form.prerequisites}
          onChange={(entries) => setList('prerequisites', entries)}
          validate={validateNewPrerequisite}
          max={LEARNING_LIMITS.maxPrerequisites}
          placeholder="Basic Python syntax"
          addLabel="Add prerequisite"
          fullMessage="You have listed the maximum number of prerequisites"
          hint="Free text, and optional. Press Enter to add. Left empty, the program reads as open to anyone at this level."
          error={errors.prerequisites}
          disabled={isSaving}
        />
      </FormSection>

      <FormSection
        title="When it runs, and who teaches it"
        description="All optional. A self-paced course with no dates is normal — leaving both empty says the program is always open rather than that its dates are unknown."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Instructor or mentor"
            name="instructor"
            value={form.instructor}
            onChange={(event) => setField('instructor', event.target.value)}
            error={errors.instructor}
            placeholder="Dr. Ananya Rao"
            hint="For a mentorship, this is the mentor."
            disabled={isSaving}
          />

          <Input
            label="Duration in hours"
            name="durationHours"
            type="number"
            value={form.durationHours}
            onChange={(event) => setField('durationHours', event.target.value)}
            error={errors.durationHours}
            placeholder="40"
            hint={`Between ${LEARNING_LIMITS.durationHoursMin} and ${LEARNING_LIMITS.durationHoursMax}. Leave blank if there is no fixed length.`}
            disabled={isSaving}
          />

          <Input
            label="Start date"
            name="startDate"
            type="date"
            value={form.startDate}
            onChange={(event) => setField('startDate', event.target.value)}
            error={errors.startDate}
            hint="A date in the past is allowed — a cohort already running can still be listed."
            disabled={isSaving}
          />

          <Input
            label="End date"
            name="endDate"
            type="date"
            value={form.endDate}
            onChange={(event) => setField('endDate', event.target.value)}
            error={errors.endDate}
            // Not a UI preference: the API refuses a past end date, and enrolment
            // closes on it. Said before the save rather than after the rejection.
            hint="Cannot be in the past — enrolment closes at the end of this day. Leave blank for a program that does not end."
            disabled={isSaving}
          />
        </div>

        <Input
          label="External link"
          name="externalUrl"
          type="url"
          value={form.externalUrl}
          onChange={(event) => setField('externalUrl', event.target.value)}
          error={errors.externalUrl}
          placeholder="https://aws.amazon.com/training/"
          hint="Where the learning actually happens. The portal tracks enrolment and progress; it does not host the content."
          disabled={isSaving}
        />
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
        {isCreating ? (
          <>
            <Button type="submit" isLoading={isSaving}>
              Publish program
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => submit(LEARNING_PROGRAM_STATUSES.DRAFT)}
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
            A published program can be enrolled in straight away. A draft is visible only to you.
          </p>
        ) : null}
      </div>
    </form>
  );
}
