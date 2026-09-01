/**
 * AcademicianProfile — everything about a faculty member that is NOT identity.
 *
 * Relationship design, the same shape StudentProfile uses:
 *
 *   User 1───1 AcademicianProfile        userId, unique index
 *   AcademicianProfile.skills[].skillId ──> Skill  (many refs, shared catalogue)
 *
 * WHY A SEPARATE COLLECTION FROM StudentProfile rather than a `role` field on one
 * shared profile model. The two describe different people. A student profile
 * carries `graduationYear`, `currentYear`, `cgpa`, `targetRoles` and
 * `readinessScore` — every one of which is meaningless for a professor — while
 * this one carries designation, research interests and industry exposure, which
 * are meaningless for an undergraduate. Merging them would produce a document
 * where most fields are null for everybody and no validator could require
 * anything. TRD.md section 7 already models profiles as role-specific
 * collections, and this follows it.
 *
 * WHY IT IS NOT A COPY OF StudentProfile EITHER. The `skills` subdocument is
 * deliberately identical in shape to the student one — same `skillId` ref into
 * the same Skill catalogue, same 0-100 `level`, same `verified`/`source` fields —
 * because the matching engine reads that shape and Step 7's whole matching
 * requirement is satisfied by reusing it rather than writing a second algorithm.
 * Everything else diverges because the subject matter diverges.
 *
 * THE ONE THING THIS MODEL MUST NEVER DO is duplicate name, email, password or
 * role. Those belong to User. The controller merges the safe user object in
 * beside this one, exactly as the student profile controller does, so identity
 * has one home and cannot drift.
 *
 * `verified` on a skill entry stays false throughout Step 7 — there is no faculty
 * assessment engine and nothing in this step sets it true. Storing the field now
 * is what lets the UI say "self-reported" honestly instead of implying otherwise.
 */

import mongoose from 'mongoose';

import {
  ACADEMICIAN_COMPLETION_SECTIONS,
  ACADEMICIAN_DESIGNATION_VALUES,
  ACADEMICIAN_LIMITS,
  ACADEMIC_ACHIEVEMENT_TYPE_VALUES,
  ACADEMIC_EXPERIENCE_TYPE_VALUES,
  isIndustryExperience,
} from '../constants/academicians.js';
import {
  SKILL_LEVEL_MAX,
  SKILL_LEVEL_MIN,
  SKILL_SOURCES,
  SKILL_SOURCE_VALUES,
} from '../constants/skills.js';

/**
 * One skill this academician claims, pointing at the shared catalogue entry.
 *
 * INTENTIONALLY THE SAME SHAPE AS `studentSkillSchema`. `matching.service.js`
 * consumes `{skillId, level, verified, source}` and does not care whose profile
 * it came from, so an academician built to this shape can be scored against an
 * industry posting by the existing engine with no changes to it whatsoever.
 * Inventing a different structure here would have forced a second matcher.
 *
 * `_id: false` — the same skill never appears twice (a pre-validate hook below
 * enforces it), so `skillId` is already the natural key.
 */
const academicianSkillSchema = new mongoose.Schema(
  {
    skillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill',
      required: [true, 'A skill entry must reference a skill'],
    },

    level: {
      type: Number,
      required: [true, 'A skill entry must have a level'],
      min: [SKILL_LEVEL_MIN, `Level cannot be below ${SKILL_LEVEL_MIN}`],
      max: [SKILL_LEVEL_MAX, `Level cannot exceed ${SKILL_LEVEL_MAX}`],
    },

    verified: { type: Boolean, default: false },

    source: {
      type: String,
      enum: { values: SKILL_SOURCE_VALUES, message: '{VALUE} is not a valid skill source' },
      default: SKILL_SOURCES.MANUAL,
    },
  },
  { _id: false },
);

/**
 * A qualification. `_id: true` because the editor addresses one entry at a time —
 * unlike a skill, an education record has no natural key (two MTechs from the
 * same university in different years are two real rows).
 */
const educationSchema = new mongoose.Schema(
  {
    degree: {
      type: String,
      trim: true,
      maxlength: ACADEMICIAN_LIMITS.maxTitleLength,
      required: [true, 'Name the degree'],
    },

    institution: {
      type: String,
      trim: true,
      maxlength: ACADEMICIAN_LIMITS.maxInstitutionLength,
      required: [true, 'Name the institution'],
    },

    /** Free text: "Computer Science", "Signal Processing". Not a catalogue ref. */
    fieldOfStudy: { type: String, trim: true, maxlength: 120, default: '' },

    /**
     * Year only, not a date. Nobody remembers the day they were awarded a PhD,
     * and asking for one would produce invented precision.
     */
    year: {
      type: Number,
      min: [1900, 'That year looks too early'],
      max: [2100, 'That year looks too far ahead'],
      default: null,
    },
  },
  { _id: true, timestamps: true },
);

/**
 * One position held — teaching, research, administrative, or industry.
 *
 * ONE ARRAY FOR BOTH "professional experience" AND "industry experience", split
 * by `experienceType`. See the note in `constants/academicians.js`: two arrays
 * would mean two schemas and two date-ordering bugs to fix separately, and the
 * question worth asking ("has this person worked in industry?") is a filter on
 * one field rather than a check for a non-empty second array.
 */
const academicExperienceSchema = new mongoose.Schema(
  {
    organization: {
      type: String,
      trim: true,
      maxlength: ACADEMICIAN_LIMITS.maxOrganizationLength,
      required: [true, 'Name the organisation'],
    },

    role: {
      type: String,
      trim: true,
      maxlength: ACADEMICIAN_LIMITS.maxRoleLength,
      required: [true, 'What was your role?'],
    },

    experienceType: {
      type: String,
      enum: {
        values: ACADEMIC_EXPERIENCE_TYPE_VALUES,
        message: '{VALUE} is not a valid experience type',
      },
      required: [true, 'Choose an experience type'],
    },

    startDate: { type: Date, required: [true, 'When did it start?'] },

    /** Null while `isCurrent` is true — the hook below keeps the two consistent. */
    endDate: { type: Date, default: null },
    isCurrent: { type: Boolean, default: false },

    description: {
      type: String,
      trim: true,
      maxlength: ACADEMICIAN_LIMITS.maxDescriptionLength,
      default: '',
    },
  },
  { _id: true, timestamps: true },
);

/** A publication, patent, grant or award. */
const academicAchievementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      maxlength: ACADEMICIAN_LIMITS.maxTitleLength,
      required: [true, 'An achievement needs a title'],
    },

    achievementType: {
      type: String,
      enum: {
        values: ACADEMIC_ACHIEVEMENT_TYPE_VALUES,
        message: '{VALUE} is not a valid achievement type',
      },
      required: [true, 'Choose an achievement type'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: ACADEMICIAN_LIMITS.maxDescriptionLength,
      default: '',
    },

    /** Journal, conference, funding body or awarding institution. */
    issuingOrganization: {
      type: String,
      trim: true,
      maxlength: ACADEMICIAN_LIMITS.maxOrganizationLength,
      default: '',
    },

    /** Year only, same reasoning as education. */
    year: {
      type: Number,
      min: [1900, 'That year looks too early'],
      max: [2100, 'That year looks too far ahead'],
      default: null,
    },

    /** DOI, patent number or a link to the published work. */
    url: { type: String, trim: true, maxlength: ACADEMICIAN_LIMITS.maxUrlLength, default: '' },
  },
  { _id: true, timestamps: true },
);

/**
 * Keeps "currently here" and "has an end date" from contradicting each other, and
 * rejects an end that precedes its start.
 *
 * A subdocument validator rather than a service check, so the invariant holds
 * however the document was built — including from the seed. Same technique as
 * `applyDateOrderValidation` on StudentProfile, kept local rather than imported
 * across models so neither can break the other.
 */
academicExperienceSchema.pre('validate', function checkDateOrder(next) {
  if (this.isCurrent) {
    // Trusting the flag over the date: they ticked "still here".
    this.endDate = null;
    return next();
  }

  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'The end date cannot be before the start date');
  }

  return next();
});

const academicianProfileSchema = new mongoose.Schema(
  {
    /**
     * The owner. One profile per user — the unique index is the real guarantee,
     * the service's pre-check only buys a better error message.
     *
     * THIS IS THE OWNERSHIP BOUNDARY. Every read and write derives this from
     * `req.user.id`, never from the URL, so "an academician can only edit their
     * own profile" is structural: there is no route that takes a user id, so
     * addressing someone else's profile is unrepresentable rather than merely
     * refused.
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A profile must belong to a user'],
      unique: true,
      index: true,
    },

    /** Short professional title, e.g. "Associate Professor, Computer Vision". */
    headline: {
      type: String,
      trim: true,
      maxlength: [
        ACADEMICIAN_LIMITS.maxHeadlineLength,
        `Headline cannot exceed ${ACADEMICIAN_LIMITS.maxHeadlineLength} characters`,
      ],
      default: '',
    },

    bio: {
      type: String,
      trim: true,
      maxlength: [
        ACADEMICIAN_LIMITS.maxBioLength,
        `Bio cannot exceed ${ACADEMICIAN_LIMITS.maxBioLength} characters`,
      ],
      default: '',
    },

    /**
     * Institution as free text, with `institutionId` reserved for the future
     * Institution collection — identical treatment to StudentProfile, so when
     * that collection lands both sides link the same way in one backfill.
     */
    institutionName: {
      type: String,
      trim: true,
      maxlength: [
        ACADEMICIAN_LIMITS.maxInstitutionLength,
        `Institution name cannot exceed ${ACADEMICIAN_LIMITS.maxInstitutionLength} characters`,
      ],
      default: '',
    },

    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      default: null,
      index: true,
    },

    department: {
      type: String,
      trim: true,
      maxlength: [
        ACADEMICIAN_LIMITS.maxDepartmentLength,
        `Department cannot exceed ${ACADEMICIAN_LIMITS.maxDepartmentLength} characters`,
      ],
      default: '',
    },

    /**
     * Academic rank from the closed set. Null until set, rather than defaulted to
     * a rank nobody claimed.
     */
    designation: {
      type: String,
      enum: {
        values: [...ACADEMICIAN_DESIGNATION_VALUES, null],
        message: '{VALUE} is not a valid designation',
      },
      default: null,
      index: true,
    },

    /** Only meaningful when `designation` is `other`; cleared otherwise by the hook below. */
    designationOther: {
      type: String,
      trim: true,
      maxlength: ACADEMICIAN_LIMITS.maxDesignationOtherLength,
      default: '',
    },

    location: {
      type: String,
      trim: true,
      maxlength: [
        ACADEMICIAN_LIMITS.maxLocationLength,
        `Location cannot exceed ${ACADEMICIAN_LIMITS.maxLocationLength} characters`,
      ],
      default: '',
    },

    /**
     * Broad subject areas, free text: "Machine Learning", "VLSI Design".
     *
     * FREE TEXT ON PURPOSE, UNLIKE `skills`. An area of expertise is a field of
     * study, not a technology, and the Skill catalogue is a catalogue of
     * technologies and human skills. Forcing "Computational Linguistics" to be a
     * catalogue entry would either pollute the catalogue students pick from or
     * leave the academician unable to describe their own field. The catalogue
     * `skills` array below is what matching reads; this is what a human reads.
     */
    expertiseAreas: { type: [String], default: [] },

    /**
     * What they want to work on with industry: "Edge AI for manufacturing".
     *
     * Feeds the matching engine's career-interest component as free-text titles,
     * which is exactly the shape it already expects from a student's target
     * roles — see `academicianMatchContext()` below.
     */
    researchInterests: { type: [String], default: [] },

    /** Catalogue-backed skills. The half of this profile that matching reads. */
    skills: { type: [academicianSkillSchema], default: [] },

    education: { type: [educationSchema], default: [] },

    /** Teaching, research, administrative and industry positions in one list. */
    experiences: { type: [academicExperienceSchema], default: [] },

    achievements: { type: [academicAchievementSchema], default: [] },

    /**
     * Whether they are open to industry collaboration right now.
     *
     * Stored rather than inferred from "has applied to something recently",
     * because those are different facts: a professor mid-semester with no
     * capacity should be able to say so without deleting their profile. Defaults
     * true — someone who registered as an academician on a collaboration portal
     * has already expressed the interest.
     */
    isOpenToCollaboration: { type: Boolean, default: true },

    /**
     * 0-100, how complete this profile is. Computed by `recomputeCompletion()`
     * below and stored, mirroring StudentProfile's `profileCompletion` so the
     * dashboard card reads the same field name on both sides.
     */
    profileCompletion: { type: Number, min: 0, max: 100, default: 0 },
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

/** "Which faculty work on X?" — the collaboration discovery path. */
academicianProfileSchema.index({ 'skills.skillId': 1 });

/**
 * Guards against the same skill appearing twice, and keeps `designationOther`
 * from carrying a stale value after someone switches away from "Other".
 *
 * The service prevents duplicates on the write path too; this means the invariant
 * holds no matter how the document was constructed, including from the seed.
 *
 * `this.invalidate()` RATHER THAN `next(new Error(...))`, for the same reason
 * Opportunity.js spells out on `noConflictingSkills`. A plain Error is not a
 * Mongoose ValidationError, so errorMiddleware cannot recognise it: the caller
 * gets a 500 "Something went wrong" instead of a 400 naming `skills`, and the
 * duplicate looks like a server fault rather than something they can fix. It also
 * aborts the hook chain, so `designationOther` below would silently keep its stale
 * value on exactly the request that reported an error.
 */
academicianProfileSchema.pre('validate', function normaliseProfile(next) {
  const skillIds = this.skills.map((entry) => String(entry.skillId));
  if (new Set(skillIds).size !== skillIds.length) {
    this.invalidate('skills', 'A profile cannot list the same skill twice.');
  }

  /* Cleared rather than rejected: switching from "Other" to "Professor" is a
     correction, not an error, and leaving the old free text behind would show a
     designation nobody currently claims. */
  if (this.designation !== 'other') {
    this.designationOther = '';
  }

  return next();
});

/**
 * Deterministically scores profile completeness out of 100.
 *
 * The weights live in `constants/academicians.js` as a frozen table and the
 * arithmetic is a sum — no AI, no randomness, no client input, so the same
 * profile always scores the same number.
 *
 * STORED, unlike the student portfolio score, because this one is read by the
 * dashboard card and the matching engine's completeness component rather than
 * only rendered on the page that computes it. The service calls this before every
 * save, the same contract `recomputeCompletion()` has on StudentProfile.
 *
 * @returns {number} the stored percentage
 */
academicianProfileSchema.methods.recomputeCompletion = function recomputeCompletion() {
  const earned = ACADEMICIAN_COMPLETION_SECTIONS.reduce(
    (total, section) => total + (section.filled(this) ? section.weight : 0),
    0,
  );

  // The weights sum to 100 (asserted by the Step 7 verification script), so the
  // clamp is defence against a future bad edit rather than a live concern.
  this.profileCompletion = Math.min(100, Math.max(0, earned));
  return this.profileCompletion;
};

/**
 * The completion breakdown — which sections are done, which are not, and what to
 * do about each.
 *
 * Derived on read rather than stored, so it can never disagree with the profile
 * in front of it. The percentage it reports is recomputed from the same table
 * `recomputeCompletion()` uses, so the two always agree by construction.
 *
 * @returns {{completionPercentage: number, completedSections: string[],
 *            missingSections: Array<{key: string, label: string, weight: number, action: string}>}}
 */
academicianProfileSchema.methods.computeCompletionBreakdown =
  function computeCompletionBreakdown() {
    const completedSections = [];
    const missingSections = [];
    let earned = 0;

    for (const section of ACADEMICIAN_COMPLETION_SECTIONS) {
      if (section.filled(this)) {
        earned += section.weight;
        completedSections.push(section.key);
      } else {
        missingSections.push({
          key: section.key,
          label: section.label,
          weight: section.weight,
          action: section.action,
        });
      }
    }

    return {
      completionPercentage: Math.min(100, Math.max(0, earned)),
      completedSections,
      missingSections,
    };
  };

/** True when any recorded position was industry or consultancy work. */
academicianProfileSchema.methods.hasIndustryExperience = function hasIndustryExperience() {
  return (this.experiences ?? []).some(isIndustryExperience);
};

/**
 * This profile in the shape `calculateMatch({opportunity, student})` expects.
 *
 * THIS METHOD IS WHY STEP 7 NEEDED NO SECOND MATCHING ALGORITHM. The existing
 * engine is already pure — it takes plain objects, not a StudentProfile document
 * — so the only thing standing between it and an academician was a context in the
 * right shape. That is all this is.
 *
 * The mapping, and why each line is honest rather than a fudge:
 *
 *   skills            → the same catalogue refs and levels, unchanged.
 *   careerInterest.titles → research interests. The engine uses titles for a
 *                       fuzzy token overlap against the posting title, and
 *                       "wants to work on computer vision" plays exactly the
 *                       role "wants to be a CV engineer" plays for a student.
 *   careerInterest.skillIds → the same held skill ids. A student's come from
 *                       their target role's blueprint; an academician has no
 *                       blueprint, so their own expertise is the honest answer
 *                       to "which skills is this person interested in?".
 *   branch/graduationYear → deliberately absent. They are student eligibility
 *                       facts. `scoreEligibility` awards full share when a
 *                       posting states no rules, and academician-facing postings
 *                       state student rules for nobody, so this is correct
 *                       rather than merely convenient.
 *   profileCompletion → the stored percentage from this model.
 *
 * @returns {{skills: Array<object>, profileCompletion: number,
 *            careerInterest: {titles: string[], skillIds: string[]}}}
 */
academicianProfileSchema.methods.toMatchContext = function toMatchContext() {
  const skills = (this.skills ?? []).map((entry) => ({
    skillId: entry.skillId && entry.skillId._id ? entry.skillId._id : entry.skillId,
    level: entry.level,
    verified: entry.verified,
    source: entry.source,
  }));

  return {
    skills,
    profileCompletion: this.profileCompletion ?? 0,
    careerInterest: {
      titles: [...(this.researchInterests ?? [])],
      skillIds: skills.map((entry) => String(entry.skillId)),
    },
  };
};

/**
 * The API shape for a profile.
 *
 * Expects `skills.skillId` to have been populated by the service; falls back to
 * bare ids if not, so the method is safe either way. Never includes anything from
 * User beyond the id — the controller merges the safe user object in separately,
 * keeping identity and profile the two separate things they are.
 */
academicianProfileSchema.methods.toProfileObject = function toProfileObject() {
  const mapSkill = (entry) => {
    const populated =
      entry.skillId && typeof entry.skillId === 'object' && entry.skillId.name
        ? entry.skillId
        : null;

    return {
      skillId: populated ? populated._id.toString() : entry.skillId.toString(),
      name: populated ? populated.name : undefined,
      slug: populated ? populated.slug : undefined,
      category: populated ? populated.category : undefined,
      tags: populated ? [...(populated.tags ?? [])] : undefined,
      level: entry.level,
      verified: entry.verified,
      source: entry.source,
    };
  };

  return {
    id: this._id.toString(),
    userId: this.userId.toString(),
    headline: this.headline,
    bio: this.bio,
    institutionName: this.institutionName,
    institutionId: this.institutionId ? this.institutionId.toString() : null,
    department: this.department,
    designation: this.designation,
    designationOther: this.designationOther,
    location: this.location,
    expertiseAreas: [...this.expertiseAreas],
    researchInterests: [...this.researchInterests],
    skills: this.skills.map(mapSkill),
    education: this.education.map((entry) => ({
      id: entry._id.toString(),
      degree: entry.degree,
      institution: entry.institution,
      fieldOfStudy: entry.fieldOfStudy,
      year: entry.year,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    })),
    experiences: this.experiences.map((entry) => ({
      id: entry._id.toString(),
      organization: entry.organization,
      role: entry.role,
      experienceType: entry.experienceType,
      startDate: entry.startDate,
      endDate: entry.endDate,
      isCurrent: entry.isCurrent,
      description: entry.description,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    })),
    achievements: this.achievements.map((entry) => ({
      id: entry._id.toString(),
      title: entry.title,
      achievementType: entry.achievementType,
      description: entry.description,
      issuingOrganization: entry.issuingOrganization,
      year: entry.year,
      url: entry.url,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    })),
    isOpenToCollaboration: this.isOpenToCollaboration,
    hasIndustryExperience: this.hasIndustryExperience(),
    profileCompletion: this.profileCompletion,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const AcademicianProfile = mongoose.model('AcademicianProfile', academicianProfileSchema);

export default AcademicianProfile;
