# HireSense AI - Resume Screening & Recruitment Assistant

AI-powered resume screening built with Next.js (App Router, JavaScript), MySQL and the OpenAI API.

## Features

- **Roles:** candidate, recruiter and admin accounts (registration + login)
- **Recruiter:** create/publish jobs with required and optional skills, batch resume screening, duplicate detection, ranked candidates, explainable match reports, candidate comparison, interview scheduling with invitation drafts, HR chatbot, analytics, blind screening and a fairness audit
- **Candidate:** resume versions, ATS report, improvement suggestions, skill gap analysis, version comparison, job recommendations, applications tracker, generative career assistant
- **Admin:** user and job management, skills demand analytics, shortlisting statistics, API usage/error monitoring, audit logs, feedback-based shortlist threshold
- **AI safeguards:** extracted details are validated against the resume text (hallucination control)

## Setup

1. Install [Node.js](https://nodejs.org) 18+ and MySQL 8.
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY` and your `MYSQL_*` values.
4. Start the app: `npm run dev` and open http://localhost:3000

The database, tables and sample data are created automatically on the first request.
`database/sample-data.sql` is an optional older snapshot of the sample data.

## Demo accounts (when `SEED_SAMPLE_DATA` is not `false`)

| Role | Email | Password |
|---|---|---|
| Admin | admin@hireai.com | admin123 |
| Recruiter | recruiter@hireai.com | recruiter123 |
| Candidate | candidate@hireai.com | candidate123 |

Change the admin password and `AUTH_SECRET` before deploying anywhere public.

## Notes

- Resumes: PDF and TXT only. Interview invitations open as email drafts; nothing is sent automatically.
- AI scores assist HR; the final hiring decision is always human.
