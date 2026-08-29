# SkillBridge AI

**Academia–Industry Collaboration Portal** — connecting students, industry, academicians and institutions through verified skills, explainable matching, and real opportunities.

> **Status:** Step 6 — Student portfolio and secure document management. Every
> flow is live end to end: a student registers, builds a profile, sits an
> assessment that scores itself on the server, sees their career readiness and
> skill gaps, browses ranked opportunity matches with the reasoning behind each
> score, applies, watches the status history as an employer moves them along, and
> assembles a portfolio of projects, certifications, achievements and experience
> with the documents that back them up. An **industry** account posts and manages
> opportunities and works a ranked applicant pipeline. An **institution** account
> sees cohort readiness, the skill gaps against live hiring, and placements.
>
> **Nothing verifies a portfolio record yet.** Every record says `pending`,
> because there is no reviewer role and no endpoint that promotes one — the field
> is there so the badge tells the truth rather than flattering the profile.
> Notifications are not built. The Academician and Admin dashboards remain
> honest placeholders that list what they will contain.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 5, JavaScript, Tailwind CSS 3 |
| Backend | Node.js, Express 4, JavaScript (ES modules) |
| Database | MongoDB with Mongoose 8 |
| Auth *(Step 2)* | JWT, bcrypt, role-based access control |
| Profile data *(Step 3)* | Mongoose refs between User, StudentProfile, Skill and CareerRole |
| Opportunities *(Step 4)* | Mongoose refs from Opportunity to User and to the same Skill catalogue |

No TypeScript, no Next.js, no PostgreSQL/Prisma, no monorepo tooling. Plain
`npm` in two independent folders.

---

## Prerequisites

- **Node.js 18 or newer** — check with `node -v`
- **npm 9 or newer** — check with `npm -v`
- **MongoDB**, either:
  - local MongoDB Community Server (works alongside MongoDB Compass), or
  - a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) cluster

---

## Project structure

```text
skillbridge-ai/
├── client/                      # React + Vite frontend
│   ├── src/
│   │   ├── api/                 # axios instance + one module per resource
│   │   │   ├── axiosInstance.js # attaches the JWT, handles 401 centrally
│   │   │   ├── auth.api.js
│   │   │   ├── health.api.js
│   │   │   ├── catalogue.api.js      # read-only: skills, career roles
│   │   │   ├── studentProfile.api.js # profile, career goals, skills
│   │   │   ├── opportunity.api.js    # browse, detail, and the owner's CRUD
│   │   │   ├── assessment.api.js     # generate, take, submit, history
│   │   │   ├── matching.api.js       # readiness, recommendations, matches
│   │   │   ├── application.api.js    # apply, my applications, applicants
│   │   │   ├── analytics.api.js      # the institution overview, one call
│   │   │   └── portfolio.api.js      # portfolio records + document upload
│   │   ├── components/
│   │   │   ├── ui/              # Button, Input, Textarea, Select, Alert,
│   │   │   │                    # Spinner, Card, Badge, ProgressBar, EmptyState,
│   │   │   │                    # BackLink, ChipListField, Pagination
│   │   │   ├── auth/RoleSelector.jsx
│   │   │   ├── dashboard/DashboardPlaceholder.jsx
│   │   │   ├── layout/          # AuthLayout, DashboardLayout
│   │   │   ├── profile/         # ProfileForm, InterestsField,
│   │   │   │                    # CareerGoalsSection, SkillsSection,
│   │   │   │                    # SkillLevelPicker, ProfileCompletionCard
│   │   │   ├── opportunities/   # OpportunityCard, OpportunityForm,
│   │   │   │                    # SkillRequirementPicker, SearchInput,
│   │   │   │                    # StudentFilterBar, OwnerFilterBar
│   │   │   ├── student/
│   │   │   │   ├── MatchBreakdown.jsx        # why a match scored what it did
│   │   │   │   ├── RecommendedLearning.jsx   # gap-driven study suggestions
│   │   │   │   ├── ApplyCard.jsx             # the apply form + its refusals
│   │   │   │   └── ApplicationStatusTimeline.jsx  # the real status history
│   │   │   ├── industry/CandidateCard.jsx    # one ranked applicant
│   │   │   ├── institution/AnalyticsCharts.jsx  # CSS bars, no chart library
│   │   │   └── portfolio/
│   │   │       ├── PortfolioHeader.jsx        # name, headline, completion ring
│   │   │       ├── PortfolioSummary.jsx       # bio, education, skills, readiness
│   │   │       ├── PortfolioCompletionPanel.jsx # what is missing, and the fix
│   │   │       ├── PortfolioSection.jsx       # one collapsible record section
│   │   │       ├── RecordCard.jsx             # one project/cert/achievement/role
│   │   │       ├── RecordForm.jsx             # add and edit, driven by config
│   │   │       ├── ResumeCard.jsx             # the single current resume
│   │   │       ├── DocumentControl.jsx        # attach, download, remove
│   │   │       └── VerificationBadge.jsx      # pending / verified / rejected
│   │   ├── constants/
│   │   │   ├── roles.js         # role labels + dashboard paths
│   │   │   ├── skills.js        # proficiency bands, category labels
│   │   │   ├── opportunities.js # types, work modes, statuses, availability,
│   │   │   │                    # limits — mirrors the server file of the same name
│   │   │   ├── applications.js  # statuses, labels, the pipeline order
│   │   │   ├── portfolio.js     # upload limits, type labels, badge styling —
│   │   │   │                    # mirrors the server file of the same name
│   │   │   └── portfolioSections.js # the four record sections as data: fields,
│   │   │                            # validation, card shape, request payload
│   │   ├── context/AuthContext.jsx
│   │   ├── hooks/
│   │   │   ├── useStudentProfile.js  # loads the profile, owns every write
│   │   │   ├── useSkillCatalogue.js  # the shared skill list, for pickers
│   │   │   ├── useOpportunities.js   # student browse: filters + pagination
│   │   │   ├── useOpportunity.js     # one opportunity, for the detail page
│   │   │   ├── useMyOpportunities.js # the owner's list, summary and row actions
│   │   │   ├── useOpportunityEditor.js # create/edit form state and submission
│   │   │   ├── useAssessmentAttempt.js # one attempt: answers, timer, submit
│   │   │   └── usePortfolio.js        # the portfolio, and every write to it
│   │   ├── pages/
│   │   │   ├── Login.jsx  Register.jsx
│   │   │   ├── SystemStatus.jsx      # the Step 1 status card, now at /status
│   │   │   ├── Unauthorized.jsx  NotFound.jsx
│   │   │   ├── dashboards/           # one per role
│   │   │   │   ├── StudentDashboard.jsx      # profile + opportunity browsing
│   │   │   │   ├── IndustryDashboard.jsx     # posting counts + shortcuts
│   │   │   │   ├── InstitutionDashboard.jsx  # cohort readiness + skill gaps
│   │   │   │   ├── AcademicianDashboard.jsx  # still a placeholder
│   │   │   │   └── AdminDashboard.jsx        # still a placeholder
│   │   │   ├── student/
│   │   │   │   ├── StudentProfile.jsx
│   │   │   │   ├── BrowseOpportunities.jsx   # search, filters, pagination
│   │   │   │   ├── OpportunityDetails.jsx    # detail + match + apply
│   │   │   │   ├── StartAssessment.jsx       # pick a skill, start an attempt
│   │   │   │   ├── TakeAssessment.jsx        # the attempt itself
│   │   │   │   ├── AssessmentResult.jsx      # score, band, what to study
│   │   │   │   ├── CareerReadiness.jsx       # readiness + gaps per career goal
│   │   │   │   ├── MatchedOpportunities.jsx  # ranked matches, with reasons
│   │   │   │   ├── MyApplications.jsx        # every application and its history
│   │   │   │   └── StudentPortfolio.jsx      # the portfolio page, /student/portfolio
│   │   │   └── industry/
│   │   │       ├── MyOpportunities.jsx       # the owner's management list
│   │   │       ├── OpportunityFormPage.jsx   # one page for create and edit
│   │   │       └── OpportunityApplicants.jsx # ranked applicants + status moves
│   │   ├── routes/
│   │   │   ├── AppRouter.jsx    # all route definitions
│   │   │   └── guards.jsx       # ProtectedRoute, RoleRoute, PublicOnlyRoute
│   │   ├── utils/
│   │   │   ├── tokenStorage.js  # the only place the token is read or written
│   │   │   ├── validation.js    # mirrors the backend rules for instant feedback
│   │   │   ├── profileValidation.js      # same, for the profile form
│   │   │   ├── opportunityValidation.js  # same, for the opportunity form
│   │   │   └── apiErrors.js     # turns a rejected request into field messages
│   │   ├── styles/index.css     # Tailwind entry point
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── tailwind.config.js       # design tokens from DESIGN.md
│   ├── postcss.config.js
│   ├── vite.config.js
│   └── package.json
│
├── server/                      # Express + MongoDB API
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js            # Mongoose connection + status helpers
│   │   │   └── env.js           # centralised env access + validation
│   │   ├── constants/
│   │   │   ├── roles.js         # the five roles, in one place
│   │   │   ├── skills.js        # proficiency bands, categories, domains
│   │   │   ├── opportunities.js # types, work modes, statuses, the status
│   │   │   │                    # transition graph, limits, availability rules
│   │   │   ├── assessments.js   # attempt limits, difficulty mix, scoring bands
│   │   │   ├── applications.js  # statuses, the legal transition map, labels
│   │   │   └── portfolio.js     # section weights, upload limits, allowed MIME
│   │   │                        # types, document types, verification statuses
│   │   ├── controllers/         # request/response only
│   │   │   ├── auth.controller.js
│   │   │   ├── health.controller.js
│   │   │   ├── catalogue.controller.js  # skills + career roles, read-only
│   │   │   ├── studentProfile.controller.js
│   │   │   ├── opportunity.controller.js
│   │   │   ├── assessment.controller.js
│   │   │   ├── application.controller.js
│   │   │   ├── analytics.controller.js  # reads req.user and nothing else
│   │   │   └── portfolio.controller.js  # records, uploads, downloads
│   │   ├── data/
│   │   │   ├── skills.seed.js       # the seed catalogue, as plain data
│   │   │   ├── careerRoles.seed.js
│   │   │   ├── questionBank.seed.js # the offline fallback question bank
│   │   │   └── demo.seed.js         # the demo cohort, postings and pipeline
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js    # verifies the JWT, loads the user
│   │   │   ├── roleMiddleware.js    # allowRoles(...)
│   │   │   └── errorMiddleware.js
│   │   ├── models/
│   │   │   ├── User.js          # account + credentials (Step 2)
│   │   │   ├── Skill.js         # the shared skill catalogue
│   │   │   ├── CareerRole.js    # target roles + their required skills
│   │   │   ├── StudentProfile.js    # one per student, refs User
│   │   │   ├── Opportunity.js       # one per posting, refs User + Skill
│   │   │   ├── Assessment.js        # one attempt, with its questions
│   │   │   └── Application.js       # one per student per posting, unique
│   │   ├── routes/
│   │   │   ├── index.js         # mounts everything under /api/v1
│   │   │   ├── auth.routes.js
│   │   │   ├── health.routes.js
│   │   │   ├── catalogue.routes.js  # /skills and /career-roles
│   │   │   ├── student.routes.js    # /students/profile and below
│   │   │   ├── opportunity.routes.js # /opportunities and /industry
│   │   │   ├── assessment.routes.js  # /assessments
│   │   │   ├── application.routes.js # /applications
│   │   │   └── analytics.routes.js   # /analytics/institution
│   │   ├── services/            # business logic
│   │   │   ├── auth.service.js
│   │   │   ├── catalogue.service.js
│   │   │   ├── studentProfile.service.js
│   │   │   ├── opportunity.service.js   # every owner query filters on the owner
│   │   │   ├── assessment.service.js    # generates, scores, writes back skills
│   │   │   ├── readiness.service.js     # career readiness + skill gaps
│   │   │   ├── recommendation.service.js # what to study, from the gaps
│   │   │   ├── matching.service.js      # the match score, pure and testable
│   │   │   ├── application.service.js   # apply, and the legal status moves
│   │   │   ├── analytics.service.js     # the institution overview; read-only
│   │   │   ├── portfolio.service.js     # every query filters on the caller
│   │   │   ├── document.service.js      # reads the raw stream, no upload library
│   │   │   └── ai/
│   │   │       ├── aiProvider.js        # one HTTP call, provider-agnostic
│   │   │       └── assessmentAi.js      # question TEXT only — never a score
│   │   ├── utils/
│   │   │   ├── AppError.js
│   │   │   ├── apiResponse.js
│   │   │   ├── asyncHandler.js
│   │   │   └── jwt.js           # sign, verify, extract from header
│   │   ├── validators/
│   │   │   ├── auth.validator.js
│   │   │   ├── studentProfile.validator.js
│   │   │   ├── opportunity.validator.js
│   │   │   ├── assessment.validator.js
│   │   │   ├── application.validator.js
│   │   │   └── portfolio.validator.js  # the four sections + upload headers
│   │   ├── app.js               # builds the Express app
│   │   └── server.js            # starts it
│   ├── scripts/
│   │   ├── checkDbConnection.js
│   │   ├── seed.js              # seeds the skill + career-role catalogue
│   │   └── seedDemo.js          # seeds the demo cohort, postings, pipeline
│   ├── uploads/                 # created on first upload; gitignored, never
│   │   │                        # served statically — see "Student portfolio"
│   └── package.json
│
├── .gitignore
└── README.md
```

**Architectural rule:** controllers handle requests and responses only. Business
logic belongs in `services/`. Do not put complex logic in controllers.

Two Step 1 placeholder folders are still empty and omitted above:
`client/src/components/forms/` and `client/src/layouts/`. Layouts ended up in
`components/layout/` instead; the empty folders are kept only so the tree matches
the structure TRD.md section 43 describes.

---

## Setup

Clone, then install each half separately. Run these from the repository root.

### 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Create environment files

Both folders ship a `.env.example`. Copy each to `.env`:

**Windows (PowerShell)**

```powershell
Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
```

**macOS / Linux**

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

The defaults work as-is for local MongoDB. If you use **Atlas**, edit
`server/.env` and replace `MONGODB_URI` with your connection string, keeping
`/skillbridge_ai` as the database name.

Then set your own `JWT_SECRET` in `server/.env` — the placeholder in
`.env.example` is not a usable secret. Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

If it is missing, the server prints `[env] Missing required variable(s):
JWT_SECRET` at startup and every login or registration returns a 500 explaining
why. There is deliberately no fallback default, because a hardcoded one would
let the app boot and issue tokens that anyone who has read the source can forge.

> `.env` files are gitignored and must never be committed. Only `VITE_`-prefixed
> variables are exposed to the browser, so never put a secret in `client/.env`.

### 3. Verify the database connection

```bash
cd server
npm run db:check
```

Prints `PASS` with the server version and collection count, or `FAIL` with the
likely causes.

### 4. Seed the skill and career-role catalogue

```bash
cd server
npm run seed
```

Students pick their career goals and skills from a shared catalogue, so the
database needs that catalogue before the profile pages have anything to offer.
Without it, the career-goal and skill pickers load successfully but come up
empty.

The script is **idempotent** — it matches on each record's `slug` and upserts, so
running it twice changes nothing and running it after a pull adds only what is
new. It never deletes student data. Re-run it whenever `src/data/skills.seed.js`
or `src/data/careerRoles.seed.js` changes.

---

## Running the app

Two terminals.

**Terminal 1 — API**

```bash
cd server
npm run dev          # nodemon, restarts on save
```

Serves <http://localhost:5000>.

**Terminal 2 — client**

```bash
cd client
npm run dev
```

Serves <http://localhost:5173>.

Open <http://localhost:5173>. You land on the login page — register an account to
reach a dashboard. The Step 1 status card now lives at
<http://localhost:5173/status> and is linked from the login page; it should still
show client, API and database all connected.

### Other scripts

| Folder | Command | Purpose |
| --- | --- | --- |
| `server` | `npm run dev` | Start with auto-reload |
| `server` | `npm start` | Start once, no watcher |
| `server` | `npm run db:check` | Test MongoDB connectivity in isolation |
| `server` | `npm run seed` | Load the skill and career-role catalogue |
| `server` | `npm run seed:demo` | Load the demo cohort, postings and applications |
| `client` | `npm run dev` | Vite dev server |
| `client` | `npm run build` | Production build into `dist/` |
| `client` | `npm run preview` | Serve the production build locally |

---

## Verifying the foundation

```bash
curl http://localhost:5000/api/v1/health
```

Expected:

```json
{
  "success": true,
  "message": "SkillBridge AI API is running",
  "data": {
    "status": "ok",
    "environment": "development",
    "apiVersion": "v1",
    "database": "connected",
    "databaseConnected": true,
    "uptimeSeconds": 3,
    "timestamp": "2026-08-24T09:15:00.000Z"
  }
}
```

On Windows PowerShell, `curl` is aliased to `Invoke-WebRequest`. Use:

```powershell
curl.exe http://localhost:5000/api/v1/health
# or
Invoke-RestMethod http://localhost:5000/api/v1/health | ConvertTo-Json -Depth 5
```

Also worth checking: an unknown route returns a clean 404 envelope.

```bash
curl http://localhost:5000/api/v1/nope
# {"success":false,"message":"Route not found: GET /api/v1/nope", ...}
```

### Checking auth from the command line

Register, then use the returned token. On PowerShell use `curl.exe`, not `curl`.

```bash
# 1. register — expect 201 and a token
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@college.edu","password":"testpass1","role":"STUDENT"}'

# 2. the same email again — expect 409
# 3. log in — expect 200 and a token
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@college.edu","password":"testpass1"}'

# 4. the current user — expect 200
curl http://localhost:5000/api/v1/auth/me -H "Authorization: Bearer <paste-token>"

# 5. no token — expect 401
curl http://localhost:5000/api/v1/auth/me

# 6. try to register an admin — expect 400
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Sneaky","email":"sneaky@college.edu","password":"testpass1","role":"ADMIN"}'
```

Two things to look for in every response: no `password` field anywhere, and a
wrong password producing exactly the same message as an unknown email.

### Checking the profile endpoints from the command line

Sign in as a `STUDENT` first and keep the token. `$T` below stands for it.

```bash
# 1. before creating anything — expect 404, which is normal
curl http://localhost:5000/api/v1/students/profile -H "Authorization: Bearer $T"

# 2. create it — expect 201
curl -X POST http://localhost:5000/api/v1/students/profile \
  -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -d '{"headline":"CS undergrad","institutionName":"My College","yearOfStudy":3}'

# 3. the same call again — expect 409
# 4. update a scalar field — expect 200
curl -X PATCH http://localhost:5000/api/v1/students/profile \
  -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -d '{"headline":"Final-year CS undergrad"}'

# 5. send skills to the wrong endpoint — expect 400 naming the right one
curl -X PATCH http://localhost:5000/api/v1/students/profile \
  -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -d '{"skills":[]}'

# 6. the catalogue — expect 200 and a non-empty array (seed first)
curl http://localhost:5000/api/v1/skills -H "Authorization: Bearer $T"
curl http://localhost:5000/api/v1/career-roles -H "Authorization: Bearer $T"

# 7. add a skill using a real _id from step 6 — expect 201
curl -X POST http://localhost:5000/api/v1/students/profile/skills \
  -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -d '{"skillId":"<paste-id>","level":67}'

# 8. the same skill again — expect 409
# 9. a career goal that does not exist — expect 400, not a dangling reference
curl -X PUT http://localhost:5000/api/v1/students/profile/career-goals \
  -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -d '{"roleIds":["000000000000000000000000"]}'

# 9b. real goals, ranked — expect 200. Bare ids also work: {"roleIds":["<id>"]}
curl -X PUT http://localhost:5000/api/v1/students/profile/career-goals \
  -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -d '{"roleIds":[{"roleId":"<paste-id>","priority":1}]}'

# 10. no token — expect 401
curl http://localhost:5000/api/v1/students/profile

# 11. as a non-STUDENT account — expect 403
curl http://localhost:5000/api/v1/students/profile -H "Authorization: Bearer $INDUSTRY_T"
```

Steps 10 and 11 matter most: they are the difference between "not signed in" and
"signed in but not allowed", and they are enforced by the API rather than the UI.

### Checking the opportunity endpoints from the command line

You need two tokens: `$IND` from an `INDUSTRY` account and `$STU` from a
`STUDENT` one. Replace `<id>` with the id the create call returns, and use any
future date for the deadline.

```bash
# 1. post one — expect 201. No owner field is sent; it comes from the token.
curl -X POST http://localhost:5000/api/v1/opportunities \
  -H "Authorization: Bearer $IND" -H "Content-Type: application/json" \
  -d '{"title":"Backend Intern","type":"internship",
       "description":"Work with our platform team on the Node services behind checkout.",
       "location":"Bengaluru","workMode":"hybrid","deadline":"2027-06-30",
       "durationMonths":6,"openings":2}'

# 2. try to set the owner yourself — expect 400 naming industryId
curl -X POST http://localhost:5000/api/v1/opportunities \
  -H "Authorization: Bearer $IND" -H "Content-Type: application/json" \
  -d '{"title":"X","industryId":"64b000000000000000000000"}'

# 3. a deadline in the past — expect 400, decided by the server, not the browser
curl -X POST http://localhost:5000/api/v1/opportunities \
  -H "Authorization: Bearer $IND" -H "Content-Type: application/json" \
  -d '{"title":"Late","type":"job","description":"A description long enough to pass.",
       "location":"Pune","workMode":"remote","deadline":"2020-01-01"}'

# 4. a student trying to post — expect 403
curl -X POST http://localhost:5000/api/v1/opportunities \
  -H "Authorization: Bearer $STU" -H "Content-Type: application/json" -d '{}'

# 5. your own postings, with the summary counts — expect 200
curl http://localhost:5000/api/v1/industry/opportunities -H "Authorization: Bearer $IND"

# 6. a student browsing — expect 200 and only open postings
curl http://localhost:5000/api/v1/opportunities -H "Authorization: Bearer $STU"

# 7. filter and search — expect 200
curl "http://localhost:5000/api/v1/opportunities?type=internship&workMode=hybrid&location=beng&search=backend" \
  -H "Authorization: Bearer $STU"

# 8. an invalid filter value — expect 400, not an empty list
curl "http://localhost:5000/api/v1/opportunities?type=freelance" -H "Authorization: Bearer $STU"

# 9. the detail page — expect 200
curl http://localhost:5000/api/v1/opportunities/<id> -H "Authorization: Bearer $STU"

# 10. close it — expect 200 and "Opportunity closed."
curl -X PATCH http://localhost:5000/api/v1/opportunities/<id> \
  -H "Authorization: Bearer $IND" -H "Content-Type: application/json" \
  -d '{"status":"closed"}'

# 11. browse again — the closed posting is gone from the list…
curl http://localhost:5000/api/v1/opportunities -H "Authorization: Bearer $STU"

# 12. …but a direct link still explains itself, with availability "closed"
curl http://localhost:5000/api/v1/opportunities/<id> -H "Authorization: Bearer $STU"

# 13. reopen it — expect 200 and "Opportunity published."
curl -X PATCH http://localhost:5000/api/v1/opportunities/<id> \
  -H "Authorization: Bearer $IND" -H "Content-Type: application/json" \
  -d '{"status":"active"}'

# 14. as a SECOND industry account, try to edit the first one's posting.
#     Expect 403 — it is published, so its existence is not a secret. A foreign
#     *draft*, or an id that does not exist, is a 404 instead.
curl -X PATCH http://localhost:5000/api/v1/opportunities/<id> \
  -H "Authorization: Bearer $IND2" -H "Content-Type: application/json" \
  -d '{"title":"Hijacked"}'
```

Steps 2, 3, 4 and 14 are the ones worth running twice. They are the four claims
this step makes that a UI cannot make for itself: the owner cannot be forged, the
deadline rule lives on the server, the role gate holds, and one company cannot
touch another's row.

### Checking the portfolio and document endpoints from the command line

`$TOK` is a student's token; `$TOK2` is a second student's.

```bash
# 1. the whole portfolio — expect 200, with four arrays and a resume slot
curl http://localhost:5000/api/v1/students/portfolio -H "Authorization: Bearer $TOK"

# 2. the completion score — expect 200 and a percentage that is never above 100
curl http://localhost:5000/api/v1/students/portfolio/completion \
  -H "Authorization: Bearer $TOK"

# 3. add a project — expect 201, and verificationStatus "pending", not "verified"
curl -X POST http://localhost:5000/api/v1/students/portfolio/projects \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"title":"Test project","description":"Long enough to pass validation."}'

# 4. try to claim it is verified — expect the field to be ignored or refused,
#    never accepted. Nothing in this build can promote a record.
curl -X PATCH http://localhost:5000/api/v1/students/portfolio/projects/<id> \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"verificationStatus":"verified"}'

# 5. an end date before its start — expect 400 from the server, not the browser
curl -X POST http://localhost:5000/api/v1/students/portfolio/projects \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"title":"Backwards","description":"Ends before it starts.",
       "startDate":"2025-06-01","endDate":"2025-01-01"}'

# 6. upload a resume — raw bytes, binary content type, no multipart
curl -X POST http://localhost:5000/api/v1/students/portfolio/resume \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/pdf" \
  --data-binary @resume.pdf

# 7. an .exe renamed and declared as a PDF — expect 400. The magic number is
#    checked, so the declared content type is not trusted.
printf 'MZ\x90\x00this is not a pdf' > /tmp/fake.pdf
curl -X POST http://localhost:5000/api/v1/students/portfolio/resume \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/pdf" \
  --data-binary @/tmp/fake.pdf

# 8. something over 5 MB — expect 413, and the stream cut off rather than buffered
head -c 6000000 /dev/urandom > /tmp/big.pdf
curl -X POST http://localhost:5000/api/v1/students/portfolio/resume \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/pdf" \
  --data-binary @/tmp/big.pdf

# 9. download your own document — expect 200 and the bytes back. Take the
#    fileName from step 1; it is generated, never the name you uploaded.
curl http://localhost:5000/api/v1/students/portfolio/documents/<fileName> \
  -H "Authorization: Bearer $TOK" -o /tmp/back.pdf

# 10. THE IMPORTANT ONE: the same file as a different student — expect 404.
#     The name is correct and the token is valid; the file is simply not theirs.
curl -i http://localhost:5000/api/v1/students/portfolio/documents/<fileName> \
  -H "Authorization: Bearer $TOK2"

# 11. path traversal — expect 400, and no bytes of .env either way
curl -i "http://localhost:5000/api/v1/students/portfolio/documents/..%2f..%2f.env" \
  -H "Authorization: Bearer $TOK"

# 12. no static route to the uploads directory — expect 404, not a file
curl -i http://localhost:5000/uploads/<fileName>

# 13. an unknown section — expect 404 from the router itself
curl -X POST http://localhost:5000/api/v1/students/portfolio/secrets/<id>/document \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/pdf" \
  --data-binary @resume.pdf

# 14. as an INDUSTRY account — expect 403 on every route above
curl -i http://localhost:5000/api/v1/students/portfolio -H "Authorization: Bearer $IND"

# 15. no token — expect 401
curl -i http://localhost:5000/api/v1/students/portfolio
```

Steps 7, 8, 10, 11 and 12 are the ones worth running twice. They are the five
claims a UI cannot make for itself: the declared file type is not trusted, the size
cap holds while the body is still arriving, one student cannot read another's
document even knowing its exact name, a traversal attempt cannot escape the uploads
root, and there is no static route serving those files at all.

---

## API conventions

All routes are mounted under **`/api/v1`**.

**Success**

```json
{ "success": true, "message": "...", "data": {} }
```

**Paginated success** — adds a sibling block:

```json
{
  "success": true,
  "message": "...",
  "data": [],
  "pagination": {
    "page": 1, "limit": 10, "total": 42, "totalPages": 5,
    "hasNextPage": true, "hasPrevPage": false
  }
}
```

**Failure**

```json
{ "success": false, "message": "...", "errors": [{ "field": "email", "message": "..." }] }
```

Build responses with `sendSuccess` / `sendCreated` from `utils/apiResponse.js`.
Signal failures by throwing `AppError` (`AppError.badRequest()`,
`.unauthorized()`, `.forbidden()`, `.notFound()`, `.conflict()`) and wrap async
handlers in `asyncHandler` so rejections reach the error middleware.

One route needs no token at all:

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/health` | public | Liveness, environment and database status |

In development only, failure bodies carry an extra `stack` field. It is gated on
`NODE_ENV`, so production responses stay at exactly `success`, `message` and
`errors`.

---

## Authentication and roles

### Endpoints

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register` | public | Create an account, return the user and a token |
| `POST` | `/api/v1/auth/login` | public | Exchange credentials for a token |
| `GET` | `/api/v1/auth/me` | Bearer token | The current user, re-read from the database |
| `POST` | `/api/v1/auth/logout` | Bearer token | Acknowledge sign-out (see the note below) |

Register and login return `{ user, token }`. Send the token on subsequent
requests as `Authorization: Bearer <token>`. The browser client does this
automatically in `api/axiosInstance.js`.

### The five roles

`STUDENT`, `INDUSTRY`, `ACADEMICIAN`, `INSTITUTION`, `ADMIN`.

The backend keeps them in `server/src/constants/roles.js`, imported by the schema
enum, the validator and the role middleware, so those three cannot drift apart.

The client and server are separate npm projects and cannot import from each
other, so `client/src/constants/roles.js` holds a **parallel copy** plus its
display labels and dashboard paths. That is a deliberate duplication, and the
place to look first if the two ever disagree. The server is authoritative: the
`role` enum rejects anything it does not recognise, whatever the UI sends.

Registration accepts the first four only. **`ADMIN` cannot be self-registered**;
the first admin has to be promoted directly in the database:

```js
db.users.updateOne({ email: "you@example.com" }, { $set: { role: "ADMIN" } })
```

### Protecting a route

```js
import { authenticate } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../constants/roles.js';

router.get('/reports', authenticate, allowRoles(ROLES.INSTITUTION, ROLES.ADMIN), handler);
```

`authenticate` must come first: it produces `401` for "not signed in", and
`allowRoles` produces `403` for "signed in but not permitted". `allowRoles`
throws at startup if given an unknown role name, so a typo fails on boot rather
than silently allowing nobody through.

### What the implementation actually guarantees

- Passwords are hashed with bcrypt (cost factor 12) by a pre-save hook, and the
  field is `select: false` so ordinary queries never load the hash.
- No response, on any route, includes the password field. There is a test that
  walks every response body recursively to confirm it.
- `JWT_SECRET` comes from the environment with no fallback.
- Authorization reads the role from the **database**, not from the token. A
  deactivated or downgraded account loses access on its very next request
  instead of at token expiry.
- Wrong password and unknown email return an identical `401` and message, so the
  endpoint cannot be used to discover which addresses have accounts.
- Duplicate emails are blocked twice: a friendly check in the service, and a
  unique index as the real guarantee. Comparison is case-insensitive.

And what it does not:

- **Logout is client-side.** JWTs are stateless, so a token stays valid until it
  expires; `POST /auth/logout` exists for a clean API surface and the real effect
  is the client discarding the token. Revoking tokens server-side needs a
  denylist or refresh-token rotation, which is deliberately out of scope here.
- **The token is stored in `localStorage`**, which is readable by any script that
  achieves XSS on the page. This is the standard MVP trade-off, chosen for
  simplicity; `httpOnly` cookies plus CSRF protection would be the hardening step.
- There is no rate limiting on login yet, so nothing slows down password guessing.
- Frontend route guards are **UX only**. They stop honest navigation, not a
  crafted request. Every real restriction is enforced in the API.

---

## Student profiles, career goals and skills

Step 3 adds the structured data that every later feature reads from. It stores
what a student *can do* and what they are *aiming at*, in a shape that assessment
scoring, gap analysis and matching can consume without reinterpreting free text.

### How the data fits together

Four collections, joined by references rather than copied data.

```text
User ──1:1── StudentProfile ──┬── skills[]      ──> Skill
 (account,        (everything  │   (level 0–100)
  credentials,     else)       │
  role)                        └── targetRoles[] ──> CareerRole
                                   (priority)          │
Skill <────────────────────────────────────────────────┘
   (catalogue)              requiredSkills[] (requiredLevel, importanceWeight)
```

**`User` keeps identity, `StudentProfile` keeps everything else.** The profile
holds `userId` with a unique index and does not repeat `name`, `email`,
`password`, `role` or `isActive`. One student cannot end up with two profiles: the
service checks first for a friendly `409`, and the unique index is the actual
guarantee if two requests race.

**`Skill` is a shared catalogue, not free text.** A student's skill entry stores
`skillId` — a reference — plus their own `level`. So "React" is one document that
a profile and a career role both point at. Storing the name as a string in each
place is what would make gap analysis impossible later, because `"react"`,
`"React.js"` and `"ReactJS"` would never line up. Each skill carries a `slug`
(the unique index lives there, not on `name`), a `category` of `technical` or
`soft`, and free-form `tags` for its domain.

**`CareerRole` describes a target, and its `requiredSkills[]` are the bridge.**
Each requirement is `{ skillId, requiredLevel, importanceWeight }`. That is
deliberately the exact shape gap analysis needs — `requiredLevel − studentLevel`
per skill, weighted by importance — but **no matching or scoring engine is built
yet**. This step only makes the data available.

**Career roles come from the API, never from a hardcoded list.** The frontend
fetches them from `GET /career-roles`, so adding a role means editing
`src/data/careerRoles.seed.js` and re-running the seed. There is no second copy
of the list in a component.

### Proficiency

One numeric scale, `0–100`, stored on each skill entry. Labels are **derived**
from the number, never stored alongside it, so the two cannot drift:

| Score | Label |
| --- | --- |
| 0–39 | Beginner |
| 40–59 | Basic |
| 60–74 | Intermediate |
| 75–89 | Advanced |
| 90–100 | Expert |

The UI offers the five labels rather than a raw number, and sends that band's
representative score (20, 50, 67, 82, 95). A number is stored because assessment
results later need finer resolution than five buckets, and because
`requiredLevel − currentLevel` has to mean something.

Every skill entry also carries `source` (`manual` for now) and
`verified: false`. **Nothing sets `verified` to `true` in this step** — these
levels are self-reported. Verification arrives with assessments.

### Endpoints

The catalogue is readable by **any signed-in user**, because industry and
academician features will need the same lists later:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/skills` | The skill catalogue; filterable by `category`, `tag`, `search` |
| `GET` | `/api/v1/skills/:id` | One skill |
| `GET` | `/api/v1/career-roles` | Career roles a student can target; filterable by `category` |
| `GET` | `/api/v1/career-roles/:id` | One role, with its required skills expanded |

Everything below is **`STUDENT` only and always scoped to the caller's own
profile**:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/students/profile` | Your profile, or `404` if not created yet |
| `POST` | `/api/v1/students/profile` | Create it once; `409` if it already exists |
| `PATCH` | `/api/v1/students/profile` | Update your own details |
| `PUT` | `/api/v1/students/profile/career-goals` | Replace your whole goal selection |
| `GET` | `/api/v1/students/profile/skills` | Your skills, with derived labels |
| `POST` | `/api/v1/students/profile/skills` | Add a skill; `409` if already added |
| `PATCH` | `/api/v1/students/profile/skills/:skillId` | Change one skill's level |
| `DELETE` | `/api/v1/students/profile/skills/:skillId` | Remove a skill |

Two deliberate design choices worth knowing:

- **No route takes a user id.** Ownership comes from the token via
  `req.user._id`, so there is no `/students/:id/profile` to tamper with. A
  student editing another student's data is not blocked by a check — it is
  unrepresentable in the API surface.
- **`PATCH /profile` accepts scalar fields only.** Sending `skills` or
  `targetRoles` in that body returns `400` pointing at the dedicated endpoint,
  rather than silently ignoring it. Skills and goals need per-item validation
  that a general field merge cannot do.

`PUT` on career goals rather than `PATCH` because the body is the complete new
selection — it replaces, it does not merge. It takes `{ roleIds: [...] }`, where
each entry is either a bare id or `{ roleId, priority }`, so a plain checkbox list
and a ranked one both work. Every referenced `skillId` and `roleId` is checked
against the database, so a nonexistent or inactive id is rejected with `400`
instead of being stored as a dangling reference.

### The student flow in the browser

`/student/profile`, guarded to `STUDENT`. One hook, `useStudentProfile`, loads
the profile and owns every write, so there is a single place where loading,
saving, success and error state live.

On a first visit the profile does not exist yet, so the page shows only the
details form. Career goals and skills appear after it is created, because both
write to a profile that has to exist first — showing them disabled would only
invite clicks that cannot work.

Once the profile exists the page shows a completion percentage, the editable
details form, career-goal selection (search the fetched roles, pick and
prioritise), and skills management (add from the catalogue, set a level, change
it, remove). Every action reports success or failure inline, buttons disable
while saving, and validation messages appear per field.

The student dashboard links to all three sections — `/student/profile`,
`#career-goals` and `#skills` — and shows the same completion number, read from
the same endpoint. **The other four dashboards are untouched placeholders.**

Validation runs in both halves: `client/src/utils/profileValidation.js` for
instant feedback, and `server/src/validators/studentProfile.validator.js` as the
rule that actually decides. The client copy exists to save a round trip, not to
enforce anything.

---

## Opportunities

An **opportunity** is one posting made by one industry account: an internship, a
job, an apprenticeship or a project. Industry accounts own them; students read
them. Nothing else in the portal writes to them yet.

### How the data fits together

```text
User (role: INDUSTRY) ──1:N──> Opportunity ──N:1──> Skill   (requiredSkills[])
                                           ──N:1──> Skill   (preferredSkills[])
```

Three deliberate decisions, and the reasons they were made:

- **The owner is a ref, not a copy.** `Opportunity.industryId` is a
  `ref: 'User'`. The company name is never written into the posting, so an account
  that renames itself does not leave stale names on last month's postings. The
  browse and detail responses `populate()` it down to `{ id, name }` and nothing
  more — the industry's email is deliberately withheld, because a browse list is
  the easiest place in the app to scrape.
- **Skills are refs into the *same* Step 3 catalogue.** Both skill lists hold
  `{ skillId, requiredLevel, importanceWeight }`, where `skillId` is a
  `ref: 'Skill'` — the identical collection a student's profile points at. There
  is no second list of skill names anywhere. That is the whole reason matching
  will be possible later: "React" on a posting and "React" on a profile are the
  same document, not two strings that happen to match.
- **Nothing about a student is stored on a posting.** No applicant list, no
  counts, no `StudentProfile` data. When applications arrive they become their own
  collection referencing both sides, so `Opportunity → Application → Matching`
  can be added without rewriting this schema.

The stored fields are `industryId`, `title`, `type`, `description`, `location`,
`workMode`, `requiredSkills[]`, `preferredSkills[]`, `eligibility`,
`durationMonths`, `deadline`, `openings`, `status`, and Mongoose's `createdAt` /
`updatedAt`. `eligibility` is an embedded block of `branches[]`,
`minGraduationYear`, `maxGraduationYear` and `notes` — embedded rather than
referenced because it is only ever read as part of its posting.

### Status, availability, and why they are two different things

`status` is stored and is set by the employer. **`availability` is derived and is
never stored:**

| status | deadline | availability |
| --- | --- | --- |
| `draft` | any | `draft` |
| `active` | in the future | `open` |
| `active` | in the past | `expired` |
| `closed` | any | `closed` |

Only `open` postings appear in student browsing, and that filter is applied in
the database query — `status: 'active'` **and** `deadline: { $gte: now }` — not in
the browser. The client has the same rule in
`client/src/constants/opportunities.js` so it can label a row without another
request, but it is a copy for display, never the decision. Expired postings are
kept, never deleted: the employer needs to see what they posted, and a shared link
deserves "this closed on 12 August" over a 404.

Legal status changes are `draft → active`, `active → closed` and
`closed → active`. Anything else is a `400`. There is no `/close` or `/reopen`
route — closing is `PATCH { "status": "closed" }`, which is why the response
message reads "Opportunity closed." rather than a vague "updated".

### Endpoints

Every route below needs a signed-in caller. The two reads have no role gate, so an
industry user opening their own posting uses the same detail endpoint a student
does:

| Method | Route | Who | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/opportunities` | any signed-in user | Browse open postings; paginated |
| `GET` | `/api/v1/opportunities/:id` | any signed-in user | One posting, with `availability` |
| `POST` | `/api/v1/opportunities` | `INDUSTRY` | Create one, owned by the caller |
| `PATCH` | `/api/v1/opportunities/:id` | `INDUSTRY`, owner only | Edit, close or reopen |
| `DELETE` | `/api/v1/opportunities/:id` | `INDUSTRY`, owner only | Delete one |
| `GET` | `/api/v1/industry/opportunities` | `INDUSTRY` | The caller's own postings + counts |

`GET /opportunities` accepts `type`, `workMode`, `location`, `skills`, `search`,
`page` and `limit`. `location` is a case-insensitive substring, so "bengaluru"
finds "Bengaluru, India". `search` is the same kind of substring across title,
description **and** location — a regex rather than a `$text` index, because
`$text` matches whole words and a student typing "front" would get nothing for
"Frontend Developer". `skills` is a comma-separated list of catalogue ids
(`?skills=<id>,<id>`) and matches a posting wanting **any** of them, in either
list: someone filtering by "React, Node" is asking what they can do with those,
not what needs all of them at once. Results are ordered by deadline — closing
soonest first, since every entry expires — with `createdAt` breaking ties so
paging is stable. **It does not accept `status`**: what a student may see is not
theirs to choose. `GET /industry/opportunities` accepts `status`, `type`, `search`
(title only) and `page`/`limit`, and its rows are newest first.

An unrecognised enum value is a `400`, not an empty list. `?type=freelance`
returning zero rows would read to a student as "there are no internships" rather
than "your request was malformed". Page size defaults to 10 and is capped at 50.

`GET /industry/opportunities` also returns a `summary` of `total`, `active`,
`expired`, `closed` and `drafts`. Those are counted by the database across the
whole collection, not over the returned page, so the dashboard figures do not
change when the page size does.

### Ownership

**The API never accepts an owner from the client.** `industryId`, `owner`,
`ownerId` and `availability` are all explicitly rejected with a `400` naming the
field, and the stored owner is always `req.user.id`. Every owner-scoped query
filters on the owner *in the query itself* —
`Opportunity.findOne({ _id: id, industryId: ownerId })` — so the safe path never
depends on an `if` comparison further down. "Industry B edits industry A's row" is
not a case that gets rejected; it is a case that cannot be expressed.

The middleware chain on every write is
`authenticate → allowRoles(INDUSTRY) → validate → controller`, in that order, and
the order is the design:

- `authenticate` first, so an anonymous request gets `401` rather than `403` —
  "who are you?" must be answered before "may you?"
- `allowRoles` second, so a student is refused before any body is interpreted. The
  role is read from the database, never from the token claim, so an account
  demoted after its token was issued cannot keep writing.
- `validate` third, so the controller only ever sees a well-formed body.
- the controller last, containing no role or ownership logic at all.

Cross-owner access separates two cases on purpose. Someone else's **published**
posting is a `403` — students browse it, so its existence is not a secret and
"this belongs to another organisation" is both true and more useful. Someone
else's **draft**, or an id that does not exist, is a `404` — an unpublished
posting must not be discoverable by probing ids.

### The industry flow in the browser

`/industry` shows the summary counts and links onward. `/industry/opportunities`
is the management list: search by title, filter by status and type, then per row
edit, close or reopen, and delete behind a confirmation.
`/industry/opportunities/new` and `/industry/opportunities/:id/edit` are the same
page — the presence of `:id` is what makes it an edit — and it can save a draft or
publish. Skills are chosen from the seeded catalogue through the same endpoint the
profile page uses; the form cannot invent a skill name, because the field is a
picker over real catalogue rows, and the server would reject an unknown id anyway.

### The student flow in the browser

`/student/opportunities` lists what is open, with a keyword search and filters for
type, location, work mode and required skills, plus a "clear filters" action and
pagination. `/student/opportunities/:id` is the full posting: description,
required and preferred skills with their expected levels, eligibility, openings
and the deadline with a countdown.

**There is no Apply button, no application form, no match percentage, no skill-gap
readout and no "Recommended for You" anywhere in this step** — deliberately, and
the detail page says so in a sentence rather than offering a disabled control. A
disabled Apply is the first thing anyone clicks, and it would be a promise this
build cannot keep. The student's own skills are one request away and the
arithmetic is trivial, which is exactly why the omission is worth stating: a
number invented in the browser would be read as the portal's verified judgement
of their fit, and the matching engine that will produce that number properly is a
later phase with a different definition.

Validation runs in both halves here too —
`client/src/utils/opportunityValidation.js` for instant feedback and
`server/src/validators/opportunity.validator.js` as the rule that decides. The
two share their limits through matching `constants/opportunities.js` files, and a
test asserts every entry in them agrees.

---

## Skill assessments

A student picks a skill, answers a short multiple-choice attempt, and gets a
score that writes back to their profile as a **verified** skill level. Everything
about *what* the score is stays on the server.

### Where the questions come from, and where they do not

An AI provider may write the question and option **text**. It never sees a score,
never marks an answer, and never decides a level. Correctness is stored on the
question when the attempt is generated, and scoring is arithmetic in
`assessment.service.js` — so an AI outage cannot change anybody's marks.

`AI_API_KEY` is optional. With no key configured the service falls back to
`data/questionBank.seed.js`, and the whole flow works offline. That is the mode
the demo runs in.

### Endpoints

Every route here is **STUDENT-only** (`router.use(authenticate, allowRoles(STUDENT))`).

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/assessments` | This student's attempt history, paginated |
| `POST` | `/api/v1/assessments` | Generate a new attempt for one skill |
| `GET` | `/api/v1/assessments/active` | The attempt in progress, if there is one |
| `GET` | `/api/v1/assessments/latest` | The most recently completed attempt |
| `GET` | `/api/v1/assessments/:assessmentId` | One attempt, without the answer key |
| `POST` | `/api/v1/assessments/:assessmentId/submit` | Submit answers, get the score |
| `DELETE` | `/api/v1/assessments/:assessmentId` | Abandon an attempt in progress |

A submitted attempt is immutable: submitting twice is a `409`, and the answer key
is never included in any response until after submission.

### The student flow in the browser

`/student/assessment` → pick a skill → `/student/assessment/:assessmentId` to
answer → `/student/assessment/:assessmentId/result` for the score, the band, and
what to study next. The result writes the level onto the profile automatically, so
the skill appears as verified on `/student/profile` without another step.

---

## Career readiness, gaps and learning recommendations

Both of these are **computed on request and stored nowhere**. That is deliberate:
a stored readiness score goes stale the moment a student adds a skill, and two
places that could disagree eventually will.

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/students/readiness` | `STUDENT` | Readiness per career goal, plus the gaps behind it |
| `GET` | `/api/v1/students/recommendations` | `STUDENT` | What to study next, derived from those same gaps |

Both accept an optional `careerRoleId` to narrow the answer to one goal;
`recommendations` also accepts `limit` (1–10). Readiness is the weighted distance
between the levels a career role requires and the levels the student holds — the
weights live in `constants/skills.js`, not in the AI layer.

`/student/readiness` in the browser shows one card per career goal, each gap
listed with the level required and the level held.

---

## Opportunity matching

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/students/matches` | `STUDENT` | The ranked list of live postings for this student |
| `GET` | `/api/v1/students/matches/:opportunityId` | `STUDENT` | The breakdown behind one posting's score |

These live under `/students` rather than `/opportunities` because the answer is
about *this* student: the owner is `req.user.id`, so there is no request shape in
which one student can ask for another's matches. `limit` accepts 1–20.

`calculateMatch()` in `matching.service.js` is a pure function of an opportunity
and a student, which is what makes the number reproducible and the breakdown
honest — the UI shows the same components the score was built from, never a
re-derived approximation.

---

## Applications

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/applications` | `STUDENT` | Apply to a posting |
| `GET` | `/api/v1/applications/me` | `STUDENT` | This student's applications, paginated |
| `GET` | `/api/v1/applications/summary` | `STUDENT` | Counts by status, for the dashboard |
| `GET` | `/api/v1/applications/:id` | `STUDENT` | One application and its full status history |
| `PATCH` | `/api/v1/applications/:id/status` | `INDUSTRY` | Move an applicant along the pipeline |
| `GET` | `/api/v1/opportunities/:id/applications` | `INDUSTRY` | The applicants for one posting, ranked |
| `GET` | `/api/v1/industry/applications/summary` | `INDUSTRY` | Totals across all of this employer's postings |

Applying is refused — with a reason, not a generic `400` — when the posting is not
active, when its deadline has passed, and when this student has already applied.
The duplicate rule is enforced twice: a friendly check, and a unique compound
index on `{ studentId, opportunityId }` that a race cannot get around.

**The match score is frozen at apply time.** `matchScoreAtApplication` is computed
once, by the real matching engine, and never recomputed — so an employer ranking
applicants six weeks later sees the score that existed when each person applied,
not one that drifted as they added skills.

**Statuses move along a defined graph**, not freely:

```text
applied → under_review → shortlisted → interview → selected
   └───────────┴──────────────┴────────────┴──────→ rejected
```

`canTransition(from, to)` in `constants/applications.js` is the only authority.
There is no path to `interview` that skips `shortlisted`, and `selected` and
`rejected` are terminal. Every move appends to `statusHistory` with a timestamp
and an optional note, which is what the student's timeline renders.

---

## Institution analytics

One endpoint, one page, one request.

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/analytics/institution` | `INSTITUTION` | Cohort readiness, skill gaps against live hiring, and the placement pipeline |

The controller reads `req.user` and **nothing** from the query, body or params —
an institution cannot ask about a cohort that is not its own. Students are matched
to an institution by `institutionId` where it exists and by exact
`institutionName` otherwise, so a college sees its own students the moment they
type its name on their profile.

**The skill gap is asymmetric on purpose.** Supply is this institution's students;
demand is every live posting from every employer on the platform. That is what
makes it curriculum advice rather than a report card on one hiring round.

Students who have not been assessed are reported as `notAssessed` and left out of
every average. Their readiness is unknown, not zero, and the dashboard prints an
em dash rather than `0%` — a college acting on a fake zero would be acting on
nothing.

---

## Student portfolio and documents

One page, `/student/portfolio`, where a student assembles the evidence behind
their profile: a written summary, a resume, projects, certifications,
achievements, internship and work records, and the documents that back them up.

### How the data fits together

**There is no new collection.** All four record sections are embedded arrays on
`StudentProfile`, and the resume is a single embedded subdocument. A portfolio is
only ever read as a whole page and only ever written by the one student who owns
it, so a separate collection would buy a join and nothing else.

```text
StudentProfile
├── headline, bio                     # the summary section (bio is new)
├── institutionName, degree, branch,  # the education section — already existed,
│   graduationYear, currentYear, cgpa #   deliberately not duplicated
├── skills[]                          # already existed; the portfolio reads it
├── resume            { fileName, originalName, mimeType, size, uploadedAt }
├── projects[]        { title, description, technologies[], role, githubUrl,
│                       liveUrl, startDate, endDate, isOngoing, document,
│                       verificationStatus, timestamps }
├── certifications[]  { title, issuingOrganization, issueDate, expiryDate,
│                       credentialId, credentialUrl, document, ... }
├── achievements[]    { title, achievementType, description, date,
│                       issuingOrganization, document, ... }
└── experiences[]     { organization, role, experienceType, startDate, endDate,
                        isCurrent, description, skillsUsed[], document, ... }
```

Education reuses the Step 3 fields as they are. Skills reuse the Step 3 skill
list, so an assessment that verifies a skill updates the portfolio too; a project
also lists free-text `technologies`, which is a different claim — what you used on
one project is not what an assessment measured, and merging the two is how a
skills list starts lying.

### The completion score is arithmetic, not AI

Computed on the server by `computePortfolioCompletion()`, from eight weighted
sections that sum to exactly 100:

| Section | Weight | Counts as filled when |
| --- | --- | --- |
| Profile summary | 15 | headline **and** bio are both non-empty |
| Education details | 15 | institution, degree and graduation year are set |
| Skills | 15 | at least three skills |
| Resume | 15 | a resume file is stored |
| Projects | 15 | at least one project |
| Certifications | 10 | at least one certification |
| Experience | 10 | at least one experience record |
| Achievements | 5 | at least one achievement |

`GET /students/portfolio/completion` returns the percentage, the sections that are
done, and the ones that are not — each with the sentence a student should read to
fix it. Nothing is rounded up and nothing is inferred: a section is filled or it
is not, the total never exceeds 100, and an empty profile scores 0 rather than
being flattered to a friendlier number.

> The section key for experience records is `experience` in the completion
> response and `experiences` everywhere else — the array, the route segment, the
> client config. Both spellings are load-bearing; the client maps between them.

### Verification is honest about not existing

Every record carries `verificationStatus`, one of `pending`, `verified` or
`rejected`, and **every student-created record starts and stays `pending`.**
Nothing in this build promotes a record. There is no reviewer role, no approval
queue and no endpoint that sets `verified` — the field exists so the schema and
the UI are ready for one, and the badge reads "Awaiting verification" because that
is the true state. The demo seed sets no statuses either, for the same reason: a
green tick nobody earned is worse than an honest amber one.

### How documents are stored

Files go to `server/uploads/`, which is gitignored. The database stores metadata
only — `fileName`, `originalName`, `mimeType`, `size`, `uploadedAt` — never bytes,
and never an absolute path. No cloud provider is hardcoded; swapping the storage
layer means reimplementing `document.service.js` and nothing above it.

**There is no upload library.** No multer, no busboy. A document is sent as a raw
request body with a binary content type, and `document.service.js` reads the
stream itself using Node built-ins. `app.js` mounts only the content-type-gated
`express.json()` and `express.urlencoded()`, so neither parser touches a binary
body — which is what lets the byte cap be enforced while the stream is still
arriving rather than after it has already been buffered.

What the upload path enforces, in order:

| Guard | Rule |
| --- | --- |
| Authentication | `authenticate` → `allowRoles(STUDENT)` before anything reads the body |
| Ownership | the owner is `req.user.id`; the request body cannot name a student |
| Declared type | `Content-Type` must be one of PDF, PNG, JPEG, DOCX or plain text |
| Actual type | the first bytes must match that type's magic number (`%PDF`, `PK\x03\x04`, ...) — a renamed `.exe` sent as `application/pdf` is rejected |
| Size | 5 MB, enforced while reading; the stream is destroyed the moment it is exceeded |
| Count | 40 documents per student |
| Filename | the original is **never** used as a path. Stored names are generated: `<ownerId>-<epochMs>-<16 hex>.<ext>`, and a download must match that exact pattern |
| Path traversal | the resolved absolute path is re-checked to still sit inside the uploads root, with a trailing separator so `/uploads-evil/x` cannot pass as a child of `/uploads` |
| Missing file | metadata without a file on disk returns a clean 404, not a stack trace |

`originalName` is kept for display only, trimmed and length-capped.

**Downloads go through an authenticated controller, and there is deliberately no
`express.static('uploads')`.** Static middleware would make every stored document
readable by anyone who guessed its name. Instead `GET /students/portfolio/documents/:fileName`
verifies the caller's own profile actually references that file before streaming a
byte, so one student cannot fetch another's certificate even with the exact name.

Document types are fixed to the five the product needs — `resume`, `certificate`,
`achievement_proof`, `experience_proof`, `project_attachment` — and the type is
decided by the section the file is attached to, not by the client. A certificate
cannot be attached to a project. This is not a general file store.

### Endpoints

Every one is `authenticate` → `allowRoles(STUDENT)` → validate → controller, and
every one resolves the profile from `req.user.id`. A student never sends their own
id; the request body cannot name one.

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/students/portfolio` | Student | The whole portfolio, in one call |
| `GET` | `/api/v1/students/portfolio/completion` | Student | Percentage, completed and missing sections |
| `GET` | `/api/v1/students/portfolio/documents/:fileName` | Student | Download one of your own documents |
| `POST` | `/api/v1/students/portfolio/resume` | Student | Upload or replace the resume |
| `DELETE` | `/api/v1/students/portfolio/resume` | Student | Remove it, file included |
| `POST` | `/api/v1/students/portfolio/projects` | Student | Add a project |
| `PATCH` | `/api/v1/students/portfolio/projects/:projectId` | Student | Edit one |
| `DELETE` | `/api/v1/students/portfolio/projects/:projectId` | Student | Remove one |
| `POST` | `/api/v1/students/portfolio/certifications` | Student | Add a certification |
| `PATCH` | `/api/v1/students/portfolio/certifications/:certificationId` | Student | Edit one |
| `DELETE` | `/api/v1/students/portfolio/certifications/:certificationId` | Student | Remove one |
| `POST` | `/api/v1/students/portfolio/achievements` | Student | Add an achievement |
| `PATCH` | `/api/v1/students/portfolio/achievements/:achievementId` | Student | Edit one |
| `DELETE` | `/api/v1/students/portfolio/achievements/:achievementId` | Student | Remove one |
| `POST` | `/api/v1/students/portfolio/experiences` | Student | Add an experience record |
| `PATCH` | `/api/v1/students/portfolio/experiences/:experienceId` | Student | Edit one |
| `DELETE` | `/api/v1/students/portfolio/experiences/:experienceId` | Student | Remove one |
| `POST` | `/api/v1/students/portfolio/:section(projects\|certifications\|achievements\|experiences)/:entryId/document` | Student | Attach proof to one record |
| `DELETE` | `/api/v1/students/portfolio/:section(projects\|certifications\|achievements\|experiences)/:entryId/document` | Student | Remove that proof |

That last route is written the way the router actually declares it, alternation
included, because the alternation is the security boundary: `:section` can only
ever be one of those four, so an unknown section is a 404 from Express itself
rather than something a controller has to police. The section also *determines* the
document type, which is what keeps this from being a general-purpose file store.

`/portfolio/documents/:fileName` is declared **before** `/portfolio/:section/...`
in `student.routes.js`. Express matches in declaration order, and without the
alternation constraint `documents` would be captured as a section name, turning
every download into a 404.

The resume is singular and replaced rather than appended: uploading a second one
deletes the first from disk, because a student has one current resume.

### The student flow in the browser

`/student/portfolio` loads once and every write goes through `usePortfolio.js`,
which owns the optimistic update and the rollback. The four record sections are
generated from `constants/portfolioSections.js` — one config object per section
describing its fields, its validation, its card shape and its request payload — so
adding a field means editing data, not four components.

The page opens with the completion panel, and the panel is the point: it names the
highest-weight thing still missing and links to the form that fixes it. Records
show a verification badge, an attach-proof control, and dates as month and year.
The client validates before submitting, and the server validates again regardless.

---

## Demo data

`npm run seed` loads the catalogue. `npm run seed:demo` loads a **story**: 22
students, 3 employers, 12 postings, 31 applications and 16 portfolio records, all
reachable through the UI with one password.

```bash
cd server
npm run seed        # first — the catalogue the demo data points at
npm run seed:demo   # then — the cohort, postings and pipeline
```

Both are idempotent and neither ever deletes: users are matched on email,
profiles on user, postings on owner-plus-title, applications on the unique index.
Re-running updates in place and reports what it found. There is no `--force` and
no `dropDatabase`, because these run against whatever `MONGODB_URI` names.

Every account shares the password in `DEMO_PASSWORD` (default `Demo1234`).
Existing accounts keep whatever password they already had — a seed script has no
business silently resetting credentials.

| Role | Email | What it shows |
| --- | --- | --- |
| `INSTITUTION` | `institution@skillbridge.demo` | The cohort analytics dashboard, with real gaps |
| `INDUSTRY` | `hiring@northwind.demo` | Postings with ranked applicants at every pipeline stage |
| `INDUSTRY` | `talent@lumen.demo` | A second employer, so demand is not one company's wishlist |
| `INDUSTRY` | `careers@sentinel.demo` | A third, including a draft and a closed posting |
| `ACADEMICIAN` | `academician@skillbridge.demo` | The placeholder dashboard, with role enforcement working |
| `STUDENT` | `aarav.menon@student.demo` | Persona A — ready: high readiness, verified skills, selected |
| `STUDENT` | `rohan.iyer@student.demo` | Persona B — solid: good, not exceptional, mid-pipeline |
| `STUDENT` | `divya.ramesh@student.demo` | Persona C — developing: real gaps against real postings |
| `STUDENT` | `priya.ranganathan@student.demo` | Persona D — full profile, **no assessment**: readiness unknown |
| `STUDENT` | `rahul.bhatt@student.demo` | Persona E — empty profile: the first-run experience |

**The cohort is deliberately not excellent.** Readiness runs from 34 to 88 with
nobody in the Expert band, seven students unassessed, and two students at a
*different* college so the cohort filter has something to exclude. A demo where
everyone is employable cannot demonstrate a skill gap, so `seedDemo.js` refuses
to run if a later edit flattens the spread — that assertion is in
`validateDemoData()`, and it aborts before the database connection opens.

**The gap is emergent, not asserted.** Students hold HTML, CSS, JavaScript, Git
and Python; employers ask for Docker, AWS, Kubernetes and system design. The
Platform Engineer posting exists specifically so the gap table has a top row that
nobody in the cohort can reach.

**Applications go through the real services.** `seedDemo.js` calls
`createApplication` and `updateApplicationStatus`, so every match score in the
demo database was produced by the actual matching engine and every status history
is one the product itself could have produced. Only two fields are stated rather
than earned — `readinessScore` and `verified` — because the alternative is sitting
22 assessments by hand.

Postings are created **active**, applications are seeded, statuses are walked, and
only then do the draft and closed postings take their final state. That is the
order reality uses, and `createApplication` rightly refuses a closed or expired
posting.

### Portfolios are on a minority of the cohort, on purpose

Four students have portfolio records. One more has a written summary and nothing
else. The remaining seventeen have neither. A completion score that reads the same
for all 22 students would look decorative, so the seed spreads it:

| Student | Completion | What they have |
| --- | --- | --- |
| Aarav | 85% | 3 projects, 2 certifications, an internship, 2 achievements |
| Ishita | 75% | 2 projects, a current research post, a published paper — no certificate |
| Rohan | 65% | 2 projects and one competition win; no experience yet |
| Divya | 60% | one project, honestly described as her first |
| Priya | 45% | a written profile and no portfolio at all — every empty state |
| most of the cohort | 30% | education and skills, from Step 3, and nothing else |
| Imran | 15% | one skill where the section wants three |
| Rahul, Sanya | 0% | no degree, no graduation year, no skills |

**Nobody reaches 100, and no resume is seeded anywhere.** A resume is a stored
file, and a fresh clone has no files on disk — seeded metadata would render a
download button that 404s, which is worse than an empty slot. The empty slot also
means the completion panel always has one real, actionable recommendation instead
of a congratulatory 100% that demonstrates nothing. The 0% is not a bug to round
up either: a student who has just signed up genuinely has none of this, and a
score that flatters them is a score nobody can act on.

**No `verificationStatus` is set in the seed.** The model defaults every record to
`pending`, and pending is the truth.

**Dates are month offsets, not literals** — `startMonthsAgo: 14`, and a single
`expiryMonthsAhead` for the one certification allowed a future date. A hardcoded
2025 date reads as abandoned once the calendar moves past it. Offsets resolve to
the 15th at midday, which dodges the end-of-month overflow that would otherwise
print the wrong month on a card showing only month and year.

Links point at `github.com/skillbridge-demo/...` and IANA-reserved `example.com`,
so the link chrome renders without anyone mistaking a seeded URL for a real repo.

`validateDemoData()` enforces all of this before the database connection opens: it
rejects a portfolio keyed to an unknown email, an unregistered date offset, an end
date before its start, an ongoing record that also has an end date, and any
attempt to write a `verificationStatus` into the seed.

Because `upsertProfile` sets all four arrays on every student, **re-seeding is a
reset, not an append** — records added by hand through the UI are replaced.

---

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `MONGODB_URI is not set` | `server/.env` is missing. Copy it from `.env.example`. |
| `db:check` fails on local Mongo | The MongoDB service is not running. Start it, then retry. |
| `db:check` fails on Atlas | Add your current IP under Network Access, and URL-encode any special characters in the password. |
| Client shows "Cannot reach the API" | The server is not running, or `VITE_API_URL` does not match its port. |
| CORS error in the browser console | Vite is not on port 5173. `CLIENT_URL` in `server/.env` must match the client's real origin. |
| Vite exits with "Port 5173 is in use" | Intentional (`strictPort`). Free the port, or change both `vite.config.js` and `CLIENT_URL` together. |
| Tailwind classes have no effect | Restart `npm run dev` after editing `tailwind.config.js`. |
| Changes to `.env` seem ignored | Restart the process. Neither nodemon nor Vite reloads env files. |
| `JWT_SECRET is not configured` on login | `JWT_SECRET` is missing from `server/.env`. Add it and restart. |
| Logged out on every refresh | The API is unreachable or `JWT_SECRET` changed since the token was issued. Old tokens no longer verify — sign in again. |
| `403` on your own dashboard | The account was deactivated (`isActive: false`), or its role was changed in the database. |
| Cannot register as `ADMIN` | Intended. Register normally, then promote the account in the database. |
| Career-goal or skill picker is empty | The catalogue was never seeded. Run `npm run seed` in `server`. The opportunity form's skill picker reads the same catalogue, so it empties for the same reason. |
| `npm run seed` exits before writing | Intended pre-flight: two seed entries collide on a slug, or a role requires a skill that is not in `skills.seed.js`. The message names both. Fix the data and re-run. |
| `404` from `GET /students/profile` | Normal before the profile is created. The page shows the create form instead of an error. |
| `409` when saving the profile | A profile already exists for this account. Reload the page — it will switch to edit mode. |
| `400` mentioning "Use the skills endpoints" | `skills` or `targetRoles` was sent to `PATCH /students/profile`. Use the dedicated endpoints. |
| `403` on any `/students/*` route | The signed-in account is not a `STUDENT`. That is the API refusing, not a UI bug. |
| `403` on any `/industry/*` route | The signed-in account is not an `INDUSTRY`. Same as above — the API refusing. |
| `400` "The owner is taken from your account and cannot be set directly." | The request body contained `industryId`, `owner` or `ownerId`. The owner comes from your token; remove the field. |
| `400` "Availability is derived from the status and deadline." | `availability` was sent as a field. It is computed, not stored — set `status` and `deadline` instead. |
| `403` "posted by another organisation" | You are signed in as a different `INDUSTRY` account than the one that created it. Expected. |
| `404` editing a posting you can see the id of | It is either another organisation's **draft** or it does not exist. Drafts are deliberately indistinguishable from absent, so ids cannot be probed. |
| `400` "That status change is not allowed." | Only `draft → active`, `active → closed` and `closed → active` are legal. The message names what the current status can become. |
| `400` "The deadline has already passed." when reopening | Reopening a `closed` posting needs a live deadline, or it would be `active` and still invisible to students. Send a new `deadline` in the same `PATCH`. |
| `400` "The deadline cannot be in the past." | Deadlines are validated against the server's date, not the browser's. |
| `400` "That opportunity type does not have a duration." | `type` and `durationMonths` were changed in one request, and the new type has no duration. Send them separately, or drop `durationMonths`. |
| `400` "A skill cannot be both required and preferred." | The same skill is in both lists. Pick one — the message names which skill. |
| `400` "One or more selected skills could not be found." | A skill id is malformed or not in the catalogue. Skills must reference the seeded catalogue; free text is never accepted. |
| Your posting does not appear in student browsing | Students only see `active` postings whose deadline has not passed. Drafts, closed and expired postings are excluded by the query itself. |
| Employer search finds nothing for a word in your own description | `GET /industry/opportunities` searches the **title** only. The student endpoint is the one that searches title, description and location. |

---

## Documentation

The specification in `docs/` is the source of truth for requirements,
architecture, features and constraints:

| File | Covers |
| --- | --- |
| `docs/prd1.md` | Product requirements, user roles, feature scope |
| `docs/TRD.md` | Technical architecture, data models, API design |
| `docs/rules.md` | Engineering rules and constraints |
| `docs/phases.md` | Build phases and sequencing |
| `docs/design.md` | UI/UX system, design tokens, screen specs |

Where the PRD's technology sections disagree with the TRD, **the TRD wins** —
it defines the approved MERN stack above. `APPFLOW.md` is not yet available;
the flows in the PRD and TRD are used instead.

---

## Roadmap

~~Foundation~~ → ~~Auth & RBAC~~ → ~~Profiles, skills & career goals~~ →
~~Opportunities~~ → ~~Assessment engine~~ → ~~Career readiness & gap analysis~~ →
~~Learning recommendations~~ → ~~Matching~~ → ~~Applications~~ →
~~Candidate ranking~~ → ~~Institution analytics~~ → ~~Demo data~~ →
~~Portfolio & documents~~ → Notifications.

Each step ships one complete, working flow before the next begins.

Every flow above is live end to end. A student can register, build a profile, sit
an assessment, see their readiness and what to study, browse ranked matches with
the reasoning behind each score, apply, watch the status history as an employer
moves them along, and assemble a portfolio with the documents behind it. An
employer can post, see ranked applicants with the match score frozen at apply
time, and move them through the pipeline. An institution can see cohort readiness,
the skill gaps against live hiring, and the placement pipeline.

The `ACADEMICIAN` and `ADMIN` dashboards still render placeholders. They exist to
prove routing and role enforcement work, and they are honest about it — each one
lists what it will contain rather than showing an empty chart.

Notifications remain out of scope: they need a delivery channel decision rather
than more code.

**What the portfolio step left for later, deliberately:** nothing verifies a
record. `verificationStatus` exists on every record and every one of them says
`pending`, because there is no reviewer role, no approval queue and no endpoint
that promotes one. Building that means deciding who verifies what — an
academician, the institution, or the issuing body — which is a product question,
not an implementation gap. Documents also live on the local disk under
`server/uploads/`, which is correct for a single-process demo and would need an
object store the moment the API runs on more than one machine; the storage layer is
isolated in `document.service.js` so that swap touches one file.
