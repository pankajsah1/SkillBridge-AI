/**
 * Skill model — the central skill catalogue.
 *
 * TRD.md section 12 opens with the governing sentence: "Skills will be centrally
 * managed." That is the whole point of this collection. A skill is stored once,
 * here, and every other part of the system points at its ObjectId:
 *
 *   StudentProfile.skills[].skillId      what a student has
 *   CareerRole.requiredSkills[].skillId  what a role needs
 *   (later) Assessment.skillId           what a test measures
 *
 * Because all three reference the same document, gap analysis later reduces to
 * comparing two numbers against one shared id. If skills were stored as free
 * text in each place, "React" on a profile and "React.js" on a role would never
 * match and the analysis would be quietly wrong — the exact failure RULES.md
 * section 14 warns about.
 *
 * Students never create skills. They pick from this catalogue, which is
 * populated by `npm run seed`. Admin write endpoints are specified in TRD.md
 * section 30 and are deliberately not built yet.
 */

import mongoose from 'mongoose';

import {
  SKILL_CATEGORIES,
  SKILL_CATEGORY_VALUES,
  toSlug,
} from '../constants/skills.js';

const skillSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Skill name is required'],
      trim: true,
      maxlength: [80, 'Skill name cannot exceed 80 characters'],
    },

    /**
     * Normalised lookup key, derived from `name` — never set by hand.
     *
     * This carries the unique index rather than `name` doing it, so "MongoDB"
     * and "mongodb" collide at the database level instead of both being stored.
     * It is also what the seed script upserts on, which is what makes re-running
     * the seed safe.
     */
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    category: {
      type: String,
      required: [true, 'Skill category is required'],
      enum: { values: SKILL_CATEGORY_VALUES, message: '{VALUE} is not a valid skill category' },
      default: SKILL_CATEGORIES.TECHNICAL,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },

    /**
     * Finer groupings ("Frontend", "Database", ...) from RULES.md section 14.
     * TRD.md section 12 defines this field as a free-form string array, so it is
     * not enum-constrained; SKILL_DOMAINS is the recommended vocabulary and the
     * seed script warns on anything outside it.
     *
     * The profile UI groups a student's skills under these, per the layout in
     * DESIGN.md section 24.
     */
    tags: {
      type: [String],
      default: [],
    },

    /**
     * Lets a skill be retired without deleting it.
     *
     * Deleting would orphan every StudentProfile.skills[] entry pointing at it,
     * leaving profiles referencing an id that no longer resolves. Flipping this
     * to false hides it from the picker while existing profiles keep rendering.
     */
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true, // RULES.md section 13.2
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

/**
 * Keeps `slug` in lockstep with `name`.
 *
 * Derived on save rather than being a caller's responsibility, so there is no
 * way to insert a document whose slug disagrees with its name.
 */
skillSchema.pre('validate', function deriveSlug(next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = toSlug(this.name);
  }
  return next();
});

/** Shape sent to clients. Explicit, so adding an internal field cannot leak it. */
skillSchema.methods.toPublicObject = function toPublicObject() {
  return {
    id: this._id.toString(),
    name: this.name,
    slug: this.slug,
    category: this.category,
    description: this.description,
    tags: [...this.tags],
  };
};

const Skill = mongoose.model('Skill', skillSchema);

export default Skill;
