# Émargement App — Project Context

## Overview

Digital attendance (émargement) web application for a business school. Professors take roll call on mobile/tablet, present students receive an email with an e-signature link as proof of attendance. Monthly attendance reports sent to parents/tutors. Data sourced from Galia CRM (mock data initially).

**Reference:** [Edusign](https://edusign.com/fr)

## Architecture

- **Monorepo** with separate `frontend/` and `backend/` directories
- **Frontend:** Next.js 16 (App Router, TypeScript, Tailwind CSS 4, SWR, PWA, recharts) → deployed on Vercel
- **Backend:** FastAPI (async SQLAlchemy, Pydantic v2, slowapi rate limiting) → deployed on Railway
- **Database:** Supabase PostgreSQL
- **Auth:** JWT-based (roles: `prof` | `admin` | `student` | `external`)
- **Email:** Resend (signature emails to students + monthly reports to parents)
- **PDF:** ReportLab (monthly attendance reports, certificates)
- **QR Code:** python-qrcode (alternative signing method)
- **CRON:** APScheduler (monthly report generation on 1st of each month)
- **WebSocket:** Real-time signature updates via FastAPI WebSocket
- **Galia CRM:** Adapter pattern — `MockGaliaService` for dev, `GaliaAPIService` for production

## Project Structure

```
emargement-app/
├── frontend/                    # Next.js 16 App Router
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/           # Login page (prof/admin/student/external)
│   │   │   ├── dashboard/       # Prof dashboard (today's courses)
│   │   │   ├── course/[id]/     # Roll call page + live signatures
│   │   │   ├── sign/[token]/    # Student e-signature page (public)
│   │   │   ├── admin/           # Admin dashboard
│   │   │   │   ├── page.tsx     # Stats, justifications, students, audit logs
│   │   │   │   ├── layout.tsx   # Shared nav tabs (Dashboard | Analytique)
│   │   │   │   └── analytics/   # Charts + analytics page (recharts)
│   │   │   ├── student/         # Student dashboard + sign + justify
│   │   │   └── external/        # Tutor/parent dashboard
│   │   ├── components/          # UI components (skeleton, theme-toggle, course-card, etc.)
│   │   ├── hooks/               # SWR hooks (use-auth, use-courses, use-analytics, use-websocket, etc.)
│   │   └── lib/                 # API client, toast, export-chart
│   └── public/                  # PWA manifest, icons
│
├── backend/
│   ├── app/
│   │   ├── api/v1/              # FastAPI routers
│   │   │   ├── auth.py          # POST /login, GET /me
│   │   │   ├── courses.py       # GET /today, GET /{id}/students
│   │   │   ├── attendance.py    # POST /validate, GET /{course_id}, GET /{course_id}/qr
│   │   │   ├── signatures.py    # GET /info/{token}, POST /sign/{token}
│   │   │   ├── admin.py         # GET /stats, GET /students, justifications, audit logs, exports
│   │   │   ├── student.py       # Student endpoints (notifications, sign, justify, history)
│   │   │   ├── analytics.py     # 5 analytics endpoints (admin-only)
│   │   │   ├── external.py      # External (tutor/parent) endpoints
│   │   │   ├── exports.py       # Export endpoints (certificates, OPCO CSV)
│   │   │   └── ws.py            # WebSocket endpoint for live attendance
│   │   ├── models/              # SQLAlchemy models (7+ tables)
│   │   ├── schemas/             # Pydantic schemas (including analytics.py)
│   │   ├── services/
│   │   │   ├── galia.py         # Adapter pattern (mock → real Galia API)
│   │   │   ├── email.py         # Resend email service
│   │   │   ├── email_templates.py # HTML email templates
│   │   │   ├── pdf.py           # ReportLab PDF generation
│   │   │   ├── qrcode.py        # QR code generation
│   │   │   ├── ws_manager.py    # WebSocket connection manager
│   │   │   └── audit.py         # Audit logging service
│   │   ├── tasks/               # CRON jobs (monthly_reports.py)
│   │   └── core/
│   │       ├── config.py        # Settings & environment variables
│   │       ├── database.py      # SQLAlchemy async engine + check_db_health()
│   │       ├── auth.py          # JWT helpers, role dependencies
│   │       ├── middleware.py     # RequestID middleware
│   │       ├── rate_limit.py    # Slowapi rate limiting
│   │       ├── sanitize.py      # Input sanitization (XSS prevention)
│   │       └── exceptions.py    # Global structured JSON error handlers
│   ├── tests/                   # pytest + pytest-asyncio
│   │   ├── conftest.py          # Fixtures (SQLite in-memory, seeded data)
│   │   ├── test_analytics.py    # 15 analytics endpoint tests
│   │   ├── test_error_handler.py # Structured error response tests
│   │   ├── test_middleware.py   # X-Request-ID header tests
│   │   ├── test_rate_limit.py   # Rate limiting tests
│   │   ├── test_sanitize.py     # Input sanitization tests
│   │   ├── test_websocket.py    # WebSocket tests
│   │   └── ...                  # Other test files
│   └── requirements.txt
│
└── docs/plans/                  # Design doc + implementation plan
```

## Data Model (7+ tables)

- **professors** — id, email, first_name, last_name, password_hash, role (prof|admin), galia_id
- **students** — id, email, first_name, last_name, is_alternance, password_hash, galia_id
- **student_contacts** — id, student_id (FK), type (parent|tutor), email, first_name, last_name, company, password_hash
- **courses** — id, name, professor_id (FK), room (string), start_time, end_time, galia_id
- **course_enrollments** — id, course_id (FK), student_id (FK), unique(course_id, student_id)
- **attendance_records** — id, course_id (FK), student_id (FK), status (present|absent|late), marked_by_prof_at, signature_token, signature_token_expires, signed_at, signature_ip, signature_user_agent, signature_data, qr_signed_at
- **monthly_reports** — id, student_id (FK), contact_id (FK), month, total_courses, attended, absent, late, attendance_rate, pdf_url, sent_at
- **justifications** — id, attendance_record_id (FK), student_id (FK), reason, file_paths, status (pending|approved|rejected), reviewed_by, review_comment
- **audit_logs** — id, event_type, actor_type, actor_id, target_type, target_id, ip_address, user_agent, metadata
- **notifications** — id, student_id (FK), type, title, message, data, is_read

## Key User Flows

1. **Prof takes attendance:** Login → Dashboard (today's courses) → Click course → Toggle student statuses → Validate → Emails sent + optional QR code displayed
2. **Student e-signs:** Receives email → Clicks signature link (token, 24h expiry) → Draws signature on pad → IP + user-agent recorded → Real-time WebSocket update to prof
3. **Student signs via QR:** Prof displays QR → Student scans → Same signature page → qr_signed_at recorded
4. **Student justifies absence:** Student dashboard → Click "Justifier" on absent record → Upload reason + files → Admin reviews
5. **Admin analytics:** Admin dashboard → Analytique tab → Charts (trends, courses, at-risk students, professors)
6. **Monthly reports:** CRON on 1st of month → Calculate stats per student → Generate PDF → Email to parents/tutors

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/v1/auth/login | none | Login (prof/admin/student/external) |
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
| GET | /api/v1/admin/justifications | admin | List justifications with filters |
| PATCH | /api/v1/admin/justifications/{id} | admin | Approve/reject justification |
| GET | /api/v1/admin/audit-logs | admin | Audit log entries |
| GET | /api/v1/analytics/attendance-trends | admin | Attendance trends (daily/weekly/monthly) |
| GET | /api/v1/analytics/courses | admin | Per-course attendance stats |
| GET | /api/v1/analytics/students-at-risk | admin | Students below threshold |
| GET | /api/v1/analytics/professors | admin | Per-professor stats |
| GET | /api/v1/analytics/summary | admin | Dashboard aggregations |
| WS | /api/v1/ws/attendance/{course_id} | prof (JWT query) | Real-time signature updates |
| GET | /api/v1/student/notifications | student | Student notifications |
| POST | /api/v1/student/sign/{record_id} | student | Sign attendance record |
| POST | /api/v1/student/justify/{record_id} | student | Submit justification |
| GET | /health | none | Health check with DB status |

## UX Features

- **Dark Mode:** CSS variable-based theming, toggle on all pages, persisted in localStorage
- **Toast Notifications:** react-hot-toast for success/error feedback on all actions
- **Loading Skeletons:** Skeleton components for dashboard, admin, student, and course pages
- **Micro-animations:** fadeIn, slideUp, scaleIn, shimmer, stagger-children
- **Print Styles:** Analytics page prints cleanly (nav hidden, white background)
- **Chart Export:** Per-chart PNG download + browser print button
- **WebSocket Live Updates:** Real-time signature checkmarks on course page
- **Rate Limiting:** Slowapi on login (5/min) and signature (10/min) endpoints
- **Input Sanitization:** XSS prevention on user inputs
- **Structured Errors:** JSON error responses with request_id tracking

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
python -m app.seed           # Seed mock data (3 profs, 15 students, 30 days of courses)
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
- **Professor 2:** marie.bernard@ecole.fr / prof123
- **Admin:** admin@ecole.fr / admin123
- **Students:** alice.martin@etu.fr / student123 (and 14 others)

### Running tests
```bash
cd backend && pytest -v
```

## Deployment

- **Frontend:** Push to `main` → auto-deploy on Vercel
- **Backend:** Push to `main` → auto-deploy on Railway
- Set env vars on each platform (see Environment Variables above)

## Key Dependencies

### Backend
- fastapi, uvicorn, sqlalchemy[asyncio], asyncpg, pydantic, pydantic-settings
- python-jose[cryptography], passlib[bcrypt] (auth)
- resend, reportlab, qrcode[pil] (email, PDF, QR)
- apscheduler, slowapi (scheduling, rate limiting)
- pytest, pytest-asyncio, aiosqlite, httpx (testing)

### Frontend
- next 16, react 19, typescript 5
- swr (data fetching), recharts (charts), react-hot-toast (notifications)
- signature_pad (e-signature drawing), tailwindcss 4

## Design Decisions

- **Rooms as strings** (not separate table) — simplicity, rooms come from Galia
- **E-signature = drawing pad + IP + timestamp** — sufficient for school attendance
- **Signature tokens expire in 24h** — prevents stale links
- **QR code as additional method** — prof can display QR on screen for in-class signing
- **Galia adapter pattern** — develop with mock data, swap to real API when credentials available
- **APScheduler for CRON** — runs inside FastAPI process, no external scheduler needed
- **PWA** — professors can install on mobile home screen for quick access
- **WebSocket per-room** — broadcasts only to the course page being viewed
- **CSS variables for theming** — enables dark mode without class duplication
- **Structured JSON errors** — all errors include request_id for debugging
