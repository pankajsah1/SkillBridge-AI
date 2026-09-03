/**
 * Demo data — the cohort, the employers, the postings and the learning the demo runs on.
 *
 * DATA ONLY. No database access, no mongoose import, nothing async. `scripts/seedDemo.js`
 * is the mechanism; this file is the content, kept separate for the same reason
 * skills.seed.js is: the numbers below are the thing that gets argued about, and they
 * should be readable without reading a loop.
 *
 * FIVE PERSONAS, AND DELIBERATELY NOT FIVE GOOD ONES. A demo where every student is
 * employable proves nothing — the product's whole claim is that it can tell students
 * apart and tell an institution where the gaps are. So the cohort spans:
 *
 *   A  Ready       assessed, mostly verified, high readiness. The success story.
 *   B  Solid       assessed, strong in one area and thin in another. The realistic middle.
 *   C  Developing  assessed, low scores, real gaps. The student the product is for.
 *   D  Unassessed  a filled-in profile and no assessment. Readiness is UNKNOWN, not low —
 *                  the distinction the analytics dashboard is built to preserve.
 *   E  Empty       barely signed up. Proves the empty states are real.
 *
 * TWO STUDENTS BELONG TO A DIFFERENT COLLEGE, ON PURPOSE. `otherInstitution: true` puts
 * them outside the demo institution's cohort, so the institution dashboard can be shown
 * to exclude them. A scoping rule nobody can see working is a scoping rule nobody
 * believes.
 *
 * THE SKILL GAP IS ENGINEERED, AND IT IS THE HONEST KIND. Students mostly hold the
 * things students actually learn first — HTML, CSS, JavaScript, Git, Python. Employers
 * mostly ask for the things they actually ask for — Docker, AWS, System Design, SQL at a
 * senior level. Neither side was written to make the other look bad; the gap falls out
 * of the two lists, which is exactly what the analytics page claims to detect.
 *
 * READINESS AND VERIFICATION ARE STATED HERE, NOT COMPUTED. A seeded `readinessScore`
 * and a `verified: true` skill stand in for an assessment nobody sat. Match scores are
 * the exception: seedDemo.js applies through the real application service, so every
 * `matchScoreAtApplication` in the demo database was produced by the actual matching
 * engine. Nothing in this file fakes a match score.
 *
 * SKILL TUPLES ARE `[slug, level, verified]`. `verified` true means the level is
 * recorded as coming from an assessment; false means the student typed it. The slugs
 * must exist in skills.seed.js — seedDemo.js proves that offline before it connects.
 *
 * THE LEARNING PROGRAMMES AT THE BOTTOM CLOSE THE LOOP, AND THEY DO NOT SHORTEN IT.
 * They teach the skills the postings ask for and the cohort lacks, three students have
 * finished one, and not one skill level below changes because of it. Completion is
 * evidence that learning happened; the assessment engine is still the only thing that
 * says how good anybody is.
 */

/** The one shared password, printed at the end of a seed run. Demo accounts only. */
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo1234';

/** Everything hangs off this name: students match their institution by typing it. */
export const DEMO_INSTITUTION = {
  name: 'Anna University Regional Campus',
  email: 'institution@skillbridge.demo',
};

/**
 * Academician demo persona (Step 7).
 *
 * Dr. Ananya Sharma is the Phase 7 example from the brief: Machine Learning, Python,
 * Computer Vision as core expertise, plus Deep Learning as a preferred skill that
 * makes the match explanation honest ("Additional relevant expertise: Deep Learning").
 * The CV collaboration posting below lists ML/Python/CV as required and Deep Learning
 * as preferred, so the match breakdown on her dashboard will demonstrate the Phase 7
 * split.
 *
 * WRITTEN IN AcademicianProfile's OWN VOCABULARY, not a friendlier one. `institutionName`
 * rather than `institution`, `designation: 'associate_professor'` rather than "Associate
 * Professor", one `experiences` array discriminated by `experienceType` rather than a
 * separate professional and industry list, and `achievements` as typed objects. A seed
 * that invents its own field names does not fail loudly — Mongoose drops unknown paths
 * silently and the demo profile simply arrives half empty — so the shape here is the
 * schema's shape, and the completion score the model computes is the proof.
 *
 * `expertise` KEEPS ITS TUPLE FORM, `[slug, level]`, because that is the seed's
 * convention for every catalogue-backed skill list including DEMO_STUDENTS.skills; the
 * seeder resolves the slugs and builds `skills` entries from them.
 */
export const DEMO_ACADEMICIAN = {
  name: 'Dr. Ananya Sharma',
  email: 'academician@skillbridge.demo',
  headline: 'Associate Professor, Computer Vision and Edge AI',
  bio:
    'I work on making vision models small enough and reliable enough to run on a factory floor rather than a benchmark. Most of my collaborations start with a company that has cameras, a defect they cannot describe precisely, and no labelled data — which is the interesting part.',
  institutionName: 'Anna University Regional Campus',
  department: 'Computer Science and Engineering',
  designation: 'associate_professor',
  location: 'Chennai',
  expertiseAreas: [
    'Machine Learning',
    'Computer Vision',
    'Deep Learning',
    'Edge AI',
    'Model Optimization',
  ],
  expertise: [
    ['python', 95],
    ['machine-learning', 92],
    ['computer-vision', 90],
    ['deep-learning', 88],
    ['tensorflow', 85],
    ['pytorch', 82],
    ['data-structures-algorithms', 78],
  ],
  researchInterests: [
    'Computer vision for industrial applications',
    'Deep learning model optimization',
    'Edge AI and embedded systems',
    'Explainable machine learning',
    'Real-world ML deployment',
  ],
  education: [
    {
      degree: 'Ph.D. in Computer Science',
      fieldOfStudy: 'Computer Vision and Pattern Recognition',
      institution: 'Indian Institute of Science, Bangalore',
      year: 2018,
    },
    {
      degree: 'M.Tech in Computer Science',
      fieldOfStudy: 'Machine Learning',
      institution: 'IIT Madras',
      year: 2013,
    },
  ],
  /**
   * Teaching, research and industry in one array — see `ACADEMIC_EXPERIENCE_TYPES`.
   *
   * `[year, month]` pairs rather than Date objects or ISO strings, so the file stays
   * readable and the seeder does the constructing. The Bosch entry is what earns the
   * `industryExperience` completion section, which is the one an industry partner
   * reading her profile cares about most.
   */
  experiences: [
    {
      organization: 'Anna University Regional Campus',
      role: 'Associate Professor',
      experienceType: 'academic',
      start: [2018, 7],
      isCurrent: true,
      description:
        'Teaching graduate courses in machine learning, deep learning and computer vision, and supervising M.Tech theses on industrial CV applications.',
    },
    {
      organization: 'Anna University Regional Campus',
      role: 'Principal Investigator, DST-SERB Edge AI project',
      experienceType: 'research',
      start: [2021, 1],
      end: [2024, 3],
      description:
        'Led a ₹18 lakh DST-SERB funded project on running vision models on constrained edge hardware, with two industry partners and three research scholars.',
    },
    {
      organization: 'Bosch AI Research',
      role: 'Research Intern',
      experienceType: 'industry',
      start: [2017, 1],
      end: [2017, 7],
      description:
        'Developed defect detection algorithms for automotive manufacturing. Published at a CVPR workshop on industrial computer vision.',
    },
  ],
  achievements: [
    {
      title: 'Efficient attention for on-device defect detection',
      achievementType: 'publication',
      issuingOrganization: 'Indian Conference on Computer Vision',
      year: 2019,
      description: 'Best Paper Award.',
    },
    {
      title: 'Excellence in Teaching Award',
      achievementType: 'award',
      issuingOrganization: 'Anna University',
      year: 2022,
    },
    {
      title: 'Efficient neural network architectures for embedded inference',
      achievementType: 'patent',
      issuingOrganization: 'Indian Patent Office',
      year: 2021,
      description: 'Three filings on the same family of architectures.',
    },
    {
      title: 'Edge AI for industrial inspection',
      achievementType: 'grant',
      issuingOrganization: 'DST-SERB',
      year: 2021,
      description: '₹18 lakhs, 2021-2024.',
    },
  ],
};

/** A second college, so the cohort filter has something to exclude. */
export const OTHER_INSTITUTION_NAME = 'Coimbatore Institute of Technology';

/** Employers. `key` is how postings below refer back to one. */
export const DEMO_EMPLOYERS = [
  { key: 'northwind', name: 'Northwind Analytics', email: 'hiring@northwind.demo' },
  { key: 'lumen', name: 'Lumen Web Systems', email: 'talent@lumen.demo' },
  { key: 'sentinel', name: 'Sentinel Cloud', email: 'careers@sentinel.demo' },
];

/**
 * The cohort. 22 students, 20 of them at the demo institution.
 *
 * `readiness: null` is the point of personas D and E and must stay null — the
 * dashboard reports those students as unassessed rather than folding a zero into
 * every average.
 */
export const DEMO_STUDENTS = [
  /* ---- Persona A — ready ------------------------------------------------- */
  {
    persona: 'A',
    name: 'Aarav Menon',
    email: 'aarav.menon@student.demo',
    headline: 'Full stack developer, MERN, looking for a backend internship',
    bio:
      'Third-year CSE student who mostly writes backend JavaScript. The part I like is where the data model stops fighting the feature. Currently trying to get better at making a service observable rather than merely working.',
    branch: 'Computer Science and Engineering',
    degree: 'B.E.',
    graduationYear: 2027,
    currentYear: 3,
    cgpa: 8.9,
    location: 'Chennai',
    readiness: 88,
    targets: ['Full Stack Developer', 'Backend Developer'],
    interests: ['Distributed systems', 'Developer tooling'],
    skills: [
      ['javascript', 88, true],
      ['react', 84, true],
      ['node-js', 86, true],
      ['express-js', 82, true],
      ['mongodb', 80, true],
      ['rest-api-design', 78, true],
      ['git', 85, true],
      ['data-structures-algorithms', 81, true],
      ['docker', 62, false],
      ['sql', 70, true],
      ['problem-solving', 84, true],
      ['communication', 76, false],
    ],
  },
  {
    persona: 'A',
    name: 'Ishita Bose',
    email: 'ishita.bose@student.demo',
    headline: 'Data science student, Python and ML, two published notebooks',
    bio:
      'Final-year student working on applied ML, mostly forecasting. I have learned to care more about whether an evaluation is honest than whether a model is clever, which is a lesson one badly split dataset taught me the hard way.',
    branch: 'Computer Science and Engineering',
    degree: 'B.Tech',
    graduationYear: 2026,
    currentYear: 4,
    cgpa: 9.1,
    location: 'Chennai',
    readiness: 84,
    targets: ['Data Scientist / ML Engineer', 'Data Analyst'],
    interests: ['Applied ML', 'Statistics'],
    skills: [
      ['python', 90, true],
      ['pandas', 86, true],
      ['statistics', 82, true],
      ['machine-learning', 80, true],
      ['data-analysis', 84, true],
      ['data-visualization', 76, true],
      ['sql', 74, true],
      ['git', 70, false],
      ['deep-learning', 58, false],
      ['communication', 80, true],
    ],
  },

  /* ---- Persona B — solid, uneven ----------------------------------------- */
  {
    persona: 'B',
    name: 'Rohan Iyer',
    email: 'rohan.iyer@student.demo',
    headline: 'Frontend developer, React, learning testing',
    bio:
      'Frontend developer who got here through CSS. I am deliberately working on testing and on the backend half, because that is the obviously thin part of my profile and pretending otherwise has not helped.',
    branch: 'Computer Science and Engineering',
    degree: 'B.E.',
    graduationYear: 2027,
    currentYear: 3,
    cgpa: 8.1,
    location: 'Chennai',
    readiness: 72,
    targets: ['Frontend Developer'],
    interests: ['Design systems', 'Accessibility'],
    skills: [
      ['html', 88, true],
      ['css', 84, true],
      ['javascript', 76, true],
      ['react', 74, true],
      ['git', 68, false],
      ['teamwork', 78, false],
      /* The uneven half: no backend, no infrastructure. */
      ['node-js', 42, false],
    ],
  },
  {
    persona: 'B',
    name: 'Sneha Kulkarni',
    email: 'sneha.kulkarni@student.demo',
    headline: 'Backend developer, Java and SQL',
    branch: 'Information Technology',
    degree: 'B.Tech',
    graduationYear: 2026,
    currentYear: 4,
    cgpa: 8.4,
    location: 'Coimbatore',
    readiness: 74,
    targets: ['Backend Developer', 'Software Engineer'],
    interests: ['APIs', 'Databases'],
    skills: [
      ['java', 82, true],
      ['sql', 80, true],
      ['data-modeling', 72, true],
      ['rest-api-design', 70, true],
      ['data-structures-algorithms', 68, true],
      ['git', 66, false],
      ['linux', 54, false],
      ['problem-solving', 74, true],
    ],
  },
  {
    persona: 'B',
    name: 'Vikram Naidu',
    email: 'vikram.naidu@student.demo',
    headline: 'Interested in cloud and automation',
    branch: 'Electronics and Communication',
    degree: 'B.E.',
    graduationYear: 2027,
    currentYear: 3,
    cgpa: 7.6,
    location: 'Chennai',
    readiness: 66,
    targets: ['DevOps Engineer'],
    interests: ['Cloud', 'Automation'],
    skills: [
      ['linux', 78, true],
      ['git', 72, true],
      ['python', 62, true],
      ['docker', 58, false],
      ['ci-cd', 48, false],
      ['teamwork', 70, false],
    ],
  },
  {
    persona: 'B',
    name: 'Ananya Pillai',
    email: 'ananya.pillai@student.demo',
    headline: 'Analytics and reporting',
    branch: 'Information Technology',
    degree: 'B.Tech',
    graduationYear: 2027,
    currentYear: 3,
    cgpa: 8.0,
    location: 'Madurai',
    readiness: 69,
    targets: ['Data Analyst'],
    interests: ['Dashboards', 'Business analytics'],
    skills: [
      ['data-analysis', 76, true],
      ['sql', 72, true],
      ['data-visualization', 70, true],
      ['statistics', 62, true],
      ['python', 58, false],
      ['communication', 82, true],
    ],
  },
  {
    persona: 'B',
    name: 'Kabir Shah',
    email: 'kabir.shah@student.demo',
    headline: 'Security enthusiast, CTF regular',
    branch: 'Computer Science and Engineering',
    degree: 'B.E.',
    graduationYear: 2026,
    currentYear: 4,
    cgpa: 7.9,
    location: 'Chennai',
    readiness: 71,
    targets: ['Cybersecurity Analyst'],
    interests: ['Network security', 'Reverse engineering'],
    skills: [
      ['network-security', 78, true],
      ['linux', 76, true],
      ['application-security', 68, true],
      ['python', 66, true],
      ['git', 60, false],
      ['problem-solving', 72, true],
    ],
  },

  /* ---- Persona C — developing -------------------------------------------- */
  {
    persona: 'C',
    name: 'Divya Ramesh',
    email: 'divya.ramesh@student.demo',
    headline: 'Second year, learning web development',
    bio:
      'Second-year student learning web development. One project finished on my own so far, HTML and CSS solid, JavaScript still a work in progress. Looking for a first internship where I would be allowed to be a beginner.',
    branch: 'Computer Science and Engineering',
    degree: 'B.E.',
    graduationYear: 2028,
    currentYear: 2,
    cgpa: 7.2,
    location: 'Chennai',
    readiness: 52,
    targets: ['Frontend Developer'],
    interests: ['Web development'],
    skills: [
      ['html', 68, true],
      ['css', 60, true],
      ['javascript', 48, true],
      ['git', 40, false],
      ['teamwork', 62, false],
    ],
  },
  {
    persona: 'C',
    name: 'Arjun Deshpande',
    email: 'arjun.deshpande@student.demo',
    headline: 'Learning Python, first year of DSA',
    branch: 'Computer Science and Engineering',
    degree: 'B.E.',
    graduationYear: 2028,
    currentYear: 2,
    cgpa: 6.9,
    location: 'Trichy',
    readiness: 46,
    targets: ['Software Engineer'],
    interests: ['Competitive programming'],
    skills: [
      ['python', 58, true],
      ['data-structures-algorithms', 44, true],
      ['git', 38, false],
      ['problem-solving', 56, true],
    ],
  },
  {
    persona: 'C',
    name: 'Fatima Sheikh',
    email: 'fatima.sheikh@student.demo',
    headline: 'Exploring data analysis',
    branch: 'Information Technology',
    degree: 'B.Tech',
    graduationYear: 2028,
    currentYear: 2,
    cgpa: 7.4,
    location: 'Chennai',
    readiness: 49,
    targets: ['Data Analyst'],
    interests: ['Spreadsheets to code'],
    skills: [
      ['sql', 54, true],
      ['data-analysis', 46, true],
      ['python', 42, true],
      ['communication', 68, false],
    ],
  },
  {
    persona: 'C',
    name: 'Nikhil Verma',
    email: 'nikhil.verma@student.demo',
    headline: 'Mechanical student moving into software',
    branch: 'Mechanical Engineering',
    degree: 'B.E.',
    graduationYear: 2027,
    currentYear: 3,
    cgpa: 6.6,
    location: 'Salem',
    /* The lowest assessed score in the cohort, and deliberately in the Beginner
       band. A readiness distribution whose bottom band is empty suggests the
       college has no one who needs help, which is never true. */
    readiness: 34,
    targets: ['Software Engineer'],
    interests: ['Career change'],
    skills: [
      ['python', 46, true],
      ['html', 44, false],
      ['problem-solving', 52, true],
      ['time-management', 60, false],
    ],
  },
  {
    persona: 'C',
    name: 'Meghna Das',
    email: 'meghna.das@student.demo',
    headline: 'Third year, backend curious',
    branch: 'Computer Science and Engineering',
    degree: 'B.E.',
    graduationYear: 2027,
    currentYear: 3,
    cgpa: 7.1,
    location: 'Chennai',
    readiness: 57,
    targets: ['Backend Developer'],
    interests: ['APIs'],
    skills: [
      ['javascript', 58, true],
      ['node-js', 52, true],
      ['mongodb', 48, true],
      ['git', 50, false],
      ['rest-api-design', 44, false],
      ['teamwork', 66, false],
    ],
  },
  {
    persona: 'C',
    name: 'Saurabh Jain',
    email: 'saurabh.jain@student.demo',
    headline: 'Electronics student learning embedded C and Linux',
    branch: 'Electronics and Communication',
    degree: 'B.E.',
    graduationYear: 2027,
    currentYear: 3,
    cgpa: 7.0,
    location: 'Coimbatore',
    readiness: 44,
    targets: ['DevOps Engineer'],
    interests: ['Embedded systems'],
    skills: [
      ['linux', 56, true],
      ['git', 42, true],
      ['python', 38, false],
      ['teamwork', 64, false],
    ],
  },

  /* ---- Persona D — profile, but never assessed --------------------------- */
  {
    persona: 'D',
    name: 'Priya Ranganathan',
    email: 'priya.ranganathan@student.demo',
    headline: 'Final year, MERN projects, yet to take an assessment',
    bio:
      'Final year, and everything on this profile is still self-reported: I have not sat an assessment yet and I have not written up my projects. Both are next on my list.',
    branch: 'Computer Science and Engineering',
    degree: 'B.E.',
    graduationYear: 2026,
    currentYear: 4,
    cgpa: 8.6,
    location: 'Chennai',
    readiness: null,
    targets: ['Full Stack Developer'],
    interests: ['Product engineering'],
    /* Every level self-reported. Nothing verified — that is the persona. */
    skills: [
      ['javascript', 80, false],
      ['react', 78, false],
      ['node-js', 74, false],
      ['mongodb', 70, false],
      ['git', 72, false],
      ['communication', 78, false],
    ],
  },
  {
    persona: 'D',
    name: 'Harsh Tiwari',
    email: 'harsh.tiwari@student.demo',
    headline: 'Java and SQL, no assessment yet',
    branch: 'Information Technology',
    degree: 'B.Tech',
    graduationYear: 2027,
    currentYear: 3,
    cgpa: 7.8,
    location: 'Chennai',
    readiness: null,
    targets: ['Backend Developer'],
    interests: ['Databases'],
    skills: [
      ['java', 72, false],
      ['sql', 68, false],
      ['git', 60, false],
      ['problem-solving', 70, false],
    ],
  },
  {
    persona: 'D',
    name: 'Lakshmi Narayan',
    email: 'lakshmi.narayan@student.demo',
    headline: 'Interested in cloud, has not been assessed',
    branch: 'Computer Science and Engineering',
    degree: 'B.E.',
    graduationYear: 2028,
    currentYear: 2,
    cgpa: 7.5,
    location: 'Chennai',
    readiness: null,
    targets: ['DevOps Engineer'],
    interests: ['Cloud'],
    skills: [
      ['linux', 58, false],
      ['git', 54, false],
      ['docker', 40, false],
    ],
  },
  {
    persona: 'D',
    name: 'Tanvi Kapoor',
    email: 'tanvi.kapoor@student.demo',
    headline: 'Design to frontend, no assessment yet',
    branch: 'Information Technology',
    degree: 'B.Tech',
    graduationYear: 2027,
    currentYear: 3,
    cgpa: 8.2,
    location: 'Madurai',
    readiness: null,
    targets: ['Frontend Developer'],
    interests: ['UI engineering'],
    skills: [
      ['html', 76, false],
      ['css', 78, false],
      ['javascript', 62, false],
      ['communication', 80, false],
    ],
  },
  {
    persona: 'D',
    name: 'Imran Qureshi',
    email: 'imran.qureshi@student.demo',
    /* No branch at all: exercises the dashboard's "Not specified" grouping. */
    headline: 'First year, still deciding',
    branch: '',
    degree: 'B.E.',
    graduationYear: 2029,
    currentYear: 1,
    cgpa: null,
    location: 'Chennai',
    readiness: null,
    targets: [],
    interests: ['Everything, for now'],
    skills: [['html', 40, false]],
  },

  /* ---- Persona E — barely started ---------------------------------------- */
  {
    persona: 'E',
    name: 'Rahul Bhatt',
    email: 'rahul.bhatt@student.demo',
    headline: '',
    branch: '',
    degree: '',
    graduationYear: null,
    currentYear: null,
    cgpa: null,
    location: '',
    readiness: null,
    targets: [],
    interests: [],
    skills: [],
  },
  {
    persona: 'E',
    name: 'Sanya Malhotra',
    email: 'sanya.malhotra@student.demo',
    headline: 'Just signed up',
    branch: '',
    degree: '',
    graduationYear: null,
    currentYear: null,
    cgpa: null,
    location: '',
    readiness: null,
    targets: [],
    interests: [],
    skills: [],
  },

  /* ---- Another college — must NOT appear in the cohort -------------------- */
  {
    persona: 'B',
    otherInstitution: true,
    name: 'Gautam Reddy',
    email: 'gautam.reddy@student.demo',
    headline: 'Full stack developer at another college',
    branch: 'Computer Science and Engineering',
    degree: 'B.E.',
    graduationYear: 2026,
    currentYear: 4,
    cgpa: 8.5,
    location: 'Coimbatore',
    readiness: 79,
    targets: ['Full Stack Developer'],
    interests: ['Web'],
    skills: [
      ['javascript', 82, true],
      ['react', 78, true],
      ['node-js', 76, true],
      ['docker', 64, true],
      ['aws', 58, false],
      ['git', 74, true],
    ],
  },
  {
    persona: 'C',
    otherInstitution: true,
    name: 'Nisha Varma',
    email: 'nisha.varma@student.demo',
    headline: 'Learning data analysis at another college',
    branch: 'Information Technology',
    degree: 'B.Tech',
    graduationYear: 2028,
    currentYear: 2,
    cgpa: 7.3,
    location: 'Coimbatore',
    readiness: 51,
    targets: ['Data Analyst'],
    interests: ['Analytics'],
    skills: [
      ['sql', 56, true],
      ['data-analysis', 50, true],
      ['python', 46, false],
    ],
  },
];

/**
 * Portfolio records — projects, certifications, experience and achievements.
 *
 * KEYED BY EMAIL, AND DELIBERATELY NOT ATTACHED TO EVERY STUDENT. Four students have
 * portfolio records, one more has a bio and nothing else, and the remaining seventeen
 * have none. That spread is the content: the portfolio completion score is supposed to
 * separate a student who has assembled their evidence from one who has not, and a seed
 * where all 22 look the same would make the score look decorative.
 *
 * What it comes out as, given the weights in constants/portfolio.js:
 *
 *   Aarav     85%   projects, certifications, experience, achievements. Missing: resume.
 *   Ishita    75%   the same minus certifications — a research-track student who never
 *                   collected a course certificate, which is normal.
 *   Rohan     65%   projects and one achievement. No experience yet, and he knows it.
 *   Divya     60%   one project. Persona C is the student the product is for.
 *   Priya     45%   a written profile and no portfolio at all — every empty state.
 *   Most      30%   education and skills, from Step 3, and nothing else.
 *   Imran     15%   one skill where the section wants three. Persona D, first year.
 *   Persona E  0%   no degree, no graduation year, no skills. Every section missing.
 *
 * That 0% is not a bug to round up. A student who has just signed up genuinely has none
 * of this, and a score that flatters them is a score nobody can act on.
 *
 * NOBODY REACHES 100, AND THAT IS ON PURPOSE. No resume is seeded anywhere, because a
 * resume is a stored file and there are no files on disk in a fresh clone: seeded
 * metadata would render a download button that 404s, which is worse than an empty slot.
 * The empty slot also means the completion panel always has one real, actionable
 * recommendation to show, instead of a congratulatory 100% that demonstrates nothing.
 *
 * NO `verificationStatus` IS SET HERE. The model defaults every record to `pending`,
 * and pending is the truth — nothing in this build verifies a portfolio record. Writing
 * `verified: true` into the seed would put a badge on screen that no reviewer earned,
 * which is exactly the claim Step 6 was told not to fake.
 *
 * DATES ARE OFFSETS, NOT LITERALS, for the same reason `deadlineInDays` is: a hardcoded
 * 2025 date reads as abandoned once the calendar moves past it. `MonthsAgo` counts back
 * from the seed run; `MonthsAhead` counts forward, and is only used for a certification
 * expiry — the one date in the portfolio the validator allows to be in the future.
 * `endMonthsAgo: null` with `isOngoing`/`isCurrent` true is a record still in progress.
 *
 * LINKS POINT AT PLACEHOLDER DOMAINS ON PURPOSE. `github.com/skillbridge-demo/...` and
 * `example.com` are visibly not real, so the link chrome renders in the demo without
 * anyone mistaking a seeded URL for a repository that exists. `example.com` is reserved
 * by IANA for precisely this.
 *
 * TECHNOLOGIES AND `skillsUsed` ARE FREE TEXT AND DO NOT HAVE TO MATCH THE SKILL LIST.
 * Aarav's containerisation project lists Docker Compose, which is not a seeded skill and
 * should not be: what a student used on a project is a different claim from what an
 * assessment measured, and collapsing the two is how a skills list starts lying.
 */
export const DEMO_PORTFOLIOS = {
  'aarav.menon@student.demo': {
    projects: [
      {
        title: 'Campus placement tracker',
        description:
          'A tracker the placement cell uses instead of a shared spreadsheet: companies, rounds, and where each student currently stands. Four of us built it; I wrote the API and the data model, including the part that stops two coordinators from overwriting the same round.',
        technologies: ['Node.js', 'Express', 'MongoDB', 'React', 'JWT'],
        role: 'Backend developer',
        githubUrl: 'https://github.com/skillbridge-demo/placement-tracker',
        startMonthsAgo: 14,
        endMonthsAgo: 9,
      },
      {
        title: 'Live library seat availability',
        description:
          'Sensors on the reading room turnstiles feed a small service that shows how many seats are free, so nobody walks across campus during exam week for nothing. My first time keeping a socket connection alive through a flaky campus network.',
        technologies: ['Node.js', 'WebSocket', 'MongoDB', 'Chart.js'],
        role: 'Sole developer',
        githubUrl: 'https://github.com/skillbridge-demo/library-seats',
        liveUrl: 'https://seats.skillbridge-demo.example.com',
        startMonthsAgo: 8,
        endMonthsAgo: 5,
      },
      {
        title: 'One-command dev setup for the coding club',
        description:
          'New club members were losing their first two sessions to installing Mongo. This is a Compose file and a seed script that gets them to a running app in one command. Still finding edge cases on Windows.',
        technologies: ['Docker', 'Docker Compose', 'Bash', 'MongoDB'],
        role: 'Maintainer',
        githubUrl: 'https://github.com/skillbridge-demo/club-dev-setup',
        startMonthsAgo: 3,
        endMonthsAgo: null,
        isOngoing: true,
      },
    ],
    certifications: [
      {
        title: 'Modern Application Development',
        issuingOrganization: 'NPTEL',
        issueMonthsAgo: 8,
        credentialId: 'NPTEL25CS03S194772',
      },
      {
        title: 'MongoDB Associate Developer',
        issuingOrganization: 'MongoDB University',
        issueMonthsAgo: 5,
        expiryMonthsAhead: 31,
        credentialId: 'MDB-AD-4471902',
        credentialUrl: 'https://verify.example.com/mongodb/MDB-AD-4471902',
      },
    ],
    experiences: [
      {
        organization: 'Marutham Systems',
        role: 'Backend intern',
        experienceType: 'internship',
        startMonthsAgo: 8,
        endMonthsAgo: 6,
        description:
          'Two months on an internal billing service. I added the reconciliation endpoint and moved a nightly report off a cron job that silently failed when it overran. Learned more from reading their existing code than from anything I wrote.',
        skillsUsed: ['Node.js', 'Express', 'MongoDB', 'Postman', 'Git'],
      },
    ],
    achievements: [
      {
        title: 'Runner-up, Anna University Hackfest',
        achievementType: 'hackathon',
        description:
          'Second of 74 teams for a 36-hour build: a bus-pass renewal flow that works offline and syncs when the phone finds signal. I built the sync layer.',
        dateMonthsAgo: 11,
        issuingOrganization: 'Anna University Regional Campus',
      },
      {
        title: 'Departmental merit scholarship',
        achievementType: 'scholarship',
        description:
          'Awarded to the top three students in the second-year cohort by CGPA. Covers tuition for one academic year.',
        dateMonthsAgo: 19,
        issuingOrganization: 'Anna University Regional Campus',
      },
    ],
  },

  'ishita.bose@student.demo': {
    projects: [
      {
        title: 'District-level rainfall forecasting',
        description:
          'Monthly rainfall forecasts for 38 districts from 30 years of IMD records. The interesting part was not the model — it was discovering that my first validation split leaked future data backwards, and that the honest score was about 11 points worse than the one I nearly presented.',
        technologies: ['Python', 'pandas', 'scikit-learn', 'Matplotlib'],
        role: 'Sole author',
        githubUrl: 'https://github.com/skillbridge-demo/rainfall-forecast',
        startMonthsAgo: 16,
        endMonthsAgo: 10,
      },
      {
        title: 'Dropout risk indicators for the department',
        description:
          'A dashboard the department uses to spot students falling behind early, from attendance and internal marks. Deliberately reports factors rather than a single risk number, because a number gets treated as a verdict and these factors are the things a tutor can actually act on.',
        technologies: ['Python', 'pandas', 'Streamlit', 'SQL'],
        role: 'Data analyst',
        liveUrl: 'https://dropout-signals.example.com',
        startMonthsAgo: 9,
        endMonthsAgo: 3,
      },
    ],
    experiences: [
      {
        organization: 'Centre for Data Sciences, Anna University Regional Campus',
        role: 'Undergraduate research assistant',
        experienceType: 'part_time',
        startMonthsAgo: 13,
        endMonthsAgo: null,
        isCurrent: true,
        description:
          'Ten hours a week on a groundwater time-series study: cleaning sensor data, writing the evaluation harness, and drafting the results section of the paper below.',
        skillsUsed: ['Python', 'pandas', 'statistics', 'LaTeX'],
      },
    ],
    achievements: [
      {
        title: 'Paper accepted, National Conference on Data Engineering',
        achievementType: 'publication',
        description:
          'Co-authored a short paper on evaluating groundwater level forecasts when the sensor record has long gaps. Presented at the student track.',
        dateMonthsAgo: 4,
        issuingOrganization: 'National Conference on Data Engineering',
      },
    ],
  },

  'rohan.iyer@student.demo': {
    projects: [
      {
        title: 'Accessible component library for club sites',
        description:
          'Every club on campus was rebuilding the same modal, badly. This is fourteen components that pass keyboard navigation and contrast checks, documented in Storybook so nobody has to read the source to use them.',
        technologies: ['React', 'CSS', 'Storybook', 'Testing Library'],
        role: 'Frontend developer',
        githubUrl: 'https://github.com/skillbridge-demo/club-components',
        startMonthsAgo: 10,
        endMonthsAgo: 4,
      },
      {
        title: 'Department symposium site',
        description:
          'The public site for our annual symposium — schedule, speakers, registration. Around 2,000 people used it over three days on mostly mid-range phones, so I spent most of my time on how fast the first screen renders.',
        technologies: ['HTML', 'CSS', 'JavaScript'],
        role: 'Sole developer',
        liveUrl: 'https://symposium.skillbridge-demo.example.com',
        startMonthsAgo: 9,
        endMonthsAgo: 7,
      },
    ],
    achievements: [
      {
        title: 'Best interface, department project expo',
        achievementType: 'competition',
        description:
          'Judged best interface out of 31 projects at the annual expo, for the component library above. The feedback that stuck was that the keyboard-only walkthrough was what set it apart.',
        dateMonthsAgo: 5,
        issuingOrganization: 'Anna University Regional Campus',
      },
    ],
  },

  'divya.ramesh@student.demo': {
    projects: [
      {
        title: 'Personal portfolio site',
        description:
          'My first project built without following a tutorial line by line. Hand-written HTML and CSS, a small amount of JavaScript for the navigation, and a layout I rewrote three times before it worked on a phone.',
        technologies: ['HTML', 'CSS', 'JavaScript'],
        role: 'Built it on my own',
        startMonthsAgo: 5,
        endMonthsAgo: 3,
      },
    ],
  },
};

/**
 * The postings. 12 of them, across the three employers and every lifecycle state.
 *
 * `deadlineInDays` may be negative: that is the "published but the clock ran out"
 * case the industry dashboard counts separately from active. `finalStatus` is applied
 * AFTER applications are seeded, because a closed posting in the real product got its
 * applications while it was still open, and createApplication rightly refuses to
 * accept one otherwise.
 *
 * Requirement levels are what employers actually write down, not what students have.
 * That is where the gap comes from.
 */
export const DEMO_OPPORTUNITIES = [
  {
    employer: 'lumen',
    title: 'Frontend Developer Intern',
    type: 'internship',
    workMode: 'hybrid',
    location: 'Chennai',
    deadlineInDays: 21,
    durationMonths: 6,
    openings: 3,
    description:
      'Work with our product team on the customer dashboard. You will own small features end to end, from the component to the API call, with a mentor reviewing every pull request. We care more about how you reason through a layout problem than how many frameworks you have used.',
    required: [
      ['html', 60, 15],
      ['css', 65, 20],
      ['javascript', 70, 30],
      ['react', 65, 25],
      ['git', 50, 10],
    ],
    preferred: [['typescript', 50, 60], ['communication', 60, 40]],
    eligibility: { branches: ['Computer Science and Engineering', 'Information Technology'], minGraduationYear: 2026 },
  },
  {
    employer: 'lumen',
    title: 'Full Stack Engineer (Entry Level)',
    type: 'job',
    workMode: 'onsite',
    location: 'Chennai',
    deadlineInDays: 30,
    openings: 2,
    description:
      'A first engineering role on a small team that ships weekly. You will write React on the front and Node on the back, and you will be expected to read a database query plan by the end of your first quarter. We hire for curiosity and follow-through.',
    required: [
      ['javascript', 75, 20],
      ['react', 70, 15],
      ['node-js', 70, 20],
      ['mongodb', 65, 15],
      ['rest-api-design', 65, 15],
      ['docker', 55, 15],
    ],
    preferred: [['aws', 50, 50], ['system-design', 55, 50]],
    eligibility: { minGraduationYear: 2025, maxGraduationYear: 2027 },
  },
  {
    employer: 'northwind',
    title: 'Data Analyst Intern',
    type: 'internship',
    workMode: 'remote',
    location: 'Remote',
    deadlineInDays: 18,
    durationMonths: 4,
    openings: 4,
    description:
      'Turn messy operational data into weekly reporting the business actually reads. You will spend real time in SQL, some in Python, and a surprising amount deciding which chart tells the truth. No prior industry experience expected.',
    required: [
      ['sql', 65, 30],
      ['data-analysis', 60, 25],
      ['data-visualization', 55, 20],
      ['statistics', 55, 15],
      ['communication', 60, 10],
    ],
    preferred: [['python', 55, 60], ['pandas', 50, 40]],
    eligibility: {},
  },
  {
    employer: 'northwind',
    title: 'Machine Learning Intern',
    type: 'internship',
    workMode: 'hybrid',
    location: 'Bengaluru',
    deadlineInDays: 25,
    durationMonths: 6,
    openings: 2,
    description:
      'Support the forecasting team: feature engineering, evaluation, and honest error analysis. You will not be handed a clean dataset. A completed course in statistics matters more here than a list of model names.',
    required: [
      ['python', 75, 25],
      ['machine-learning', 70, 25],
      ['statistics', 70, 20],
      ['pandas', 65, 15],
      ['sql', 60, 15],
    ],
    preferred: [['deep-learning', 60, 100]],
    eligibility: { minGraduationYear: 2026 },
  },
  {
    employer: 'sentinel',
    title: 'Cloud Infrastructure Intern',
    type: 'internship',
    workMode: 'remote',
    location: 'Remote',
    deadlineInDays: 20,
    durationMonths: 6,
    openings: 2,
    description:
      'Help maintain the deployment pipeline behind our platform. Expect Linux, containers, and a rota of small automation jobs that remove manual steps for the whole team. You will break staging at least once; that is fine.',
    required: [
      ['linux', 65, 25],
      ['docker', 65, 30],
      ['ci-cd', 60, 20],
      ['git', 60, 15],
      ['aws', 55, 10],
    ],
    preferred: [['kubernetes', 50, 100]],
    eligibility: {},
  },
  {
    employer: 'sentinel',
    title: 'Backend Engineer (Entry Level)',
    type: 'job',
    workMode: 'hybrid',
    location: 'Hyderabad',
    deadlineInDays: 35,
    openings: 2,
    description:
      'Own services that other teams depend on. The work is API design, data modelling and the unglamorous discipline of making failures visible. You will be paired with a senior engineer for your first three months.',
    required: [
      ['rest-api-design', 70, 20],
      ['sql', 70, 20],
      ['data-modeling', 65, 15],
      ['system-design', 60, 20],
      ['docker', 60, 15],
      ['authentication-authorization', 60, 10],
    ],
    preferred: [['java', 65, 50], ['node-js', 65, 50]],
    eligibility: { minGraduationYear: 2025, maxGraduationYear: 2027 },
  },
  {
    employer: 'sentinel',
    title: 'Security Analyst Apprenticeship',
    type: 'apprenticeship',
    workMode: 'onsite',
    location: 'Chennai',
    deadlineInDays: 28,
    durationMonths: 12,
    openings: 1,
    description:
      'A twelve month apprenticeship in our security operations team. You will triage alerts, write up what you found, and gradually take on your own investigations. We will teach the tooling; bring the stubbornness.',
    required: [
      ['network-security', 60, 30],
      ['linux', 60, 25],
      ['application-security', 55, 25],
      ['python', 50, 20],
    ],
    preferred: [['problem-solving', 65, 100]],
    eligibility: {},
  },
  {
    employer: 'northwind',
    title: 'Analytics Dashboard Live Project',
    type: 'project',
    workMode: 'remote',
    location: 'Remote',
    deadlineInDays: 14,
    durationMonths: 2,
    openings: 5,
    description:
      'A two month paid project: build an internal dashboard against our reporting database. Good first industry work for a second or third year student, and a real reference at the end of it.',
    required: [
      ['javascript', 55, 25],
      ['react', 55, 25],
      ['sql', 50, 25],
      ['data-visualization', 50, 25],
    ],
    preferred: [],
    eligibility: {},
  },
  {
    employer: 'lumen',
    title: 'Platform Engineer',
    type: 'job',
    workMode: 'onsite',
    location: 'Chennai',
    deadlineInDays: 40,
    openings: 1,
    /* Deliberately out of reach for this cohort: the gap table needs a top row. */
    description:
      'A senior-leaning platform role for someone who has already run something in production. You will define how our services are built, deployed and observed. Rare for a new graduate, and we do interview new graduates who can show the work.',
    required: [
      ['kubernetes', 70, 20],
      ['aws', 75, 25],
      ['docker', 75, 20],
      ['system-design', 75, 20],
      ['ci-cd', 70, 15],
    ],
    preferred: [['linux', 70, 100]],
    eligibility: {},
  },
  {
    employer: 'lumen',
    title: 'TypeScript Migration Intern',
    type: 'internship',
    workMode: 'remote',
    location: 'Remote',
    deadlineInDays: 16,
    durationMonths: 3,
    openings: 2,
    description:
      'We are moving a large React codebase to TypeScript one module at a time. Repetitive in the best way: you will learn the type system properly and see every corner of a real application.',
    required: [
      ['typescript', 65, 40],
      ['javascript', 70, 30],
      ['react', 60, 30],
    ],
    preferred: [],
    eligibility: {},
  },

  /* ---- Academician-facing opportunities (Step 7) ----------------------------- */
  {
    employer: 'northwind',
    title: 'Industry-Academia Computer Vision Research Collaboration',
    type: 'research_collaboration',
    audience: 'academician',
    workMode: 'hybrid',
    location: 'Chennai / Bengaluru',
    deadlineInDays: 35,
    durationMonths: 12,
    openings: 2,
    description:
      'Joint research on real-time defect detection in manufacturing. We bring the production data and the deployment constraints; you bring the academic rigour and the novel approaches. This is a funded collaboration with publication opportunities and regular on-site engagements. Ideal for faculty with computer vision expertise looking to bridge research and industrial application.',
    required: [
      ['python', 80, 25],
      ['machine-learning', 85, 30],
      ['computer-vision', 85, 30],
    ],
    preferred: [['deep-learning', 60, 100]],
    eligibility: {},
  },
  {
    employer: 'lumen',
    title: 'Faculty Development Programme — Generative AI in Production',
    type: 'fdp',
    audience: 'academician',
    workMode: 'onsite',
    location: 'Chennai',
    deadlineInDays: 28,
    /* Two weeks, which is not a whole number of months. `null` is the schema's
       "not stated" — `0` fails its `min: 1`, and rounding to 1 would be a lie. */
    durationMonths: null,
    openings: 20,
    description:
      'A two-week intensive FDP on deploying generative AI systems in production environments. Topics: prompt engineering, RAG architectures, evaluation frameworks, cost optimization, and responsible AI practices. Led by our AI team with hands-on sessions using real production systems. Certificate provided. No prior GenAI experience required, but solid ML fundamentals expected.',
    required: [
      ['python', 70, 40],
      ['machine-learning', 75, 60],
    ],
    preferred: [],
    eligibility: {},
  },
  {
    employer: 'sentinel',
    title: 'Industrial Training Programme for Faculty — Cloud Infrastructure',
    type: 'industrial_training',
    audience: 'academician',
    workMode: 'hybrid',
    location: 'Chennai',
    deadlineInDays: 42,
    durationMonths: 2,
    openings: 5,
    description:
      'A two-month industrial training designed for faculty teaching cloud computing or distributed systems. You will work alongside our platform team on real infrastructure: Kubernetes cluster management, observability pipelines, cost optimization, and incident response. Weekly knowledge-sharing sessions. Perfect for updating curriculum with industry practices.',
    required: [
      ['linux', 65, 30],
      ['docker', 60, 30],
      ['system-design', 65, 40],
    ],
    preferred: [['kubernetes', 50, 100], ['aws', 50, 100]],
    eligibility: {},
  },
  {
    employer: 'northwind',
    title: 'Guest Lecture Series on Data Engineering',
    type: 'guest_lecture',
    audience: 'academician',
    workMode: 'remote',
    location: 'Remote',
    deadlineInDays: 15,
    /* A 60-90 minute session has no duration in months. See the FDP above. */
    durationMonths: null,
    openings: 3,
    description:
      'Deliver a guest lecture (or short series) to our data engineering team on academic advances in data modeling, query optimization, or distributed data systems. 60-90 minute sessions, followed by Q&A. Honorarium provided. This is a knowledge exchange: we want to know what academia is exploring that industry has not caught up to yet.',
    required: [
      ['sql', 70, 40],
      ['data-modeling', 75, 40],
      ['communication', 70, 20],
    ],
    preferred: [['system-design', 60, 100]],
    eligibility: {},
  },
  {
    employer: 'lumen',
    title: 'Consultancy — Web Performance Audit',
    type: 'consultancy',
    audience: 'academician',
    workMode: 'remote',
    location: 'Remote',
    deadlineInDays: 20,
    durationMonths: 3,
    openings: 1,
    description:
      'Paid consultancy to audit and improve the performance of our customer-facing web application. We need an expert external perspective on rendering bottlenecks, bundle optimization, and caching strategies. Deliverables: detailed audit report, prioritized recommendations, and a follow-up session with the engineering team. Fixed-fee contract.',
    required: [
      ['javascript', 80, 40],
      ['react', 75, 30],
      /* Caching and trade-offs are what System Design names in the catalogue, and
         the audit's third leg is caching strategy. A "Web Performance" entry was
         considered and dropped: it would have overlapped these three. */
      ['system-design', 70, 30],
    ],
    preferred: [],
    eligibility: {},
  },
  {
    employer: 'sentinel',
    title: 'Mentorship Programme for Junior Engineers',
    type: 'mentorship',
    audience: 'academician',
    workMode: 'hybrid',
    location: 'Chennai',
    deadlineInDays: 30,
    durationMonths: 6,
    openings: 4,
    description:
      'Mentor a cohort of our junior engineers (1-2 years experience) on software design fundamentals, problem-solving approaches, and career development. Monthly on-site sessions plus asynchronous support. We are looking for patient educators who can translate academic CS concepts into practical guidance. Stipend provided.',
    required: [
      ['data-structures-algorithms', 75, 40],
      ['system-design', 70, 30],
      ['communication', 75, 30],
    ],
    preferred: [['problem-solving', 65, 100]],
    eligibility: {},
  },

  /* ---- Not open to students, for the industry dashboard's other counts ---- */
  {
    employer: 'northwind',
    title: 'Data Engineering Intern (draft)',
    type: 'internship',
    workMode: 'hybrid',
    location: 'Bengaluru',
    deadlineInDays: 45,
    durationMonths: 6,
    openings: 2,
    description:
      'Draft posting, not yet published. Kept in the demo database so the employer dashboard can show what a draft looks like: visible to us, invisible to every student.',
    required: [
      ['python', 65, 40],
      ['sql', 70, 40],
      ['data-modeling', 60, 20],
    ],
    preferred: [],
    eligibility: {},
    finalStatus: 'draft',
  },
  {
    employer: 'sentinel',
    title: 'Winter Internship Programme',
    type: 'internship',
    workMode: 'onsite',
    location: 'Chennai',
    /* Already past. Published, expired, still holds its applications. */
    deadlineInDays: -6,
    durationMonths: 2,
    openings: 6,
    description:
      'Our winter programme, now closed to new applications. It stays in the demo so a recruiter can be shown a finished pipeline: candidates reviewed, one selected, the rest told honestly.',
    required: [
      ['git', 55, 30],
      ['linux', 55, 30],
      ['python', 55, 40],
    ],
    preferred: [],
    eligibility: {},
    finalStatus: 'closed',
  },
];

/**
 * Who applied to what, and how far it got.
 *
 * `status` is the END state. seedDemo.js walks the real transition map to reach it,
 * through the real service, so every application in the demo has a status history that
 * the product itself could have produced. There is no path to `interview` that skips
 * `shortlisted`, here or anywhere else.
 *
 * The spread is the point: one selection, one rejection after interview, several
 * mid-pipeline, and a handful nobody has looked at yet — so the recruiter dashboard has
 * a real "6 waiting on you" number and the institution's pipeline has every stage.
 */
export const DEMO_APPLICATIONS = [
  /* Aarav — the strong candidate, all the way through. */
  { student: 'aarav.menon@student.demo', posting: 'Full Stack Engineer (Entry Level)', status: 'selected',
    note: 'Strongest submission in the round. Offer extended.',
    coverNote: 'I have shipped three MERN projects and would like to work on the API side of your dashboard.' },
  { student: 'aarav.menon@student.demo', posting: 'Backend Engineer (Entry Level)', status: 'interview',
    coverNote: 'Backend is where I want to specialise. Happy to talk through my API design decisions.' },
  { student: 'aarav.menon@student.demo', posting: 'Cloud Infrastructure Intern', status: 'applied' },

  /* Ishita — data track. */
  { student: 'ishita.bose@student.demo', posting: 'Machine Learning Intern', status: 'shortlisted',
    note: 'Notebooks are genuinely good. Moving forward.',
    coverNote: 'I have two published notebooks on forecasting and would like to work on evaluation.' },
  { student: 'ishita.bose@student.demo', posting: 'Data Analyst Intern', status: 'under_review' },

  /* Rohan — frontend, uneven. */
  { student: 'rohan.iyer@student.demo', posting: 'Frontend Developer Intern', status: 'shortlisted',
    note: 'Good CSS fundamentals.', coverNote: 'I care a lot about accessible components.' },
  { student: 'rohan.iyer@student.demo', posting: 'TypeScript Migration Intern', status: 'applied' },
  { student: 'rohan.iyer@student.demo', posting: 'Full Stack Engineer (Entry Level)', status: 'rejected',
    note: 'Not enough backend experience for this role yet. Encouraged to reapply next cycle.' },

  /* Sneha — backend. */
  { student: 'sneha.kulkarni@student.demo', posting: 'Backend Engineer (Entry Level)', status: 'interview',
    coverNote: 'I have built and documented a REST API for my college fest.' },
  { student: 'sneha.kulkarni@student.demo', posting: 'Winter Internship Programme', status: 'selected',
    note: 'Selected for the winter cohort.' },

  /* Vikram — cloud, not there yet. */
  { student: 'vikram.naidu@student.demo', posting: 'Cloud Infrastructure Intern', status: 'under_review' },
  { student: 'vikram.naidu@student.demo', posting: 'Platform Engineer', status: 'rejected',
    note: 'This role needs production experience. Please look at the internship instead.' },

  /* Ananya — analytics. */
  { student: 'ananya.pillai@student.demo', posting: 'Data Analyst Intern', status: 'shortlisted',
    note: 'Clear written communication.' },
  { student: 'ananya.pillai@student.demo', posting: 'Analytics Dashboard Live Project', status: 'applied' },

  /* Kabir — security. */
  { student: 'kabir.shah@student.demo', posting: 'Security Analyst Apprenticeship', status: 'interview',
    coverNote: 'I play CTFs most weekends and write up what I learn.' },

  /* Persona C — applying honestly, mostly early in the pipeline. */
  { student: 'divya.ramesh@student.demo', posting: 'Frontend Developer Intern', status: 'applied' },
  { student: 'divya.ramesh@student.demo', posting: 'Analytics Dashboard Live Project', status: 'under_review' },
  { student: 'arjun.deshpande@student.demo', posting: 'Analytics Dashboard Live Project', status: 'applied' },
  { student: 'fatima.sheikh@student.demo', posting: 'Data Analyst Intern', status: 'applied' },
  { student: 'fatima.sheikh@student.demo', posting: 'Analytics Dashboard Live Project', status: 'rejected',
    note: 'Close, but we filled the last slot. Please apply again.' },
  { student: 'nikhil.verma@student.demo', posting: 'Analytics Dashboard Live Project', status: 'applied' },
  { student: 'meghna.das@student.demo', posting: 'Frontend Developer Intern', status: 'under_review' },
  { student: 'meghna.das@student.demo', posting: 'Winter Internship Programme', status: 'rejected',
    note: 'Not selected this round.' },
  { student: 'saurabh.jain@student.demo', posting: 'Cloud Infrastructure Intern', status: 'applied' },
  { student: 'saurabh.jain@student.demo', posting: 'Winter Internship Programme', status: 'under_review' },

  /* Persona D — a good profile with no assessment behind it. The recruiter sees a
     high self-reported profile and zero verified skills, which is the comparison
     the candidate view exists to make. */
  { student: 'priya.ranganathan@student.demo', posting: 'Full Stack Engineer (Entry Level)', status: 'shortlisted',
    note: 'Strong on paper. Asked to complete a skill assessment before we interview.' },
  { student: 'priya.ranganathan@student.demo', posting: 'TypeScript Migration Intern', status: 'applied' },
  { student: 'harsh.tiwari@student.demo', posting: 'Backend Engineer (Entry Level)', status: 'applied' },
  { student: 'tanvi.kapoor@student.demo', posting: 'Frontend Developer Intern', status: 'applied' },

  /* The other college applies to the same market — its students appear to employers
     and must not appear in the demo institution's analytics. */
  { student: 'gautam.reddy@student.demo', posting: 'Full Stack Engineer (Entry Level)', status: 'interview',
    coverNote: 'I have deployed two side projects to AWS.' },
  { student: 'nisha.varma@student.demo', posting: 'Data Analyst Intern', status: 'applied' },

  /* ---- Academician applications (Step 7) ------------------------------------ */
  /* Dr. Ananya Sharma — the CV collaboration is the Phase 7 example, with ML/Python/CV
     as required and Deep Learning as preferred. Her expertise matches perfectly, so the
     dashboard's match explanation will demonstrate the "Strong expertise match" plus
     "Additional relevant expertise" split that Phase 7 requires. */
  {
    academician: 'academician@skillbridge.demo',
    posting: 'Industry-Academia Computer Vision Research Collaboration',
    status: 'shortlisted',
    note: 'Excellent fit — CV and ML expertise align perfectly with our manufacturing defect detection work. Moving to interview.',
    coverNote: 'I have published extensively on efficient neural architectures for edge deployment and real-time defect detection. My recent work on model compression for manufacturing QA directly aligns with your needs. I would bring both research rigour and practical deployment experience to this collaboration.',
  },
  {
    academician: 'academician@skillbridge.demo',
    posting: 'Faculty Development Programme — Generative AI in Production',
    status: 'applied',
    coverNote: 'I am keen to update my ML curriculum with practical GenAI deployment patterns. My students need to understand not just the models but the production challenges.',
  },
  {
    academician: 'academician@skillbridge.demo',
    posting: 'Guest Lecture Series on Data Engineering',
    status: 'under_review',
    coverNote: 'I can speak on recent advances in learned query optimization and how academic research on adaptive indexing is beginning to influence production systems.',
  },
];

/**
 * The learning programmes (Step 8). Eight of them, published by the same three
 * employers, because the role that lists a posting is the role that lists a course.
 *
 * THE SKILLS THEY TEACH ARE THE SKILLS THE POSTINGS ABOVE ASK FOR AND THE COHORT
 * DOES NOT HAVE. That is not decoration — it is the entire mechanism. Recommendations
 * are a set intersection between a student's skill gaps and `skills` below, so a
 * programme teaching things nobody is short of would be listed and never recommended,
 * and one teaching a skill no posting wants would be recommended and never useful.
 * Docker, AWS, CI/CD, advanced SQL and production ML are exactly where the engineered
 * gap sits (see the header), so that is what these programmes cover.
 *
 * DATES ARE MONTH OFFSETS, LIKE THE PORTFOLIO RECORDS. `startsInMonths` and
 * `endsInMonths` are resolved against the run, so the demo does not age into a
 * catalogue of programmes that all finished last spring. `endsInMonths: null` means
 * evergreen, which is what a self-paced course honestly is — and it is also the only
 * end date that can never expire between two seed runs.
 *
 * ONE OF THEM IS A DRAFT, ON PURPOSE. A draft is invisible to browse, to search and
 * to recommendations, and unenrollable — a rule nobody can see working is a rule
 * nobody believes. It is also what puts a number on the publisher dashboard's Drafts
 * tile.
 *
 * `provider` IS NOT THE PUBLISHER. Northwind lists an NPTEL course, which is what an
 * industry partner curating third-party material actually looks like, and the detail
 * page renders "Listed by Northwind Analytics" only because the two differ.
 */
export const DEMO_LEARNING_PROGRAMS = [
  {
    employer: 'sentinel',
    title: 'AWS Cloud Fundamentals',
    provider: 'Sentinel Cloud Academy',
    type: 'certification',
    level: 'beginner',
    deliveryMode: 'self_paced',
    skills: ['aws', 'linux'],
    durationHours: 40,
    startsInMonths: null,
    endsInMonths: null,
    instructor: '',
    prerequisites: ['Comfort with a terminal', 'No prior cloud experience needed'],
    externalUrl: 'https://learn.sentinel.example.com/aws-cloud-fundamentals',
    description:
      'The cloud vocabulary every backend and DevOps interview assumes you already have: regions and availability zones, IAM, EC2, S3, VPC basics, and what actually happens when you point a domain at a load balancer. Ends with the associate-level practice exam, taken under time.',
  },
  {
    employer: 'lumen',
    title: 'Full Stack React & Node Development',
    provider: 'Lumen Web Systems Academy',
    type: 'course',
    level: 'intermediate',
    deliveryMode: 'online',
    skills: ['react', 'node-js', 'express-js', 'mongodb', 'rest-api-design'],
    durationHours: 120,
    startsInMonths: 1,
    endsInMonths: 4,
    instructor: 'Meera Raghavan',
    prerequisites: ['Working JavaScript', 'Have built at least one page by hand'],
    externalUrl: 'https://learn.lumen.example.com/full-stack-react-node',
    description:
      'Twelve weeks building one application properly rather than six tutorials badly. React with real state, an Express API behind it, MongoDB underneath, and a fortnightly code review with an engineer from the product team. You finish with something deployed that you can defend in an interview.',
  },
  {
    employer: 'northwind',
    title: 'Advanced SQL & Database Engineering',
    provider: 'Northwind Data Academy',
    type: 'course',
    level: 'advanced',
    deliveryMode: 'hybrid',
    skills: ['sql', 'data-modeling'],
    durationHours: 60,
    startsInMonths: 1,
    endsInMonths: 3,
    instructor: 'Dr. Suresh Iyer',
    prerequisites: ['Confident with joins and grouping', 'Have written queries against a real dataset'],
    externalUrl: 'https://learn.northwind.example.com/advanced-sql',
    description:
      'Window functions, CTEs, indexing strategy and reading a query plan without guessing. The second half is modelling: normalisation you can argue for, the denormalisation you will actually ship, and why the schema decision made in week one is the one nobody can undo later.',
  },
  {
    employer: 'northwind',
    title: 'Python for Data Analytics',
    provider: 'NPTEL',
    type: 'course',
    level: 'beginner',
    deliveryMode: 'online',
    skills: ['python', 'pandas', 'data-analysis', 'data-visualization'],
    durationHours: 80,
    startsInMonths: 2,
    endsInMonths: 5,
    instructor: 'Prof. Kavita Menon',
    prerequisites: ['School-level mathematics'],
    externalUrl: 'https://nptel.example.com/python-for-data-analytics',
    description:
      'Pandas from the first week, on messy data rather than a teaching set: missing values, inconsistent categories, dates stored four different ways. Ends on visualisation and the harder half of it, which is deciding what a chart is allowed to claim.',
  },
  {
    employer: 'lumen',
    title: 'Industry Project & Agile Development Workshop',
    provider: 'Lumen Web Systems',
    type: 'workshop',
    level: 'intermediate',
    deliveryMode: 'offline',
    skills: ['git', 'teamwork', 'communication', 'problem-solving'],
    durationHours: 24,
    startsInMonths: 1,
    endsInMonths: 2,
    instructor: 'Arun Prakash',
    prerequisites: ['Any language', 'Bring a laptop'],
    externalUrl: 'https://learn.lumen.example.com/industry-project-workshop',
    description:
      'Three days on a team you did not choose, working a real backlog: branching that survives four people, pull requests reviewed by someone who did not write the code, a standup that stays under ten minutes, and a demo on the last afternoon to an audience that asks awkward questions.',
  },
  {
    employer: 'northwind',
    title: 'AI/ML Industry Readiness Program',
    provider: 'Northwind Analytics',
    type: 'training',
    level: 'advanced',
    deliveryMode: 'hybrid',
    skills: ['machine-learning', 'deep-learning', 'statistics', 'tensorflow'],
    durationHours: 150,
    startsInMonths: 2,
    endsInMonths: 6,
    instructor: 'Vandana Krishnan',
    prerequisites: ['A model trained end to end at least once', 'Statistics to hypothesis testing'],
    externalUrl: 'https://learn.northwind.example.com/ai-ml-industry-readiness',
    description:
      'The part of machine learning that a course project skips: leakage, honest validation splits, error analysis on the cases you got wrong, and what changes when the model has to answer in 40 milliseconds. Assessed on a written error analysis rather than a leaderboard score.',
  },
  {
    employer: 'sentinel',
    title: 'DevOps Mentorship: Linux to CI/CD',
    provider: 'Sentinel Cloud Academy',
    type: 'mentorship',
    level: 'intermediate',
    deliveryMode: 'online',
    skills: ['docker', 'ci-cd', 'kubernetes'],
    /* Open-ended, so `durationHours: null` is exercised by something the demo shows.
       A mentorship runs until it stops. */
    durationHours: null,
    startsInMonths: 1,
    endsInMonths: null,
    instructor: 'Farhan Qureshi',
    prerequisites: ['Comfortable on the Linux command line', 'Have deployed something, anywhere'],
    externalUrl: 'https://learn.sentinel.example.com/devops-mentorship',
    description:
      'Fortnightly one-to-one with a platform engineer, working on your own repository rather than an exercise: containerise it, get a pipeline green, then talk honestly about what happens when it fails at 2am. Pairs with the AWS certification above.',
  },
  /**
   * The draft. Nobody can see it and nobody can enrol in it — which is the point.
   *
   * `status: 'draft'` is the only status the fixture may state other than published:
   * archiving is a decision taken after learners exist, so it belongs in the UI rather
   * than in a seed that would have to enrol people into it first.
   */
  {
    employer: 'sentinel',
    title: 'System Design for Production Services',
    provider: 'Sentinel Cloud Academy',
    type: 'course',
    level: 'advanced',
    deliveryMode: 'online',
    status: 'draft',
    skills: ['system-design', 'kubernetes', 'aws'],
    durationHours: 90,
    startsInMonths: 3,
    endsInMonths: 6,
    instructor: 'Farhan Qureshi',
    prerequisites: ['Two years of writing services, or the AWS certification above'],
    externalUrl: 'https://learn.sentinel.example.com/system-design',
    description:
      'Still being written. Queues, idempotency, backpressure and the failure modes that only appear under load — the syllabus is drafted but the case studies are not cleared for release yet.',
  },
];

/**
 * Who is learning what (Step 8). 18 enrolments across the seven published programmes.
 *
 * `student` (or `academician`) plus `program` is the natural key, and it is also the
 * unique index the product enforces, so this list cannot express a duplicate
 * enrolment even by accident.
 *
 * THE END STATE IS STATED, THE ROUTE IS NOT. seedDemo.js enrols and then patches
 * through the real service, so every `startedAt`, every `completedAt` and every
 * refusal to move backwards is the product's own doing. A re-run reads where the row
 * actually is and asks for nothing it already has.
 *
 * THREE STUDENTS HAVE FINISHED SOMETHING, AND NONE OF THEM GOT A POINT FOR IT. That is
 * the whole argument of Step 8: completing a programme is evidence that learning
 * happened, not a claim about ability. Vikram finishes the DevOps mentorship with
 * Docker still recorded at 58 and CI/CD at 48, exactly where his profile above says
 * they are, and the portal responds by asking him to reassess. If a future edit makes
 * the numbers move on completion, this fixture is where the lie would have to be
 * written — and it must not be.
 *
 * PERSONAS D AND E ARE HANDLED DIFFERENTLY ON PURPOSE. Two unassessed students are
 * learning, which is honest and keeps readiness at null while progress moves; the two
 * empty accounts have no enrolments at all, so the My Learning empty state is real.
 */
export const DEMO_ENROLLMENTS = [
  /* ---- Persona A — already strong, closing the last gap ------------------- */
  { student: 'aarav.menon@student.demo', program: 'AWS Cloud Fundamentals', status: 'in_progress', progress: 70 },
  { student: 'ishita.bose@student.demo', program: 'AI/ML Industry Readiness Program', status: 'in_progress', progress: 40 },

  /* ---- Persona B — the realistic middle ---------------------------------- */
  { student: 'rohan.iyer@student.demo', program: 'Full Stack React & Node Development', status: 'in_progress', progress: 35 },
  { student: 'sneha.kulkarni@student.demo', program: 'Advanced SQL & Database Engineering', status: 'completed' },
  /* The completion the reassessment prompt was built for: Docker 58 and CI/CD 48 on
     his profile before, and the same two numbers after. */
  { student: 'vikram.naidu@student.demo', program: 'DevOps Mentorship: Linux to CI/CD', status: 'completed' },
  { student: 'ananya.pillai@student.demo', program: 'Python for Data Analytics', status: 'in_progress', progress: 55 },
  { student: 'kabir.shah@student.demo', program: 'AWS Cloud Fundamentals', status: 'enrolled' },

  /* ---- Persona C — the students the product is for ------------------------ */
  { student: 'divya.ramesh@student.demo', program: 'Industry Project & Agile Development Workshop', status: 'completed' },
  { student: 'arjun.deshpande@student.demo', program: 'Industry Project & Agile Development Workshop', status: 'in_progress', progress: 50 },
  { student: 'fatima.sheikh@student.demo', program: 'Advanced SQL & Database Engineering', status: 'in_progress', progress: 30 },
  /* Two programmes for one student, so My Learning has tabs worth switching. */
  { student: 'fatima.sheikh@student.demo', program: 'Python for Data Analytics', status: 'enrolled' },
  { student: 'nikhil.verma@student.demo', program: 'Python for Data Analytics', status: 'enrolled' },
  { student: 'meghna.das@student.demo', program: 'Full Stack React & Node Development', status: 'in_progress', progress: 60 },
  { student: 'saurabh.jain@student.demo', program: 'DevOps Mentorship: Linux to CI/CD', status: 'in_progress', progress: 20 },

  /* ---- Persona D — learning without an assessment behind it --------------- */
  { student: 'priya.ranganathan@student.demo', program: 'Full Stack React & Node Development', status: 'enrolled' },
  { student: 'lakshmi.narayan@student.demo', program: 'DevOps Mentorship: Linux to CI/CD', status: 'enrolled' },

  /* ---- The other college, and the academician ---------------------------- */
  /* Learning is open to the whole platform, unlike the institution cohort. */
  { student: 'gautam.reddy@student.demo', program: 'AWS Cloud Fundamentals', status: 'in_progress', progress: 65 },
  /* An academician is a learner too — LEARNER_ROLES says so, and this is the row that
     proves the `learnerRole` snapshot is not decoration. */
  { academician: 'academician@skillbridge.demo', program: 'AWS Cloud Fundamentals', status: 'in_progress', progress: 50 },
];

export default {
  DEMO_PASSWORD,
  DEMO_INSTITUTION,
  DEMO_ACADEMICIAN,
  OTHER_INSTITUTION_NAME,
  DEMO_EMPLOYERS,
  DEMO_STUDENTS,
  DEMO_PORTFOLIOS,
  DEMO_OPPORTUNITIES,
  DEMO_APPLICATIONS,
  DEMO_LEARNING_PROGRAMS,
  DEMO_ENROLLMENTS,
};
