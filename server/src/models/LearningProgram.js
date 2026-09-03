/**
 * LearningProgram — something a learner enrols in to close a skill gap.
 *
 * WHY THIS COLLECTION EXISTS AT ALL, given Step 7 argued the other way for
 * academician programmes. An Opportunity is a thing you *apply* to: it has
 * openings you compete for, a deadline, a cover note, a snapshot match score, a
 * recruiter deciding, and six statuses that describe their decision about you. A
 * course is a thing you *take*: nobody competes, nobody decides, and the only
 * states that matter describe how far along you are. Forcing the two into one
 * collection would mean every posting carrying four fields that mean nothing to it
 * and an `Application` whose `status` ladder is wrong for half its rows.
 * `constants/opportunities.js` reserved this ground itself — "the Learning Program
 * collection remains available for its own purpose if a later step builds it".
 *
 * FIELD NAMES COME FROM TRD.md SECTION 18 WHERE IT DEFINES THEM: `title`,
 * `provider`, `description`, `targetSkills`, `type`, `level`, `externalUrl`,
 * timestamps. That includes `targetSkills` as a bare array of Skill references
 * rather than the `[{skillId, ...}]` subdocuments Opportunity uses — a programme's
 * relationship to a skill carries no extra data (no required level, no importance
 * weight), so a subdocument would be a wrapper around one field. Where the TRD is
 * silent — the publisher reference, delivery mode, duration, prerequisites,
 * instructor, dates, lifecycle — the Step 8 brief and this project's existing
 * conventions decide.
 *
 * Relationship design, deliberately (as section 14 of the brief asks):
 *
 *   LearningProgram.publisherId  ──> User   (owner, one industry : many programmes)
 *   LearningProgram.targetSkills ──> Skill  (the SAME shared catalogue)
 *   LearningEnrollment.programId ──> LearningProgram
 *   LearningEnrollment.learnerId ──> User
 *
 * THE SHARED SKILL CATALOGUE IS THE WHOLE FEATURE. A StudentProfile stores
 * `skills[].skillId` with a 0-100 level and a CareerRole stores
 * `requiredSkills[].skillId` with a required level, so `readiness.service.js`
 * already knows which skills a given student is short on, by id. Pointing a
 * programme at those same ids makes "which course closes this gap?" a set
 * intersection instead of a string-similarity guess. If this model stored
 * "Amazon Web Services" as free text while the catalogue said "AWS", the
 * recommendation engine would have nothing to join on and Step 8's central claim —
 * that recommendations are data-driven — would be false. So: no second skill
 * collection, no free-text skill names, ever.
 *
 * NO ENROLMENT COUNTER ON THIS DOCUMENT. How many people are enrolled is a fact
 * about the enrolment collection, and copying it here would create a second answer
 * that drifts the first time a write fails half way. The owner's list computes it
 * with one aggregate — the same reasoning that kept `industryId` off Application.
 */

import mongoose from 'mongoose';

import {
  DEFAULT_LEARNING_PROGRAM_STATUS,
  DELIVERY_MODE_VALUES,
  LEARNING_LIMITS,
  LEARNING_PROGRAM_STATUS_VALUES,
  LEARNING_PROGRAM_TYPE_VALUES,
  PROGRAM_AVAILABILITY,
  PROGRAM_LEVEL_VALUES,
  programAvailabilityFor,
} from '../constants/learning.js';

/**
 * The hex id of a reference, whether bare or populated.
 *
 * Same helper, same reason, as in Opportunity.js: `String(ref)` is the hex id only
 * when the path has not been populated, and returns Mongoose's object dump when it
 * has. Every comparison in this file goes through here so that difference cannot
 * silently change what a comparison means.
 */
const refId = (value) =>
  String(value && typeof value === 'object' && value._id ? value._id : value);

const learningProgramSchema = new mongoose.Schema(
  {
    /**
     * The owning user.
     *
     * NAMED `publisherId`, NOT `industryId`. TRD.md section 18 defines no owner
     * field, so there is no authority to defer to here as there was for
     * Opportunity — and the name should say what the relationship is. The route
     * restricts creation to `ROLES.INDUSTRY` (docs/rules.md 5.2 lists "Create
     * learning programs" under Industry), so today every publisher is an industry
     * user; the field name does not need re-doing if that list ever widens.
     *
     * ALWAYS SET FROM THE AUTHENTICATED USER, never from the request body. The
     * validator rejects the field outright if a client sends it, which is what
     * makes "publish as someone else" inexpressible rather than merely discouraged.
     */
    publisherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A learning program must belong to a publisher'],
      index: true,
    },

    title: {
      type: String,
      required: [true, 'A learning program needs a title'],
      trim: true,
      maxlength: [
        LEARNING_LIMITS.titleMax,
        `Title cannot exceed ${LEARNING_LIMITS.titleMax} characters`,
      ],
    },
    /**
     * Who is actually offering the learning — "AWS Training and Certification",
     * "NPTEL", the publishing company's own academy.
     *
     * REQUIRED, AND NOT DERIVED FROM `publisherId`. An industry partner can list a
     * third party's course as readily as their own, and a student choosing between
     * two Docker courses cares far more about who wrote it than who posted it.
     * Deriving this from the owner would quietly relabel every such listing.
     */
    provider: {
      type: String,
      required: [true, 'A learning program needs a provider'],
      trim: true,
      maxlength: [
        LEARNING_LIMITS.providerMax,
        `Provider cannot exceed ${LEARNING_LIMITS.providerMax} characters`,
      ],
    },

    description: {
      type: String,
      required: [true, 'A learning program needs a description'],
      trim: true,
      minlength: [
        LEARNING_LIMITS.descriptionMin,
        `Description must be at least ${LEARNING_LIMITS.descriptionMin} characters`,
      ],
      maxlength: [
        LEARNING_LIMITS.descriptionMax,
        `Description cannot exceed ${LEARNING_LIMITS.descriptionMax} characters`,
      ],
    },

    type: {
      type: String,
      required: [true, 'A learning program needs a type'],
      enum: { values: LEARNING_PROGRAM_TYPE_VALUES, message: '{VALUE} is not a valid program type' },
    },

    level: {
      type: String,
      required: [true, 'A learning program needs a level'],
      enum: { values: PROGRAM_LEVEL_VALUES, message: '{VALUE} is not a valid level' },
    },

    deliveryMode: {
      type: String,
      required: [true, 'A learning program needs a delivery mode'],
      enum: { values: DELIVERY_MODE_VALUES, message: '{VALUE} is not a valid delivery mode' },
    },
    /**
     * The catalogue skills this programme teaches. TRD.md section 18's field name
     * and its shape: bare references, not subdocuments.
     *
     * AT LEAST ONE IS REQUIRED — enforced by the hook below, since Mongoose counts
     * an empty array as present. A programme that teaches no catalogued skill can
     * never appear in a recommendation, because there is nothing to join it to a
     * student's gaps by; it would be a listing the portal could show but never
     * explain, which is the opposite of what Step 8 is for.
     */
    targetSkills: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Skill' }],
      default: [],
    },

    /**
     * What a learner should already have, as free text: "Basic Python", "Comfort
     * with the command line".
     *
     * FREE TEXT ON PURPOSE, unlike `targetSkills`. A real prerequisite is often not
     * a catalogue skill at all ("a laptop with 8GB RAM", "second year onwards"), and
     * forcing it into skill references would either lose it or invent catalogue
     * entries nobody assesses. Nothing gates on this; it is displayed, exactly as
     * `eligibility.notes` is on an opportunity.
     */
    prerequisites: {
      type: [String],
      default: [],
    },

    /**
     * Who teaches it. One field, not `instructor` plus `mentor`.
     *
     * The brief says "instructor/mentor", and two fields would mean four states,
     * two of which are nonsense (both set; a mentorship with an instructor). `type`
     * already says which word to render, so the client writes "Mentor" over this
     * value on a mentorship and "Instructor" everywhere else.
     *
     * Optional: a self-paced course from a provider often has no named person, and
     * an empty string is more honest than inventing one.
     */
    instructor: {
      type: String,
      trim: true,
      maxlength: [
        LEARNING_LIMITS.instructorMax,
        `Instructor cannot exceed ${LEARNING_LIMITS.instructorMax} characters`,
      ],
      default: '',
    },
    /**
     * How long it takes, in hours.
     *
     * HOURS RATHER THAN THE `durationMonths` OPPORTUNITY USES, because the range
     * here starts at a three-hour workshop. Months cannot express that without
     * fractions, and a fractional month is not a unit anybody quotes.
     *
     * Null for open-ended programmes — a mentorship runs until it stops — the same
     * nullable-for-open-ended treatment `durationMonths` gets.
     */
    durationHours: {
      type: Number,
      min: [LEARNING_LIMITS.durationHoursMin, 'Duration must be at least one hour'],
      max: [
        LEARNING_LIMITS.durationHoursMax,
        `Duration cannot exceed ${LEARNING_LIMITS.durationHoursMax} hours`,
      ],
      default: null,
    },

    /** When a cohort begins. Null for self-paced material with no start date. */
    startDate: {
      type: Date,
      default: null,
    },

    /**
     * When it finishes, and the one input to expiry.
     *
     * OPTIONAL, UNLIKE AN OPPORTUNITY'S DEADLINE — and that difference is load
     * bearing. An opportunity must have a deadline because "no deadline" and
     * "expired" would otherwise be indistinguishable. Here a self-paced course
     * genuinely never ends, so null has to mean evergreen; `programAvailabilityFor`
     * spells out how it keeps that from colliding with the unreadable-date case.
     */
    endDate: {
      type: Date,
      default: null,
      index: true,
    },

    /** Where the learning actually lives. Validated as http(s) by the validator. */
    externalUrl: {
      type: String,
      trim: true,
      maxlength: [
        LEARNING_LIMITS.externalUrlMax,
        `Link cannot exceed ${LEARNING_LIMITS.externalUrlMax} characters`,
      ],
      default: '',
    },
    /**
     * What the publisher decided: draft, published or archived.
     *
     * ONE STATUS FIELD, NOT `isPublished` PLUS `isActive`. The brief sketches the
     * two booleans; `constants/learning.js` explains why a single enum replaces
     * them — four combinations, three meanings, and no definition of the fourth.
     *
     * NOT where "ended" lives, for the same reason `status` on an Opportunity is
     * not where "expired" lives: a passed end date is a fact about the clock, and
     * storing it would need a nightly job to stay true and be wrong in between.
     */
    status: {
      type: String,
      enum: { values: LEARNING_PROGRAM_STATUS_VALUES, message: '{VALUE} is not a valid status' },
      default: DEFAULT_LEARNING_PROGRAM_STATUS,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

/**
 * Browse: published programmes, newest first.
 *
 * NEWEST FIRST RATHER THAN "ENDING SOONEST", which is what the opportunity browse
 * sorts by. A deadline creates urgency worth surfacing; a course end date usually
 * does not exist, so sorting by it would order the list by which programmes happen
 * to have dates.
 */
learningProgramSchema.index({ status: 1, createdAt: -1 });

/**
 * The recommendation query: published programmes teaching any of a set of skills.
 *
 * This is the index that makes recommendations cheap. `targetSkills` is an array,
 * so this is a multikey index, and `{status: 'published', targetSkills: {$in: [...]}}`
 * uses it directly rather than scanning every programme and filtering in Node.
 */
learningProgramSchema.index({ status: 1, targetSkills: 1 });

/** "My programmes, newest first" — the publisher list page's only query. */
learningProgramSchema.index({ publisherId: 1, createdAt: -1 });
/*
 * `type`, `level` and `deliveryMode` are deliberately NOT indexed. All three are
 * low-cardinality filters that arrive alongside `status`, which is already the
 * leading field of two indexes, and an index whose selectivity is "one value in
 * five" earns its write cost only on collections far larger than this one. The same
 * judgement `applicantRole` on Application records.
 */

/**
 * Rejects a programme that lists the same skill twice, or none at all.
 *
 * The validator catches both first with a field-named 400. This is the backstop, so
 * the invariant holds however the document was built — including from the demo seed
 * and any future bulk import.
 *
 * `this.invalidate()` rather than `next(new Error(...))`, for the reason spelled out
 * at length on Opportunity's `noConflictingSkills`: a plain Error thrown from a
 * pre-validate hook is not a Mongoose ValidationError, so errorMiddleware masks it
 * as a 500 and every other field error is swallowed.
 *
 * Ids go through `refId` because the service populates `targetSkills` before an
 * edit, so a stored entry may be a full Skill document while an incoming one is a
 * bare id — and a plain `String()` over that mix never matches, which would let a
 * real duplicate past.
 */
learningProgramSchema.pre('validate', function noDuplicateSkills(next) {
  const ids = (this.targetSkills ?? []).map(refId);

  if (new Set(ids).size !== ids.length) {
    this.invalidate('targetSkills', 'A learning program cannot list the same skill twice.');
  }

  if (ids.length === 0) {
    this.invalidate('targetSkills', 'A learning program needs at least one skill it teaches.');
  }

  if (ids.length > LEARNING_LIMITS.maxSkills) {
    this.invalidate(
      'targetSkills',
      `A learning program cannot teach more than ${LEARNING_LIMITS.maxSkills} skills.`,
    );
  }

  return next();
});

/**
 * Rejects a date window that runs backwards.
 *
 * Its own hook so the failure lands on the right path rather than being lumped in
 * with the skill checks. Both dates are optional, so this only fires when both are
 * present — a start with no end is a self-paced cohort, which is legitimate.
 */
learningProgramSchema.pre('validate', function coherentDates(next) {
  const start = this.startDate ? new Date(this.startDate).getTime() : null;
  const end = this.endDate ? new Date(this.endDate).getTime() : null;

  if (Number.isFinite(start) && Number.isFinite(end) && start > end) {
    this.invalidate('endDate', 'A learning program cannot end before it starts.');
  }

  return next();
});
/**
 * Draft, open, ended or archived — what a learner can actually do about this now.
 *
 * A virtual rather than a stored field, so it cannot go stale: it is recomputed
 * from `status` and `endDate` on every read. The backend stays the source of truth
 * on expiry and the client renders this value instead of comparing dates itself.
 */
learningProgramSchema.virtual('availability').get(function getAvailability() {
  return programAvailabilityFor({ status: this.status, endDate: this.endDate });
});

/** True when someone could enrol in this right now. */
learningProgramSchema.methods.isEnrollableNow = function isEnrollableNow(now = new Date()) {
  return (
    programAvailabilityFor({ status: this.status, endDate: this.endDate }, now) ===
    PROGRAM_AVAILABILITY.OPEN
  );
};

/**
 * Whether `userId` published this programme.
 *
 * Takes the id rather than reading anything ambient, and compares as strings so an
 * ObjectId and its hex form both work. Called before every owner-only operation.
 */
learningProgramSchema.methods.isOwnedBy = function isOwnedBy(userId) {
  if (!userId) return false;
  return refId(this.publisherId) === String(userId);
};

/**
 * The API shape for one programme.
 *
 * Written out longhand rather than spread, for the same reason as
 * `Opportunity.toPublicObject`, `Skill.toPublicObject` and `User.toSafeObject`:
 * a field added to this schema later must not become public because nobody
 * revisited this method.
 *
 * The publisher is exposed as `{id, name}` and nothing more — no email. A browse
 * list is the easiest place in the app to scrape, and nobody needs a contact
 * address to read a course description.
 *
 * Skills are flattened to carry the catalogue name, slug and category when
 * populated, so a client never needs a second request to render a tag.
 */
learningProgramSchema.methods.toPublicObject = function toPublicObject() {
  const owner = this.publisherId;
  const ownerPopulated = owner && typeof owner === 'object' && owner.name;

  const mapSkill = (entry) => {
    const populated = entry && typeof entry === 'object' && entry.name ? entry : null;

    return {
      skillId: refId(entry),
      name: populated ? populated.name : undefined,
      slug: populated ? populated.slug : undefined,
      category: populated ? populated.category : undefined,
    };
  };
  return {
    id: this._id.toString(),
    publisherId: refId(owner),
    publisher: ownerPopulated ? { id: refId(owner), name: owner.name } : null,
    title: this.title,
    provider: this.provider,
    description: this.description,
    type: this.type,
    level: this.level,
    deliveryMode: this.deliveryMode,
    targetSkills: (this.targetSkills ?? []).map(mapSkill),
    prerequisites: [...(this.prerequisites ?? [])],
    instructor: this.instructor ?? '',
    durationHours: this.durationHours,
    startDate: this.startDate,
    endDate: this.endDate,
    externalUrl: this.externalUrl ?? '',
    status: this.status,
    availability: this.availability,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const LearningProgram = mongoose.model('LearningProgram', learningProgramSchema);

export default LearningProgram;

