/**
 * CareerRole model — the target a student aims at.
 *
 * Schema follows TRD.md section 13. A role is a *blueprint*: a list of skills
 * with the level each one is expected to reach and how much it counts. Two
 * later features consume it, which is why the shape matters now:
 *
 *   Gap analysis (TRD.md section 22)    requiredLevel - studentLevel, per skill
 *   Match scoring (TRD.md section 23.2) weighted by importanceWeight
 *
 * Step 3 builds neither. It stores the data those steps will read, and exposes
 * it read-only so a student can choose career goals.
 *
 * Roles are seeded, not user-created. TRD.md section 30 reserves POST/PATCH/
 * DELETE for admins; those endpoints are deliberately not built yet.
 */

import mongoose from 'mongoose';

import {
  SKILL_LEVEL_MAX,
  SKILL_LEVEL_MIN,
  toSlug,
} from '../constants/skills.js';

/**
 * One line of a role's skill blueprint.
 *
 * `_id: false` because these are value objects — nothing ever needs to address
 * a single requirement by its own id, and suppressing it keeps the API payload
 * free of ids that mean nothing to a client.
 */
const requiredSkillSchema = new mongoose.Schema(
  {
    skillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill',
      required: [true, 'A required skill must reference a skill'],
    },

    /**
     * The proficiency this role expects, on the same 0-100 scale a student's own
     * level uses (TRD.md section 21). Sharing one scale is what makes
     * `requiredLevel - currentLevel` meaningful later.
     */
    requiredLevel: {
      type: Number,
      required: [true, 'A required skill must specify a required level'],
      min: [SKILL_LEVEL_MIN, `Required level cannot be below ${SKILL_LEVEL_MIN}`],
      max: [SKILL_LEVEL_MAX, `Required level cannot exceed ${SKILL_LEVEL_MAX}`],
    },

    /**
     * How much this skill counts, as a percentage of the role.
     *
     * PRD.md section 6.3 models it exactly this way — its Backend Developer
     * example lists weights of 15/20/15/15/15/10/10, summing to 100. The seed
     * data keeps that convention and the seed script asserts the sum, so a
     * hand-edited role cannot silently skew a future match score.
     *
     * Not enforced in the schema: Mongoose validates documents, not the
     * relationship between array members, and a cross-field validator here
     * would fire on every partial update. The seed script is the right place
     * for it, and it is where roles actually come from.
     */
    importanceWeight: {
      type: Number,
      required: [true, 'A required skill must specify an importance weight'],
      min: [0, 'Importance weight cannot be negative'],
      max: [100, 'Importance weight cannot exceed 100'],
    },
  },
  { _id: false },
);

const careerRoleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Career role title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },

    /** Same role as Skill.slug: stable key, unique index, safe re-seeding. */
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },

    /**
     * Grouping for the career-goal picker ("Engineering", "Data & AI", ...).
     * Not in TRD.md section 13, added because eight roles in one flat list is a
     * worse choosing experience than eight roles under three headings. Purely
     * presentational — nothing computes on it.
     */
    category: {
      type: String,
      trim: true,
      maxlength: [60, 'Category cannot exceed 60 characters'],
      default: 'General',
      index: true,
    },

    requiredSkills: {
      type: [requiredSkillSchema],
      default: [],
    },

    /**
     * TRD.md section 13. The readiness percentage a student should reach before
     * this role is a realistic target. Stored now, consumed by the readiness
     * score in TRD.md section 24 — not calculated in this step.
     */
    averageReadinessTarget: {
      type: Number,
      min: [SKILL_LEVEL_MIN, 'Readiness target cannot be negative'],
      max: [SKILL_LEVEL_MAX, `Readiness target cannot exceed ${SKILL_LEVEL_MAX}`],
      default: 70,
    },

    /** Retire a role without orphaning the profiles that already target it. */
    isActive: {
      type: Boolean,
      default: true,
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

careerRoleSchema.pre('validate', function deriveSlug(next) {
  if (this.isModified('title') || !this.slug) {
    this.slug = toSlug(this.title);
  }
  return next();
});

/**
 * Client shape.
 *
 * `requiredSkills` is included but its `skillId` is only expanded into a name
 * when the caller populated it — the service does that for the detail endpoint
 * and skips it for the list, so browsing roles does not drag the whole skill
 * catalogue along with it.
 */
careerRoleSchema.methods.toPublicObject = function toPublicObject() {
  return {
    id: this._id.toString(),
    title: this.title,
    slug: this.slug,
    description: this.description,
    category: this.category,
    averageReadinessTarget: this.averageReadinessTarget,
    requiredSkillCount: this.requiredSkills.length,
    requiredSkills: this.requiredSkills.map((requirement) => {
      // populate() replaces the ObjectId with a document; handle both.
      const populated =
        requirement.skillId && typeof requirement.skillId === 'object' && requirement.skillId.name
          ? requirement.skillId
          : null;

      return {
        skillId: populated ? populated._id.toString() : requirement.skillId.toString(),
        skillName: populated ? populated.name : undefined,
        skillCategory: populated ? populated.category : undefined,
        requiredLevel: requirement.requiredLevel,
        importanceWeight: requirement.importanceWeight,
      };
    }),
  };
};

const CareerRole = mongoose.model('CareerRole', careerRoleSchema);

export default CareerRole;
