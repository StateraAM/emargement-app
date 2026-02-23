# Émargement App — Project Context

## Overview

Digital attendance (émargement) web application for a business school. Professors take roll call on mobile/tablet, present students receive an email with an e-signature link as proof of attendance. Monthly attendance reports sent to parents/tutors. Data sourced from Galia CRM (mock data initially).

**Reference:** [Edusign](https://edusign.com/fr)

## Architecture

- **Monorepo** with separate `frontend/` and `backend/` directories
- **Frontend:** Next.js 14 (App Router, TypeScript, Tailwind CSS, SWR, PWA) → deployed on Vercel
- **Backend:** FastAPI (async SQLAlchemy, Pydantic v2) → deployed on Railway
- **Database:** Supabase PostgreSQL
- **Auth:** Supabase Auth email/password (JWT-based, roles: `prof` | `admin`)
- **Email:** Resend (signature emails to students + monthly reports to parents)
- **PDF:** ReportLab (monthly attendance reports)
- **QR Code:** python-qrcode (alternative signing method)
- **CRON:** APScheduler (monthly report generation on 1st of each month)
- **Galia CRM:** Adapter pattern — `MockGaliaService` for dev, `GaliaAPIService` for production (API access pending)

## Project Structure

```
emargement-app/
├── frontend/                    # Next.js 14 App Router
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/           # Prof login page
│   │   │   ├── dashboard/       # Prof dashboard (today's courses)
│   │   │   ├── course/[id]/     # Roll call page
│   │   │   ├── sign/[token]/    # Student e-signature page (public)
│   │   │   └── admin/           # Admin dashboard
│   │   ├── components/          # Reusable UI components
│   │   ├── hooks/               # SWR hooks (use-auth, use-courses, use-attendance, use-admin)
│   │   └── lib/                 # API client, utilities
│   └── public/                  # PWA manifest, icons
│
├── backend/
│   ├── app/
│   │   ├── api/v1/              # FastAPI routers
│   │   │   ├── auth.py          # POST /login, GET /me
│   │   │   ├── courses.py       # GET /today, GET /{id}/students
│   │   │   ├── attendance.py    # POST /validate, GET /{course_id}, GET /{course_id}/qr
│   │   │   ├── signatures.py    # GET /info/{token}, POST /sign/{token}
│   │   │   ├── reports.py       # POST /generate
│   │   │   └── admin.py         # GET /stats, GET /students (admin-only)
│   │   ├── models/              # SQLAlchemy models (7 tables)
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── galia.py         # Adapter pattern (mock → real Galia API)
│   │   │   ├── email.py         # Resend email service
│   │   │   ├── pdf.py           # ReportLab PDF generation
│   │   │   └── qrcode.py        # QR code generation
│   │   ├── tasks/               # CRON jobs (monthly_reports.py)
│   │   └── core/                # config.py, database.py, auth.py
│   ├── tests/                   # pytest + pytest-asyncio
│   ├── alembic/                 # Database migrations
│   └── requirements.txt
│
└── docs/plans/                  # Design doc + implementation plan
```

## Data Model (7 tables)

- **professors** — id, email, first_name, last_name, password_hash, role (prof|admin), galia_id
- **students** — id, email, first_name, last_name, is_alternance, galia_id
- **student_contacts** — id, student_id (FK), type (parent|tutor), email, first_name, last_name, company
- **courses** — id, name, professor_id (FK), room (string), start_time, end_time, galia_id
- **course_enrollments** — id, course_id (FK), student_id (FK), unique(course_id, student_id)
- **attendance_records** — id, course_id (FK), student_id (FK), status (present|absent|late), marked_by_prof_at, signature_token, signature_token_expires, signed_at, signature_ip, signature_user_agent, qr_signed_at
- **monthly_reports** — id, student_id (FK), contact_id (FK), month, total_courses, attended, absent, late, attendance_rate, pdf_url, sent_at

## Key User Flows

1. **Prof takes attendance:** Login → Dashboard (today's courses) → Click course → Toggle student statuses → Validate → Emails sent + optional QR code displayed
2. **Student e-signs:** Receives email → Clicks signature link (token, 24h expiry) → Confirms presence → IP + user-agent recorded
3. **Student signs via QR:** Prof displays QR → Student scans → Same signature page → qr_signed_at recorded
4. **Monthly reports:** CRON on 1st of month → Calculate stats per student → Generate PDF → Email to parents/tutors

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/v1/auth/login | none | Professor login |
| GET | /api/v1/auth/me | prof | Current professor info |
| GET | /api/v1/courses/today | prof | Today's courses for logged-in prof |
| GET | /api/v1/courses/{id}/students | prof | Enrolled students for a course |
| POST | /api/v1/attendance/validate | prof | Validate attendance (triggers emails) |
| GET | /api/v1/attendance/{course_id} | prof | Get attendance records for a course |
| GET | /api/v1/attendance/{course_id}/qr | prof | Generate QR code PNG |
| GET | /api/v1/signatures/info/{token} | none | Get signature info (public) |
| POST | /api/v1/signatures/sign/{token} | none | E-sign attendance (public) |
| GET | /api/v1/admin/stats | admin | Global attendance stats |
| GET | /api/v1/admin/students | admin | Students with attendance rates |
| POST | /api/v1/reports/generate | admin | Trigger monthly report generation |

## Environment Variables

### Backend (.env)
- `DATABASE_URL` — Supabase PostgreSQL connection string (asyncpg)
- `JWT_SECRET` — Secret key for JWT tokens
- `RESEND_API_KEY` — Resend email API key (empty = dev mode, logs to console)
- `FRONTEND_URL` — Frontend URL for email links (default: http://localhost:3000)
- `CORS_ORIGINS` — Comma-separated allowed origins
- `GALIA_MOCK` — `true` for mock data, `false` for real Galia API

### Frontend (.env.local)
- `NEXT_PUBLIC_API_URL` — Backend URL (default: http://localhost:8000)

## Development

### Backend
```bash
cd backend
pip install -r requirements.txt
python -m app.seed           # Seed mock data
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                  # http://localhost:3000
```

### Test accounts (seeded)
- **Professor:** jean.dupont@ecole.fr / password123
- **Admin:** admin@ecole.fr / admin123

### Running tests
```bash
cd backend && pytest -v
```

## Deployment

- **Frontend:** Push to `main` → auto-deploy on Vercel
- **Backend:** Push to `main` → auto-deploy on Railway
- Set env vars on each platform (see Environment Variables above)

## Design Decisions

- **Rooms as strings** (not separate table) — simplicity, rooms come from Galia
- **E-signature = simple confirmation + IP + timestamp** — sufficient for school attendance, not legally binding signature
- **Signature tokens expire in 24h** — prevents stale links
- **QR code as additional method** — prof can display QR on screen for in-class signing
- **Galia adapter pattern** — develop with mock data, swap to real API when credentials available
- **APScheduler for CRON** — runs inside FastAPI process, no external scheduler needed
- **PWA** — professors can install on mobile home screen for quick access
