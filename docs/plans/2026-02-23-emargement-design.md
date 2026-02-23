# Digital Attendance (Émargement) App — Design Document

**Date:** 2026-02-23
**Project:** emargement-app
**Reference:** [Edusign](https://edusign.com/fr)

## Overview

Digital attendance web application for a business school. Professors take attendance on mobile/tablet, present students receive an email with an e-signature link as proof of attendance. Monthly reports sent to parents/tutors of alternance students. Data sourced from Galia CRM (mock data initially).

## Decisions

| Decision | Choice |
|----------|--------|
| Stack | Next.js + FastAPI + Supabase (monorepo) |
| Auth | Supabase Auth email/password |
| E-signature | Simple confirmation + IP + timestamp |
| Galia API | Mock data first, adapter pattern for future integration |
| Reports | Email + PDF attachment, monthly CRON |
| Email service | Resend |
| Rooms | String field in courses table (no separate table) |
| QR Code | Yes, as additional signing method |
| Admin dashboard | Yes, included in MVP |

## Data Model

### professors
| Column | Type | Notes |
|--------|------|-------|
| id | uuid, PK | |
| email | text, unique | |
| first_name | text | |
| last_name | text | |
| galia_id | text, nullable | Future Galia link |
| created_at | timestamptz | |

### students
| Column | Type | Notes |
|--------|------|-------|
| id | uuid, PK | |
| email | text, unique | |
| first_name | text | |
| last_name | text | |
| is_alternance | boolean | |
| galia_id | text, nullable | |
| created_at | timestamptz | |

### student_contacts (parents/tuteurs)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid, PK | |
| student_id | uuid, FK → students | |
| type | text | parent or tutor |
| email | text | |
| first_name | text | |
| last_name | text | |
| company | text, nullable | For alternance tutors |
| created_at | timestamptz | |

### courses
| Column | Type | Notes |
|--------|------|-------|
| id | uuid, PK | |
| name | text | |
| professor_id | uuid, FK → professors | |
| room | text | Room name string |
| start_time | timestamptz | |
| end_time | timestamptz | |
| galia_id | text, nullable | |
| created_at | timestamptz | |

### course_enrollments
| Column | Type | Notes |
|--------|------|-------|
| id | uuid, PK | |
| course_id | uuid, FK → courses | |
| student_id | uuid, FK → students | |
| created_at | timestamptz | |

### attendance_records
| Column | Type | Notes |
|--------|------|-------|
| id | uuid, PK | |
| course_id | uuid, FK → courses | |
| student_id | uuid, FK → students | |
| status | text | present, absent, late |
| marked_by_prof_at | timestamptz | When prof validates |
| signature_token | uuid | Unique token for email link |
| signature_token_expires | timestamptz | 24h expiry |
| signed_at | timestamptz, nullable | When student e-signs |
| signature_ip | text, nullable | |
| signature_user_agent | text, nullable | |
| qr_signed_at | timestamptz, nullable | If signed via QR |
| created_at | timestamptz | |

### monthly_reports
| Column | Type | Notes |
|--------|------|-------|
| id | uuid, PK | |
| student_id | uuid, FK → students | |
| contact_id | uuid, FK → student_contacts | |
| month | date | First day of month |
| total_courses | int | |
| attended | int | |
| absent | int | |
| late | int | |
| attendance_rate | decimal | Percentage |
| pdf_url | text | Stored PDF URL |
| sent_at | timestamptz | |
| created_at | timestamptz | |

## User Flows

### Flow 1: Professor Takes Attendance

1. Prof opens app on mobile/tablet
2. Logs in via email/password (Supabase Auth)
3. Sees dashboard with today's courses (name, room, time)
4. Clicks "Start attendance" on a course (available when course time starts)
5. Sees enrolled student list with checkboxes
6. Checks present students, submits
7. Backend creates attendance_records, sends emails to present students via Resend
8. Optionally displays QR code for in-class signature

### Flow 2: Student E-Signs via Email

1. Student receives email with course info and signature link
2. Clicks link (contains unique token, expires in 24h)
3. Lands on public signature page (no login required)
4. Sees course details, clicks "I confirm my presence"
5. Backend records: signed_at, IP, user_agent

### Flow 3: Student Signs via QR Code

1. Professor displays QR code on screen during class
2. Student scans QR with phone
3. Same signature page as Flow 2
4. Backend records: qr_signed_at

### Flow 4: Monthly Parent/Tutor Reports

1. CRON job runs on 1st of each month
2. For each student: calculates monthly stats (attended, absent, late, rate)
3. Generates PDF report with course-by-course breakdown
4. Sends email to each student_contact with PDF attachment
5. Stores report in monthly_reports table

## Architecture

### Project Structure

```
emargement-app/
├── frontend/                    # Next.js 14+ App Router
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/          # Login
│   │   │   ├── dashboard/       # Prof dashboard
│   │   │   ├── course/[id]/     # Attendance for a course
│   │   │   ├── sign/[token]/    # Student e-signature (public)
│   │   │   └── admin/           # Admin dashboard
│   │   ├── components/
│   │   ├── hooks/               # SWR hooks
│   │   └── lib/                 # Utils, API client
│   └── next.config.js           # PWA config
│
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── auth.py
│   │   │   ├── courses.py
│   │   │   ├── attendance.py
│   │   │   ├── signatures.py
│   │   │   ├── reports.py
│   │   │   └── admin.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   │   ├── galia.py         # Adapter pattern (mock → real)
│   │   │   ├── email.py         # Resend
│   │   │   ├── pdf.py           # Report PDF generation
│   │   │   └── qrcode.py
│   │   ├── tasks/               # CRON jobs
│   │   └── core/                # Config, DB, auth
│   └── requirements.txt
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/auth/login | Professor login |
| GET | /api/v1/courses/today | Today's courses for logged-in prof |
| GET | /api/v1/courses/{id}/students | Enrolled students for a course |
| POST | /api/v1/attendance/validate | Prof validates attendance (triggers emails) |
| GET | /api/v1/attendance/{course_id}/qr | Generate QR code for a course |
| POST | /api/v1/signatures/{token} | Student e-signs via link/QR |
| GET | /api/v1/admin/stats | Global attendance stats |
| GET | /api/v1/admin/students | Students list with attendance rates |
| POST | /api/v1/reports/generate | Trigger monthly report generation |

### Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, SWR |
| PWA | next-pwa |
| Backend | FastAPI, SQLAlchemy async, Pydantic v2 |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (email/password) |
| Email | Resend |
| PDF | ReportLab or WeasyPrint |
| QR Code | python-qrcode |
| CRON | APScheduler |
| Deploy | Vercel (frontend) + Railway (backend) |

### Galia Adapter Pattern

```python
class GaliaServiceInterface(ABC):
    async def get_courses(self, professor_id, date) -> list[Course]
    async def get_students(self, course_id) -> list[Student]
    async def sync_attendance(self, records) -> None

class MockGaliaService(GaliaServiceInterface):
    """Mock data for development"""

class GaliaAPIService(GaliaServiceInterface):
    """Real Galia API — plug in later"""
```

## Admin Dashboard

### Features

- **Global view:** School-wide attendance rate (today/week/month), courses today, expected vs present students, alerts for students < 70%
- **Student view:** Search/filter by name/promo/formation, detailed attendance history, individual rate, linked contacts
- **Course view:** Attendance history per course, presence rate per course/prof
- **Management:** CRUD professors, students, contacts (until Galia sync is live). Manual report trigger.

### Access Control

Admin uses same web app with `admin` role in Supabase Auth user metadata. Role field: `prof` | `admin`.

## Scalability

- Next.js on Vercel: CDN, auto-scaling serverless functions
- FastAPI async: handles 1000+ concurrent requests per worker
- Supabase: PgBouncer connection pooling, handles thousands of connections
- Peak load (email signing): simple POST request, lightweight
