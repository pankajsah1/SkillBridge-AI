/**
 * Role constants for the UI.
 *
 * Values must match server/src/constants/roles.js exactly — they are compared
 * against the `role` string the API returns. Duplicating the list is
 * unavoidable across a process boundary, so if you add a role, change both
 * files together.
 *
 * The frontend uses these only for display and navigation. Route guards built
 * on them are a convenience, never a security control: the backend re-checks
 * every request.
 */

export const ROLES = Object.freeze({
  STUDENT: 'STUDENT',
  INDUSTRY: 'INDUSTRY',
  ACADEMICIAN: 'ACADEMICIAN',
  INSTITUTION: 'INSTITUTION',
  ADMIN: 'ADMIN',
});

/**
 * Roles offered on the registration form.
 * ADMIN is absent by design — the server rejects it too, which is what
 * actually enforces this.
 */
export const REGISTRATION_ROLES = Object.freeze([
  { value: ROLES.STUDENT, label: 'Student', hint: 'Assess your skills and find opportunities' },
  { value: ROLES.INDUSTRY, label: 'Industry / Recruiter', hint: 'Post opportunities and find talent' },
  { value: ROLES.ACADEMICIAN, label: 'Academician', hint: 'Faculty programmes and collaboration' },
  { value: ROLES.INSTITUTION, label: 'Institution', hint: 'Track student readiness and placements' },
]);

export const ROLE_LABELS = Object.freeze({
  [ROLES.STUDENT]: 'Student',
  [ROLES.INDUSTRY]: 'Industry / Recruiter',
  [ROLES.ACADEMICIAN]: 'Academician',
  [ROLES.INSTITUTION]: 'Institution',
  [ROLES.ADMIN]: 'Administrator',
});

/** Where each role lands after login. Also used to bounce users off foreign dashboards. */
export const ROLE_HOME_PATH = Object.freeze({
  [ROLES.STUDENT]: '/student',
  [ROLES.INDUSTRY]: '/industry',
  [ROLES.ACADEMICIAN]: '/academician',
  [ROLES.INSTITUTION]: '/institution',
  [ROLES.ADMIN]: '/admin',
});

/** Falls back to the status page if an unrecognised role ever appears. */
export const homePathForRole = (role) => ROLE_HOME_PATH[role] || '/status';

export default ROLES;
