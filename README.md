# SkillBridge AI

**Academia–Industry Collaboration Portal** — connecting students, industry, academicians and institutions through verified skills, explainable matching, and real opportunities.

> **Status:** Step 4 — Opportunity management and discovery. On top of the Step 1
> foundation, Step 2 auth and the Step 3 profile, an **industry** account can now
> post an opportunity, edit it, close and reopen it, delete it, and see all of its
> own postings; a **student** can browse everything that is open, search it, filter
> by type, location, work mode and required skills, and read the full details.
>
> Applications and matching are **not** built. There is no Apply button, no match
> percentage and no recommendation ranking anywhere — those are later phases with
> their own data model, and a number invented in the browser would be read as the
> portal's verified judgement of a student's fit. The Academician, Institution and
> Admin dashboards remain placeholders.

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
│   │   │   └── opportunity.api.js    # browse, detail, and the owner's CRUD
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
│   │   │   └── opportunities/   # OpportunityCard, OpportunityForm,
│   │   │                        # SkillRequirementPicker, SearchInput,
│   │   │                        # StudentFilterBar, OwnerFilterBar
│   │   ├── constants/
│   │   │   ├── roles.js         # role labels + dashboard paths
│   │   │   ├── skills.js        # proficiency bands, category labels
│   │   │   └── opportunities.js # types, work modes, statuses, availability,
│   │   │                        # limits — mirrors the server file of the same name
│   │   ├── context/AuthContext.jsx
│   │   ├── hooks/
│   │   │   ├── useStudentProfile.js  # loads the profile, owns every write
│   │   │   ├── useSkillCatalogue.js  # the shared skill list, for pickers
│   │   │   ├── useOpportunities.js   # student browse: filters + pagination
│   │   │   ├── useOpportunity.js     # one opportunity, for the detail page
│   │   │   ├── useMyOpportunities.js # the owner's list, summary and row actions
│   │   │   └── useOpportunityEditor.js # create/edit form state and submission
│   │   ├── pages/
│   │   │   ├── Login.jsx  Register.jsx
│   │   │   ├── SystemStatus.jsx      # the Step 1 status card, now at /status
│   │   │   ├── Unauthorized.jsx  NotFound.jsx
│   │   │   ├── dashboards/           # one per role; STUDENT and INDUSTRY are live
│   │   │   │   ├── StudentDashboard.jsx      # profile + opportunity browsing
│   │   │   │   ├── IndustryDashboard.jsx     # posting counts + shortcuts
│   │   │   │   ├── AcademicianDashboard.jsx  # still a placeholder
│   │   │   │   ├── InstitutionDashboard.jsx  # still a placeholder
│   │   │   │   └── AdminDashboard.jsx        # still a placeholder
│   │   │   ├── student/
│   │   │   │   ├── StudentProfile.jsx
│   │   │   │   ├── BrowseOpportunities.jsx   # search, filters, pagination
│   │   │   │   └── OpportunityDetails.jsx    # read-only; no Apply button
│   │   │   └── industry/
│   │   │       ├── MyOpportunities.jsx       # the owner's management list
│   │   │       └── OpportunityFormPage.jsx   # one page for create and edit
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
│   │   │   └── opportunities.js # types, work modes, statuses, the status
│   │   │                        # transition graph, limits, availability rules
│   │   ├── controllers/         # request/response only
│   │   │   ├── auth.controller.js
│   │   │   ├── health.controller.js
│   │   │   ├── catalogue.controller.js  # skills + career roles, read-only
│   │   │   ├── studentProfile.controller.js
│   │   │   └── opportunity.controller.js
│   │   ├── data/
│   │   │   ├── skills.seed.js       # the seed catalogue, as plain data
│   │   │   └── careerRoles.seed.js
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js    # verifies the JWT, loads the user
│   │   │   ├── roleMiddleware.js    # allowRoles(...)
│   │   │   └── errorMiddleware.js
│   │   ├── models/
│   │   │   ├── User.js          # account + credentials (Step 2)
│   │   │   ├── Skill.js         # the shared skill catalogue
│   │   │   ├── CareerRole.js    # target roles + their required skills
│   │   │   ├── StudentProfile.js    # one per student, refs User
│   │   │   └── Opportunity.js       # one per posting, refs User + Skill
│   │   ├── routes/
│   │   │   ├── index.js         # mounts everything under /api/v1
│   │   │   ├── auth.routes.js
│   │   │   ├── health.routes.js
│   │   │   ├── catalogue.routes.js  # /skills and /career-roles
│   │   │   ├── student.routes.js    # /students/profile and below
│   │   │   └── opportunity.routes.js # /opportunities and /industry
│   │   ├── services/            # business logic
│   │   │   ├── auth.service.js
│   │   │   ├── catalogue.service.js
│   │   │   ├── studentProfile.service.js
│   │   │   └── opportunity.service.js   # every owner query filters on the owner
│   │   ├── utils/
│   │   │   ├── AppError.js
│   │   │   ├── apiResponse.js
│   │   │   ├── asyncHandler.js
│   │   │   └── jwt.js           # sign, verify, extract from header
│   │   ├── validators/
│   │   │   ├── auth.validator.js
│   │   │   ├── studentProfile.validator.js
│   │   │   └── opportunity.validator.js
│   │   ├── app.js               # builds the Express app
│   │   └── server.js            # starts it
│   ├── scripts/
│   │   ├── checkDbConnection.js
│   │   └── seed.js              # seeds the skill + career-role catalogue
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
~~Opportunities~~ → Applications → Assessment engine → Matching & gap analysis →
Learning programs → Portfolio → Institution analytics → Notifications & polish.

Each step ships one complete, working flow before the next begins.

Foundation, Auth & RBAC, student profiles and opportunities are done. The
`STUDENT` and `INDUSTRY` dashboards are live; the Academician, Institution and
Admin dashboards still render placeholders — they exist to prove routing and role
enforcement work, and get their real content in later steps.

Opportunities ships the employer's half and the student's half of Phase 3, and
stops at the boundary: a student can find a posting and read all of it, but there
is no way to apply. Applications are the next step, and the schema is shaped to
receive them — a posting already carries the deadline, the openings count and the
status an application would need to check, so adding an `Application` model that
points at an `Opportunity` and a `User` needs no change to what exists.
