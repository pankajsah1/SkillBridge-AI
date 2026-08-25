/**
 * Opportunity model — a role an industry partner posts for students.
 *
 * Relationship design (his section 14 asks for this to be deliberate):
 *
 *   Opportunity.industryId          ──> User        (owner, one industry : many opportunities)
 *   Opportunity.requiredSkills[].skillId ──> Skill  (the SAME shared catalogue)
 *   Opportunity.preferredSkills[].skillId ──> Skill (the SAME shared catalogue)
 *
 * WHY THE SKILL REFERENCES MATTER MORE THAN THEY LOOK. A StudentProfile already
 * stores `skills[].skillId -> Skill` with a 0-100 level, and a CareerRole stores
 * `requiredSkills[].skillId -> Skill` with a required level. Pointing an
 * opportunity at that same catalogue is what makes the later matching step a
 * subtraction — `requiredLevel - studentLevel` per shared skillId — instead of a
 * string-similarity guess. If this model stored "React.js" as free text while a
 * profile stored "React", nothing downstream could line them up, and the matching
 * phase would need a destructive rewrite. So: no second skill list, no free-text
 * skill names, ever.
 *
 * WHY THE OWNER IS A BARE REFERENCE. Only `industryId` is stored — never a copied
 * company name or email. The industry's display name lives on User and is
 * populated on read, so renaming a company updates every posting at once and
 * there is no second copy to drift. It is also the ownership boundary his
 * section 3 requires: this field is always set from `req.user._id` and never from
 * the request body, so "post as someone else" is not expressible.
 *
 * WHY EMBED THE SKILL REQUIREMENTS. A requirement has no life of its own — it is
 * meaningless without the opportunity it belongs to and is always read and
 * written with it. TRD.md section 16 embeds `requiredSkills` as an array for that
 * reason. The skill *definition* is shared and normalised; the *opportunity's
 * relationship to it* (level, weight) is embedded. Same split as StudentProfile.
 *
 * HEADROOM FOR LATER PHASES, without a rewrite: an Application collection will
 * reference `opportunityId` and `studentId` and needs nothing added here; the
 * matching engine reads `requiredSkills` and `importanceWeight`, which already
 * exist; candidate ranking sorts applications, not opportunities. Nothing in this
 * schema has to change for any of that.
 */

import mongoose from 'mongoose';

import { SKILL_LEVEL_MAX, SKILL_LEVEL_MIN } from '../constants/skills.js';
import {
  DEFAULT_OPPORTUNITY_STATUS,
  OPPORTUNITY_LIMITS,
  OPPORTUNITY_STATUS_VALUES,
  OPPORTUNITY_TYPE_VALUES,
  WORK_MODE_VALUES,
  availabilityFor,
} from '../constants/opportunities.js';

/**
 * One skill requirement, pointing at the shared catalogue entry.
 *
 * Deliberately ONE schema used by both `requiredSkills` and `preferredSkills`.
 * The two arrays differ in what they mean to a reader and in how the matching
 * phase will weight them — not in shape — so giving them separate schemas would
 * create two things to keep in step for no gain.
 *
 * `_id: false` for the same reason as StudentProfile.skills: a skill appears at
 * most once per array (enforced below), so `skillId` is already the natural key.
 */
const opportunitySkillSchema = new mongoose.Schema(
  {
    skillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill',
      required: [true, 'A skill requirement must reference a skill'],
    },

    /**
     * The proficiency the employer is looking for, on the same 0-100 scale a
     * student's self-assessment uses (TRD.md section 16 `requiredLevel`,
     * section 21 for the scale). Sharing the scale is the entire point: the gap
     * for one skill is later just `requiredLevel - studentLevel`.
     */
    requiredLevel: {
      type: Number,
      required: [true, 'A skill requirement must state a level'],
      min: [SKILL_LEVEL_MIN, `Level cannot be below ${SKILL_LEVEL_MIN}`],
      max: [SKILL_LEVEL_MAX, `Level cannot exceed ${SKILL_LEVEL_MAX}`],
    },

    /**
     * How much this particular skill matters relative to the others (TRD.md
     * section 16 `importanceWeight`).
     *
     * Stored now, used later: TRD.md section 23.2 weights skills when scoring a
     * candidate, and that phase is explicitly out of scope here. Defaulting to 50
     * — the middle — means an employer who never touches the field produces a
     * flat, unbiased weighting rather than a lopsided one.
     */
    importanceWeight: {
      type: Number,
      default: 50,
      min: [0, 'Importance cannot be negative'],
      max: [100, 'Importance cannot exceed 100'],
    },
  },
  { _id: false },
);

/**
 * Who may apply.
 *
 * TRD.md section 16 defines `branches`, `minGraduationYear` and
 * `maxGraduationYear`. `notes` is added for the free-text "Other Requirements"
 * box that DESIGN.md section 27 Step 4 asks for — the structured fields cannot
 * express "must be able to attend a weekly on-site standup", and without
 * somewhere to put it that requirement ends up jammed into the description.
 *
 * Nothing here is enforced against a student in this step. Eligibility is
 * displayed, not gated, because gating needs an application to gate — Step 5's
 * job. Storing it structurally now means that check is a query later, not a
 * schema change.
 */
const eligibilitySchema = new mongoose.Schema(
  {
    /**
     * Academic branches, e.g. ["Computer Science", "Information Technology"].
     * Empty means open to all branches, which is both the sane default and the
     * honest reading of an employer leaving it blank.
     */
    branches: {
      type: [String],
      default: [],
    },

    minGraduationYear: {
      type: Number,
      min: [OPPORTUNITY_LIMITS.graduationYearMin, 'Graduation year looks too early'],
      max: [OPPORTUNITY_LIMITS.graduationYearMax, 'Graduation year looks too far ahead'],
      default: null,
    },

    maxGraduationYear: {
      type: Number,
      min: [OPPORTUNITY_LIMITS.graduationYearMin, 'Graduation year looks too early'],
      max: [OPPORTUNITY_LIMITS.graduationYearMax, 'Graduation year looks too far ahead'],
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [
        OPPORTUNITY_LIMITS.eligibilityNotesMax,
        `Eligibility notes cannot exceed ${OPPORTUNITY_LIMITS.eligibilityNotesMax} characters`,
      ],
      default: '',
    },
  },
  { _id: false },
);

const opportunitySchema = new mongoose.Schema(
  {
    /**
     * The owning industry user. Named `industryId` because TRD.md section 16
     * names it that, even though `ownerId` might read more naturally — the TRD is
     * the authority on field names here.
     */
    industryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'An opportunity must belong to an industry user'],
      index: true, // TRD.md section 16: industryId -> Index
    },

    title: {
      type: String,
      required: [true, 'An opportunity needs a title'],
      trim: true,
      maxlength: [
        OPPORTUNITY_LIMITS.titleMax,
        `Title cannot exceed ${OPPORTUNITY_LIMITS.titleMax} characters`,
      ],
    },

    type: {
      type: String,
      required: [true, 'An opportunity needs a type'],
      enum: { values: OPPORTUNITY_TYPE_VALUES, message: '{VALUE} is not a valid opportunity type' },
      index: true, // TRD.md section 16: type -> Index
    },

    /**
     * The overview, responsibilities and requirements as one rich text block.
     *
     * DESIGN.md section 27 Step 2 asks for three separate boxes and section 19
     * renders Overview and Responsibilities as separate sections, but TRD.md
     * section 16 defines a single `description` field — and the TRD is
     * authoritative on the schema. The form collects the three parts and joins
     * them into headed paragraphs, which keeps the authoring experience the
     * design asks for without inventing schema fields the TRD does not define.
     */
    description: {
      type: String,
      required: [true, 'An opportunity needs a description'],
      trim: true,
      minlength: [
        OPPORTUNITY_LIMITS.descriptionMin,
        `Description must be at least ${OPPORTUNITY_LIMITS.descriptionMin} characters`,
      ],
      maxlength: [
        OPPORTUNITY_LIMITS.descriptionMax,
        `Description cannot exceed ${OPPORTUNITY_LIMITS.descriptionMax} characters`,
      ],
    },

    /**
     * Free text, e.g. "Bengaluru, India". Kept as typed rather than normalised
     * into a city collection: the student filter is a case-insensitive substring
     * match, which handles "bengaluru" against "Bengaluru, India" without an
     * extra collection to seed and maintain for a three-day build.
     *
     * Required even for remote roles, where a company still has a base location
     * and students still care about the timezone it implies.
     */
    location: {
      type: String,
      required: [true, 'An opportunity needs a location'],
      trim: true,
      maxlength: [
        OPPORTUNITY_LIMITS.locationMax,
        `Location cannot exceed ${OPPORTUNITY_LIMITS.locationMax} characters`,
      ],
    },

    workMode: {
      type: String,
      required: [true, 'An opportunity needs a work mode'],
      enum: { values: WORK_MODE_VALUES, message: '{VALUE} is not a valid work mode' },
    },

    /** Must-have skills. At least one is required — see the validator below. */
    requiredSkills: {
      type: [opportunitySkillSchema],
      default: [],
    },

    /**
     * Nice-to-have skills. Optional by nature.
     *
     * TRD.md section 16 does not define this field; PHASES.md PHASE 3
     * "Opportunity Fields" and DESIGN.md section 27 Step 3 both do. Since the TRD
     * defines no competing field, this is additive rather than a conflict, and it
     * uses the TRD's own subdocument shape so nothing downstream needs a special
     * case for it.
     */
    preferredSkills: {
      type: [opportunitySkillSchema],
      default: [],
    },

    eligibility: {
      type: eligibilitySchema,
      default: () => ({}),
    },

    /**
     * How long the engagement runs, in months.
     *
     * A number rather than free text so "6 Months" on the card (DESIGN.md
     * section 18) is formatted rather than typed, and so it stays comparable if a
     * later phase ever filters on it. Null for open-ended roles — a permanent job
     * has no duration, and PHASES.md line 478 lists the field as applying "when
     * appropriate".
     */
    durationMonths: {
      type: Number,
      min: [OPPORTUNITY_LIMITS.durationMonthsMin, 'Duration must be at least one month'],
      max: [
        OPPORTUNITY_LIMITS.durationMonthsMax,
        `Duration cannot exceed ${OPPORTUNITY_LIMITS.durationMonthsMax} months`,
      ],
      default: null,
    },

    /**
     * The last day applications are accepted. Required, because "no deadline" and
     * "expired" would then be indistinguishable and every availability check
     * would need a special case.
     */
    deadline: {
      type: Date,
      required: [true, 'An opportunity needs an application deadline'],
      index: true, // TRD.md section 16: deadline -> Index
    },

    /** Number of positions. PHASES.md line 480, DESIGN.md section 27 Step 5. */
    openings: {
      type: Number,
      default: 1,
      min: [OPPORTUNITY_LIMITS.openingsMin, 'There must be at least one opening'],
      max: [OPPORTUNITY_LIMITS.openingsMax, 'That is an implausible number of openings'],
    },

    /**
     * What the owner decided: draft, active or closed (TRD.md section 16).
     *
     * NOT where expiry lives. A passed deadline is a fact about the clock, so
     * writing it here would need a nightly job to stay true and would be wrong in
     * between runs. The `availability` virtual derives that on read instead.
     */
    status: {
      type: String,
      enum: { values: OPPORTUNITY_STATUS_VALUES, message: '{VALUE} is not a valid status' },
      default: DEFAULT_OPPORTUNITY_STATUS,
      index: true, // TRD.md section 16: status -> Index
    },
  },
  {
    timestamps: true, // RULES.md section 13.2, TRD.md section 16 createdAt/updatedAt
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

/**
 * The student browse query is always `status + deadline`, so a compound index
 * serves it in one pass rather than intersecting two single-field ones. The
 * single-field indexes TRD.md section 16 asks for stay declared above, since they
 * serve other paths (`type` filtering, owner lists).
 */
opportunitySchema.index({ status: 1, deadline: 1 });

/** "Newest first" within one owner's list — the my-opportunities default sort. */
opportunitySchema.index({ industryId: 1, createdAt: -1 });

/**
 * Text-ish search support for the browse page.
 *
 * A real text index is deliberately NOT used. It would need `$text`, which
 * cannot do partial-word matching — a student typing "front" would get nothing
 * for "Frontend Developer", which is exactly the behaviour a search box must
 * have. The service uses an escaped case-insensitive regex on title, description
 * and location instead: correct for a hackathon-scale collection, and honest
 * about what it is rather than dressed up as search infrastructure.
 */

/**
 * The hex id of a reference, whether it is a bare ObjectId or has been populated
 * into a full document.
 *
 * This exists because `String(someRef)` is only the hex id in the bare case. On a
 * populated path it returns Mongoose's multi-line object dump, so two comparisons
 * that look identical behave differently depending on whether the caller happened
 * to populate. Every place in this file that compares a reference goes through
 * here, so that difference cannot drift back in.
 */
const refId = (value) =>
  String(value && typeof value === 'object' && value._id ? value._id : value);

/**
 * Rejects a document that lists the same skill twice, or the same skill as both
 * required and preferred, or has no required skills at all.
 *
 * The validator layer catches all three first with a field-named 400. This is the
 * backstop: the invariant then holds regardless of how a document was built,
 * including from a seed script or a future bulk import.
 *
 * WHY `this.invalidate()` RATHER THAN `next(new Error(...))`. Aborting a
 * pre-validate hook with a plain Error produces exactly that — a plain Error, not
 * a Mongoose ValidationError. Two things go wrong when it reaches
 * errorMiddleware: it has no `name === 'ValidationError'` and no `isOperational`,
 * so it is masked as a 500 rather than returned as a 400; and because the hook
 * short-circuits, every other field error is swallowed, so a blank form reports
 * one problem instead of all seven. `invalidate()` registers each failure against
 * its own path and lets validation finish, which produces a real ValidationError
 * the existing middleware already maps to a 400 with a `{field, message}` entry
 * per problem. Found by the offline model suite.
 *
 * WHY THE IDS GO THROUGH `refId`. The service loads an opportunity with
 * `.populate()` before editing it, so by the time this hook runs on an update the
 * stored skill references may be full Skill documents while the incoming ones are
 * bare ids. A plain `String()` over a mix of the two compares a document dump
 * against a hex string, which never matches — so a genuine duplicate would slip
 * past this backstop. The service's own overlap check already normalises the same
 * way; this brings the model into line with it.
 */
opportunitySchema.pre('validate', function noConflictingSkills(next) {
  const requiredIds = (this.requiredSkills ?? []).map((entry) => refId(entry.skillId));
  const preferredIds = (this.preferredSkills ?? []).map((entry) => refId(entry.skillId));

  if (new Set(requiredIds).size !== requiredIds.length) {
    this.invalidate(
      'requiredSkills',
      'An opportunity cannot list the same required skill twice.',
    );
  }

  if (new Set(preferredIds).size !== preferredIds.length) {
    this.invalidate(
      'preferredSkills',
      'An opportunity cannot list the same preferred skill twice.',
    );
  }

  if (preferredIds.some((id) => requiredIds.includes(id))) {
    this.invalidate(
      'preferredSkills',
      'A skill cannot be both required and preferred on the same opportunity.',
    );
  }

  /**
   * An opportunity with no required skills cannot be matched against anybody,
   * which makes it useless to every later phase. Enforced here rather than with
   * `required: true` on the array, because Mongoose treats an empty array as
   * present.
   */
  if (requiredIds.length === 0) {
    this.invalidate('requiredSkills', 'An opportunity needs at least one required skill.');
  }

  return next();
});

/**
 * Rejects a graduation-year window that runs backwards.
 *
 * Separate hook so the failure is registered against the right path rather than
 * being lumped in with the skill checks.
 */
opportunitySchema.pre('validate', function coherentEligibility(next) {
  const { minGraduationYear: min, maxGraduationYear: max } = this.eligibility ?? {};

  if (min != null && max != null && min > max) {
    this.invalidate(
      'eligibility.maxGraduationYear',
      'The earliest graduation year cannot be after the latest.',
    );
  }

  return next();
});

/**
 * What a reader actually needs to know: open, expired, closed or draft.
 *
 * A virtual, not a stored field, so it cannot go stale — it is recomputed from
 * `status` and `deadline` every time it is read. This is the backend being the
 * source of truth on expiry, per his section 2; the client displays this value
 * rather than comparing dates itself.
 */
opportunitySchema.virtual('availability').get(function getAvailability() {
  return availabilityFor({ status: this.status, deadline: this.deadline });
});

/** True when a student could act on this right now. */
opportunitySchema.methods.isOpenNow = function isOpenNow(now = new Date()) {
  return availabilityFor({ status: this.status, deadline: this.deadline }, now) === 'open';
};

/**
 * Whether `userId` owns this opportunity.
 *
 * Takes the id rather than reading it from anywhere ambient, and compares as
 * strings so an ObjectId and its hex form both work. Used by the service before
 * every owner-only operation.
 */
opportunitySchema.methods.isOwnedBy = function isOwnedBy(userId) {
  if (!userId) return false;
  // `industryId` may be populated to a full User document, hence refId.
  return refId(this.industryId) === String(userId);
};

/**
 * The API shape for one opportunity.
 *
 * Explicit rather than a spread, so adding an internal field later cannot leak it
 * by accident — the same reason Skill.toPublicObject and User.toSafeObject are
 * written out longhand.
 *
 * When `industryId` has been populated, the owner is exposed as `{id, name}` and
 * nothing more. The industry's email is deliberately withheld: it is contact
 * information no student needs in order to browse, and a browse list is the
 * easiest place in the app to scrape. Applications, later, are the channel for
 * contact.
 *
 * Skills are flattened to include the catalogue name and slug when populated, so
 * the client never has to make a second request to render a tag.
 */
opportunitySchema.methods.toPublicObject = function toPublicObject() {
  const owner = this.industryId;
  const ownerPopulated = owner && typeof owner === 'object' && owner.name;

  const mapSkill = (entry) => {
    const skill = entry.skillId;
    const populated = skill && typeof skill === 'object' && skill.name ? skill : null;

    return {
      skillId: refId(entry.skillId),
      name: populated ? populated.name : undefined,
      slug: populated ? populated.slug : undefined,
      category: populated ? populated.category : undefined,
      requiredLevel: entry.requiredLevel,
      importanceWeight: entry.importanceWeight,
    };
  };

  return {
    id: this._id.toString(),
    industryId: refId(owner),
    industry: ownerPopulated ? { id: refId(owner), name: owner.name } : null,
    title: this.title,
    type: this.type,
    description: this.description,
    location: this.location,
    workMode: this.workMode,
    requiredSkills: this.requiredSkills.map(mapSkill),
    preferredSkills: this.preferredSkills.map(mapSkill),
    eligibility: {
      branches: [...(this.eligibility?.branches ?? [])],
      minGraduationYear: this.eligibility?.minGraduationYear ?? null,
      maxGraduationYear: this.eligibility?.maxGraduationYear ?? null,
      notes: this.eligibility?.notes ?? '',
    },
    durationMonths: this.durationMonths,
    deadline: this.deadline,
    openings: this.openings,
    status: this.status,
    availability: this.availability,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Opportunity = mongoose.model('Opportunity', opportunitySchema);

export default Opportunity;
