/**
 * The deterministic question bank — the reason this app never needs an AI key.
 *
 * WHY A DATA FILE AND NOT A COLLECTION. TRD section 14 sketches a `questions`
 * collection, and that is the right shape for a product where staff author
 * questions through an admin screen. It is the wrong shape here: it would need a
 * second seed step before an assessment could run at all, and a demo that fails
 * because someone forgot `npm run seed` is a demo that fails. This file is
 * imported, so the bank exists the moment the server boots. The questions a
 * student was actually served are snapshotted onto their attempt, so scoring
 * never depends on this file staying unchanged.
 *
 * SHAPE. Each entry is `[skillSlug, difficulty, questionText, [best, good, weak,
 * wrong]]`. Options are written in descending correctness order and the scores in
 * `OPTION_SCORES` are attached by `buildQuestion` below — writing 100/67/33/0 out
 * sixty-two times invites exactly one typo, and a typo here silently distorts a
 * student's skill score with nothing to catch it.
 *
 * Options are shuffled per attempt (see assessment.service.js), so the ordering
 * here is authoring convenience only and never reaches the browser in this order.
 *
 * COVERAGE. Every skill slug referenced by `careerRoles.seed.js` has at least two
 * questions. That is the contract this file owes the rest of the system, and
 * `verify-assessment.mjs` checks it rather than trusting this comment.
 */

import { DIFFICULTIES, OPTION_SCORES } from '../constants/assessments.js';
import { SKILL_CATEGORIES } from '../constants/skills.js';

const { EASY, MEDIUM, HARD } = DIFFICULTIES;

/** Soft skills, so category can be derived instead of typed on every row. */
const SOFT_SLUGS = new Set(['communication', 'teamwork', 'problem-solving', 'leadership', 'time-management']);

/**
 * Rows are `[skillSlug, difficulty, questionText, options]` with options ordered
 * best to worst.
 */
const ROWS = [
  // ---------------------------------------------------------------- frontend
  ['html', EASY, 'Which element correctly associates a caption with a form control?', [
    'A <label> with a "for" attribute matching the control id',
    'A <span> placed immediately before the control',
    'A "title" attribute on the control',
    'A <div> with class="label" above the control',
  ]],
  ['html', MEDIUM, 'A page has a logo, a nav, an article and a footer. What is the most accessible markup?', [
    'Semantic <header>, <nav>, <main><article>, <footer> landmarks',
    'Divs with ARIA role attributes on each region',
    'Divs with descriptive class names such as .header and .nav',
    'A table layout with one row per region',
  ]],
  ['css', EASY, 'You need three cards in a row that wrap on small screens and share gaps evenly. What do you reach for?', [
    'Flexbox with flex-wrap and a gap value',
    'Floats with a clearfix and percentage widths',
    'Absolute positioning with calculated offsets',
    'A table with three cells',
  ]],
  ['css', MEDIUM, 'A child with margin-bottom: 24px sits inside a parent with no padding. The gap appears outside the parent. Why?', [
    'Adjacent vertical margins collapse through the parent boundary',
    'The child inherited the margin from the body element',
    'Margins are always applied to the nearest positioned ancestor',
    'The parent has display: none applied by the browser',
  ]],
  ['javascript', EASY, 'What does Array.prototype.map return?', [
    'A new array of the same length containing the callback results',
    'The original array, mutated in place',
    'Only the elements for which the callback returned true',
    'A single accumulated value',
  ]],
  ['javascript', MEDIUM, 'Inside a promise chain, an awaited call rejects and there is no try/catch. What happens?', [
    'The rejection propagates and becomes an unhandled rejection unless a caller catches it',
    'The value resolves to undefined and execution continues normally',
    'Node exits immediately with status 0',
    'The await expression retries the call automatically',
  ]],
  ['javascript', HARD, 'Why does a "var" loop counter passed to setTimeout print the final value every time?', [
    'var is function-scoped, so all callbacks close over one shared binding',
    'setTimeout copies its arguments by reference rather than by value',
    'The event loop reorders timers by delay before running them',
    'Numbers are boxed objects and share a single instance',
  ]],
  ['typescript', EASY, 'What is the practical benefit of a type annotation on a function parameter?', [
    'Errors from a wrong argument type surface at compile time, before running',
    'The function executes measurably faster at runtime',
    'The parameter becomes immutable inside the function body',
    'The argument is coerced to the declared type automatically',
  ]],
  ['typescript', MEDIUM, 'When is an interface preferable to a type alias for an object shape?', [
    'When the shape should be open to declaration merging or extended by others',
    'Whenever the object has more than three properties',
    'Only inside .d.ts files, as aliases are not allowed there',
    'When the shape contains union members',
  ]],
  ['react', EASY, 'Why does React need a stable "key" on list items?', [
    'To match elements across renders so state and DOM nodes are reused correctly',
    'To generate the CSS class names applied to each row',
    'To sort the array before it is rendered',
    'To make each item focusable for keyboard users',
  ]],
  ['react', MEDIUM, 'A useEffect that fetches data reruns endlessly. What is the most likely cause?', [
    'A dependency is a new object or function identity on every render',
    'The effect is missing a return statement',
    'The component is wrapped in StrictMode',
    'The fetch call was not awaited',
  ]],
  ['react', HARD, 'A parent re-renders often and an expensive child receives an inline callback. What actually prevents the child re-rendering?', [
    'Memoising the child and stabilising the callback with useCallback',
    'Wrapping the child in useMemo alone',
    'Moving the callback into the child as a prop default',
    'Converting the child to a class component',
  ]],

  // ----------------------------------------------------------------- backend
  ['node-js', EASY, 'Node is single-threaded for JavaScript. How does it serve many concurrent requests?', [
    'Non-blocking I/O with an event loop, so waiting work does not occupy the thread',
    'It forks a new operating-system thread for each request',
    'It queues requests and handles them strictly one after another',
    'It relies on the client to retry when the server is busy',
  ]],
  ['node-js', MEDIUM, 'Where does CPU-bound work belong in a Node service?', [
    'In a worker thread or a separate process, off the event loop',
    'In a setTimeout callback so it runs later',
    'Inside a promise, which makes it asynchronous',
    'In a middleware, so Express can schedule it',
  ]],
  ['express-js', EASY, 'What makes a function Express error-handling middleware?', [
    'It takes four arguments, starting with the error',
    'It is registered with app.use before the routes',
    'Its name is errorHandler',
    'It returns a rejected promise',
  ]],
  ['express-js', MEDIUM, 'An async route handler throws. Express returns nothing and the request hangs. Why?', [
    'Express 4 does not catch rejected promises, so next(error) is never called',
    'The error handler must be registered before the route to catch it',
    'Async handlers are unsupported and must be callbacks',
    'The response was already sent, so the throw was ignored',
  ]],
  ['rest-api-design', EASY, 'Which status code fits a request that is authenticated but not permitted?', [
    '403 Forbidden',
    '401 Unauthorized',
    '400 Bad Request',
    '404 Not Found',
  ]],
  ['rest-api-design', MEDIUM, 'Which verb suits replacing a resource’s entire representation?', [
    'PUT, because it is idempotent and describes a full replacement',
    'POST, because it carries a request body',
    'PATCH, because it writes to an existing resource',
    'GET with a body, to keep the URL clean',
  ]],
  ['rest-api-design', HARD, 'A list endpoint must expose paging metadata. What is the soundest design?', [
    'Return the page of items plus a sibling metadata block describing total and page count',
    'Return only the items and let the client count them',
    'Encode the total in a custom response header and nothing else',
    'Return every record and paginate in the browser',
  ]],
  ['authentication-authorization', EASY, 'What is the difference between authentication and authorization?', [
    'Authentication establishes who you are; authorization decides what you may do',
    'They are two words for verifying a password',
    'Authentication happens on the client, authorization on the server',
    'Authorization runs first, then authentication confirms it',
  ]],
  ['authentication-authorization', MEDIUM, 'A JWT carries a "role" claim. Why still read the role from the database?', [
    'A token issued before a role or status change would otherwise stay valid',
    'Claims cannot store strings reliably',
    'Reading from the database is faster than parsing a token',
    'The signature cannot be verified without the database record',
  ]],
  ['authentication-authorization', HARD, 'Why must login return the same message for an unknown email and a wrong password?', [
    'Different messages let an attacker enumerate which accounts exist',
    'It reduces the size of the response payload',
    'The password comparison would otherwise be skipped',
    'HTTP forbids two different 401 bodies on one route',
  ]],
  ['python', EASY, 'What does a list comprehension give you over an explicit append loop?', [
    'The same result in one expression, with the intent stated up front',
    'Guaranteed parallel execution across cores',
    'Automatic removal of duplicate values',
    'Lazy evaluation, so nothing is computed until used',
  ]],
  ['python', MEDIUM, 'Why is a mutable default argument such as def f(items=[]) a trap?', [
    'The default is created once and shared across every call',
    'Lists cannot be used as parameters in Python',
    'It forces the function to be called with an argument',
    'The interpreter copies it on each call, which is slow',
  ]],
  ['java', EASY, 'What does it mean that Java is statically typed?', [
    'Variable types are known and checked at compile time',
    'Objects cannot be reassigned after construction',
    'All fields are implicitly final',
    'Types are inferred at runtime from the assigned value',
  ]],
  ['java', MEDIUM, 'Why override hashCode whenever you override equals?', [
    'Hash-based collections locate objects by bucket first, so unequal hashes hide equal objects',
    'The compiler refuses to build a class that overrides only equals',
    'hashCode is what the == operator calls',
    'Without it, equals silently compares references instead',
  ]],

  // ---------------------------------------------------------------- database
  ['mongodb', EASY, 'What is a document in MongoDB?', [
    'A BSON record, roughly a JSON object, stored inside a collection',
    'A table row with a fixed column schema',
    'A single field within a record',
    'A stored query definition',
  ]],
  ['mongodb', MEDIUM, 'A query filters on a field with no index over a large collection. What is the cost?', [
    'A full collection scan, so latency grows with the document count',
    'The query is rejected until an index is created',
    'The result set silently truncates to the first thousand documents',
    'MongoDB creates the missing index automatically',
  ]],
  ['mongodb', HARD, 'When does embedding beat referencing?', [
    'When the data is read with its parent, bounded in size and not shared elsewhere',
    'Whenever the embedded array might grow without limit',
    'Whenever two parents need the same child record',
    'Always, since embedding removes every join',
  ]],
  ['sql', EASY, 'What does an INNER JOIN return?', [
    'Only the rows with a match on both sides of the join condition',
    'Every row from the left table, with nulls where no match exists',
    'Every row from both tables concatenated',
    'The rows present in one table but absent from the other',
  ]],
  ['sql', MEDIUM, 'Which clause filters on an aggregate such as COUNT(*)?', [
    'HAVING, which is applied after grouping',
    'WHERE, which is applied before grouping',
    'ORDER BY, with the aggregate as the sort key',
    'A subquery is the only option',
  ]],
  ['data-modeling', EASY, 'Why store a foreign key rather than repeat the referenced values?', [
    'One authoritative copy means an update cannot leave the two out of step',
    'Foreign keys use less storage than any other column type',
    'Repetition is forbidden by the SQL standard',
    'It removes the need for an index on the column',
  ]],
  ['data-modeling', MEDIUM, 'A skill level must be comparable against a role requirement. What models it best?', [
    'One numeric scale stored per entry, with labels derived from it',
    'A label string such as "Advanced", stored as written',
    'A boolean for each named proficiency band',
    'Free text, so the student can describe the level',
  ]],

  // ----------------------------------------------------- tooling / platform
  ['git', EASY, 'What does git commit actually record?', [
    'A snapshot of the staged content, with a parent pointer',
    'The differences since the last push',
    'Every change in the working tree, staged or not',
    'A branch label pointing at the remote',
  ]],
  ['git', MEDIUM, 'Why avoid rewriting history on a branch others have pulled?', [
    'Their history diverges from the rewritten one and the next merge conflicts',
    'Git deletes the remote branch as a safety measure',
    'Rewritten commits lose their authorship metadata',
    'The commits become unreachable and are erased immediately',
  ]],
  ['linux', EASY, 'What does chmod 644 grant on a file?', [
    'Read and write for the owner, read only for group and others',
    'Full access for everyone',
    'Read, write and execute for the owner only',
    'Execute for the group and nothing else',
  ]],
  ['linux', MEDIUM, 'What does a pipe between two commands do?', [
    'Sends the first command’s standard output to the second’s standard input',
    'Runs both commands in parallel with no connection between them',
    'Writes the first command’s output into a file named by the second',
    'Runs the second command only if the first fails',
  ]],
  ['docker', EASY, 'What is a container image?', [
    'An immutable, layered filesystem plus the metadata to start a process from it',
    'A running process with its own kernel',
    'A virtual machine snapshot including a guest operating system',
    'A tarball of source code awaiting compilation',
  ]],
  ['docker', MEDIUM, 'Why copy package.json and install dependencies before copying the source?', [
    'The dependency layer stays cached while only application code changes',
    'npm refuses to run if source files are already present',
    'It makes the final image smaller by removing the source layer',
    'Docker requires manifests to be copied in the first instruction',
  ]],
  ['kubernetes', EASY, 'What is a Pod?', [
    'The smallest deployable unit: one or more containers sharing a network namespace',
    'A single physical machine in the cluster',
    'A load balancer in front of the cluster',
    'A stored configuration template for a Deployment',
  ]],
  ['kubernetes', MEDIUM, 'What does a readiness probe control?', [
    'Whether the Pod receives traffic from its Service',
    'Whether the container is restarted after a crash',
    'How many replicas the Deployment maintains',
    'The order in which Pods are scheduled onto nodes',
  ]],
  ['ci-cd', EASY, 'What is the point of running tests in a pipeline as well as locally?', [
    'Every change is checked in a clean, identical environment before it merges',
    'Pipeline runs execute faster than local ones',
    'It removes the need to run tests before pushing',
    'It guarantees the code contains no bugs',
  ]],
  ['ci-cd', MEDIUM, 'Why keep deployment credentials in the pipeline’s secret store rather than the repository?', [
    'Anything committed stays in history and is visible to everyone with read access',
    'Repository files are inaccessible to the pipeline runner',
    'Secret stores compress values, saving space',
    'Environment variables cannot be read by a build step',
  ]],
  ['aws', EASY, 'What does S3 provide?', [
    'Durable object storage addressed by bucket and key',
    'A managed relational database engine',
    'A virtual machine with attached block storage',
    'A managed Kubernetes control plane',
  ]],
  ['aws', MEDIUM, 'What is the IAM principle of least privilege?', [
    'Grant only the permissions a role actually needs, and no more',
    'Give every role administrator access and audit the logs',
    'Use one shared account so access is easy to review',
    'Rotate credentials daily regardless of scope',
  ]],

  // ----------------------------------------------------- data science / ML
  ['data-analysis', EASY, 'A column of salaries has a handful of extreme values. Which centre is more representative?', [
    'The median, because it is not dragged by outliers',
    'The mean, because it uses every observation',
    'The mode, because it is the most frequent value',
    'The midpoint between minimum and maximum',
  ]],
  ['data-analysis', MEDIUM, 'What is the risk in dropping every row with a missing value?', [
    'If missingness is not random, the remaining sample is biased',
    'Row counts must always stay constant for analysis to be valid',
    'Dropping rows corrupts the column data types',
    'There is no risk; it is always the correct treatment',
  ]],
  ['pandas', EASY, 'What does df.groupby("city")["sales"].sum() produce?', [
    'One summed sales figure per city',
    'The overall sales total, ignoring city',
    'The rows sorted by city then by sales',
    'A count of records for each city',
  ]],
  ['pandas', MEDIUM, 'Why prefer .loc over chained indexing for assignment?', [
    'Chained indexing may write to a temporary copy, so the change is silently lost',
    '.loc is the only accessor that supports boolean masks',
    'Chained indexing cannot select more than one column',
    '.loc converts the result to a NumPy array first',
  ]],
  ['data-visualization', EASY, 'You are comparing one value across eight categories. Which chart?', [
    'A bar chart, because length is easy to compare precisely',
    'A pie chart, because it shows the share of a whole',
    'A line chart, because it looks cleaner',
    'A scatter plot, with the category on the x axis',
  ]],
  ['data-visualization', MEDIUM, 'Why is truncating a bar chart’s y axis misleading?', [
    'Bar length encodes magnitude, so a shifted baseline exaggerates differences',
    'Truncated axes cannot display gridlines',
    'It makes the chart harder to render at small sizes',
    'It is only a problem when the data are percentages',
  ]],
  ['machine-learning', EASY, 'What distinguishes supervised from unsupervised learning?', [
    'Supervised learning trains on labelled examples; unsupervised finds structure without labels',
    'Supervised learning uses neural networks; unsupervised uses statistics',
    'Supervised learning runs on a GPU; unsupervised runs on a CPU',
    'Supervised learning needs more data by definition',
  ]],
  ['machine-learning', MEDIUM, 'Training accuracy is 99% and validation accuracy is 62%. What is happening?', [
    'The model is overfitting and has memorised the training set',
    'The model is underfitting and needs more capacity',
    'The learning rate is too low to converge',
    'The validation set is simply harder and nothing is wrong',
  ]],
  ['machine-learning', HARD, 'A fraud classifier sees 1% positives and scores 99% accuracy. Why is that not good news?', [
    'Predicting the majority class always reaches 99%; precision and recall are what matter',
    'Accuracy cannot be computed on imbalanced data',
    'The model must be leaking labels from the test set',
    '99% is below the threshold for a usable classifier',
  ]],
  ['deep-learning', EASY, 'What does an activation function contribute to a network?', [
    'Non-linearity, without which stacked layers collapse into one linear map',
    'Normalisation of the input features',
    'A reduction in the number of parameters',
    'Randomised weight initialisation',
  ]],
  ['deep-learning', MEDIUM, 'What does dropout do during training?', [
    'Randomly zeroes activations so the network cannot rely on any single unit',
    'Discards the training examples the model gets wrong',
    'Reduces the learning rate as epochs progress',
    'Removes layers permanently once they stop improving',
  ]],
  ['statistics', EASY, 'What does the standard deviation describe?', [
    'How far observations typically fall from the mean',
    'The middle value once the data are ordered',
    'The difference between the largest and smallest value',
    'The most frequently observed value',
  ]],
  ['statistics', MEDIUM, 'A study finds p = 0.03. What does that mean?', [
    'Data this extreme would arise 3% of the time if the null hypothesis were true',
    'There is a 3% chance the null hypothesis is true',
    'The effect explains 3% of the variance',
    'The result will replicate 97 times out of 100',
  ]],

  // ----------------------------------------------------------- CS core / sec
  ['data-structures-algorithms', EASY, 'What is the average-case lookup cost of a hash table?', [
    'Constant time, O(1)',
    'Logarithmic time, O(log n)',
    'Linear time, O(n)',
    'Linearithmic time, O(n log n)',
  ]],
  ['data-structures-algorithms', MEDIUM, 'Which structure suits a breadth-first traversal?', [
    'A queue, so nodes are visited in the order discovered',
    'A stack, so the deepest node is visited next',
    'A max-heap, so the largest node is visited next',
    'A sorted array rebuilt at each step',
  ]],
  ['data-structures-algorithms', HARD, 'Why is binary search O(log n) rather than O(n)?', [
    'Each comparison discards half the remaining range',
    'Sorted arrays support constant-time indexing',
    'The comparison itself is cheaper than a linear scan’s',
    'It examines only the first and last elements',
  ]],
  ['system-design', EASY, 'What problem does a load balancer solve?', [
    'It spreads traffic over several instances and stops routing to unhealthy ones',
    'It compresses responses to save bandwidth',
    'It caches database queries close to the client',
    'It encrypts traffic between services',
  ]],
  ['system-design', MEDIUM, 'A read-heavy endpoint returns rarely-changing data and is slow. What is the cheapest first move?', [
    'Cache the response with a sensible expiry and invalidate on write',
    'Shard the database across regions',
    'Rewrite the service in a faster language',
    'Add a message queue in front of the endpoint',
  ]],
  ['system-design', HARD, 'What does the CAP theorem force you to choose during a network partition?', [
    'Between consistency and availability, since partition tolerance is not optional',
    'Between consistency and partition tolerance, keeping availability',
    'Between availability and latency, keeping consistency',
    'Nothing; a well-designed system provides all three',
  ]],
  ['network-security', EASY, 'What does TLS give a client talking to a server?', [
    'Encryption in transit plus verification of the server’s identity',
    'A guarantee the server stores data encrypted at rest',
    'Protection against SQL injection in the request body',
    'Authentication of the user to the application',
  ]],
  ['network-security', MEDIUM, 'Why is a firewall alone insufficient inside a network?', [
    'Once a host is compromised, lateral movement is unfiltered without internal controls',
    'Firewalls cannot inspect encrypted traffic at all',
    'Firewalls only work on outbound connections',
    'A firewall replaces the need for authentication',
  ]],
  ['application-security', EASY, 'What prevents SQL injection?', [
    'Parameterised queries, which keep data out of the statement text',
    'Escaping quotes in the user input before concatenating',
    'Rejecting any input containing the word SELECT',
    'Running the database under a non-root account',
  ]],
  ['application-security', MEDIUM, 'Why hash passwords with bcrypt rather than SHA-256?', [
    'bcrypt is deliberately slow and salted, so brute-forcing a leak is expensive',
    'SHA-256 is reversible with the right key',
    'bcrypt produces a shorter digest, saving storage',
    'SHA-256 cannot handle strings longer than 64 characters',
  ]],
  ['application-security', HARD, 'What is the real danger of returning a password hash in an API response?', [
    'It is offline-crackable material that never needed to leave the server',
    'Hashes are large and slow the response down',
    'The client may accidentally display it to the user',
    'None, because a hash cannot be reversed',
  ]],

  // -------------------------------------------------------------- soft skills
  ['communication', EASY, 'You will miss a deadline by two days. What is the best move?', [
    'Tell the stakeholder now, with a revised date and what changed',
    'Wait until the deadline, then explain what went wrong',
    'Ship something incomplete on time and say nothing',
    'Mention it casually in the next weekly meeting',
  ]],
  ['communication', MEDIUM, 'You must explain a technical trade-off to a non-technical decision maker. How?', [
    'Lead with the impact and the recommendation, keep the mechanism brief and available',
    'Walk through the implementation in full so the reasoning is complete',
    'Send the design document and ask for questions',
    'Simplify to the point of leaving out the trade-off',
  ]],
  ['teamwork', EASY, 'A teammate’s pull request has a real problem. What is the constructive response?', [
    'Comment on the specific code with the reason and a suggested alternative',
    'Approve it and fix the problem yourself afterwards',
    'Reject it with a note that it needs work',
    'Raise it in the team channel so everyone learns',
  ]],
  ['teamwork', MEDIUM, 'Two teammates disagree on an approach and the work has stalled. What helps most?', [
    'Write down the decision criteria, then evaluate both options against them',
    'Let the more senior person decide and move on',
    'Build both and compare afterwards',
    'Escalate to the manager immediately',
  ]],
  ['problem-solving', EASY, 'A bug appears only in production. What is the first step?', [
    'Find a reliable reproduction, using the logs and the failing input',
    'Start changing the most suspicious code and redeploy',
    'Roll back and consider it resolved',
    'Add defensive try/catch blocks around the area',
  ]],
  ['problem-solving', MEDIUM, 'A test suite passes but the feature is broken. What does that tell you?', [
    'The tests are asserting something other than the behaviour that matters',
    'The suite needs to be run again in a clean environment',
    'The bug must be in a dependency rather than the code',
    'Nothing useful; passing tests and broken features are unrelated',
  ]],
  ['problem-solving', HARD, 'You have four plausible causes and limited time. How do you order the investigation?', [
    'By what a single cheap observation can eliminate the most possibilities',
    'By which cause would be easiest to fix if true',
    'By which cause you have seen most recently',
    'In the order the code executes, from entry point onwards',
  ]],
  ['leadership', EASY, 'A project is behind and the team is demoralised. What helps first?', [
    'Cut scope openly to something achievable, and say what is being dropped',
    'Extend working hours until the original scope is met',
    'Reassure the team that it will work out',
    'Escalate the risk and wait for direction',
  ]],
  ['leadership', MEDIUM, 'How should credit and blame be handled after a failed release?', [
    'Blameless review of the system that allowed it, with credit shared for the fix',
    'Identify who introduced the change so it is not repeated',
    'Absorb the blame privately and say nothing to the team',
    'Move on quickly to avoid dwelling on it',
  ]],
  ['time-management', EASY, 'Two tasks are due today and only one can be finished. What do you do?', [
    'Confirm which matters more with whoever depends on them, then finish that one',
    'Work on both and deliver each half-finished',
    'Pick the shorter one so something is complete',
    'Start the harder one and hope for extra time',
  ]],
  ['time-management', MEDIUM, 'What makes an estimate more trustworthy?', [
    'Breaking the work down until each piece is small enough to have been done before',
    'Adding a fixed percentage buffer to the first number that comes to mind',
    'Estimating in hours rather than days for precision',
    'Committing to the earliest date that is still conceivable',
  ]],
];

/** Attaches the shared option weights so no row hard-codes a score. */
const buildQuestion = ([skillSlug, difficulty, questionText, optionTexts], index) => ({
  bankId: `q${String(index + 1).padStart(3, '0')}-${skillSlug}`,
  skillSlug,
  category: SOFT_SLUGS.has(skillSlug) ? SKILL_CATEGORIES.SOFT : SKILL_CATEGORIES.TECHNICAL,
  difficulty,
  questionText,
  options: optionTexts.map((text, position) => ({ text, score: OPTION_SCORES[position] })),
});

export const QUESTION_BANK = Object.freeze(ROWS.map(buildQuestion));

/** slug -> questions, built once. The service picks from these lists. */
export const QUESTIONS_BY_SKILL_SLUG = Object.freeze(
  QUESTION_BANK.reduce((grouped, question) => {
    (grouped[question.skillSlug] ??= []).push(question);
    return grouped;
  }, {}),
);

export const BANK_SKILL_SLUGS = Object.freeze(Object.keys(QUESTIONS_BY_SKILL_SLUG));

export default QUESTION_BANK;
