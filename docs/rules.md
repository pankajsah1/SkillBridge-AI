# Project Rules and Development Guidelines

# Academia–Industry Collaboration Portal

## 1. Purpose of This Document

This document defines the development, coding, collaboration, security, Git, API, database, and deployment rules for the Academia–Industry Collaboration Portal.

All team members and AI-assisted development tools working on this project should follow these rules to maintain:

- Clean and consistent code
- Fast development
- Easy collaboration
- Reduced merge conflicts
- Secure implementation
- Maintainable architecture
- Consistent UI and user experience

These rules apply to the complete project unless a team decision explicitly updates this document.

---

# 2. Project Overview

The Academia–Industry Collaboration Portal is a centralized web platform connecting:

- Students
- Industries and recruiters
- Academicians
- Institutions and administrators

The platform aims to reduce the gap between academic skills and industry requirements.

The core platform allows users to:

- Create role-based accounts
- Build skill profiles
- Complete skill assessments
- Identify skill gaps
- Receive career and opportunity recommendations
- Search and apply for internships and jobs
- Track applications
- Discover learning programs
- Build digital portfolios
- Connect industry and academia through opportunities and collaboration
- Monitor progress through dashboards and analytics

---

# 3. Core Development Principles

Every development decision should follow these principles:

## 3.1 Build for the MVP First

Do not build unnecessary features before the core user journey works.

Priority order:

1. Authentication and role management
2. Student profile and skills
3. Opportunity creation
4. Opportunity discovery
5. Skill matching
6. Application workflow
7. Application tracking
8. Dashboards
9. AI-powered features
10. Advanced analytics and integrations

The team must always prefer:

> A complete working core feature over an incomplete advanced feature.

---

## 3.2 Avoid Overengineering

Do not introduce complex technologies unless there is a clear benefit.

Avoid:

- Microservices
- Kubernetes
- Complex event-driven architecture
- Multiple databases without necessity
- Unnecessary abstraction layers
- Premature optimization

The MVP should remain simple and modular.

---

## 3.3 Build Working Features Before Perfect Features

For a hackathon or early product version:

- A working recommendation system is better than an unfinished complex AI system.
- A simple dashboard is better than a partially completed enterprise analytics platform.
- A reliable rule-based skill matcher is acceptable before advanced machine learning.
- Mock data is acceptable for external systems that cannot be integrated during development.

---

# 4. Technology Stack Rules

## 4.1 Frontend

Use:

- React.js
- Vite
- JavaScript
- React Router
- Tailwind CSS
- Axios or Fetch API

Recommended optional libraries:

- React Hook Form
- Zod or another validation library
- Recharts for analytics
- Lucide React for icons

Do not introduce another frontend framework without team approval.

---

## 4.2 Backend

Use:

- Node.js
- Express.js
- JavaScript
- MongoDB
- Mongoose

The backend must expose RESTful APIs.

---

## 4.3 Database

Use:

- MongoDB Atlas for cloud deployment
- Mongoose for schema modeling

Database collections should have clear responsibilities.

Do not store unrelated data inside a single large collection.

---

## 4.4 Authentication

Authentication must use:

- JWT
- Password hashing using bcrypt
- Role-based authorization middleware

Never store:

- Plain-text passwords
- JWT secrets in source code
- API keys directly in frontend code

---

# 5. User Roles

The primary roles are:

## 5.1 Student

Students can:

- Register and log in
- Complete profiles
- Add skills
- Take skill assessments
- View skill gaps
- Explore recommended opportunities
- Apply for internships and jobs
- Track application status
- Build a digital portfolio
- View learning recommendations

---

## 5.2 Industry

Industry users can:

- Create organization profiles
- Post internships
- Post entry-level jobs
- Define required skills
- Create learning programs
- Review applicants
- View candidate matching scores
- Update application status

---

## 5.3 Academician

Academicians can:

- Create professional profiles
- Explore faculty internships
- Explore FDPs
- Discover industrial training
- View consultancy opportunities
- Discover research collaborations
- Participate in workshops and mentorship programs

---

## 5.4 Institution

Institution users can:

- Monitor student progress
- View internship participation
- Monitor placement activity
- View skill development analytics
- Monitor opportunities and applications

---

## 5.5 Admin

Admins can:

- Manage users
- Verify organizations
- Moderate opportunities
- Manage assessments
- Monitor platform activity
- Access system-level analytics

---

# 6. Role-Based Access Rules

Every protected action must verify:

1. The user is authenticated.
2. The user's role is authorized.
3. The user has permission to access the requested resource.

Example:

A student must not be able to:

- Create a job posting
- Change another student's profile
- Access admin dashboards

An industry user must not be able to:

- Edit another industry's opportunities
- Access private student data without authorization

Authorization must always be enforced on the backend.

Frontend restrictions are for user experience only and must never be considered a security mechanism.

---

# 7. Frontend Rules

## 7.1 Component Structure

Components should have a single clear responsibility.

Example structure:

```text
src/
├── components/
│   ├── common/
│   ├── student/
│   ├── industry/
│   └── dashboard/
│
├── pages/
│   ├── auth/
│   ├── student/
│   ├── industry/
│   ├── academician/
│   └── admin/
│
├── services/
├── hooks/
├── context/
├── utils/
└── constants/
Absolutely bro! 🔥 For your **Academia–Industry Collaboration Portal**, a `RULES.md` file can define the **project rules, coding standards, Git workflow, security rules, API conventions, and team collaboration guidelines**.

You can copy the following directly into a file named **`RULES.md`**:

````md
# Project Rules and Development Guidelines

# Academia–Industry Collaboration Portal

## 1. Purpose of This Document

This document defines the development, coding, collaboration, security, Git, API, database, and deployment rules for the Academia–Industry Collaboration Portal.

All team members and AI-assisted development tools working on this project should follow these rules to maintain:

- Clean and consistent code
- Fast development
- Easy collaboration
- Reduced merge conflicts
- Secure implementation
- Maintainable architecture
- Consistent UI and user experience

These rules apply to the complete project unless a team decision explicitly updates this document.

---

# 2. Project Overview

The Academia–Industry Collaboration Portal is a centralized web platform connecting:

- Students
- Industries and recruiters
- Academicians
- Institutions and administrators

The platform aims to reduce the gap between academic skills and industry requirements.

The core platform allows users to:

- Create role-based accounts
- Build skill profiles
- Complete skill assessments
- Identify skill gaps
- Receive career and opportunity recommendations
- Search and apply for internships and jobs
- Track applications
- Discover learning programs
- Build digital portfolios
- Connect industry and academia through opportunities and collaboration
- Monitor progress through dashboards and analytics

---

# 3. Core Development Principles

Every development decision should follow these principles:

## 3.1 Build for the MVP First

Do not build unnecessary features before the core user journey works.

Priority order:

1. Authentication and role management
2. Student profile and skills
3. Opportunity creation
4. Opportunity discovery
5. Skill matching
6. Application workflow
7. Application tracking
8. Dashboards
9. AI-powered features
10. Advanced analytics and integrations

The team must always prefer:

> A complete working core feature over an incomplete advanced feature.

---

## 3.2 Avoid Overengineering

Do not introduce complex technologies unless there is a clear benefit.

Avoid:

- Microservices
- Kubernetes
- Complex event-driven architecture
- Multiple databases without necessity
- Unnecessary abstraction layers
- Premature optimization

The MVP should remain simple and modular.

---

## 3.3 Build Working Features Before Perfect Features

For a hackathon or early product version:

- A working recommendation system is better than an unfinished complex AI system.
- A simple dashboard is better than a partially completed enterprise analytics platform.
- A reliable rule-based skill matcher is acceptable before advanced machine learning.
- Mock data is acceptable for external systems that cannot be integrated during development.

---

# 4. Technology Stack Rules

## 4.1 Frontend

Use:

- React.js
- Vite
- JavaScript
- React Router
- Tailwind CSS
- Axios or Fetch API

Recommended optional libraries:

- React Hook Form
- Zod or another validation library
- Recharts for analytics
- Lucide React for icons

Do not introduce another frontend framework without team approval.

---

## 4.2 Backend

Use:

- Node.js
- Express.js
- JavaScript
- MongoDB
- Mongoose

The backend must expose RESTful APIs.

---

## 4.3 Database

Use:

- MongoDB Atlas for cloud deployment
- Mongoose for schema modeling

Database collections should have clear responsibilities.

Do not store unrelated data inside a single large collection.

---

## 4.4 Authentication

Authentication must use:

- JWT
- Password hashing using bcrypt
- Role-based authorization middleware

Never store:

- Plain-text passwords
- JWT secrets in source code
- API keys directly in frontend code

---

# 5. User Roles

The primary roles are:

## 5.1 Student

Students can:

- Register and log in
- Complete profiles
- Add skills
- Take skill assessments
- View skill gaps
- Explore recommended opportunities
- Apply for internships and jobs
- Track application status
- Build a digital portfolio
- View learning recommendations

---

## 5.2 Industry

Industry users can:

- Create organization profiles
- Post internships
- Post entry-level jobs
- Define required skills
- Create learning programs
- Review applicants
- View candidate matching scores
- Update application status

---

## 5.3 Academician

Academicians can:

- Create professional profiles
- Explore faculty internships
- Explore FDPs
- Discover industrial training
- View consultancy opportunities
- Discover research collaborations
- Participate in workshops and mentorship programs

---

## 5.4 Institution

Institution users can:

- Monitor student progress
- View internship participation
- Monitor placement activity
- View skill development analytics
- Monitor opportunities and applications

---

## 5.5 Admin

Admins can:

- Manage users
- Verify organizations
- Moderate opportunities
- Manage assessments
- Monitor platform activity
- Access system-level analytics

---

# 6. Role-Based Access Rules

Every protected action must verify:

1. The user is authenticated.
2. The user's role is authorized.
3. The user has permission to access the requested resource.

Example:

A student must not be able to:

- Create a job posting
- Change another student's profile
- Access admin dashboards

An industry user must not be able to:

- Edit another industry's opportunities
- Access private student data without authorization

Authorization must always be enforced on the backend.

Frontend restrictions are for user experience only and must never be considered a security mechanism.

---

# 7. Frontend Rules

## 7.1 Component Structure

Components should have a single clear responsibility.

Example structure:

```text
src/
├── components/
│   ├── common/
│   ├── student/
│   ├── industry/
│   └── dashboard/
│
├── pages/
│   ├── auth/
│   ├── student/
│   ├── industry/
│   ├── academician/
│   └── admin/
│
├── services/
├── hooks/
├── context/
├── utils/
└── constants/
````

Do not place all components inside one folder.

---

## 7.2 Reusable Components

Before creating a new component, check whether an existing reusable component can be used.

Common components should include:

* Button
* Input
* Select
* Modal
* Card
* Badge
* Loading state
* Empty state
* Error message
* Pagination

Do not duplicate the same UI implementation across multiple pages.

---

## 7.3 Page Responsibilities

Pages should primarily:

* Fetch data
* Manage page-level state
* Compose components

Complex reusable UI logic should be moved into components or custom hooks.

---

## 7.4 UI States

Every important page should handle:

* Loading
* Success
* Empty state
* Error state

Never leave users with a blank page while data is loading or unavailable.

---

# 8. UI and UX Rules

The application should be:

* Clean
* Modern
* Professional
* Accessible
* Responsive

The UI should prioritize clarity over excessive animations.

---

## 8.1 Responsive Design

The application must work on:

* Desktop
* Tablet
* Mobile

Test important screens on mobile widths.

---

## 8.2 Dashboard Design

Dashboards should provide useful information immediately.

Recommended dashboard elements:

* Summary cards
* Recent activity
* Status indicators
* Progress indicators
* Charts
* Recommended actions

Avoid adding charts that do not provide meaningful insights.

---

## 8.3 Forms

Forms should:

* Clearly label required fields
* Validate user input
* Display useful error messages
* Prevent duplicate submissions
* Show loading states during submission

---

# 9. Backend Rules

## 9.1 Layered Architecture

Use a modular backend structure:

```text
src/
├── config/
├── controllers/
├── models/
├── routes/
├── middleware/
├── services/
├── utils/
└── app.js
```

Responsibilities:

### Routes

Routes define API endpoints.

### Controllers

Controllers handle:

* Request input
* Calling services
* Returning responses

Controllers should not contain unnecessary business logic.

### Services

Services contain:

* Business logic
* Matching logic
* Recommendation logic
* Complex database workflows

### Models

Models define:

* MongoDB schemas
* Validation rules
* Relationships between documents

---

# 10. API Design Rules

Use RESTful API design.

Example:

```text
GET    /api/opportunities
POST   /api/opportunities
GET    /api/opportunities/:id
PATCH  /api/opportunities/:id
DELETE /api/opportunities/:id
```

Use plural resource names.

Good:

```text
/api/students
/api/opportunities
/api/applications
```

Avoid:

```text
/api/getStudents
/api/createOpportunity
/api/deleteApplication
```

HTTP methods should describe the action.

---

# 11. API Response Format

Use a consistent response format.

Successful response:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

Error response:

```json
{
  "success": false,
  "message": "Descriptive error message"
}
```

Do not return completely different response structures across APIs.

---

# 12. HTTP Status Code Rules

Use appropriate HTTP status codes.

| Status Code | Usage                   |
| ----------- | ----------------------- |
| 200         | Successful request      |
| 201         | Resource created        |
| 400         | Invalid request         |
| 401         | Authentication required |
| 403         | Permission denied       |
| 404         | Resource not found      |
| 409         | Duplicate or conflict   |
| 500         | Internal server error   |

---

# 13. Database Rules

## 13.1 Main Collections

Recommended collections:

```text
users
studentProfiles
industryProfiles
academicianProfiles
institutionProfiles
opportunities
applications
assessments
assessmentAttempts
learningPrograms
portfolios
notifications
```

Additional collections may be added only when necessary.

---

## 13.2 Required Metadata

Important documents should generally include:

```js
createdAt
updatedAt
```

Use Mongoose timestamps where appropriate.

---

## 13.3 Ownership

Every resource must clearly identify its owner.

Examples:

* An opportunity belongs to an industry.
* An application belongs to a student.
* A portfolio belongs to a student.

Never allow a user to modify another user's resource unless explicitly authorized.

---

# 14. Skill System Rules

Skills should be normalized as much as possible.

Avoid unnecessary duplicates such as:

```text
React
ReactJS
React.js
react js
```

Prefer a standardized skill representation.

Example:

```js
{
  name: "React",
  category: "Frontend",
  level: "Intermediate"
}
```

Skill categories may include:

* Frontend
* Backend
* Database
* Cloud
* DevOps
* Data Science
* AI/ML
* Soft Skills
* Tools

---

# 15. Skill Assessment Rules

The assessment system should:

1. Present questions.
2. Record answers.
3. Calculate skill scores.
4. Generate a skill profile.
5. Identify strengths.
6. Identify skill gaps.
7. Generate recommendations.

For the MVP, a rule-based scoring system is acceptable.

Do not claim that the system is performing advanced AI evaluation unless such functionality is actually implemented.

---

# 16. Matching and Recommendation Rules

Matching must be understandable.

A recommended opportunity should have a matching score based on factors such as:

* Required skill match
* Skill level
* Career interest
* Eligibility
* Location preference

Example MVP logic:

```text
Match Score =
Skill Match
+ Interest Match
+ Eligibility Match
```

The exact formula can evolve.

---

## 16.1 Explainability

Where possible, show users why an opportunity was recommended.

Example:

> 85% Match — You match 5 out of 6 required skills.

Also display the missing skill:

> Skill Gap: Docker

This makes the recommendation more useful and trustworthy.

---

# 17. Application Workflow Rules

Application status should follow controlled states.

Recommended workflow:

```text
APPLIED
↓
UNDER_REVIEW
↓
SHORTLISTED
↓
INTERVIEW
↓
SELECTED

OR

REJECTED
```

Do not allow arbitrary status values.

Each status update should be recorded.

---

# 18. Opportunity Rules

An opportunity should contain:

* Title
* Type
* Description
* Industry
* Required skills
* Eligibility criteria
* Location
* Deadline
* Status

Opportunity types may include:

* Internship
* Job
* Apprenticeship
* Live Project
* Workshop
* Mentorship
* Training Program
* Faculty Internship
* FDP
* Research Collaboration

Expired opportunities should not accept new applications.

---

# 19. File and Document Rules

Users may upload documents such as:

* Resume
* Certificates
* Project documents
* Internship certificates
* Academic documents

Validate:

* File type
* File size
* User ownership

Do not trust file extensions alone.

For the MVP, use a controlled file storage approach.

---

# 20. AI Feature Rules

AI must be used as an enhancement, not as a dependency for basic functionality.

Possible AI features:

* Career recommendations
* Skill-gap analysis
* Resume analysis
* Learning path generation
* Portfolio suggestions
* Opportunity recommendations

If an external AI API fails:

* The core application must remain functional.
* Display a meaningful fallback message.

Never expose AI API keys in the frontend.

---

# 21. Security Rules

The following are mandatory:

## Authentication

* Hash passwords using bcrypt.
* Use secure JWT handling.
* Protect private routes.
* Validate authentication tokens.

## Authorization

* Verify user roles on the backend.
* Verify resource ownership.

## Input Security

* Validate all request data.
* Sanitize inputs where necessary.
* Never trust frontend validation alone.

## Secrets

Store sensitive configuration in environment variables.

Example:

```env
PORT=5000
MONGODB_URI=
JWT_SECRET=
CLIENT_URL=
AI_API_KEY=
```

Never commit `.env` files.

The `.env` file must be included in `.gitignore`.

---

# 22. Privacy Rules

Student information is sensitive.

Do not expose private information unnecessarily.

Examples of sensitive data:

* Email
* Phone number
* Resume
* Academic information
* Application history

Only authorized users should access relevant information.

---

# 23. Error Handling Rules

Use centralized error handling.

Do not expose:

* Database errors
* JWT secrets
* Stack traces
* Internal implementation details

to end users.

Log detailed errors on the server and return safe messages to the client.

---

# 24. Logging Rules

Important actions should be logged appropriately.

Examples:

* User registration
* Login failure
* Opportunity creation
* Application submission
* Status update
* Critical system errors

Never log:

* Passwords
* Tokens
* Sensitive credentials

---

# 25. Git Workflow Rules

## 25.1 Never Work Directly on Main

The `main` branch should remain stable.

Create a feature branch.

Example:

```text
feature/student-auth
feature/opportunity-api
feature/student-dashboard
feature/skill-assessment
```

---

## 25.2 Branch Naming

Use lowercase and hyphens.

Good:

```text
feature/authentication
feature/student-profile
fix/application-status
```

Avoid:

```text
PankajWork
newBranch
test123
finalfinal
```

---

## 25.3 Commit Messages

Write meaningful commit messages.

Good:

```text
feat: add student registration API
feat: implement opportunity matching
fix: prevent duplicate applications
docs: update API documentation
```

Avoid:

```text
update
changes
final
done
asdf
```

---

# 26. Pull Request Rules

Before merging:

1. Test the feature.
2. Check for obvious errors.
3. Ensure existing features still work.
4. Resolve merge conflicts carefully.
5. Review the changed files.

Do not merge untested code into `main`.

---

# 27. Merge Conflict Rules

If a merge conflict occurs:

1. Do not panic.
2. Identify the conflicting code.
3. Understand both changes.
4. Keep the correct implementation.
5. Test the application after resolving the conflict.

Never randomly delete code just to remove conflict markers.

---

# 28. Code Quality Rules

Before committing:

* Remove unused imports.
* Remove unused variables.
* Remove debug code.
* Remove unnecessary console logs.
* Check for syntax errors.
* Test the feature manually.

Avoid extremely large files where possible.

---

# 29. Naming Rules

Use descriptive names.

Good:

```js
studentProfile
opportunityId
calculateMatchScore
applicationStatus
```

Avoid:

```js
x
data1
temp
abc
func
```

---

# 30. Environment Rules

Maintain separate configuration for:

* Development
* Production

Do not hardcode:

```text
localhost URLs
database credentials
JWT secrets
API keys
```

Use environment variables.

---

# 31. Testing Rules

Before considering a feature complete, test:

## Authentication

* Valid registration
* Duplicate email
* Valid login
* Invalid password
* Unauthorized access

## Opportunities

* Create
* View
* Update
* Delete
* Expired opportunity

## Applications

* Apply
* Duplicate application prevention
* Status updates
* Unauthorized updates

## Role Access

Test that every role can only access allowed resources.

---

# 32. Definition of Done

A feature is considered complete only when:

* The feature works.
* The UI is usable.
* Input validation exists.
* Backend authorization exists.
* Errors are handled.
* Loading states exist where necessary.
* The feature has been manually tested.
* The code has been committed properly.

A feature is not complete just because:

> "The UI looks finished."

---

# 33. Demo Rules

The final demo should focus on one complete story.

Recommended flow:

```text
Student registers
↓
Student completes profile
↓
Student takes skill assessment
↓
System identifies strengths and gaps
↓
System recommends opportunities
↓
Student applies
↓
Industry reviews applicant
↓
Industry updates application status
↓
Student sees updated status
```

This end-to-end flow is more impressive than demonstrating many disconnected screens.

---

# 34. Demo Data Rules

Prepare realistic demo data before the presentation.

Include:

* Multiple students
* Multiple skills
* Multiple industries
* Internship opportunities
* Job opportunities
* Learning programs
* Applications in different statuses

Avoid empty dashboards during the demo.

---

# 35. Hackathon Presentation Rules

When presenting, explain:

## Problem

Students do not clearly understand:

* Which skills industries require
* Where their skill gaps are
* Which opportunities match them

Industries also struggle to find relevant candidates.

## Solution

The platform connects:

```text
Student Skills
        ↓
Skill Assessment
        ↓
Skill Gap Analysis
        ↓
Opportunity Matching
        ↓
Internships and Jobs
        ↓
Skill Development and Career Growth
```

## Demo

Show the complete end-to-end journey.

## Impact

Explain how the system can:

* Improve employability
* Reduce skill gaps
* Improve industry-academia collaboration
* Help industries discover relevant talent
* Help institutions monitor career readiness

---

# 36. AI Coding Assistant Rules

When using AI-assisted development tools:

* Never blindly accept generated code.
* Understand the feature before integrating it.
* Test generated code.
* Check environment variables and secrets.
* Do not allow AI tools to overwrite working code without review.
* Generate features in small, reviewable increments.
* Commit working changes before making large modifications.

Recommended workflow:

```text
Understand feature
↓
Create branch
↓
Implement feature
↓
Run application
↓
Test feature
↓
Fix errors
↓
Commit changes
```

---

# 37. Scope Control Rules

The following are not required for the initial MVP unless time allows:

* Complex machine learning models
* Real-time chat
* Video conferencing
* Complete university ERP integration
* Payment systems
* Full-scale notification infrastructure
* Complex microservice architecture
* Blockchain verification

These can be presented as future scope.

---

# 38. Future Scope

Possible future improvements include:

* Advanced AI recommendation engine
* Resume parsing
* Automated skill extraction
* AI mock interviews
* Real-time industry mentorship
* Video workshops
* Certificate verification
* LinkedIn integration
* Learning platform integration
* Advanced institutional analytics
* National-level deployment
* Predictive placement analytics

---

# 39. Final Golden Rules

Every team member should remember:

1. Keep the architecture simple.
2. Build the core workflow first.
3. Do not overengineer.
4. Protect user data.
5. Validate everything on the backend.
6. Use role-based authorization.
7. Never commit secrets.
8. Write meaningful commits.
9. Test before merging.
10. Keep `main` stable.
11. Prefer reusable components.
12. Do not blindly trust AI-generated code.
13. A complete working demo is better than many unfinished features.
14. Focus on solving the actual problem statement.
15. Build something that judges can understand within a few minutes.

---

# 40. Rule Updates

This document may evolve as the project grows.

When a major architectural or development decision changes:

1. Discuss it with the team.
2. Update the relevant technical documentation.
3. Update this `RULES.md` if the development rules change.

All team members should follow the latest version of this document.

---

## Final Principle

> Build simple. Build clean. Build secure. Build the complete user journey first.

A successful product is not the one with the most features.

A successful product is the one that solves the user's most important problem in the clearest and most reliable way.

````

🔥 **My recommendation:** Put this `RULES.md` in your project's root folder alongside:

```text
academia-industry-portal/
│
├── PRD.md
├── TRD.md
├── RULES.md
├── README.md
│
├── client/
└── server/
````
