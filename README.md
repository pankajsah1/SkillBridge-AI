# SkillBridge AI

**Academia–Industry Collaboration Portal** — connecting students, industry, academicians and institutions through verified skills, explainable matching, and real opportunities.

> **Status:** Step 2 — Authentication & RBAC. The client, API, error handling and
> database connection are in place, and users can register, sign in and reach a
> role-specific dashboard with authorization enforced server-side. The dashboards
> are placeholders; product features come next.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 5, JavaScript, Tailwind CSS 3 |
| Backend | Node.js, Express 4, JavaScript (ES modules) |
| Database | MongoDB with Mongoose 8 |
| Auth *(Step 2)* | JWT, bcrypt, role-based access control |

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
│   │   │   └── health.api.js
│   │   ├── components/
│   │   │   ├── ui/              # Button, Input, Alert, Spinner
│   │   │   ├── auth/RoleSelector.jsx
│   │   │   ├── dashboard/DashboardPlaceholder.jsx
│   │   │   └── layout/          # AuthLayout, DashboardLayout
│   │   ├── constants/roles.js   # role labels + dashboard paths
│   │   ├── context/AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx  Register.jsx
│   │   │   ├── SystemStatus.jsx      # the Step 1 status card, now at /status
│   │   │   ├── Unauthorized.jsx  NotFound.jsx
│   │   │   └── dashboards/           # one placeholder per role
│   │   ├── routes/
│   │   │   ├── AppRouter.jsx    # all route definitions
│   │   │   └── guards.jsx       # ProtectedRoute, RoleRoute, PublicOnlyRoute
│   │   ├── utils/
│   │   │   ├── tokenStorage.js  # the only place the token is read or written
│   │   │   └── validation.js    # mirrors the backend rules for instant feedback
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
│   │   ├── constants/roles.js   # the five roles, in one place
│   │   ├── controllers/         # request/response only
│   │   │   ├── auth.controller.js
│   │   │   └── health.controller.js
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js    # verifies the JWT, loads the user
│   │   │   ├── roleMiddleware.js    # allowRoles(...)
│   │   │   └── errorMiddleware.js
│   │   ├── models/
│   │   │   └── User.js          # the only model so far
│   │   ├── routes/
│   │   │   ├── index.js         # mounts everything under /api/v1
│   │   │   ├── auth.routes.js
│   │   │   └── health.routes.js
│   │   ├── services/            # business logic
│   │   │   └── auth.service.js
│   │   ├── utils/
│   │   │   ├── AppError.js
│   │   │   ├── apiResponse.js
│   │   │   ├── asyncHandler.js
│   │   │   └── jwt.js           # sign, verify, extract from header
│   │   ├── validators/
│   │   │   └── auth.validator.js
│   │   ├── app.js               # builds the Express app
│   │   └── server.js            # starts it
│   ├── scripts/
│   │   └── checkDbConnection.js
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

~~Foundation~~ → ~~Auth & RBAC~~ → **Skill taxonomy & seed** → Profiles &
dashboards → Opportunities → Applications → Assessment engine → Matching & gap
analysis → Learning programs → Portfolio → Institution analytics →
Notifications & polish.

Each step ships one complete, working flow before the next begins.

Foundation and Auth & RBAC are done. The five dashboards currently render
placeholders — they exist to prove routing and role enforcement work, and get
their real content in later steps.
