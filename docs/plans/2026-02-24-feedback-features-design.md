# Feedback Features Design — 2026-02-24

## Goal

Implement all 9 feedback features from the New Features document: admin profiles, justification detail view, clickable KPIs, header improvements, professor history, editable attendance, student analytics, and CSV export fix.

## Features Summary

| # | Feature | Area | New Routes | New Endpoints |
|---|---------|------|------------|---------------|
| 1 | Justification detail page | Admin | `/admin/justifications/[id]` | `GET /admin/justifications/{id}`, `POST /admin/justifications/{id}/comment` |
| 2 | Student profile page | Admin | `/admin/students/[id]` | `GET /admin/students/{id}/profile` |
| 3 | Professor profile page | Admin | `/admin/professors/[id]` | `GET /admin/professors/{id}/profile` |
| 4 | Fix CSV export | Admin | — | Fix existing endpoint/frontend |
| 5 | Clickable KPIs | Analytics | `/admin/analytics/students-at-risk` | Uses existing endpoint |
| 6 | Improved header | Admin | — | — |
| 7 | Professor course history | Professor | `/dashboard/history` | `GET /courses/history` |
| 8 | Editable attendance | Professor | — | Verify existing `PUT /attendance/validate` |
| 9 | Student analytics | Student | — (section on dashboard) | `GET /student/analytics` |

## Architecture: Page-per-feature

Each feature gets a new Next.js App Router page + backend endpoint + SWR hook, following existing patterns.

---

## Section 1: Admin Header

**File**: `frontend/src/app/admin/layout.tsx`

Restructure admin layout header:
- Left: App logo/name
- Center: Navigation tabs (Dashboard | Analytique) — existing
- Right: Theme toggle (`ThemeToggle` component) + user name + Logout button

Add breadcrumb support below header for nested pages (e.g., `Admin > Etudiants > Alice Martin`).

---

## Section 2: Student Profile Page

### Backend: `GET /admin/students/{id}/profile`

**File**: `backend/app/api/v1/admin.py`

Response:
```json
{
  "student": { "id": "...", "email": "...", "first_name": "...", "last_name": "...", "is_alternance": true },
  "stats": { "total_courses": 45, "attended": 38, "absent": 5, "late": 2, "attendance_rate": 84.4 },
  "by_course": [{ "course_name": "Maths", "total": 10, "attended": 8, "absent": 2, "late": 0, "rate": 80.0 }],
  "by_professor": [{ "professor_name": "Jean Dupont", "total": 15, "attended": 13, "absent": 1, "late": 1, "rate": 86.7 }],
  "recent_absences": [{ "course_name": "Maths", "date": "2026-02-20", "status": "absent", "justification_status": "pending" }],
  "justifications": [{ "id": "...", "course_name": "Maths", "date": "2026-02-20", "reason": "Maladie", "status": "pending" }]
}
```

### Frontend: `/admin/students/[id]/page.tsx`

- Student info header with overall stats cards
- Tabbed sections: Par matiere | Par professeur | Absences recentes | Justificatifs
- Each row in absences links to justification detail if exists

### Linking

Make all student names in admin dashboard, analytics, and justification list into `<Link href="/admin/students/{id}">`.

---

## Section 3: Professor Profile Page

### Backend: `GET /admin/professors/{id}/profile`

**File**: `backend/app/api/v1/admin.py`

Response:
```json
{
  "professor": { "id": "...", "email": "...", "first_name": "...", "last_name": "...", "role": "prof" },
  "stats": { "total_courses_given": 30, "total_students": 45, "avg_attendance_rate": 88.5 },
  "courses": [{ "course_name": "Maths", "date": "2026-02-20", "student_count": 15, "attendance_rate": 93.3 }],
  "by_course_name": [{ "course_name": "Maths", "total_sessions": 10, "avg_rate": 90.0 }]
}
```

### Frontend: `/admin/professors/[id]/page.tsx`

- Professor info header + stats cards
- Table of courses given with attendance rates
- Aggregated stats by course name

### Linking

Make all professor names in admin dashboard clickable links.

---

## Section 4: Justification Detail Page

### Backend

**`GET /admin/justifications/{id}`** — Full detail with conversation thread
**`POST /admin/justifications/{id}/comment`** — Add comment, notify student

New model: `JustificationComment` table
- `id` (UUID), `justification_id` (FK), `author_type` (admin|student), `author_id`, `message`, `created_at`

Response for GET:
```json
{
  "id": "...", "student_name": "...", "student_email": "...",
  "course_name": "...", "course_date": "...",
  "reason": "Maladie", "file_urls": ["/uploads/justifications/file.pdf"],
  "status": "pending", "reviewed_by_name": null, "comment": null,
  "comments": [{ "author_name": "Admin", "author_type": "admin", "message": "Pouvez-vous fournir un certificat?", "created_at": "..." }]
}
```

### Frontend: `/admin/justifications/[id]/page.tsx`

- Student and course info header
- File viewer (images inline, PDF/other as download links)
- Conversation thread with admin comments and student responses
- Action bar: Approve | Reject | Add comment (with textarea)
- Adding a comment sends notification to student

### Student Side

Student receives notification with `justification_id` in `data`. Clicking it opens a response form in the student dashboard.

---

## Section 5: Clickable KPIs

**File**: `frontend/src/app/admin/analytics/page.tsx`

Make each summary stat card a clickable link:
- "Total Etudiants" → scroll to or link to students section
- "Etudiants a Risque" → `/admin/analytics/students-at-risk` (new detail page)
- Trend % → scroll to trends chart

### New Page: `/admin/analytics/students-at-risk/page.tsx`

Full-page sortable table of at-risk students using existing `useStudentsAtRisk()` hook. Each student name links to `/admin/students/{id}`.

---

## Section 6: Fix CSV Export

Investigate and fix the audit logs CSV export. Likely issue in `downloadBlob()` in `use-admin.ts` or the backend response format.

---

## Section 7: Professor Course History

### Backend: `GET /courses/history`

**File**: `backend/app/api/v1/courses.py`

Response:
```json
{
  "courses": [{
    "id": "...", "name": "Maths", "room": "A101",
    "date": "2026-02-20", "start_time": "08:00", "end_time": "10:00",
    "student_count": 15, "present_count": 13, "absent_count": 1, "late_count": 1,
    "is_validated": true
  }],
  "total": 30
}
```

### Frontend: `/dashboard/history/page.tsx`

Table of past courses with date, name, room, attendance breakdown. Each row links to `/course/{id}`.

Add "Historique" link/button on the professor dashboard.

---

## Section 8: Editable Attendance

Backend already has `PUT /attendance/validate` and `isEditable` flag. Verify end-to-end:
- "Editer" button appears after validation, before course end time
- "Validé" badge visible alongside Edit button
- Changes submit via PUT and create audit log entry

---

## Section 9: Student Analytics

### Backend: `GET /student/analytics`

**File**: `backend/app/api/v1/student.py`

Response:
```json
{
  "stats": { "total_courses": 45, "attended": 38, "absent": 5, "late": 2, "rate": 84.4 },
  "by_course": [{ "course_name": "Maths", "total": 10, "attended": 8, "absent": 2, "late": 0, "rate": 80.0 }],
  "by_professor": [{ "professor_name": "Jean Dupont", "total": 15, "attended": 13, "absent": 1, "late": 1, "rate": 86.7 }]
}
```

### Frontend: New section on `/student/page.tsx`

- Overall stats cards at top
- Collapsible "Mes statistiques" section
- Two tables: "Par matiere" and "Par professeur"
