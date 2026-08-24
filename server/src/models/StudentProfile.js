/**
 * StudentProfile model — everything about a student that is NOT identity.
 *
 * Relationship design (his section 13 asks for this to be deliberate):
 *
 *   User 1───1 StudentProfile          userId, unique index
 *   StudentProfile.skills[].skillId  ──> Skill        (many refs, shared catalogue)
 *   StudentProfile.targetRoles[].roleId ──> CareerRole (many refs, shared catalogue)
 *
 * WHY A SEPARATE COLLECTION rather than more fields on User. Authentication data
 * (name, email, password, role, isActive) is read on every single request by the
 * auth middleware; profile data is read only on profile screens. Keeping them
 * apart means a login does not drag a bio, skill list and career goals through
 * bcrypt-adjacent code, and the password hash lives nowhere near data we send to
 * other students later. It is also what TRD.md section 7 lays out: `Users` and
 * `StudentProfiles` are distinct collections.
 *
 * WHY EMBED skills and targetRoles rather than give them their own collections.
 * They have no life of their own — a skill entry is meaningless without the
 * student it belongs to, and it is always read and written together with the
 * rest of the profile. TRD.md section 9 embeds them as arrays for exactly this
 * reason, and his section 13 says "do not normalize or abstract the database
 * excessively." The *skill definition* is shared and normalised (the Skill
 * collection); the *student's relationship to that skill* (their level) is
 * embedded. That split is the whole design.
 *
 * The one thing this model must never do is duplicate name/email/role — those
 * belong to User, and copying them here would let the two drift.
 */

import mongoose from 'mongoose';

import {
  SKILL_LEVEL_MAX,
  SKILL_LEVEL_MIN,
  SKILL_SOURCES,
  SKILL_SOURCE_VALUES,
} from '../constants/skills.js';

/**
 * One skill a student claims, pointing at the shared catalogue entry.
 *
 * `_id: false` — a student never has the same skill twice (the service and a
 * schema validator both enforce that), so `skillId` is already the natural key
 * and a second synthetic id would only be noise in the payload.
 */
const studentSkillSchema = new mongoose.Schema(
  {
    skillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill',
      required: [true, 'A skill entry must reference a skill'],
    },

    /**
     * Proficiency, 0-100 (TRD.md section 21). The frontend renders the band
     * label; the database stores the number so the assessment engine can later
     * overwrite a self-reported figure with a computed one in the same field.
     */
    level: {
      type: Number,
      required: [true, 'A skill entry must have a level'],
      min: [SKILL_LEVEL_MIN, `Level cannot be below ${SKILL_LEVEL_MIN}`],
      max: [SKILL_LEVEL_MAX, `Level cannot exceed ${SKILL_LEVEL_MAX}`],
    },

    /**
     * False until something authoritative confirms the level. Step 3 only writes
     * self-reported skills, so this stays false throughout; the assessment step
     * is what will set it true. Storing it now is what lets the UI say
     * "self-reported" honestly instead of implying verification.
     */
    verified: {
      type: Boolean,
      default: false,
    },

    /** How the level was arrived at (TRD.md section 9). Manual for every Step 3 write. */
    source: {
      type: String,
      enum: { values: SKILL_SOURCE_VALUES, message: '{VALUE} is not a valid skill source' },
      default: SKILL_SOURCES.MANUAL,
    },
  },
  { _id: false },
);

/** A career goal: a pointer into the CareerRole catalogue plus an ordering. */
const targetRoleSchema = new mongoose.Schema(
  {
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CareerRole',
      required: [true, 'A target role must reference a career role'],
    },

    /**
     * 1 = primary goal. Lower numbers rank higher. Lets a student say "mainly a
     * backend developer, secondarily full-stack" without a separate model, and
     * gives later matching a defined order to weight by.
     */
    priority: {
      type: Number,
      default: 1,
      min: [1, 'Priority starts at 1'],
    },
  },
  { _id: false },
);

/**
 * A project entry. Included because TRD.md section 9 defines it and the later
 * portfolio step (roadmap) will read it, so defining it now avoids a schema
 * migration. Step 3 does NOT build a project-editing UI — his section 12 defers
 * the portfolio — but the field is validated if a caller sends it, so it is not
 * dead weight.
 */
const projectSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, maxlength: 150, required: true },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    technologies: { type: [String], default: [] },
    projectUrl: { type: String, trim: true, maxlength: 500, default: '' },
    repositoryUrl: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { _id: true },
);

/** Certification entry — same rationale as projects (TRD.md section 9, portfolio step). */
const certificationSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, maxlength: 150, required: true },
    issuer: { type: String, trim: true, maxlength: 150, default: '' },
    credentialUrl: { type: String, trim: true, maxlength: 500, default: '' },
    issueDate: { type: Date },
  },
  { _id: true },
);

const studentProfileSchema = new mongoose.Schema(
  {
    /**
     * The owner. One profile per user — the unique index is the real guarantee,
     * the service's friendly pre-check is just for a better error message. This
     * is also the ownership boundary his section 9 requires: a profile is
     * fetched and mutated by deriving this from req.user, never from the URL, so
     * one student can never address another's profile.
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A profile must belong to a user'],
      unique: true, // TRD.md section 9: userId -> Unique Index
      index: true,
    },

    /** Optional short professional title, e.g. "Final-year CS student". DESIGN.md section 26. */
    headline: {
      type: String,
      trim: true,
      maxlength: [120, 'Headline cannot exceed 120 characters'],
      default: '',
    },

    bio: {
      type: String,
      trim: true,
      maxlength: [1000, 'Bio cannot exceed 1000 characters'],
      default: '',
    },

    /**
     * Institution as free text — what a student types in the MVP form
     * (PHASES.md PHASE 2, PRD.md section 6.2 both treat it as text).
     *
     * `institutionId` below is the TRD.md section 9 reference to a future
     * Institution collection. That collection does not exist yet (deferred to
     * the analytics step), so the ref stays null for now; keeping the field and
     * its index means linking students to real institutions later is a
     * backfill, not a migration.
     */
    institutionName: {
      type: String,
      trim: true,
      maxlength: [150, 'Institution name cannot exceed 150 characters'],
      default: '',
    },

    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      default: null,
      index: true, // TRD.md section 9: institutionId -> Index
    },

    degree: {
      type: String,
      trim: true,
      maxlength: [100, 'Degree cannot exceed 100 characters'],
      default: '',
    },

    branch: {
      type: String,
      trim: true,
      maxlength: [100, 'Branch cannot exceed 100 characters'],
      default: '',
    },

    /** Expected graduation year. Bounds are sanity limits, not business rules. */
    graduationYear: {
      type: Number,
      min: [1950, 'Graduation year looks too early'],
      max: [2100, 'Graduation year looks too far ahead'],
      default: null,
    },

    /** Current year of study, 1-6. His section 1 allows "current year if appropriate". */
    currentYear: {
      type: Number,
      min: [1, 'Year of study starts at 1'],
      max: [6, 'Year of study cannot exceed 6'],
      default: null,
    },

    /** CGPA on a 10-point scale (PHASES.md PHASE 2 Academic Information). */
    cgpa: {
      type: Number,
      min: [0, 'CGPA cannot be negative'],
      max: [10, 'CGPA cannot exceed 10'],
      default: null,
    },

    location: {
      type: String,
      trim: true,
      maxlength: [120, 'Location cannot exceed 120 characters'],
      default: '',
    },

    /** Free-text areas of interest, e.g. "Web Development", "Machine Learning". TRD.md section 9. */
    interests: {
      type: [String],
      default: [],
    },

    /** Selected career goals — the "Career Goals" half of this step. */
    targetRoles: {
      type: [targetRoleSchema],
      default: [],
    },

    /** The student's skills — the "Skills" half of this step. */
    skills: {
      type: [studentSkillSchema],
      default: [],
    },

    /** Deferred to the portfolio step; schema-defined now, no Step 3 UI. */
    projects: {
      type: [projectSchema],
      default: [],
    },

    certifications: {
      type: [certificationSchema],
      default: [],
    },

    /**
     * TRD.md section 9. The career-readiness percentage from the assessment /
     * readiness engine (TRD.md section 24). NOT computed in this step — null
     * means "not assessed yet", which the UI states plainly rather than showing
     * a misleading 0%.
     */
    readinessScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    /**
     * TRD.md section 9. 0-100, how complete the profile is. This one IS computed
     * here (recomputeCompletion() below), because his section 8 and DESIGN.md
     * section 15.2 both want a completion indicator and it needs no later
     * engine — just the fields already on this document.
     */
    profileCompletion: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
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

// TRD.md section 9 index. Also the query path for "all students targeting role X".
studentProfileSchema.index({ 'targetRoles.roleId': 1 });

/**
 * Guards against the same skill or role appearing twice in one profile.
 *
 * The service already prevents it on the write path, but a validator here means
 * the invariant holds no matter how a document is constructed — belt and braces
 * for the "no duplicate skill entries" rule in his section 6.
 */
studentProfileSchema.pre('validate', function noDuplicateRefs(next) {
  const skillIds = this.skills.map((entry) => String(entry.skillId));
  if (new Set(skillIds).size !== skillIds.length) {
    return next(new Error('A profile cannot list the same skill twice.'));
  }

  const roleIds = this.targetRoles.map((entry) => String(entry.roleId));
  if (new Set(roleIds).size !== roleIds.length) {
    return next(new Error('A profile cannot list the same career goal twice.'));
  }

  return next();
});

/**
 * Deterministically scores profile completeness out of 100.
 *
 * Weights are declared here, in one place, so the number the dashboard shows and
 * the number stored in the document can never disagree. The set is deliberately
 * the fields a student can fill in Step 3 — nothing depends on a later engine.
 * Called by the service after every write.
 */
const COMPLETION_WEIGHTS = Object.freeze([
  { key: 'bio', weight: 15, filled: (p) => p.bio && p.bio.trim().length > 0 },
  { key: 'institutionName', weight: 15, filled: (p) => p.institutionName && p.institutionName.trim().length > 0 },
  { key: 'branch', weight: 10, filled: (p) => p.branch && p.branch.trim().length > 0 },
  { key: 'graduationYear', weight: 10, filled: (p) => Boolean(p.graduationYear) },
  { key: 'location', weight: 10, filled: (p) => p.location && p.location.trim().length > 0 },
  { key: 'interests', weight: 15, filled: (p) => p.interests.length > 0 },
  { key: 'targetRoles', weight: 10, filled: (p) => p.targetRoles.length > 0 },
  { key: 'skills', weight: 15, filled: (p) => p.skills.length > 0 },
]);

studentProfileSchema.methods.recomputeCompletion = function recomputeCompletion() {
  const earned = COMPLETION_WEIGHTS.reduce(
    (total, field) => total + (field.filled(this) ? field.weight : 0),
    0,
  );
  // The weights sum to 100 (asserted in tests), so clamping is defensive only.
  this.profileCompletion = Math.min(100, Math.max(0, earned));
  return this.profileCompletion;
};

/**
 * The API shape for a profile.
 *
 * Expects skills.skillId and targetRoles.roleId to have been populated by the
 * service; falls back gracefully to bare ids if not, so the method is safe to
 * call in either case. Never includes anything from User beyond the id — the
 * controller merges the safe user object in separately, keeping identity and
 * profile as the two clearly separate things they are.
 */
studentProfileSchema.methods.toProfileObject = function toProfileObject() {
  const mapSkill = (entry) => {
    const populated =
      entry.skillId && typeof entry.skillId === 'object' && entry.skillId.name ? entry.skillId : null;
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

  const mapRole = (entry) => {
    const populated =
      entry.roleId && typeof entry.roleId === 'object' && entry.roleId.title ? entry.roleId : null;
    return {
      roleId: populated ? populated._id.toString() : entry.roleId.toString(),
      title: populated ? populated.title : undefined,
      category: populated ? populated.category : undefined,
      priority: entry.priority,
    };
  };

  return {
    id: this._id.toString(),
    userId: this.userId.toString(),
    headline: this.headline,
    bio: this.bio,
    institutionName: this.institutionName,
    institutionId: this.institutionId ? this.institutionId.toString() : null,
    degree: this.degree,
    branch: this.branch,
    graduationYear: this.graduationYear,
    currentYear: this.currentYear,
    cgpa: this.cgpa,
    location: this.location,
    interests: [...this.interests],
    targetRoles: this.targetRoles.map(mapRole),
    skills: this.skills.map(mapSkill),
    projects: this.projects.map((project) => ({
      id: project._id.toString(),
      title: project.title,
      description: project.description,
      technologies: [...project.technologies],
      projectUrl: project.projectUrl,
      repositoryUrl: project.repositoryUrl,
    })),
    certifications: this.certifications.map((cert) => ({
      id: cert._id.toString(),
      title: cert.title,
      issuer: cert.issuer,
      credentialUrl: cert.credentialUrl,
      issueDate: cert.issueDate,
    })),
    readinessScore: this.readinessScore,
    profileCompletion: this.profileCompletion,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);

export default StudentProfile;
