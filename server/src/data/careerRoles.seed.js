/**
 * Career role seed data — the single source of truth for the role list.
 *
 * Eight roles, which sits inside TRD.md section 44's "5 to 8 Career Roles". The
 * list is the union of the examples in TRD.md section 13 (Frontend, Backend,
 * Full Stack, Data Analyst, Software Engineer, DevOps Engineer) and PRD.md
 * section 6.3 (which adds Data Scientist / ML Engineer and Cybersecurity
 * Analyst), so both documents are satisfied without inventing anything.
 *
 * SKILLS ARE REFERENCED BY SLUG, NOT BY OBJECTID. Ids do not exist until the
 * seed runs, and hardcoding them would make this file environment-specific. The
 * seed script looks each slug up in the Skill collection and fails loudly on a
 * typo rather than quietly writing a role with a missing requirement.
 *
 * `weight` follows the convention PRD.md section 6.3 demonstrates: the weights
 * within a role sum to 100, so a future match score is a straightforward
 * weighted average and the numbers stay comparable across roles. The seed script
 * asserts the sum, so an edit that breaks it cannot reach the database.
 *
 * `level` is the proficiency the role expects, on the same 0-100 scale a student
 * self-reports on (TRD.md section 21). Gap analysis later is
 * `level - studentLevel`, which only works because both use one scale.
 *
 * Nothing here computes a match or a gap. That is TRD.md sections 22 and 23,
 * deliberately out of scope for this step.
 */

/**
 * `category` groups the roles in the career-goal picker. Purely presentational —
 * eight roles under three headings is easier to choose from than eight in a row.
 */
export const CAREER_ROLE_SEED = Object.freeze([
  {
    title: 'Frontend Developer',
    category: 'Engineering',
    description:
      'Builds the parts of a product people actually touch. Turns designs into accessible, responsive interfaces and keeps them fast.',
    averageReadinessTarget: 70,
    requiredSkills: [
      { slug: 'javascript', level: 80, weight: 20 },
      { slug: 'react', level: 80, weight: 25 },
      { slug: 'css', level: 75, weight: 15 },
      { slug: 'html', level: 80, weight: 10 },
      { slug: 'typescript', level: 60, weight: 10 },
      { slug: 'git', level: 65, weight: 10 },
      { slug: 'communication', level: 65, weight: 10 },
    ],
  },
  {
    title: 'Backend Developer',
    category: 'Engineering',
    description:
      'Owns the server side: APIs, data storage, authentication and the correctness of everything the interface depends on.',
    averageReadinessTarget: 70,
    requiredSkills: [
      { slug: 'node-js', level: 80, weight: 20 },
      { slug: 'javascript', level: 75, weight: 15 },
      { slug: 'express-js', level: 75, weight: 15 },
      { slug: 'mongodb', level: 70, weight: 15 },
      { slug: 'rest-api-design', level: 75, weight: 15 },
      { slug: 'authentication-authorization', level: 65, weight: 10 },
      { slug: 'git', level: 65, weight: 10 },
    ],
  },
  {
    title: 'Full Stack Developer',
    category: 'Engineering',
    description:
      'Works end to end, from database schema to rendered pixel. Breadth over depth, with enough of both to ship a feature alone.',
    averageReadinessTarget: 72,
    requiredSkills: [
      { slug: 'javascript', level: 80, weight: 15 },
      { slug: 'react', level: 75, weight: 17 },
      { slug: 'node-js', level: 75, weight: 17 },
      { slug: 'express-js', level: 70, weight: 10 },
      { slug: 'mongodb', level: 70, weight: 15 },
      { slug: 'css', level: 65, weight: 8 },
      { slug: 'html', level: 70, weight: 8 },
      { slug: 'git', level: 70, weight: 10 },
    ],
  },
  {
    title: 'Software Engineer',
    category: 'Engineering',
    description:
      'A generalist engineering role. Strong fundamentals matter more than any single framework, because the framework will change.',
    averageReadinessTarget: 75,
    requiredSkills: [
      { slug: 'data-structures-algorithms', level: 80, weight: 25 },
      { slug: 'system-design', level: 70, weight: 20 },
      { slug: 'javascript', level: 70, weight: 15 },
      { slug: 'java', level: 65, weight: 15 },
      { slug: 'sql', level: 65, weight: 10 },
      { slug: 'problem-solving', level: 80, weight: 10 },
      { slug: 'git', level: 65, weight: 5 },
    ],
  },
  {
    title: 'Data Analyst',
    category: 'Data & AI',
    description:
      'Answers business questions with data. Lives in SQL and charts, and is judged on whether the conclusion holds up.',
    averageReadinessTarget: 68,
    requiredSkills: [
      { slug: 'sql', level: 80, weight: 25 },
      { slug: 'data-analysis', level: 75, weight: 20 },
      { slug: 'data-visualization', level: 75, weight: 20 },
      { slug: 'statistics', level: 65, weight: 15 },
      { slug: 'python', level: 60, weight: 15 },
      { slug: 'communication', level: 70, weight: 5 },
    ],
  },
  {
    title: 'Data Scientist / ML Engineer',
    category: 'Data & AI',
    description:
      'Builds models that make predictions and the pipelines that keep them honest. Statistics first, frameworks second.',
    averageReadinessTarget: 75,
    requiredSkills: [
      { slug: 'machine-learning', level: 80, weight: 25 },
      { slug: 'python', level: 80, weight: 20 },
      { slug: 'statistics', level: 75, weight: 15 },
      { slug: 'pandas', level: 75, weight: 15 },
      { slug: 'deep-learning', level: 65, weight: 15 },
      { slug: 'data-visualization', level: 60, weight: 10 },
    ],
  },
  {
    title: 'DevOps Engineer',
    category: 'Infrastructure',
    description:
      'Makes deployment boring. Owns build pipelines, containers, infrastructure and the feedback loop when something breaks.',
    averageReadinessTarget: 72,
    requiredSkills: [
      { slug: 'linux', level: 80, weight: 20 },
      { slug: 'docker', level: 80, weight: 20 },
      { slug: 'ci-cd', level: 75, weight: 20 },
      { slug: 'kubernetes', level: 65, weight: 15 },
      { slug: 'aws', level: 70, weight: 15 },
      { slug: 'git', level: 75, weight: 10 },
    ],
  },
  {
    title: 'Cybersecurity Analyst',
    category: 'Infrastructure',
    description:
      'Finds weaknesses before someone else does. Monitors, investigates and hardens systems against real attacks.',
    averageReadinessTarget: 72,
    requiredSkills: [
      { slug: 'network-security', level: 80, weight: 25 },
      { slug: 'application-security', level: 75, weight: 20 },
      { slug: 'linux', level: 75, weight: 20 },
      { slug: 'authentication-authorization', level: 70, weight: 15 },
      { slug: 'python', level: 60, weight: 10 },
      { slug: 'problem-solving', level: 75, weight: 10 },
    ],
  },
]);

export default CAREER_ROLE_SEED;
