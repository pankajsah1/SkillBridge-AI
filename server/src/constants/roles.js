/**
 * Role definitions — the single source of truth for authorization.
 *
 * Every other module (User model enum, register validator, role middleware,
 * frontend labels) derives from this file. RULES.md forbids duplicate
 * utilities, and a role list copied into five places is exactly how an
 * authorization bug gets introduced later.
 *
 * NOTE ON CASING AND COUNT — a deliberate, documented divergence from TRD.md:
 * TRD.md section 8 defines the enum as lowercase with four values
 * ("student" | "industry" | "institution" | "admin") and never mentions
 * academicians. RULES.md section 5.3 and DESIGN.md sections 3.2 and 11 all
 * define a fifth Academician role, and the build instruction for this step
 * specified exactly these five values in uppercase. The instruction wins over
 * the TRD enum. If you ever want to move to the TRD's lowercase four-value
 * form, this file plus a data migration is the whole change.
 */

/** Canonical role values, as stored in MongoDB and carried in the JWT. */
export const ROLES = Object.freeze({
  STUDENT: 'STUDENT',
  INDUSTRY: 'INDUSTRY',
  ACADEMICIAN: 'ACADEMICIAN',
  INSTITUTION: 'INSTITUTION',
  ADMIN: 'ADMIN',
});

/** All valid roles — used as the Mongoose enum. */
export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

/**
 * Roles a visitor may choose on the public registration form.
 *
 * ADMIN is deliberately excluded: an attacker who could POST
 * `{ role: "ADMIN" }` to an open endpoint would own the platform. Admin
 * accounts are seeded or promoted by an existing admin in a later step.
 */
export const PUBLIC_REGISTRATION_ROLES = Object.freeze([
  ROLES.STUDENT,
  ROLES.INDUSTRY,
  ROLES.ACADEMICIAN,
  ROLES.INSTITUTION,
]);

/** Human-readable labels. DESIGN.md stores canonical values, displays friendly text. */
export const ROLE_LABELS = Object.freeze({
  [ROLES.STUDENT]: 'Student',
  [ROLES.INDUSTRY]: 'Industry / Recruiter',
  [ROLES.ACADEMICIAN]: 'Academician',
  [ROLES.INSTITUTION]: 'Institution',
  [ROLES.ADMIN]: 'Administrator',
});

export const isValidRole = (role) => ROLE_VALUES.includes(role);

export const isPubliclyRegisterableRole = (role) =>
  PUBLIC_REGISTRATION_ROLES.includes(role);

export default ROLES;
