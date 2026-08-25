/**
 * Assessment — one attempt at one paper by one student.
 *
 * WHY THE QUESTIONS ARE SNAPSHOTTED ONTO THE ATTEMPT. Scoring reads the score of
 * the option the student picked, from this document. If the attempt merely
 * referenced a question bank, then editing a question, reordering its options or
 * regenerating an AI paper would retroactively change what an already-submitted
 * answer meant. A submitted attempt has to stay explicable months later: this is
 * the paper, this is what you chose, this is what it was worth.
 *
 * WHY OPTION SCORES LIVE ON THE ATTEMPT BUT NEVER REACH THE CLIENT.
 * `toQuestionPaper()` is the only shape the API returns while an attempt is in
 * progress, and it omits `score`. The scores are on the server document because
 * that is where scoring happens; sending them to the browser would put the answer
 * key in the network tab.
 *
 * WHY THERE IS NO `Question` COLLECTION. See data/questionBank.seed.js — the bank
 * is an imported module so an assessment can run on a fresh database with no seed
 * step. This model is the only assessment collection.
 */

import mongoose from 'mongoose';

import {
  ASSESSMENT_STATUSES,
  ASSESSMENT_STATUS_VALUES,
  DIFFICULTIES,
  DIFFICULTY_VALUES,
  QUESTION_SOURCES,
  QUESTION_SOURCE_VALUES,
} from '../constants/assessments.js';
import { SKILL_CATEGORIES, SKILL_CATEGORY_VALUES, SKILL_LEVEL_MAX, SKILL_LEVEL_MIN } from '../constants/skills.js';

const optionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, 'An option needs text'],
      trim: true,
      maxlength: [300, 'Option text cannot exceed 300 characters'],
    },
    /** 100 / 67 / 33 / 0 — partial credit, see constants/assessments.js. */
    score: {
      type: Number,
      required: [true, 'An option needs a score'],
      min: [0, 'Option score cannot be negative'],
      max: [100, 'Option score cannot exceed 100'],
    },
  },
  { _id: false },
);

const questionSchema = new mongoose.Schema(
  {
    /**
     * Where this question came from: a bank id, or `ai-<n>` for a generated one.
     * Kept for traceability when a demo produces a surprising score.
     */
    bankId: { type: String, trim: true, default: '' },
    questionText: {
      type: String,
      required: [true, 'A question needs text'],
      trim: true,
      maxlength: [500, 'Question text cannot exceed 500 characters'],
    },
    /**
     * The skill this question measures. Required and a real reference, because a
     * question that cannot be attributed to a skill cannot contribute to a skill
     * score, and would silently vanish from the result.
     */
    skillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill',
      required: [true, 'A question must reference the skill it measures'],
    },
    /** Denormalised so a result can be rendered without populating. */
    skillName: { type: String, trim: true, default: '' },
    skillSlug: { type: String, trim: true, default: '' },
    category: {
      type: String,
      enum: { values: SKILL_CATEGORY_VALUES, message: '{VALUE} is not a valid category' },
      default: SKILL_CATEGORIES.TECHNICAL,
    },
    difficulty: {
      type: String,
      enum: { values: DIFFICULTY_VALUES, message: '{VALUE} is not a valid difficulty' },
      default: DIFFICULTIES.MEDIUM,
    },
    options: {
      type: [optionSchema],
      validate: {
        validator: (options) => options.length >= 2,
        message: 'A question needs at least two options',
      },
    },
    /**
     * The student's choice, as an index into `options`. `null` means unanswered,
     * which scores zero rather than shortening the paper.
     */
    selectedOptionIndex: {
      type: Number,
      default: null,
      min: [0, 'Selected option index cannot be negative'],
    },
  },
  { _id: false },
);

const skillScoreSchema = new mongoose.Schema(
  {
    skillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill',
      required: true,
    },
    skillName: { type: String, trim: true, default: '' },
    skillSlug: { type: String, trim: true, default: '' },
    category: {
      type: String,
      enum: { values: SKILL_CATEGORY_VALUES, message: '{VALUE} is not a valid category' },
      default: SKILL_CATEGORIES.TECHNICAL,
    },
    /** 0-100, the same scale as StudentProfile.skills[].level. No conversion. */
    score: {
      type: Number,
      required: true,
      min: [SKILL_LEVEL_MIN, 'Score cannot be negative'],
      max: [SKILL_LEVEL_MAX, 'Score cannot exceed 100'],
    },
    questionCount: { type: Number, default: 0, min: 0 },
    correctCount: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const assessmentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'An assessment must belong to a student'],
      index: true,
    },
    /**
     * Optional. A student with no career goal can still be assessed on a broad
     * paper — refusing to start would block the very first thing a new user does.
     */
    careerRoleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CareerRole',
      default: null,
    },
    careerRoleTitle: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: { values: ASSESSMENT_STATUS_VALUES, message: '{VALUE} is not a valid status' },
      default: ASSESSMENT_STATUSES.IN_PROGRESS,
      index: true,
    },
    questionSource: {
      type: String,
      enum: { values: QUESTION_SOURCE_VALUES, message: '{VALUE} is not a valid question source' },
      default: QUESTION_SOURCES.BANK,
    },
    questions: {
      type: [questionSchema],
      validate: {
        validator: (questions) => questions.length > 0,
        message: 'An assessment needs at least one question',
      },
    },
    skillScores: { type: [skillScoreSchema], default: [] },
    /** Unweighted mean of the answered question scores. Readiness is separate. */
    overallScore: {
      type: Number,
      default: 0,
      min: [SKILL_LEVEL_MIN, 'Overall score cannot be negative'],
      max: [SKILL_LEVEL_MAX, 'Overall score cannot exceed 100'],
    },
    answeredCount: { type: Number, default: 0, min: 0 },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: null },
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

/** Dashboards ask for "my latest submitted attempt" constantly. */
assessmentSchema.index({ studentId: 1, status: 1, submittedAt: -1 });

assessmentSchema.virtual('questionCount').get(function questionCount() {
  return this.questions.length;
});

assessmentSchema.virtual('isSubmitted').get(function isSubmitted() {
  return this.status === ASSESSMENT_STATUSES.SUBMITTED;
});

/**
 * The in-progress shape: everything the student needs to answer, and nothing
 * that would tell them the answer. The omission of `score` is the whole point of
 * this method existing, so it is asserted in the test suite.
 */
assessmentSchema.methods.toQuestionPaper = function toQuestionPaper() {
  return {
    id: this._id.toString(),
    status: this.status,
    careerRoleId: this.careerRoleId ? this.careerRoleId.toString() : null,
    careerRoleTitle: this.careerRoleTitle,
    questionSource: this.questionSource,
    questionCount: this.questions.length,
    startedAt: this.startedAt,
    questions: this.questions.map((question, index) => ({
      index,
      questionText: question.questionText,
      skillId: question.skillId.toString(),
      skillName: question.skillName,
      skillSlug: question.skillSlug,
      category: question.category,
      difficulty: question.difficulty,
      selectedOptionIndex: question.selectedOptionIndex,
      options: question.options.map((option, optionIndex) => ({
        index: optionIndex,
        text: option.text,
      })),
    })),
  };
};

/**
 * The submitted shape. Scores are disclosed now — the paper is over, and a
 * student who cannot see why they scored what they did learns nothing from it.
 */
assessmentSchema.methods.toResult = function toResult() {
  return {
    id: this._id.toString(),
    status: this.status,
    careerRoleId: this.careerRoleId ? this.careerRoleId.toString() : null,
    careerRoleTitle: this.careerRoleTitle,
    questionSource: this.questionSource,
    overallScore: this.overallScore,
    questionCount: this.questions.length,
    answeredCount: this.answeredCount,
    startedAt: this.startedAt,
    submittedAt: this.submittedAt,
    skillScores: this.skillScores.map((entry) => ({
      skillId: entry.skillId.toString(),
      skillName: entry.skillName,
      skillSlug: entry.skillSlug,
      category: entry.category,
      score: entry.score,
      questionCount: entry.questionCount,
      correctCount: entry.correctCount,
    })),
    questions: this.questions.map((question, index) => {
      const bestScore = question.options.reduce((best, o) => Math.max(best, o.score), 0);
      const selected =
        question.selectedOptionIndex === null || question.selectedOptionIndex === undefined
          ? null
          : question.options[question.selectedOptionIndex];
      return {
        index,
        questionText: question.questionText,
        skillId: question.skillId.toString(),
        skillName: question.skillName,
        difficulty: question.difficulty,
        selectedOptionIndex: question.selectedOptionIndex ?? null,
        awardedScore: selected ? selected.score : 0,
        bestOptionIndex: question.options.findIndex((o) => o.score === bestScore),
        options: question.options.map((option, optionIndex) => ({
          index: optionIndex,
          text: option.text,
          score: option.score,
        })),
      };
    }),
  };
};

/** The compact form a list or a dashboard card needs. */
assessmentSchema.methods.toSummary = function toSummary() {
  return {
    id: this._id.toString(),
    status: this.status,
    careerRoleId: this.careerRoleId ? this.careerRoleId.toString() : null,
    careerRoleTitle: this.careerRoleTitle,
    overallScore: this.overallScore,
    questionCount: this.questions.length,
    answeredCount: this.answeredCount,
    skillCount: this.skillScores.length,
    startedAt: this.startedAt,
    submittedAt: this.submittedAt,
  };
};

const Assessment = mongoose.model('Assessment', assessmentSchema);

export default Assessment;
