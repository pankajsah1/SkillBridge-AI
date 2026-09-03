/**
 * LearningEnrollment — one learner's place on one programme.
 *
 * THE DUPLICATE RULE IS AN INDEX, NOT AN `if`. The service checks for an existing
 * enrolment first so a learner gets a sentence rather than a stack trace, but the
 * real guarantee is the unique compound index on `{learnerId, programId}` below.
 * Two clicks on "Enrol" 40ms apart can both pass a service-level check — they
 * cannot both pass a unique index. One gets the row, the other gets E11000, and
 * `errorMiddleware` already turns that into the 409 the friendly path returns. The
 * Step 8 brief asks for both layers explicitly; this is the layer that cannot be
 * raced, and it is also why the demo seed can run twice without special-casing.
 *
 * `learnerId` + `learnerRole`, NOT `studentId`. Application carries `studentId`
 * holding an academician sometimes, and says in its own header that
 * `applicantId` would have been the honest name — rejected there only because
 * renaming it meant migrating every existing row. This collection has no rows yet,
 * so it gets the honest name for free. `learnerRole` is what says which kind of
 * user the reference points at, exactly as `applicantRole` does there.
 *
 * COMPLETION IS EVIDENCE, NOT A SKILL SCORE. This is the single most important
 * thing about this file. Nothing here writes to StudentProfile, and no service that
 * touches it does either: `applySkillScoresToProfile` in assessment.service.js
 * remains the only writer of a measured skill level anywhere in the codebase.
 * Finishing "AWS Cloud Fundamentals" records that you finished it and when — it
 * does not move your AWS number. The number moves when you retake the assessment
 * and demonstrate the improvement, which is the loop Step 8 exists to close and the
 * reason a demo built on it is showing something real.
 *
 * PROGRESS IS MONOTONIC, AND THAT RULE LIVES IN THE SERVICE. Enforcing it here
 * would need the previous value, which a pre-validate hook does not reliably have;
 * `learningEnrollment.service.js` compares against the loaded document. The hooks
 * below enforce the invariants that *are* expressible from one document, so a row
 * cannot claim to be complete at 60% however it was written.
 */

import mongoose from 'mongoose';

import {
  DEFAULT_ENROLLMENT_STATUS,
  DEFAULT_LEARNER_ROLE,
  ENROLLMENT_STATUSES,
  ENROLLMENT_STATUS_VALUES,
  LEARNER_ROLE_VALUES,
  PROGRESS_MAX,
  PROGRESS_MIN,
  PROGRESS_ON_COMPLETION,
  isTerminalEnrollmentStatus,
} from '../constants/learning.js';

/** Hex id of a reference, bare or populated. Same helper, same reason, as elsewhere. */
const refId = (value) =>
  String(value && typeof value === 'object' && value._id ? value._id : value);

const learningEnrollmentSchema = new mongoose.Schema(
  {
    learnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'An enrollment must belong to a learner'],
      index: true,
    },

    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningProgram',
      required: [true, 'An enrollment must be for a learning program'],
      index: true,
    },

    /**
     * Which kind of user `learnerId` points at.
     *
     * A SNAPSHOT, like `applicantRole` on Application: it records what was true when
     * they enrolled, so a later role change does not rewrite history.
     *
     * NOT INDEXED. Nothing filters on it — a learner's own list is scoped by
     * `learnerId` and a publisher's counts by `programId`, both already indexed — and
     * an index no query uses is write cost for nothing.
     */
    learnerRole: {
      type: String,
      enum: { values: LEARNER_ROLE_VALUES, message: '{VALUE} cannot hold an enrollment' },
      default: DEFAULT_LEARNER_ROLE,
    },
    status: {
      type: String,
      enum: { values: ENROLLMENT_STATUS_VALUES, message: '{VALUE} is not a valid status' },
      default: DEFAULT_ENROLLMENT_STATUS,
      index: true,
    },

    /**
     * Percent complete, 0-100.
     *
     * SELF-REPORTED, AND THAT IS FINE. Nobody is being graded on it: it drives a
     * progress bar and the "continue" prompt in My Learning, and the thing that
     * actually measures competence is the assessment. Which is precisely why it must
     * never touch a skill score — a self-reported number that raised a measured one
     * would make the whole engine self-reported.
     *
     * An integer, because half a percent of a course is not a thing anyone means.
     */
    progress: {
      type: Number,
      default: PROGRESS_MIN,
      min: [PROGRESS_MIN, `Progress cannot be below ${PROGRESS_MIN}`],
      max: [PROGRESS_MAX, `Progress cannot be above ${PROGRESS_MAX}`],
      validate: {
        validator: Number.isInteger,
        message: 'Progress must be a whole number of percent',
      },
    },

    enrolledAt: { type: Date, default: Date.now },

    /**
     * When work actually began — set the first time the enrolment leaves `enrolled`.
     *
     * Separate from `enrolledAt` because the gap between them is the interesting
     * number: a learner who enrolled six weeks ago and started yesterday is a
     * different story from one who started the same day, and a single date cannot
     * tell either.
     */
    startedAt: { type: Date, default: null },

    /**
     * When it was finished. Null until then.
     *
     * THIS IS THE TIMESTAMP THE REASSESSMENT PROMPT HANGS OFF — "you completed this
     * on 14 August, retake the assessment to show it" — which is why completion is
     * terminal and this field is never cleared.
     */
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);
/**
 * ONE ENROLMENT PER LEARNER PER PROGRAMME — enforced by the database.
 *
 * This single line is what makes "prevent duplicate enrollment" a guarantee instead
 * of a usually-correct check, and it is the second of the two layers Step 8 requires.
 * It is also what lets the demo seed re-run: a second `enrol` attempt for the same
 * pair cannot create a second row, whatever the caller does.
 */
learningEnrollmentSchema.index({ learnerId: 1, programId: 1 }, { unique: true });

/** "My learning, newest first" — the My Learning page's only query. */
learningEnrollmentSchema.index({ learnerId: 1, enrolledAt: -1 });

/** A publisher's per-programme counts, and the completion tallies beside them. */
learningEnrollmentSchema.index({ programId: 1, status: 1 });

/**
 * Rejects a document whose status and numbers contradict each other.
 *
 * THE SERVICE ALREADY SETS ALL OF THIS. These are backstops, so the invariant holds
 * however a row was written — including from the demo seed — and so a future bulk
 * import cannot quietly create a "completed at 60%" row that renders as a lie in
 * every progress bar that reads it.
 *
 * `this.invalidate()` rather than `next(new Error(...))`, for the reason Opportunity's
 * hooks spell out: a plain Error from a pre-validate hook is not a ValidationError, so
 * errorMiddleware masks it as a 500 and swallows every other field error.
 */
learningEnrollmentSchema.pre('validate', function coherentProgress(next) {
  if (this.status === ENROLLMENT_STATUSES.COMPLETED && this.progress !== PROGRESS_ON_COMPLETION) {
    this.invalidate(
      'progress',
      `A completed enrollment must be at ${PROGRESS_ON_COMPLETION}% progress.`,
    );
  }

  /**
   * `enrolled` with progress on the clock is the other half of the same lie. Any
   * progress above zero means work has started, and `impliedStatusForProgress` is
   * what the service uses to make sure the status says so.
   */
  if (this.status === ENROLLMENT_STATUSES.ENROLLED && this.progress > PROGRESS_MIN) {
    this.invalidate(
      'status',
      'An enrollment with progress recorded cannot still be marked as only enrolled.',
    );
  }

  return next();
});
/**
 * Rejects timestamps that disagree with the status.
 *
 * Its own hook so each failure lands on its own path rather than being reported
 * against `progress`.
 */
learningEnrollmentSchema.pre('validate', function coherentTimestamps(next) {
  if (this.status === ENROLLMENT_STATUSES.COMPLETED && !this.completedAt) {
    this.invalidate('completedAt', 'A completed enrollment must record when it was completed.');
  }

  if (this.status !== ENROLLMENT_STATUSES.COMPLETED && this.completedAt) {
    this.invalidate(
      'completedAt',
      'Only a completed enrollment may carry a completion date.',
    );
  }

  if (this.status !== ENROLLMENT_STATUSES.ENROLLED && !this.startedAt) {
    this.invalidate('startedAt', 'An enrollment past "enrolled" must record when it started.');
  }

  return next();
});

learningEnrollmentSchema.virtual('isComplete').get(function isComplete() {
  return isTerminalEnrollmentStatus(this.status);
});

/**
 * Whether this enrolment belongs to `userId`.
 *
 * THE ANSWER TO "do not allow a student to modify another student's enrollment".
 * The service calls this before every read of one row and before every write, and
 * the id it passes is `req.user.id` — never anything from the request body.
 */
learningEnrollmentSchema.methods.isOwnedBy = function isOwnedBy(userId) {
  if (!userId) return false;
  return refId(this.learnerId) === String(userId);
};

/** A populated ref may be an id or a document depending on the query. */
const isPopulated = (value) => Boolean(value) && typeof value === 'object' && '_id' in value;

/**
 * Enough of the programme to render a My Learning row without a second request.
 *
 * A SUMMARY, NOT THE WHOLE PROGRAMME. `toPublicObject` would put the full
 * description and every prerequisite into each row of a list that shows neither.
 * `targetSkills` is included because the completion prompt names the skills to go
 * and reassess, and that sentence is the point of the whole feature.
 */
const programSummary = (value) => {
  if (!isPopulated(value)) return null;

  return {
    id: value._id.toString(),
    title: value.title,
    provider: value.provider,
    type: value.type,
    level: value.level,
    deliveryMode: value.deliveryMode,
    durationHours: value.durationHours ?? null,
    endDate: value.endDate ?? null,
    status: value.status,
    availability: value.availability,
    targetSkills: (value.targetSkills ?? []).map((skill) =>
      isPopulated(skill)
        ? { skillId: skill._id.toString(), name: skill.name, slug: skill.slug }
        : { skillId: String(skill) },
    ),
  };
};
/**
 * What the learner sees: their own enrolment, plus enough of the programme to
 * recognise it.
 *
 * Explicit object literal rather than a spread, the same discipline every other
 * projection in this project follows — a field added to this schema later must not
 * become visible because nobody revisited this method.
 *
 * THERE IS NO PUBLISHER-FACING PROJECTION OF A LEARNER. A publisher gets counts
 * from `GET /industry/learning-programs` and nothing else: names, emails and
 * progress figures of individual learners are private student information, and the
 * standing rule against accessing it without authorisation covers industry users
 * reading it just as much as academicians. Enrolment numbers answer "is this
 * programme working?" without answering "who is behind on it?".
 */
learningEnrollmentSchema.methods.toLearnerView = function toLearnerView() {
  return {
    id: this._id.toString(),
    programId: isPopulated(this.programId)
      ? this.programId._id.toString()
      : this.programId.toString(),
    program: programSummary(this.programId),
    learnerRole: this.learnerRole ?? DEFAULT_LEARNER_ROLE,
    status: this.status,
    progress: this.progress,
    enrolledAt: this.enrolledAt,
    startedAt: this.startedAt,
    completedAt: this.completedAt,
    isComplete: isTerminalEnrollmentStatus(this.status),
    updatedAt: this.updatedAt,
  };
};

const LearningEnrollment = mongoose.model('LearningEnrollment', learningEnrollmentSchema);

export default LearningEnrollment;

