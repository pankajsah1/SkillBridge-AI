/**
 * Skill catalogue seed data — the single source of truth for the skill list.
 *
 * This file exists so the skill vocabulary is written down exactly once. His
 * brief was explicit: "Do not hardcode the same career-role lists in multiple
 * unrelated frontend and backend files." The same applies to skills. The
 * frontend never carries a copy of this list; it fetches GET /api/v1/skills.
 *
 * TRD.md section 44 asks for 25-40 skills. There are 36 here, which is enough to
 * build every career-role blueprint in careerRoles.seed.js and still leave a
 * student room to list skills no single role demands.
 *
 * Slugs are NOT written here — Skill.js derives each one from `name`, so the name
 * is the only thing that can be got wrong. The seed script upserts on the
 * derived slug, which makes `npm run seed` safe to re-run.
 *
 * To add a skill: append it here, re-run the seed. To rename one: change `name`
 * and be aware the slug changes with it, so the old document stays behind under
 * the old slug. Rename in the database if that matters.
 */

import { SKILL_CATEGORIES } from '../constants/skills.js';

const { TECHNICAL, SOFT } = SKILL_CATEGORIES;

/**
 * `tags` uses the vocabulary in SKILL_DOMAINS. A skill can legitimately sit in
 * more than one domain (JavaScript is both frontend and backend); the profile UI
 * groups by the first tag, so list the primary domain first.
 */
export const SKILL_SEED = Object.freeze([
  // ---------------------------------------------------------------- Fundamentals
  {
    name: 'Data Structures & Algorithms',
    category: TECHNICAL,
    tags: ['Fundamentals'],
    description: 'Arrays, trees, graphs, hashing, sorting, searching and complexity analysis.',
  },
  {
    name: 'System Design',
    category: TECHNICAL,
    tags: ['Fundamentals', 'Backend'],
    description: 'Designing scalable services: data flow, caching, queues and trade-offs.',
  },
  {
    name: 'Statistics',
    category: TECHNICAL,
    tags: ['Fundamentals', 'Data Science'],
    description: 'Distributions, hypothesis testing, correlation and statistical inference.',
  },

  // -------------------------------------------------------------------- Frontend
  {
    name: 'HTML',
    category: TECHNICAL,
    tags: ['Frontend'],
    description: 'Semantic markup, forms and accessible document structure.',
  },
  {
    name: 'CSS',
    category: TECHNICAL,
    tags: ['Frontend'],
    description: 'Layout with flexbox and grid, responsive design and modern styling.',
  },
  {
    name: 'JavaScript',
    category: TECHNICAL,
    tags: ['Frontend', 'Backend'],
    description: 'The core language: ES modules, async/await, closures and the DOM.',
  },
  {
    name: 'TypeScript',
    category: TECHNICAL,
    tags: ['Frontend', 'Backend'],
    description: 'Static typing on top of JavaScript: interfaces, generics and narrowing.',
  },
  {
    name: 'React',
    category: TECHNICAL,
    tags: ['Frontend'],
    description: 'Component architecture, hooks, state management and rendering behaviour.',
  },

  // --------------------------------------------------------------------- Backend
  {
    name: 'Node.js',
    category: TECHNICAL,
    tags: ['Backend'],
    description: 'Server-side JavaScript: the event loop, streams and the module system.',
  },
  {
    name: 'Express.js',
    category: TECHNICAL,
    tags: ['Backend'],
    description: 'Routing, middleware composition and error handling in Express.',
  },
  {
    name: 'REST API Design',
    category: TECHNICAL,
    tags: ['Backend'],
    description: 'Resource modelling, HTTP verbs, status codes, versioning and pagination.',
  },
  {
    name: 'Authentication & Authorization',
    category: TECHNICAL,
    tags: ['Backend', 'Security'],
    description: 'Sessions and tokens, password hashing and role-based access control.',
  },
  {
    name: 'Python',
    category: TECHNICAL,
    tags: ['Backend', 'Data Science'],
    description: 'General-purpose Python for scripting, services and data work.',
  },
  {
    name: 'Java',
    category: TECHNICAL,
    tags: ['Backend'],
    description: 'Object-oriented Java, collections, concurrency and the JVM ecosystem.',
  },

  // -------------------------------------------------------------------- Database
  {
    name: 'MongoDB',
    category: TECHNICAL,
    tags: ['Database'],
    description: 'Document modelling, queries, aggregation pipelines and indexing.',
  },
  {
    name: 'SQL',
    category: TECHNICAL,
    tags: ['Database'],
    description: 'Joins, grouping, subqueries, window functions and query tuning.',
  },
  {
    name: 'Data Modeling',
    category: TECHNICAL,
    tags: ['Database'],
    description: 'Normalisation, relationships, embedding versus referencing, schema design.',
  },

  // ------------------------------------------------------------ Cloud and DevOps
  {
    name: 'Git',
    category: TECHNICAL,
    tags: ['Tools', 'DevOps'],
    description: 'Branching, merging, rebasing, resolving conflicts and reviewing history.',
  },
  {
    name: 'Linux',
    category: TECHNICAL,
    tags: ['Tools', 'DevOps'],
    description: 'The shell, file permissions, processes, networking and log inspection.',
  },
  {
    name: 'Docker',
    category: TECHNICAL,
    tags: ['DevOps'],
    description: 'Images, containers, volumes, networking and multi-stage builds.',
  },
  {
    name: 'Kubernetes',
    category: TECHNICAL,
    tags: ['DevOps', 'Cloud'],
    description: 'Pods, deployments, services and configuration at cluster scale.',
  },
  {
    name: 'CI/CD',
    category: TECHNICAL,
    tags: ['DevOps'],
    description: 'Automated build, test and deployment pipelines.',
  },
  {
    name: 'AWS',
    category: TECHNICAL,
    tags: ['Cloud'],
    description: 'Core services for compute, storage, networking and identity.',
  },

  // ---------------------------------------------------------- Data science, AI/ML
  {
    name: 'Data Analysis',
    category: TECHNICAL,
    tags: ['Data Science'],
    description: 'Cleaning, exploring and drawing defensible conclusions from data.',
  },
  {
    name: 'Pandas',
    category: TECHNICAL,
    tags: ['Data Science'],
    description: 'DataFrames, reshaping, grouping and time-series handling in Python.',
  },
  {
    name: 'Data Visualization',
    category: TECHNICAL,
    tags: ['Data Science'],
    description: 'Choosing and building charts that communicate honestly.',
  },
  {
    name: 'Machine Learning',
    category: TECHNICAL,
    tags: ['AI/ML'],
    description: 'Supervised and unsupervised models, feature work and evaluation metrics.',
  },
  {
    name: 'Deep Learning',
    category: TECHNICAL,
    tags: ['AI/ML'],
    description: 'Neural networks, training dynamics, CNNs and transformers.',
  },
  {
    name: 'Natural Language Processing',
    category: TECHNICAL,
    tags: ['AI/ML'],
    description: 'Text preprocessing, embeddings, classification and language models.',
  },

  // -------------------------------------------------------------------- Security
  {
    name: 'Network Security',
    category: TECHNICAL,
    tags: ['Security'],
    description: 'Protocols, firewalls, traffic analysis and common network attacks.',
  },
  {
    name: 'Application Security',
    category: TECHNICAL,
    tags: ['Security'],
    description: 'The OWASP Top Ten, input validation, secrets handling and secure defaults.',
  },

  // ---------------------------------------------------------------- Soft skills
  {
    name: 'Communication',
    category: SOFT,
    tags: ['Soft Skills'],
    description: 'Explaining technical work clearly in writing and in person.',
  },
  {
    name: 'Teamwork',
    category: SOFT,
    tags: ['Soft Skills'],
    description: 'Collaborating, reviewing other people\'s work and sharing context generously.',
  },
  {
    name: 'Problem Solving',
    category: SOFT,
    tags: ['Soft Skills'],
    description: 'Breaking down unfamiliar problems and reasoning to a working answer.',
  },
  {
    name: 'Leadership',
    category: SOFT,
    tags: ['Soft Skills'],
    description: 'Taking ownership, coordinating people and making decisions under doubt.',
  },
  {
    name: 'Time Management',
    category: SOFT,
    tags: ['Soft Skills'],
    description: 'Prioritising, estimating and delivering against a deadline.',
  },
]);

export default SKILL_SEED;
