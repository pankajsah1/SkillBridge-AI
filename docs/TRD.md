

# SkillBridge AI — Technical Requirements Document (TRD)

**Project Name:** SkillBridge AI — Academia–Industry Collaboration & Employability Platform
**Version:** 1.0
**Status:** Revised Technical Blueprint
**Architecture:** MERN Stack
**Frontend:** React.js + Vite
**Backend:** Node.js + Express.js
**Database:** MongoDB + Mongoose

---

## 1. Purpose

This Technical Requirements Document (TRD) defines the technical architecture, technologies, database design, APIs, modules, security requirements, and implementation requirements for **SkillBridge AI**.

SkillBridge AI is an intelligent platform designed to bridge the gap between:

* Skills students currently possess
* Skills required by industries
* Skills required for specific job roles
* Available learning opportunities
* Internships and entry-level jobs
* Industry recruitment requirements
* Institution-level employability monitoring

The core journey of the platform is:

```text
Assess → Profile → Identify Skill Gaps → Learn → Match → Apply → Track
```

The system will provide a centralized ecosystem connecting:

1. Students
2. Industries / Recruiters
3. Academic Institutions
4. Administrators

This revised TRD is specifically designed around the **MERN stack**, so the project does **not require Next.js, PostgreSQL, or Prisma**.

---

# 2. Technical Goals

The system must:

1. Support multiple user roles securely.
2. Allow students to complete skill assessments.
3. Generate a structured skill profile.
4. Identify technical and soft-skill gaps.
5. Calculate career readiness scores.
6. Recommend relevant internships and jobs.
7. Allow industries to post opportunities.
8. Match students with opportunities based on skills.
9. Provide explainable match scores.
10. Allow students to apply and track applications.
11. Provide institution-level dashboards and analytics.
12. Maintain digital student portfolios.
13. Support secure document uploads.
14. Be modular and scalable for future development.
15. Expose clean REST APIs for future mobile applications or integrations.

---

# 3. Recommended Technology Stack

## 3.1 Frontend

The frontend will use:

* **React.js**
* **Vite**
* **JavaScript**
* **React Router DOM**
* **Tailwind CSS**
* **Axios**
* **Recharts**
* **Lucide React**
* **React Hook Form**
* **Zod or Yup** for validation

### UI Components

Use one consistent UI approach.

Recommended options:

* shadcn/ui if the team is comfortable integrating it, or
* Material UI / another compatible React component library.

Avoid mixing multiple large UI libraries unnecessarily.

---

## 3.2 Backend

The backend will use:

* **Node.js**
* **Express.js**
* **JavaScript**
* **Mongoose**
* **JSON Web Token (JWT)**
* **bcrypt or bcryptjs**
* **Multer**
* **Nodemailer** for optional email notifications

---

## 3.3 Database

The database will use:

* **MongoDB**
* **MongoDB Atlas**
* **Mongoose ODM**

MongoDB is selected because:

* The team already knows MongoDB.
* Development speed is important.
* Student portfolios contain naturally flexible data.
* Assessments and skills can be represented effectively as nested documents.
* The project benefits from fast MERN development.

---

## 3.4 File Storage

Files should not be stored directly as large binary data inside normal MongoDB documents.

Recommended:

```text
React Frontend
      ↓
Multer
      ↓
Validate File
      ↓
Cloudinary / Object Storage
      ↓
Get Secure File URL
      ↓
Store URL in MongoDB
```

Files may include:

* Certificates
* Resumes
* Portfolio documents
* Organization logos

---

## 3.5 AI and Intelligence Layer

The core MVP must **not completely depend on an external AI API**.

### Primary Intelligence

The platform should primarily use:

* Rule-based skill scoring
* Weighted skill-gap analysis
* Explainable opportunity matching
* Rule-based learning recommendations
* Aggregation-based analytics

### Optional Generative AI Layer

An LLM can optionally provide:

* Personalized career guidance
* Natural-language explanation of skill gaps
* Personalized learning roadmap
* Career improvement suggestions
* Recruiter-friendly candidate summaries

The core calculations must remain deterministic.

---

# 4. High-Level System Architecture

```text
┌──────────────────────────────────────────────┐
│              React.js + Vite                 │
│                                              │
│  Student Portal                              │
│  Industry Portal                             │
│  Institution Portal                          │
│  Admin Portal                                │
└─────────────────────┬────────────────────────┘
                      │
                   HTTPS / REST
                      │
┌─────────────────────▼────────────────────────┐
│           Node.js + Express.js               │
│                                              │
│  Authentication                              │
│  Authorization                               │
│  Assessment Engine                           │
│  Skill Gap Engine                            │
│  Matching Engine                             │
│  Recommendation Engine                       │
│  Application Management                      │
│  Analytics                                   │
│  File Management                             │
└─────────────────────┬────────────────────────┘
                      │
                  Mongoose ODM
                      │
┌─────────────────────▼────────────────────────┐
│                  MongoDB                     │
│                                              │
│ Users                                        │
│ Student Profiles                             │
│ Skills                                       │
│ Assessments                                  │
│ Career Roles                                 │
│ Opportunities                                │
│ Applications                                 │
│ Institutions                                 │
│ Learning Programs                            │
└──────────────────────────────────────────────┘
```

---

# 5. User Roles and Role-Based Access Control

The platform will use **Role-Based Access Control (RBAC)**.

---

## 5.1 Student

Students can:

* Register and log in
* Create and update profiles
* Select target career roles
* Complete skill assessments
* View assessment results
* View skill strengths
* View skill gaps
* View career readiness score
* Receive learning recommendations
* Browse internships and jobs
* View match scores
* Apply to opportunities
* Track application status
* Create a digital portfolio
* Upload certificates

---

## 5.2 Industry / Recruiter

Industry users can:

* Register an organization
* Manage organization profile
* Create internship opportunities
* Create job opportunities
* Define required skills
* View applications
* View candidate match scores
* View candidate skill compatibility
* Shortlist candidates
* Reject candidates
* Select candidates
* Update application status

---

## 5.3 Institution

Institution users can:

* View institution-level student analytics
* Monitor assessment completion
* View average readiness
* Identify common skill gaps
* Monitor internship applications
* Monitor placement progress
* View aggregated student performance

Institution users must only access data belonging to their own institution.

---

## 5.4 Administrator

Administrators can:

* Manage users
* Manage skills
* Manage career roles
* Manage assessments
* Moderate opportunities
* Monitor platform activity
* Manage learning programs

---

# 6. Authentication and Authorization

## 6.1 Registration Flow

```text
User Registration
       ↓
Validate Input
       ↓
Check Existing Email
       ↓
Hash Password
       ↓
Create User
       ↓
Generate JWT
       ↓
Return User + Token
```

---

## 6.2 Login Flow

```text
Email + Password
       ↓
Find User
       ↓
Compare Hashed Password
       ↓
Generate JWT
       ↓
Return Authenticated User
```

---

## 6.3 JWT Payload

The JWT should contain only required information.

Example:

```json
{
  "userId": "mongodb_object_id",
  "role": "student"
}
```

Never include:

* Passwords
* Sensitive personal data
* Complete profile data

---

## 6.4 Required Backend Middleware

The backend should include:

```text
authMiddleware
authorizeRoles(...roles)
validationMiddleware
errorMiddleware
notFoundMiddleware
```

Authorization flow:

```text
Request
   ↓
JWT Authentication
   ↓
Extract User
   ↓
Check Role
   ↓
Allow or Deny Access
```

Example:

```text
POST /api/v1/opportunities
       ↓
JWT Authentication
       ↓
Role Check
       ↓
Industry or Admin?
       ↓
YES → Allow
NO  → 403 Forbidden
```

---

# 7. Database Design

MongoDB will use ObjectIds to establish relationships.

Recommended core collections:

```text
Users
StudentProfiles
IndustryProfiles
Institutions
Skills
CareerRoles
Assessments
AssessmentAttempts
Opportunities
Applications
LearningPrograms
Notifications
```

---

# 8. User Schema

```javascript
{
  _id: ObjectId,

  name: String,

  email: String,

  password: String,

  role:
    "student" |
    "industry" |
    "institution" |
    "admin",

  avatar: String,

  isActive: Boolean,

  createdAt: Date,

  updatedAt: Date
}
```

### Indexes

```text
email → Unique Index
role  → Index
```

---

# 9. Student Profile Schema

```javascript
{
  _id: ObjectId,

  userId: ObjectId,

  institutionId: ObjectId,

  branch: String,

  graduationYear: Number,

  location: String,

  bio: String,

  targetRoles: [
    {
      roleId: ObjectId,
      priority: Number
    }
  ],

  interests: [String],

  skills: [
    {
      skillId: ObjectId,
      level: Number,
      verified: Boolean,

      source:
        "assessment" |
        "manual" |
        "certificate" |
        "project"
    }
  ],

  projects: [
    {
      title: String,
      description: String,
      technologies: [String],
      projectUrl: String,
      repositoryUrl: String
    }
  ],

  certifications: [
    {
      title: String,
      issuer: String,
      credentialUrl: String,
      issueDate: Date,
      documentUrl: String
    }
  ],

  internships: [
    {
      company: String,
      role: String,
      startDate: Date,
      endDate: Date,
      description: String
    }
  ],

  readinessScore: Number,

  profileCompletion: Number,

  createdAt: Date,

  updatedAt: Date
}
```

### Indexes

```text
userId → Unique Index
institutionId → Index
targetRoles.roleId → Index
```

---

# 10. Industry Profile Schema

```javascript
{
  _id: ObjectId,

  userId: ObjectId,

  organizationName: String,

  description: String,

  website: String,

  industryType: String,

  location: String,

  logo: String,

  verified: Boolean,

  createdAt: Date,

  updatedAt: Date
}
```

---

# 11. Institution Schema

```javascript
{
  _id: ObjectId,

  name: String,

  code: String,

  location: String,

  website: String,

  createdAt: Date,

  updatedAt: Date
}
```

---

# 12. Skill Schema

Skills will be centrally managed.

```javascript
{
  _id: ObjectId,

  name: String,

  category:
    "technical" |
    "soft",

  description: String,

  tags: [String],

  createdAt: Date,

  updatedAt: Date
}
```

Examples:

```text
JavaScript
React.js
Node.js
Express.js
MongoDB
SQL
Docker
Git
Communication
Teamwork
Problem Solving
Leadership
```

---

# 13. Career Role Schema

```javascript
{
  _id: ObjectId,

  title: String,

  description: String,

  requiredSkills: [
    {
      skillId: ObjectId,

      requiredLevel: Number,

      importanceWeight: Number
    }
  ],

  averageReadinessTarget: Number,

  createdAt: Date,

  updatedAt: Date
}
```

Example career roles:

```text
Frontend Developer
Backend Developer
Full Stack Developer
Data Analyst
Software Engineer
DevOps Engineer
```

---

# 14. Assessment Schema

```javascript
{
  _id: ObjectId,

  title: String,

  description: String,

  targetRoleId: ObjectId,

  questions: [
    {
      questionText: String,

      skillId: ObjectId,

      category:
        "technical" |
        "soft",

      difficulty:
        "easy" |
        "medium" |
        "hard",

      options: [
        {
          text: String,
          score: Number
        }
      ]
    }
  ],

  isActive: Boolean,

  createdAt: Date,

  updatedAt: Date
}
```

For the MVP, use:

* Multiple-choice questions
* Skill-specific scoring
* Simple difficulty levels

This will be much more reliable and faster to implement.

---

# 15. Assessment Attempt Schema

Assessment attempts should be stored separately from assessment definitions.

```javascript
{
  _id: ObjectId,

  studentId: ObjectId,

  assessmentId: ObjectId,

  answers: [
    {
      questionId: ObjectId,

      selectedOption: Number,

      score: Number
    }
  ],

  skillScores: [
    {
      skillId: ObjectId,

      score: Number,

      maxScore: Number,

      percentage: Number
    }
  ],

  overallScore: Number,

  readinessScore: Number,

  completedAt: Date
}
```

### Indexes

```text
studentId → Index
assessmentId → Index
studentId + completedAt → Compound Index
```

---

# 16. Opportunity Schema

One collection will support:

* Internships
* Jobs
* Apprenticeships
* Live projects

```javascript
{
  _id: ObjectId,

  industryId: ObjectId,

  title: String,

  type:
    "internship" |
    "job" |
    "apprenticeship" |
    "project",

  description: String,

  location: String,

  workMode:
    "remote" |
    "onsite" |
    "hybrid",

  requiredSkills: [
    {
      skillId: ObjectId,

      requiredLevel: Number,

      importanceWeight: Number
    }
  ],

  eligibility: {
    branches: [String],

    minGraduationYear: Number,

    maxGraduationYear: Number
  },

  deadline: Date,

  status:
    "draft" |
    "active" |
    "closed",

  createdAt: Date,

  updatedAt: Date
}
```

### Indexes

```text
industryId → Index
status → Index
type → Index
deadline → Index
```

---

# 17. Application Schema

```javascript
{
  _id: ObjectId,

  studentId: ObjectId,

  opportunityId: ObjectId,

  matchScoreAtApplication: Number,

  status:
    "applied" |
    "under_review" |
    "shortlisted" |
    "rejected" |
    "selected",

  coverNote: String,

  appliedAt: Date,

  updatedAt: Date
}
```

Critical index:

```text
studentId + opportunityId → Unique Compound Index
```

This prevents a student from applying twice to the same opportunity.

---

# 18. Learning Program Schema

```javascript
{
  _id: ObjectId,

  title: String,

  provider: String,

  description: String,

  targetSkills: [ObjectId],

  type:
    "course" |
    "workshop" |
    "certification" |
    "mentorship",

  level:
    "beginner" |
    "intermediate" |
    "advanced",

  externalUrl: String,

  createdAt: Date,

  updatedAt: Date
}
```

---

# 19. Notification Schema

```javascript
{
  _id: ObjectId,

  userId: ObjectId,

  type: String,

  title: String,

  message: String,

  isRead: Boolean,

  actionUrl: String,

  createdAt: Date
}
```

---

# 20. Skill Assessment Engine

The assessment engine must calculate skill scores on the backend.

The frontend should never be trusted to calculate the final score.

## Example

```text
Question:
Which HTTP method is normally used to create a resource?

Related Skill:
REST API

Correct Answer:
Score = 10

Incorrect Answer:
Score = 0
```

Skill percentage:

```text
Skill Percentage =

Total Points Earned
──────────────────── × 100
Total Possible Points
```

---

# 21. Skill Level Mapping

| Score  | Level        |
| ------ | ------------ |
| 0–39   | Beginner     |
| 40–59  | Basic        |
| 60–74  | Intermediate |
| 75–89  | Advanced     |
| 90–100 | Expert       |

The database should primarily store numeric scores.

The frontend can convert scores into human-readable levels.

---

# 22. Skill Gap Analysis Engine

The system compares:

```text
Student Skill Score
        VS
Required Skill Score
```

Example:

```text
Career: Full Stack Developer

Required React Level: 80
Student React Score: 55

Skill Gap = 25
```

Formula:

```text
Skill Gap =

max(Required Level - Student Level, 0)
```

The system should return:

* Strong skills
* Matched skills
* Weak skills
* Missing skills
* Priority skill gaps

Example API response:

```json
{
  "strongSkills": [
    "JavaScript",
    "Communication"
  ],

  "skillGaps": [
    {
      "skill": "Docker",
      "gap": 45
    }
  ]
}
```

---

# 23. Opportunity Matching Engine

This is one of the most important technical modules.

The matching engine should be:

* Explainable
* Deterministic
* Fast
* Easy to demonstrate

---

## 23.1 Skill Compatibility

For every required skill:

```text
Skill Compatibility =

min(
Student Skill Score / Required Skill Level,
1
)
```

---

## 23.2 Weighted Match Score

```text
Weighted Match Score =

Σ (Skill Compatibility × Skill Weight)
──────────────────────────────────────
Σ Skill Weight

× 100
```

Example:

```text
React           Weight = 5
Node.js         Weight = 5
MongoDB         Weight = 3
Communication   Weight = 2
```

React and Node.js therefore influence the final score more.

---

## 23.3 Optional Future Factors

Later versions can include:

* Graduation year
* Branch
* Location
* Work preference
* Career interest
* Certification relevance
* Project relevance

For the MVP, focus primarily on:

```text
Skills + Eligibility
```

This is more achievable and explainable.

---

## 23.4 Explainable Match Result

The system should return more than a percentage.

Example:

```json
{
  "matchScore": 78,

  "matchedSkills": [
    "JavaScript",
    "React",
    "Communication"
  ],

  "skillGaps": [
    "Docker",
    "SQL"
  ],

  "recommendation":
    "Strong match. Improving Docker and SQL can increase your readiness."
}
```

This feature will make the project significantly more impressive in the demo.

---

# 24. Career Readiness Score

The MVP can calculate readiness using:

```text
Assessment Score        = 45%
Profile Completion      = 15%
Portfolio Strength      = 20%
Skill Relevance         = 20%
```

Formula:

```text
Career Readiness Score =

Assessment × 0.45
+
Profile Completion × 0.15
+
Portfolio Strength × 0.20
+
Skill Relevance × 0.20
```

The formula must be calculated on the backend.

---

# 25. Learning Recommendation Engine

The MVP recommendation system should be rule-based.

Flow:

```text
Identify Skill Gap
        ↓
Find Learning Programs
        ↓
Match Programs to Missing Skills
        ↓
Filter by Student Level
        ↓
Rank by Relevance
        ↓
Return Recommendations
```

Example:

```text
Student Missing Skill:
SQL

Student Level:
Beginner

Recommended:

1. SQL Fundamentals
2. Database Basics
3. SQL for Developers
```

Generative AI can later generate a personalized learning roadmap.

---

# 26. REST API Design

Base API URL:

```text
/api/v1
```

---

# 27. Authentication APIs

```text
POST /auth/register

POST /auth/login

GET /auth/me

POST /auth/logout
```

---

# 28. Student APIs

```text
GET /students/profile

PATCH /students/profile

GET /students/dashboard

GET /students/readiness

GET /students/recommendations

GET /students/matches
```

---

# 29. Assessment APIs

```text
GET /assessments

GET /assessments/:id

POST /assessments/:id/start

POST /assessments/:id/submit

GET /assessments/attempts/me

GET /assessments/attempts/:attemptId
```

Important:

> The backend must calculate and store all final scores when an assessment is submitted.

---

# 30. Skills and Career Role APIs

```text
GET /skills

GET /skills/:id

GET /career-roles

GET /career-roles/:id

GET /career-roles/:id/gap-analysis
```

Admin-only:

```text
POST /skills

PATCH /skills/:id

DELETE /skills/:id

POST /career-roles

PATCH /career-roles/:id

DELETE /career-roles/:id
```

---

# 31. Opportunity APIs

```text
GET /opportunities

GET /opportunities/:id

GET /opportunities/:id/match
```

Industry:

```text
POST /opportunities

PATCH /opportunities/:id

DELETE /opportunities/:id

GET /industry/opportunities
```

---

# 32. Application APIs

Student:

```text
POST /applications

GET /applications/me

GET /applications/:id
```

Industry:

```text
GET /opportunities/:id/applications

PATCH /applications/:id/status
```

---

# 33. Institution Analytics APIs

```text
GET /institution/dashboard

GET /institution/skill-gaps

GET /institution/readiness

GET /institution/applications

GET /institution/placements
```

All these APIs must enforce institution-level access control.

An institution must not see another institution's students.

---

# 34. Frontend Architecture

Recommended project structure:

```text
src/
│
├── api/
│   ├── axios.js
│   ├── authApi.js
│   ├── assessmentApi.js
│   ├── opportunityApi.js
│   └── analyticsApi.js
│
├── components/
│   ├── common/
│   ├── dashboard/
│   ├── assessment/
│   ├── opportunities/
│   └── charts/
│
├── pages/
│   ├── auth/
│   ├── student/
│   ├── industry/
│   ├── institution/
│   └── admin/
│
├── layouts/
│   ├── StudentLayout.jsx
│   ├── IndustryLayout.jsx
│   ├── InstitutionLayout.jsx
│   └── AdminLayout.jsx
│
├── context/
│   └── AuthContext.jsx
│
├── hooks/
│
├── utils/
│
├── routes/
│   └── AppRoutes.jsx
│
├── App.jsx
│
└── main.jsx
```

---

# 35. Required Frontend Pages

## Public Pages

* Landing Page
* Login Page
* Registration Page
* Browse Opportunities
* Opportunity Details

---

## Student Pages

* Student Dashboard
* My Profile
* Skill Assessment
* Assessment Result
* Skill Gap Analysis
* Learning Recommendations
* Opportunity Recommendations
* Opportunity Details
* My Applications
* Digital Portfolio

---

## Industry Pages

* Industry Dashboard
* Organization Profile
* Create Opportunity
* Manage Opportunities
* Applicants List
* Candidate Details
* Candidate Ranking

---

## Institution Pages

* Institution Dashboard
* Student Readiness Analytics
* Skill Gap Analytics
* Internship Analytics
* Placement/Application Analytics

---

## Admin Pages

* Admin Dashboard
* Manage Users
* Manage Skills
* Manage Career Roles
* Manage Assessments
* Manage Opportunities

---

# 36. Frontend Routing

Use React Router DOM.

Example:

```text
/

 /login

 /register

/student/dashboard

/student/profile

/student/assessment/:id

/student/results/:attemptId

/student/opportunities

/student/applications

/industry/dashboard

/industry/opportunities

/industry/opportunities/new

/industry/opportunities/:id/applicants

/institution/dashboard

/institution/analytics

/admin/dashboard
```

---

# 37. Protected Routes

The frontend must protect private routes.

```text
User Opens Private Route
          ↓
Token Exists?
     ↓          ↓
   YES          NO
    ↓            ↓
Role Check    Login Page
    ↓
Correct Role?
    ↓       ↓
   YES      NO
    ↓        ↓
Allow     Unauthorized Page
```

---

# 38. Dashboard Requirements

## Student Dashboard

Display:

* Career readiness score
* Assessment completion
* Top skills
* Major skill gaps
* Recommended opportunities
* Recent applications
* Profile completion

---

## Industry Dashboard

Display:

* Active opportunities
* Total applicants
* Shortlisted candidates
* Applications by status
* Top matching candidates

---

## Institution Dashboard

Display:

* Total students
* Assessment completion rate
* Average readiness score
* Top skill gaps
* Active applications
* Shortlisted students
* Selected students

---

# 39. Analytics Implementation

Use:

* **MongoDB Aggregation Pipelines**
* **Recharts** for frontend visualization

Do not fetch all database records into the frontend just to calculate analytics.

---

## Example: Average Readiness

```text
StudentProfile
      ↓
Filter Institution
      ↓
Group Students
      ↓
Calculate Average Readiness
```

---

## Example: Top Skill Gaps

```text
Assessment Attempts
      ↓
Unwind Skill Scores
      ↓
Identify Low Scores
      ↓
Group by Skill
      ↓
Calculate Average Gap
      ↓
Sort
      ↓
Return Top 5
```

---

## Example: Application Status

```text
Applications
      ↓
Group by Status
      ↓
Count
```

---

# 40. File Upload Requirements

Allowed files:

```text
PDF
JPG
JPEG
PNG
```

Recommended restrictions:

* Configurable maximum file size
* Validate MIME type
* Reject executable files
* Generate unique filenames
* Store files in cloud storage

Upload flow:

```text
React
   ↓
multipart/form-data
   ↓
Multer
   ↓
Validate
   ↓
Cloud Storage
   ↓
Get URL
   ↓
Store URL in MongoDB
```

---

# 41. Security Requirements

The platform must implement:

* HTTPS in production
* Password hashing
* JWT authentication
* Role-based authorization
* Input validation
* Rate limiting
* CORS configuration
* Environment variables
* Secure file validation
* Centralized error handling
* No passwords in API responses
* No secrets committed to Git

Recommended packages:

```text
helmet
express-rate-limit
cors
dotenv
zod / joi
bcrypt
jsonwebtoken
```

---

# 42. Environment Variables

Example:

```env
PORT=5000

NODE_ENV=development

MONGODB_URI=

JWT_SECRET=

JWT_EXPIRES_IN=

CLIENT_URL=

CLOUDINARY_CLOUD_NAME=

CLOUDINARY_API_KEY=

CLOUDINARY_API_SECRET=

AI_API_KEY=
```

Create:

```text
.env
.env.example
```

Never push `.env` to GitHub.

---

# 43. Backend Project Structure

Recommended:

```text
server/
│
├── src/
│   │
│   ├── config/
│   │   └── db.js
│   │
│   ├── models/
│   │
│   ├── controllers/
│   │
│   ├── services/
│   │   ├── matchingService.js
│   │   ├── readinessService.js
│   │   ├── recommendationService.js
│   │   └── assessmentService.js
│   │
│   ├── routes/
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── roleMiddleware.js
│   │   ├── errorMiddleware.js
│   │   └── validationMiddleware.js
│   │
│   ├── validators/
│   │
│   ├── utils/
│   │
│   ├── app.js
│   │
│   └── server.js
│
├── scripts/
│   └── seed.js
│
└── package.json
```

Important rule:

> Do not place all business logic inside controllers.

Controllers should handle requests and responses.

Complex logic should go into services.

---

# 44. Seed Data Requirements

For development and demonstration, create realistic seed data.

Recommended:

```text
25–40 Skills

5–8 Career Roles

3–5 Assessments

20+ Students

5+ Industry Profiles

15+ Opportunities

Sample Applications

Learning Programs
```

Seed data is important because it allows dashboards and matching features to demonstrate real functionality immediately.

---

# 45. AI Integration Requirements

AI should be used as an **enhancement layer**.

---

## AI Feature 1 — Career Guidance

Input:

```text
Student Skills
Skill Gaps
Target Role
Interests
Career Readiness
```

Output:

```text
Career Guidance
Priority Skills
Suggested Next Steps
Learning Path
```

---

## AI Feature 2 — Natural-Language Match Explanation

Example:

> You are a 78% match for this Full Stack Developer internship. Your strongest matches are React, JavaScript, and Node.js. Improving Docker and SQL could significantly improve your profile.

Important:

> The AI should explain the score, not calculate or manipulate the actual score.

---

## AI Must Never Control

AI must not directly modify:

* Assessment scores
* Match scores
* Application status
* Authorization
* Database permissions

The backend algorithm remains the source of truth.

---

# 46. Standard API Response Format

Success:

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": []
}
```

Paginated response:

```json
{
  "success": true,
  "data": [],

  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

---

# 47. Validation Requirements

All incoming requests must be validated.

## Registration

Validate:

* Name
* Email format
* Password length
* Valid role

---

## Opportunity

Validate:

* Title required
* Valid opportunity type
* At least one required skill
* Valid deadline
* Valid status

---

## Application

Before creating an application:

```text
Does Opportunity Exist?
        ↓
Is Opportunity Active?
        ↓
Has Deadline Passed?
        ↓
Has Student Already Applied?
        ↓
Calculate Match Score
        ↓
Create Application
```

---

# 48. Error Handling

Use centralized error handling.

Expected status codes:

| Error              | Status |
| ------------------ | -----: |
| Validation Error   |    400 |
| Unauthenticated    |    401 |
| Unauthorized       |    403 |
| Not Found          |    404 |
| Duplicate Resource |    409 |
| Server Error       |    500 |

Production errors must not expose stack traces.

---

# 49. Performance Requirements

Initial targets:

* Typical API responses should be fast.
* Large list APIs must use pagination.
* Frequently queried fields must have indexes.
* Dashboard calculations should use MongoDB aggregation.
* The frontend should not load unnecessary data.
* Matching calculations should be performed efficiently.

---

# 50. Scalability Strategy

The initial architecture:

```text
Single Express Application
          +
MongoDB Atlas
```

Future scaling:

```text
Express Application
        ↓
Load Balancer
        ↓
Multiple API Instances
        ↓
MongoDB Atlas Scaling
        ↓
Redis Cache
        ↓
Background Job Queue
```

Possible future technologies:

* Redis
* BullMQ
* WebSockets
* Dedicated AI Service
* Elasticsearch/OpenSearch

These are not required for the initial build.

---

# 51. Deployment Architecture

## Frontend

Deploy using:

```text
Vercel
or
Netlify
```

## Backend

Deploy using:

```text
Render
Railway
Fly.io
AWS
```

## Database

```text
MongoDB Atlas
```

---

# 52. CI/CD Requirements

Basic CI/CD:

```text
GitHub Push
      ↓
Run Tests / Lint
      ↓
Build
      ↓
Deploy
```

For the initial version, automatic deployment from GitHub is sufficient.

---

# 53. Logging and Monitoring

Initial version:

* Server error logging
* Request logging during development
* Deployment logs

Future:

* Centralized logs
* Uptime monitoring
* Performance monitoring
* Security audit logs

---

# 54. Testing Requirements

## Backend Testing Priority

Test:

* Registration
* Login
* JWT verification
* Role authorization
* Assessment scoring
* Skill-gap calculation
* Opportunity match calculation
* Duplicate application prevention
* Eligibility validation

The most important calculations to test are:

```text
Assessment Scoring
Skill Gap Analysis
Match Score
Readiness Score
```

Because these are central to the project's credibility.

---

# 55. End-to-End Critical User Flow

The complete platform must support:

```text
1. Student Registers
        ↓
2. Student Logs In
        ↓
3. Student Completes Profile
        ↓
4. Student Selects Target Career
        ↓
5. Student Takes Assessment
        ↓
6. Backend Calculates Skill Scores
        ↓
7. System Identifies Strengths
        ↓
8. System Identifies Skill Gaps
        ↓
9. System Calculates Career Readiness
        ↓
10. System Recommends Learning Programs
        ↓
11. Industry Posts Opportunity
        ↓
12. Matching Engine Calculates Compatibility
        ↓
13. Student Views Match Explanation
        ↓
14. Student Applies
        ↓
15. Industry Views Ranked Candidates
        ↓
16. Recruiter Updates Status
        ↓
17. Institution Dashboard Updates
```

This is the **most important demo flow** of the entire project.

---

# 56. Core MVP Functional Requirements

The first complete version must include:

## Authentication

* Registration
* Login
* JWT
* Role-based access

## Student Module

* Profile
* Assessment
* Skill scores
* Skill-gap analysis
* Career readiness
* Opportunity recommendations
* Apply
* Application tracking
* Portfolio

## Industry Module

* Organization profile
* Create opportunity
* Manage opportunities
* View applicants
* Candidate match ranking
* Update application status

## Institution Module

* Dashboard
* Readiness analytics
* Skill-gap analytics
* Application analytics

## Admin Module

* Manage skills
* Manage career roles
* Manage assessments
* Basic opportunity moderation

---

# 57. Features Deferred for Future Versions

These should not block the initial product:

* Native mobile application
* Real-time chat
* Video interviews
* Blockchain credential verification
* Autonomous AI decision-making
* Full ATS integration
* Complex machine-learning recommendation training
* Microservices architecture
* Nationwide live labor-market data ingestion
* External government integrations

These can be added later.

---

# 58. Technical Definition of Done

A feature is complete only when:

1. Database schema is implemented.
2. Backend API is implemented.
3. Authentication is enforced.
4. Authorization is enforced.
5. Input is validated.
6. Errors are handled.
7. Frontend uses the real API.
8. Loading state exists.
9. Error state exists.
10. End-to-end flow works.
11. Secrets are not hardcoded.
12. Code is committed to Git.
13. Important functionality is documented.

---

# 59. Recommended Repository Structure

```text
skillbridge-ai/
│
├── client/
│
├── server/
│
├── docs/
│   ├── PRD.md
│   ├── TRD.md
│   └── API.md
│
├── README.md
│
└── .gitignore
```

Recommended branches:

```text
main

develop

feature/auth

feature/student-dashboard

feature/assessment

feature/opportunities

feature/matching

feature/analytics
```

---

# 60. Final Technical Recommendation

## Final Stack

```text
FRONTEND

React.js
Vite
React Router DOM
Tailwind CSS
Axios
Recharts
Lucide React


BACKEND

Node.js
Express.js
Mongoose


DATABASE

MongoDB Atlas


AUTHENTICATION

JWT
bcrypt


FILE UPLOAD

Multer
Cloudinary / Object Storage


INTELLIGENCE

Rule-Based Assessment Scoring

Weighted Skill Gap Analysis

Weighted Opportunity Matching

Rule-Based Recommendations

Optional LLM for Natural-Language Explanations


DEPLOYMENT

Vercel / Netlify
+
Render / Railway
+
MongoDB Atlas
```

---

# 61. Final Architecture Decision

For **your team and this project**, this is the strongest technical approach.

The goal is **not** to use the most complicated technologies.

The goal is to build:

* A complete product
* A working product
* A polished product
* A product with real backend logic
* A product with intelligent matching
* A product with impressive dashboards
* A product that can be demonstrated end-to-end

**React + Node.js + Express.js + MongoDB is absolutely capable of building this project.**

Your biggest strength will not be saying:

> “We used the most advanced technology.”

Your strength will be demonstrating:

> **A student takes an assessment → the system identifies skill gaps → calculates career readiness → recommends learning → matches the student with internships/jobs → the student applies → recruiters rank candidates → institutions monitor outcomes.**

**That complete working lifecycle is what can make SkillBridge AI genuinely powerful in your hackathon.** 🔥
