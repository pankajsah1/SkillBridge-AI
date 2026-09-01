/**
 * Application — one student's bid for one opportunity.
 *
 * THE DUPLICATE RULE IS AN INDEX, NOT AN `if`. The service checks for an
 * existing application first so the student gets a sentence rather than a stack
 * trace, but the real guarantee is the unique compound index on
 * `{ studentId, opportunityId }` below. Two clicks on "Apply" 40ms apart can
 * both pass a service-level check — they cannot both pass a unique index. One
 * gets the row, the other gets E11000, and the service turns that into the same
 * 409 the friendly path returns.
 *
 * `matchScoreAtApplication` IS A SNAPSHOT AND MUST NEVER BE RECOMPUTED. It is
 * written once, at creation, from the matching engine. A student applies at 78%,
 * then adds three skills to their profile; if a recruiter's list recalculated,
 * they would see 91% against an application that was never made at that number,
 * and a shortlist built on it would be built on a moving target. TRD section 45
 * puts "Calculate Match Score" inside the creation flow for exactly this reason.
 *
 * `statusHistory` EXISTS BECAUSE A STATUS FIELD ALONE CANNOT ANSWER "when?".
 * "Shortlisted" tells a student where they are; the history tells them it
 * happened four days ago and nothing has moved since, which is the difference
 * between information and reassurance. Entries are appended, never edited.
 *
 * NO INDUSTRY ID ON THIS DOCUMENT, deliberately. Ownership of an application is
 * derived — the opportunity has an `industryId`, and an application belongs to
 * whoever owns the posting. Copying it here would create a second answer to
 * "who owns this?" that could disagree with the first.
 *
 * `studentId` NOW HOLDS AN ACADEMICIAN SOMETIMES, AND KEEPS ITS NAME (Step 7).
 * Since Step 7 an academician can register for a faculty programme or a research
 * collaboration, and that registration is this document: same lifecycle, same six
 * statuses, same snapshot score, same owner-derives-from-posting rule. Renaming the
 * path to `applicantId` would have been more honest and was rejected anyway — it
 * means a migration of every existing row, a rewrite of the unique index, and edits
 * to every file that reads `studentId`, which is exactly the "blindly replace
 * fields throughout the repository" that Step 7 forbids. The field is a `User` ref
 * and always was; `applicantRole` below is what says which kind of user it is.
 */

import mongoose from 'mongoose';

import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_VALUES,
  APPLICATION_LIMITS,
  DEFAULT_APPLICATION_STATUS,
  isTerminalStatus,
} from '../constants/applications.js';
import { APPLICANT_ROLE_VALUES, DEFAULT_APPLICANT_ROLE } from '../constants/roles.js';

/**
 * One recorded move. `_id: false` because these are facts in a log, not
 * resources — nothing ever needs to address a single history entry by id.
 */
const statusChangeSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: { values: APPLICATION_STATUS_VALUES, message: '{VALUE} is not a valid status' },
      required: [true, 'A status change must name a status'],
    },
    changedAt: { type: Date, default: Date.now },
    /** The recruiter's optional one-liner. Shown to the student, so it is trimmed. */
    note: { type: String, trim: true, maxlength: APPLICATION_LIMITS.statusNoteMax, default: '' },
  },
  { _id: false },
);

const applicationSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'An application must belong to a student'],
      index: true,
    },

    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Opportunity',
      required: [true, 'An application must be for an opportunity'],
      index: true,
    },

    /**
     * Which kind of user `studentId` points at (Step 7).
     *
     * A SNAPSHOT OF THE APPLICANT, in the same spirit as
     * `matchScoreAtApplication` below: it records what was true when they applied.
     * If an account's role were ever changed, this row still says what kind of
     * applicant made it, which is what a recruiter reviewing the row needs.
     *
     * WHY STORE IT WHEN IT LOOKS DERIVABLE. The posting's `audience` implies it —
     * a student cannot apply to an academician posting and vice versa, which
     * `loadApplicablePosting` in application.service.js enforces. But that only
     * makes the two agree, not interchangeable: `toRecruiterView` renders rows
     * whose `opportunityId` may be an unpopulated ObjectId, and reading the role
     * off the posting would mean a second query per row purely to decide whether
     * to write "Applicant" or "Academician" on a card. The header explains why the
     * field is not called `applicantId`; this is the field that carries what the
     * name would have said.
     *
     * NOT INDEXED. Nothing filters on it — the applicant's own list is scoped by
     * `studentId` and the recruiter's by `opportunityId`, both already indexed, and
     * an index that no query uses is write cost for nothing.
     */
    applicantRole: {
      type: String,
      enum: { values: APPLICANT_ROLE_VALUES, message: '{VALUE} cannot hold an application' },
      default: DEFAULT_APPLICANT_ROLE,
    },

    /**
     * The fit score at the moment of applying, 0-100.
     *
     * Nullable rather than defaulted to 0: a student with no profile can still
     * apply, and 0 would read as "scored, and scored badly" instead of "not
     * scored". The recruiter UI shows "not scored" for null.
     */
    matchScoreAtApplication: {
      type: Number,
      min: [0, 'A match score cannot be below 0'],
      max: [100, 'A match score cannot be above 100'],
      default: null,
    },

    status: {
      type: String,
      enum: { values: APPLICATION_STATUS_VALUES, message: '{VALUE} is not a valid status' },
      default: DEFAULT_APPLICATION_STATUS,
      index: true,
    },

    coverNote: {
      type: String,
      trim: true,
      maxlength: [
        APPLICATION_LIMITS.coverNoteMax,
        `A cover note cannot be longer than ${APPLICATION_LIMITS.coverNoteMax} characters`,
      ],
      default: '',
    },

    statusHistory: { type: [statusChangeSchema], default: [] },

    appliedAt: { type: Date, default: Date.now },
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
 * ONE APPLICATION PER STUDENT PER OPPORTUNITY — enforced by the database.
 *
 * This is the line that makes TRD section 45's "Has Student Already Applied?"
 * check unbypassable rather than merely usually-correct.
 */
applicationSchema.index({ studentId: 1, opportunityId: 1 }, { unique: true });

/** "My applications, newest first" — the student list page's only query. */
applicationSchema.index({ studentId: 1, appliedAt: -1 });

/**
 * The recruiter's applicant list: one posting, optionally filtered by status,
 * ranked by the snapshot score. Phase 7's candidate ranking reads this index.
 */
applicationSchema.index({ opportunityId: 1, status: 1, matchScoreAtApplication: -1 });

applicationSchema.virtual('isFinal').get(function isFinal() {
  return isTerminalStatus(this.status);
});

/** True when this row belongs to the given student. Used before returning one. */
applicationSchema.methods.isOwnedBy = function isOwnedBy(studentId) {
  return Boolean(studentId) && this.studentId.toString() === String(studentId);
};

/** The history, oldest first, with dates as ISO strings. */
const mapHistory = (entries = []) =>
  entries
    .map((entry) => ({
      status: entry.status,
      changedAt: entry.changedAt,
      note: entry.note ?? '',
    }))
    .sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt));

/**
 * A populated ref may be an id or a document depending on the query, so every
 * projection goes through this rather than assuming one shape.
 */
const isPopulated = (value) => Boolean(value) && typeof value === 'object' && '_id' in value;

const opportunitySummary = (value) => {
  if (!isPopulated(value)) return null;

  const industry = value.industryId;

  return {
    id: value._id.toString(),
    title: value.title,
    type: value.type,
    location: value.location,
    workMode: value.workMode,
    deadline: value.deadline,
    status: value.status,
    industry: isPopulated(industry)
      ? { id: industry._id.toString(), name: industry.name }
      : null,
  };
};

/**
 * What the student sees: their own application, plus enough of the posting to
 * recognise it without a second request.
 *
 * ALSO WHAT AN ACADEMICIAN SEES of their own registration (Step 7). The shape is
 * identical because the thing is identical — one applicant, one posting, one status
 * ladder — and giving academicians a parallel projection would mean two places to
 * fix the next time a field is added to it. `applicantRole` is included so a shared
 * frontend component can label the row without asking who is logged in.
 */
applicationSchema.methods.toStudentView = function toStudentView() {
  return {
    id: this._id.toString(),
    opportunityId: isPopulated(this.opportunityId)
      ? this.opportunityId._id.toString()
      : this.opportunityId.toString(),
    opportunity: opportunitySummary(this.opportunityId),
    applicantRole: this.applicantRole ?? DEFAULT_APPLICANT_ROLE,
    status: this.status,
    matchScoreAtApplication: this.matchScoreAtApplication,
    coverNote: this.coverNote,
    statusHistory: mapHistory(this.statusHistory),
    appliedAt: this.appliedAt,
    updatedAt: this.updatedAt,
    isFinal: isTerminalStatus(this.status),
  };
};

/**
 * What the recruiter sees.
 *
 * NAME AND EMAIL ONLY FROM THE USER DOCUMENT. `password` is `select: false` on
 * the model so it cannot arrive here by accident, but this projection lists its
 * fields explicitly rather than spreading the document — a future field on User
 * should not become visible to every employer because nobody revisited this
 * method.
 *
 * THE `student` KEY KEEPS ITS NAME even when the applicant is an academician
 * (Step 7). It is read by the industry candidate list built in Step 5, and renaming
 * it would break that page for the far more common student case in exchange for a
 * nicer word. `applicantRole` sits beside it so the page can render "Academician"
 * on the rows that are academician registrations.
 */
applicationSchema.methods.toRecruiterView = function toRecruiterView() {
  const student = this.studentId;

  return {
    id: this._id.toString(),
    opportunityId: isPopulated(this.opportunityId)
      ? this.opportunityId._id.toString()
      : this.opportunityId.toString(),
    student: isPopulated(student)
      ? { id: student._id.toString(), name: student.name, email: student.email }
      : { id: this.studentId.toString(), name: null, email: null },
    applicantRole: this.applicantRole ?? DEFAULT_APPLICANT_ROLE,
    status: this.status,
    matchScoreAtApplication: this.matchScoreAtApplication,
    coverNote: this.coverNote,
    statusHistory: mapHistory(this.statusHistory),
    appliedAt: this.appliedAt,
    updatedAt: this.updatedAt,
    isFinal: isTerminalStatus(this.status),
  };
};

/** Every application starts with one history entry, written at creation. */
applicationSchema.statics.initialHistory = function initialHistory(now = new Date()) {
  return [{ status: APPLICATION_STATUSES.APPLIED, changedAt: now, note: '' }];
};

const Application = mongoose.model('Application', applicationSchema);

export default Application;
