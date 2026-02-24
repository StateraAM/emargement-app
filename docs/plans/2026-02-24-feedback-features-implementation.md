# Feedback Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all 9 feedback features: admin header, CSV fix, student/professor profiles, justification details, clickable KPIs, professor history, editable attendance verification, and student analytics.

**Architecture:** Page-per-feature approach using Next.js App Router pages + FastAPI backend endpoints + SWR hooks. Each feature follows existing patterns: new route → new endpoint → new hook → new page component.

**Tech Stack:** Next.js 16 (App Router, TypeScript, Tailwind), FastAPI (async SQLAlchemy, Pydantic v2), SWR, recharts, CSS variables theming.

---

## Task 1: Admin Header Improvements

**Files:**
- Modify: `frontend/src/app/admin/layout.tsx`

**Step 1: Rewrite admin layout with proper header**

Replace the entire `frontend/src/app/admin/layout.tsx` with a layout that includes:
- Full-width header bar with: app name left, nav tabs center, theme toggle + user name + logout button right
- Breadcrumb component below header that reads from `usePathname()` and maps segments to French labels
- Keep the existing tab active state logic

```tsx
"use client";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/theme-toggle";

const breadcrumbLabels: Record<string, string> = {
  admin: "Admin",
  analytics: "Analytique",
  students: "Etudiants",
  professors: "Professeurs",
  justifications: "Justificatifs",
  "students-at-risk": "Etudiants a risque",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { professor, logout } = useAuth();

  const tabs = [
    { label: "Dashboard", href: "/admin" },
    { label: "Analytique", href: "/admin/analytics" },
  ];

  // Build breadcrumbs from pathname segments (skip if on /admin root)
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.length > 1
    ? segments.map((seg, i) => ({
        label: breadcrumbLabels[seg] || decodeURIComponent(seg),
        href: "/" + segments.slice(0, i + 1).join("/"),
        isLast: i === segments.length - 1,
      }))
    : [];

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Header */}
      <header className="bg-[var(--color-primary)] text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Emargement
          </h1>
          <div className="flex items-center gap-3">
            {professor && (
              <span className="text-sm text-white/80 hidden sm:inline">
                {professor.first_name} {professor.last_name}
              </span>
            )}
            <ThemeToggle />
            <button
              onClick={() => { logout(); router.push("/login"); }}
              className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Quitter
            </button>
          </div>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="bg-[var(--color-surface-card)] border-b border-[var(--color-border-light)] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const isActive = tab.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`relative px-4 py-3 text-sm font-semibold transition-colors ${
                    isActive
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-accent)] rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 1 && (
        <div className="max-w-6xl mx-auto px-4 py-2">
          <nav className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.href} className="flex items-center gap-1">
                {i > 0 && <span>/</span>}
                {crumb.isLast ? (
                  <span className="text-[var(--color-text)] font-medium">{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className="hover:text-[var(--color-text)] transition-colors">
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        </div>
      )}

      {children}
    </div>
  );
}
```

**Step 2: Run frontend dev to verify**

Run: `cd frontend && npm run dev`
Expected: Admin pages now show header with logout + theme toggle + breadcrumbs on nested pages.

**Step 3: Commit**

```bash
git add frontend/src/app/admin/layout.tsx
git commit -m "feat: improve admin header with logout, theme toggle, breadcrumbs"
```

---

## Task 2: Fix CSV Export

**Files:**
- Modify: `frontend/src/app/admin/page.tsx:514-520`

**Step 1: Investigate the CSV export issue**

The current CSV export button at line 514-520 uses a plain `<a>` tag pointing to the backend URL directly. This won't work because:
1. The endpoint requires admin auth (JWT token) but `<a>` tags don't send Authorization headers
2. The backend endpoint at `admin.py:300-327` does work — it's the auth that's missing

**Step 2: Fix by using a fetch + downloadBlob pattern**

In `frontend/src/app/admin/page.tsx`, replace the CSV export link (lines 514-520) with a button that uses a fetcher with auth token:

Replace:
```tsx
<a
  href={`${API_URL}/api/v1/admin/audit-logs/export-csv`}
  target="_blank"
  rel="noopener noreferrer"
  onClick={(e) => e.stopPropagation()}
  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
>
  Exporter CSV
</a>
```

With:
```tsx
<button
  onClick={async (e) => {
    e.stopPropagation();
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const resp = await fetch(`${API_URL}/api/v1/admin/audit-logs/export-csv`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) throw new Error("Export failed");
      const blob = await resp.blob();
      downloadBlob(blob, "audit_logs.csv");
      showToast.success("Export CSV telecharge.");
    } catch {
      showToast.error("Erreur lors de l'export CSV.");
    }
  }}
  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
>
  Exporter CSV
</button>
```

**Step 3: Verify**

Login as admin, go to audit logs section, click "Exporter CSV". Should download a CSV file.

**Step 4: Commit**

```bash
git add frontend/src/app/admin/page.tsx
git commit -m "fix: CSV export now sends auth token via fetch instead of plain link"
```

---

## Task 3: Student Profile — Backend

**Files:**
- Modify: `backend/app/api/v1/admin.py` (add new endpoint after line 114)

**Step 1: Add GET /admin/students/{student_id}/profile endpoint**

Add this endpoint in `backend/app/api/v1/admin.py` after the `get_students` function (after line 114):

```python
@router.get("/students/{student_id}/profile")
async def get_student_profile(
    student_id: str,
    db: AsyncSession = Depends(get_db),
):
    student = await db.get(Student, UUID(student_id))
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Overall stats
    total = (await db.execute(
        select(func.count(AttendanceRecord.id)).where(AttendanceRecord.student_id == student.id)
    )).scalar() or 0
    attended = (await db.execute(
        select(func.count(AttendanceRecord.id))
        .where(AttendanceRecord.student_id == student.id, AttendanceRecord.status == "present")
    )).scalar() or 0
    absent = (await db.execute(
        select(func.count(AttendanceRecord.id))
        .where(AttendanceRecord.student_id == student.id, AttendanceRecord.status == "absent")
    )).scalar() or 0
    late = (await db.execute(
        select(func.count(AttendanceRecord.id))
        .where(AttendanceRecord.student_id == student.id, AttendanceRecord.status == "late")
    )).scalar() or 0
    rate = round((attended / total * 100), 1) if total > 0 else 0

    # Stats by course name
    course_stmt = (
        select(
            Course.name,
            func.count(AttendanceRecord.id).label("total"),
            func.count().filter(AttendanceRecord.status == "present").label("attended"),
            func.count().filter(AttendanceRecord.status == "absent").label("absent"),
            func.count().filter(AttendanceRecord.status == "late").label("late"),
        )
        .join(Course, Course.id == AttendanceRecord.course_id)
        .where(AttendanceRecord.student_id == student.id)
        .group_by(Course.name)
        .order_by(Course.name)
    )
    course_rows = (await db.execute(course_stmt)).all()
    by_course = [
        {
            "course_name": row.name,
            "total": row.total,
            "attended": row.attended,
            "absent": row.absent,
            "late": row.late,
            "rate": round(row.attended / row.total * 100, 1) if row.total > 0 else 0,
        }
        for row in course_rows
    ]

    # Stats by professor
    prof_stmt = (
        select(
            Professor.first_name,
            Professor.last_name,
            func.count(AttendanceRecord.id).label("total"),
            func.count().filter(AttendanceRecord.status == "present").label("attended"),
            func.count().filter(AttendanceRecord.status == "absent").label("absent"),
            func.count().filter(AttendanceRecord.status == "late").label("late"),
        )
        .join(Course, Course.id == AttendanceRecord.course_id)
        .join(Professor, Professor.id == Course.professor_id)
        .where(AttendanceRecord.student_id == student.id)
        .group_by(Professor.id)
        .order_by(Professor.last_name)
    )
    prof_rows = (await db.execute(prof_stmt)).all()
    by_professor = [
        {
            "professor_name": f"{row.first_name} {row.last_name}",
            "total": row.total,
            "attended": row.attended,
            "absent": row.absent,
            "late": row.late,
            "rate": round(row.attended / row.total * 100, 1) if row.total > 0 else 0,
        }
        for row in prof_rows
    ]

    # Recent absences
    absence_stmt = (
        select(AttendanceRecord, Course, Justification)
        .join(Course, Course.id == AttendanceRecord.course_id)
        .outerjoin(Justification, Justification.attendance_record_id == AttendanceRecord.id)
        .where(AttendanceRecord.student_id == student.id)
        .where(AttendanceRecord.status.in_(["absent", "late"]))
        .order_by(Course.start_time.desc())
        .limit(20)
    )
    absence_rows = (await db.execute(absence_stmt)).all()
    recent_absences = [
        {
            "course_name": course.name,
            "date": course.start_time.strftime("%d/%m/%Y %H:%M"),
            "status": record.status,
            "justification_status": justif.status if justif else None,
        }
        for record, course, justif in absence_rows
    ]

    # Justifications
    justif_stmt = (
        select(Justification, Course)
        .join(AttendanceRecord, AttendanceRecord.id == Justification.attendance_record_id)
        .join(Course, Course.id == AttendanceRecord.course_id)
        .where(Justification.student_id == student.id)
        .order_by(Justification.created_at.desc())
    )
    justif_rows = (await db.execute(justif_stmt)).all()
    justifications_list = [
        {
            "id": str(j.id),
            "course_name": course.name,
            "date": course.start_time.strftime("%d/%m/%Y %H:%M"),
            "reason": j.reason,
            "status": j.status,
        }
        for j, course in justif_rows
    ]

    return {
        "student": {
            "id": str(student.id),
            "email": student.email,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "is_alternance": student.is_alternance,
        },
        "stats": {
            "total_courses": total,
            "attended": attended,
            "absent": absent,
            "late": late,
            "attendance_rate": rate,
        },
        "by_course": by_course,
        "by_professor": by_professor,
        "recent_absences": recent_absences,
        "justifications": justifications_list,
    }
```

**Step 2: Run backend to verify endpoint works**

Run: `cd backend && uvicorn app.main:app --reload --port 8000`
Test: `curl -H "Authorization: Bearer <admin-token>" http://localhost:8000/api/v1/admin/students/<student-id>/profile`

**Step 3: Commit**

```bash
git add backend/app/api/v1/admin.py
git commit -m "feat: add student profile endpoint with analytics by course/professor"
```

---

## Task 4: Student Profile — Frontend

**Files:**
- Create: `frontend/src/app/admin/students/[id]/page.tsx`
- Modify: `frontend/src/hooks/use-admin.ts` (add new hook)
- Modify: `frontend/src/app/admin/page.tsx` (make student names clickable)

**Step 1: Add hook in `frontend/src/hooks/use-admin.ts`**

Add at the end of the file:

```typescript
export interface StudentProfile {
  student: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    is_alternance: boolean;
  };
  stats: {
    total_courses: number;
    attended: number;
    absent: number;
    late: number;
    attendance_rate: number;
  };
  by_course: { course_name: string; total: number; attended: number; absent: number; late: number; rate: number }[];
  by_professor: { professor_name: string; total: number; attended: number; absent: number; late: number; rate: number }[];
  recent_absences: { course_name: string; date: string; status: string; justification_status: string | null }[];
  justifications: { id: string; course_name: string; date: string; reason: string; status: string }[];
}

export function useStudentProfile(studentId: string) {
  return useSWR<StudentProfile>(studentId ? `admin-student-profile-${studentId}` : null, {
    fetcher: () => api.get<StudentProfile>(`/api/v1/admin/students/${studentId}/profile`),
  });
}
```

**Step 2: Create student profile page**

Create `frontend/src/app/admin/students/[id]/page.tsx` — a tabbed page showing student info, stats cards, and four tab sections (by course, by professor, recent absences, justifications). Each tab renders a table following the existing table patterns in the admin page. Use CSS variable theming and the existing badge styles.

**Step 3: Make student names clickable in admin dashboard**

In `frontend/src/app/admin/page.tsx`, wrap the student name cells (around line 354-361) with `<Link>`:

Replace the `<td>` at lines 354-361 from:
```tsx
<td className="px-5 py-3.5">
  <span className="font-semibold text-[var(--color-text)]">
    {s.last_name}
  </span>{" "}
  <span className="text-[var(--color-text-secondary)]">
    {s.first_name}
  </span>
</td>
```

To:
```tsx
<td className="px-5 py-3.5">
  <Link href={`/admin/students/${s.id}`} className="hover:underline">
    <span className="font-semibold text-[var(--color-text)]">
      {s.last_name}
    </span>{" "}
    <span className="text-[var(--color-text-secondary)]">
      {s.first_name}
    </span>
  </Link>
</td>
```

Add `import Link from "next/link";` at top of file.

Also make student names clickable in the justifications table (line 149) and analytics at-risk table.

**Step 4: Commit**

```bash
git add frontend/src/app/admin/students/[id]/page.tsx frontend/src/hooks/use-admin.ts frontend/src/app/admin/page.tsx
git commit -m "feat: add student profile page with analytics by course/professor"
```

---

## Task 5: Professor Profile — Backend

**Files:**
- Modify: `backend/app/api/v1/admin.py` (add new endpoint after professors list)

**Step 1: Add GET /admin/professors/{professor_id}/profile endpoint**

Add after the `get_professors` function (after line 82):

```python
@router.get("/professors/{professor_id}/profile")
async def get_professor_profile(
    professor_id: str,
    db: AsyncSession = Depends(get_db),
):
    professor = await db.get(Professor, UUID(professor_id))
    if not professor:
        raise HTTPException(status_code=404, detail="Professor not found")

    # Courses taught with attendance stats
    course_stmt = (
        select(
            Course.id,
            Course.name,
            Course.room,
            Course.start_time,
            func.count(AttendanceRecord.id).label("student_count"),
            func.count().filter(AttendanceRecord.status == "present").label("present"),
            func.count().filter(AttendanceRecord.status == "absent").label("absent"),
            func.count().filter(AttendanceRecord.status == "late").label("late"),
        )
        .outerjoin(AttendanceRecord, AttendanceRecord.course_id == Course.id)
        .where(Course.professor_id == professor.id)
        .group_by(Course.id)
        .order_by(Course.start_time.desc())
    )
    course_rows = (await db.execute(course_stmt)).all()

    courses_list = []
    total_students_set = set()
    for row in course_rows:
        total = row.student_count
        rate = round(row.present / total * 100, 1) if total > 0 else 0
        courses_list.append({
            "course_name": row.name,
            "date": row.start_time.strftime("%d/%m/%Y %H:%M"),
            "room": row.room,
            "student_count": total,
            "attendance_rate": rate,
        })
        # Get unique students for this course
        student_ids = (await db.execute(
            select(CourseEnrollment.student_id).where(CourseEnrollment.course_id == row.id)
        )).scalars().all()
        total_students_set.update(student_ids)

    # Aggregate by course name
    from collections import defaultdict
    name_stats = defaultdict(lambda: {"sessions": 0, "total": 0, "present": 0})
    for row in course_rows:
        ns = name_stats[row.name]
        ns["sessions"] += 1
        ns["total"] += row.student_count
        ns["present"] += row.present
    by_course_name = [
        {
            "course_name": name,
            "total_sessions": s["sessions"],
            "avg_rate": round(s["present"] / s["total"] * 100, 1) if s["total"] > 0 else 0,
        }
        for name, s in sorted(name_stats.items())
    ]

    # Overall stats
    total_all = sum(r.student_count for r in course_rows)
    present_all = sum(r.present for r in course_rows)
    avg_rate = round(present_all / total_all * 100, 1) if total_all > 0 else 0

    return {
        "professor": {
            "id": str(professor.id),
            "email": professor.email,
            "first_name": professor.first_name,
            "last_name": professor.last_name,
            "role": professor.role,
        },
        "stats": {
            "total_courses_given": len(course_rows),
            "total_students": len(total_students_set),
            "avg_attendance_rate": avg_rate,
        },
        "courses": courses_list,
        "by_course_name": by_course_name,
    }
```

**Step 2: Commit**

```bash
git add backend/app/api/v1/admin.py
git commit -m "feat: add professor profile endpoint with course stats"
```

---

## Task 6: Professor Profile — Frontend

**Files:**
- Create: `frontend/src/app/admin/professors/[id]/page.tsx`
- Modify: `frontend/src/hooks/use-admin.ts` (add new hook)
- Modify: `frontend/src/app/admin/page.tsx` (make professor names clickable)

**Step 1: Add hook in `frontend/src/hooks/use-admin.ts`**

```typescript
export interface ProfessorProfile {
  professor: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  };
  stats: {
    total_courses_given: number;
    total_students: number;
    avg_attendance_rate: number;
  };
  courses: { course_name: string; date: string; room: string; student_count: number; attendance_rate: number }[];
  by_course_name: { course_name: string; total_sessions: number; avg_rate: number }[];
}

export function useProfessorProfile(professorId: string) {
  return useSWR<ProfessorProfile>(professorId ? `admin-professor-profile-${professorId}` : null, {
    fetcher: () => api.get<ProfessorProfile>(`/api/v1/admin/professors/${professorId}/profile`),
  });
}
```

**Step 2: Create professor profile page**

Create `frontend/src/app/admin/professors/[id]/page.tsx` — professor info header, stats cards (courses given, total students, avg rate), table of individual courses with date/room/attendance, aggregated table by course name.

**Step 3: Make professor names clickable**

In `frontend/src/app/admin/page.tsx`, wrap professor names (around lines 465-471) with `<Link href={/admin/professors/${p.id}}>`.

**Step 4: Commit**

```bash
git add frontend/src/app/admin/professors/[id]/page.tsx frontend/src/hooks/use-admin.ts frontend/src/app/admin/page.tsx
git commit -m "feat: add professor profile page with course analytics"
```

---

## Task 7: Justification Detail — Backend

**Files:**
- Create: `backend/app/models/justification_comment.py`
- Modify: `backend/app/models/__init__.py` (register new model)
- Modify: `backend/app/api/v1/admin.py` (add detail + comment endpoints)
- Modify: `backend/app/api/v1/student.py` (add comment reply endpoint)

**Step 1: Create JustificationComment model**

Create `backend/app/models/justification_comment.py`:

```python
import uuid
from datetime import datetime
from sqlalchemy import String, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class JustificationComment(Base):
    __tablename__ = "justification_comments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    justification_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("justifications.id"), nullable=False)
    author_type: Mapped[str] = mapped_column(String, nullable=False)  # "admin" | "student"
    author_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    author_name: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
```

**Step 2: Register in `__init__.py`**

Add to `backend/app/models/__init__.py`:
```python
from app.models.justification_comment import JustificationComment
```
And add `"JustificationComment"` to the `__all__` list.

**Step 3: Add admin endpoints for justification detail + comment**

Add to `backend/app/api/v1/admin.py` after the existing justification endpoints:

```python
from app.models.justification_comment import JustificationComment

@router.get("/justifications/{justification_id}")
async def get_justification_detail(
    justification_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Justification, Student, AttendanceRecord, Course, Professor)
        .join(Student, Justification.student_id == Student.id)
        .join(AttendanceRecord, Justification.attendance_record_id == AttendanceRecord.id)
        .join(Course, AttendanceRecord.course_id == Course.id)
        .outerjoin(Professor, Justification.reviewed_by == Professor.id)
        .where(Justification.id == UUID(justification_id))
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Justification not found")

    justif, student, record, course, reviewer = row
    file_names = json.loads(justif.file_paths) if justif.file_paths else []
    file_urls = [
        f"/api/v1/admin/justification-files/{justif.id}/{fname}"
        for fname in file_names
    ]

    # Get comments
    comment_stmt = (
        select(JustificationComment)
        .where(JustificationComment.justification_id == justif.id)
        .order_by(JustificationComment.created_at.asc())
    )
    comments = (await db.execute(comment_stmt)).scalars().all()

    return {
        "id": str(justif.id),
        "student_id": str(student.id),
        "student_name": f"{student.first_name} {student.last_name}",
        "student_email": student.email,
        "course_name": course.name,
        "course_date": course.start_time.strftime("%d/%m/%Y %H:%M"),
        "reason": justif.reason,
        "file_urls": file_urls,
        "status": justif.status,
        "created_at": justif.created_at.isoformat(),
        "reviewed_by_name": f"{reviewer.first_name} {reviewer.last_name}" if reviewer else None,
        "reviewed_at": justif.reviewed_at.isoformat() if justif.reviewed_at else None,
        "comments": [
            {
                "id": str(c.id),
                "author_type": c.author_type,
                "author_name": c.author_name,
                "message": c.message,
                "created_at": c.created_at.isoformat(),
            }
            for c in comments
        ],
    }


@router.post("/justifications/{justification_id}/comment")
async def add_justification_comment(
    justification_id: str,
    body: dict,
    professor: Professor = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    justif = (await db.execute(
        select(Justification).where(Justification.id == UUID(justification_id))
    )).scalar_one_or_none()
    if not justif:
        raise HTTPException(status_code=404, detail="Justification not found")

    message = sanitize_text(body.get("message", ""))
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    comment = JustificationComment(
        justification_id=justif.id,
        author_type="admin",
        author_id=professor.id,
        author_name=f"{professor.first_name} {professor.last_name}",
        message=message,
    )
    db.add(comment)

    # Notify the student
    notification = Notification(
        student_id=justif.student_id,
        type="justification_comment",
        title="Nouveau commentaire sur votre justificatif",
        message=f"L'administrateur a ajoute un commentaire: {message[:100]}",
        data=json.dumps({"justification_id": str(justif.id)}),
    )
    db.add(notification)
    await db.commit()

    return {"ok": True, "comment_id": str(comment.id)}
```

**Step 4: Add student comment reply endpoint**

Add to `backend/app/api/v1/student.py`:

```python
from app.models.justification_comment import JustificationComment

@router.post("/justifications/{justification_id}/comment")
async def add_student_justification_comment(
    justification_id: str,
    body: dict,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    justif = (await db.execute(
        select(Justification).where(
            Justification.id == UUID(justification_id),
            Justification.student_id == student.id,
        )
    )).scalar_one_or_none()
    if not justif:
        raise HTTPException(status_code=404, detail="Justification not found")

    message = sanitize_text(body.get("message", ""))
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    comment = JustificationComment(
        justification_id=justif.id,
        author_type="student",
        author_id=student.id,
        author_name=f"{student.first_name} {student.last_name}",
        message=message,
    )
    db.add(comment)
    await db.commit()

    return {"ok": True, "comment_id": str(comment.id)}
```

**Step 5: Run DB migration (create table)**

Since the project uses SQLAlchemy with `Base.metadata.create_all`, the new table will be created automatically on startup (or add to seed). If using alembic, create migration. If not, ensure `create_all` is called.

**Step 6: Commit**

```bash
git add backend/app/models/justification_comment.py backend/app/models/__init__.py backend/app/api/v1/admin.py backend/app/api/v1/student.py
git commit -m "feat: add justification detail, comments model, and student reply endpoint"
```

---

## Task 8: Justification Detail — Frontend

**Files:**
- Create: `frontend/src/app/admin/justifications/[id]/page.tsx`
- Modify: `frontend/src/hooks/use-admin.ts` (add hooks)
- Modify: `frontend/src/app/admin/page.tsx` (make justification rows clickable)

**Step 1: Add hooks in `frontend/src/hooks/use-admin.ts`**

```typescript
export interface JustificationDetail {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  course_name: string;
  course_date: string;
  reason: string;
  file_urls: string[];
  status: string;
  created_at: string;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  comments: { id: string; author_type: string; author_name: string; message: string; created_at: string }[];
}

export function useJustificationDetail(justificationId: string) {
  return useSWR<JustificationDetail>(justificationId ? `admin-justification-${justificationId}` : null, {
    fetcher: () => api.get<JustificationDetail>(`/api/v1/admin/justifications/${justificationId}`),
  });
}

export async function addJustificationComment(justificationId: string, message: string) {
  return api.post<{ ok: boolean }>(`/api/v1/admin/justifications/${justificationId}/comment`, { message });
}
```

**Step 2: Create justification detail page**

Create `frontend/src/app/admin/justifications/[id]/page.tsx`:
- Student/course info header with status badge
- File viewer section: images shown inline (`<img>`), PDFs and other files as download links
- Conversation thread showing all comments chronologically with admin/student badges
- Textarea + send button for adding comments
- Approve/Reject action buttons (reusing existing `reviewJustification` function)
- When comment is added, call `mutate` to refresh the detail and show toast

**Step 3: Make justification rows clickable**

In `frontend/src/app/admin/page.tsx`, wrap each justification `<tr>` (line 147) to navigate on click:

Add `onClick={() => router.push(`/admin/justifications/${j.id}`)}` to the `<tr>` element and add `cursor-pointer` class.

**Step 4: Commit**

```bash
git add frontend/src/app/admin/justifications/[id]/page.tsx frontend/src/hooks/use-admin.ts frontend/src/app/admin/page.tsx
git commit -m "feat: add justification detail page with file viewer and conversation thread"
```

---

## Task 9: Clickable KPIs + Students-at-Risk Detail Page

**Files:**
- Modify: `frontend/src/app/admin/analytics/page.tsx` (make KPI cards clickable)
- Create: `frontend/src/app/admin/analytics/students-at-risk/page.tsx`

**Step 1: Make KPI cards clickable in analytics page**

In `frontend/src/app/admin/analytics/page.tsx`, modify the summary cards section (lines 96-120):

Wrap `SummaryCard` components with `Link` or `<a>` that navigate/scroll:
- "Etudiants" → `/admin` (scrolls to students section)
- "Cours" → scroll to course comparison section
- "Taux moyen" → scroll to trends section
- "Etudiants a risque" → `/admin/analytics/students-at-risk`

Easiest approach: modify `SummaryCard` to accept an optional `href` prop. When present, wrap the card in a `Link`.

**Step 2: Create students-at-risk detail page**

Create `frontend/src/app/admin/analytics/students-at-risk/page.tsx`:
- Uses existing `useStudentsAtRisk(70)` hook
- Full-page sortable table with columns: Nom, Email, Cours total, Absences, Taux
- Each student name is a `<Link>` to `/admin/students/{student_id}`
- Sort buttons for each column header (client-side sort with useState)

**Step 3: Also make student names in the existing at-risk table clickable**

In `frontend/src/app/admin/analytics/page.tsx` line 321, wrap student name in `<Link>`:

```tsx
<td className="px-4 py-3 font-semibold text-[var(--color-text)]">
  <Link href={`/admin/students/${s.student_id}`} className="hover:underline">
    {name}
  </Link>
</td>
```

**Step 4: Commit**

```bash
git add frontend/src/app/admin/analytics/page.tsx frontend/src/app/admin/analytics/students-at-risk/page.tsx
git commit -m "feat: clickable KPI cards and students-at-risk drill-down page"
```

---

## Task 10: Professor Course History — Backend

**Files:**
- Modify: `backend/app/api/v1/courses.py`

**Step 1: Add GET /courses/history endpoint**

Add to `backend/app/api/v1/courses.py` after the existing endpoints:

```python
@router.get("/history")
async def get_course_history(
    professor: Professor = Depends(get_current_professor),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
):
    # All courses for this professor, ordered by date descending
    stmt = (
        select(
            Course,
            func.count(AttendanceRecord.id).label("total_records"),
            func.count().filter(AttendanceRecord.status == "present").label("present_count"),
            func.count().filter(AttendanceRecord.status == "absent").label("absent_count"),
            func.count().filter(AttendanceRecord.status == "late").label("late_count"),
        )
        .outerjoin(AttendanceRecord, AttendanceRecord.course_id == Course.id)
        .where(Course.professor_id == professor.id)
        .group_by(Course.id)
        .order_by(Course.start_time.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()

    # Count total
    count_stmt = select(func.count(Course.id)).where(Course.professor_id == professor.id)
    total = (await db.execute(count_stmt)).scalar() or 0

    # Check which courses have attendance validated
    course_ids = [row[0].id for row in rows]
    validated_ids = set()
    if course_ids:
        validated_stmt = (
            select(AttendanceRecord.course_id)
            .where(AttendanceRecord.course_id.in_(course_ids))
            .distinct()
        )
        validated_ids = set((await db.execute(validated_stmt)).scalars().all())

    # Count enrolled students per course
    enrollment_stmt = (
        select(CourseEnrollment.course_id, func.count(CourseEnrollment.id))
        .where(CourseEnrollment.course_id.in_(course_ids))
        .group_by(CourseEnrollment.course_id)
    )
    enrollment_counts = dict((await db.execute(enrollment_stmt)).all())

    return {
        "courses": [
            {
                "id": str(course.id),
                "name": course.name,
                "room": course.room,
                "date": course.start_time.strftime("%d/%m/%Y"),
                "start_time": course.start_time.strftime("%H:%M"),
                "end_time": course.end_time.strftime("%H:%M"),
                "student_count": enrollment_counts.get(course.id, 0),
                "present_count": present_count,
                "absent_count": absent_count,
                "late_count": late_count,
                "is_validated": course.id in validated_ids,
            }
            for course, total_records, present_count, absent_count, late_count in rows
        ],
        "total": total,
    }
```

Add imports at top: `from app.models.attendance_record import AttendanceRecord` and `from app.models.course_enrollment import CourseEnrollment`.

**Step 2: Commit**

```bash
git add backend/app/api/v1/courses.py
git commit -m "feat: add professor course history endpoint"
```

---

## Task 11: Professor Course History — Frontend

**Files:**
- Create: `frontend/src/app/dashboard/history/page.tsx`
- Modify: `frontend/src/hooks/use-courses.ts` (add history hook)
- Modify: `frontend/src/app/dashboard/page.tsx` (add "Historique" link)

**Step 1: Add hook in `frontend/src/hooks/use-courses.ts`**

```typescript
export interface CourseHistoryItem {
  id: string;
  name: string;
  room: string;
  date: string;
  start_time: string;
  end_time: string;
  student_count: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  is_validated: boolean;
}

export interface CourseHistory {
  courses: CourseHistoryItem[];
  total: number;
}

export function useCourseHistory(limit = 50) {
  return useSWR<CourseHistory>("course-history", {
    fetcher: () => api.get<CourseHistory>(`/api/v1/courses/history?limit=${limit}`),
  });
}
```

**Step 2: Create history page**

Create `frontend/src/app/dashboard/history/page.tsx`:
- Header with back arrow to `/dashboard`
- Table: Date, Cours, Salle, Etudiants, Presents, Absents, Retards, Statut (Valide badge)
- Each row links to `/course/{id}`
- Mobile card layout for small screens

**Step 3: Add "Historique" button to dashboard**

In `frontend/src/app/dashboard/page.tsx`, add a link/button after the "Cours du jour" heading (around line 88):

```tsx
<div className="flex items-center justify-between mb-6">
  <div>
    <p className="text-sm text-[var(--color-text-muted)] capitalize">{today}</p>
    <h2 className="text-2xl font-bold text-[var(--color-text)] mt-1" style={{ fontFamily: "var(--font-playfair)" }}>
      Cours du jour
    </h2>
  </div>
  <Link
    href="/dashboard/history"
    className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] transition-colors"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
    Historique
  </Link>
</div>
```

**Step 4: Commit**

```bash
git add frontend/src/app/dashboard/history/page.tsx frontend/src/hooks/use-courses.ts frontend/src/app/dashboard/page.tsx
git commit -m "feat: add professor course history page with link from dashboard"
```

---

## Task 12: Editable Attendance — Verify & Polish

**Files:**
- Review: `frontend/src/app/course/[id]/page.tsx`
- Review: `backend/app/api/v1/attendance.py`

**Step 1: Verify the existing editable attendance works end-to-end**

The backend already has:
- `PUT /attendance/validate` — edit existing attendance (line 100-198 of attendance.py)
- `GET /attendance/{course_id}/status` — returns `validated` and `editable` flags (line 201-231)
- Deadline = start_time + (end_time - start_time) / 2

The frontend at `course/[id]/page.tsx` already:
- Loads attendance status and shows "Appel valide" banner when validated (line 344)
- Shows "Modification impossible" when disabled (line 364)
- Shows "Modifier l'appel" button text when isValidated (line 512)
- Calls `updateAttendance` when isValidated on submit (line 151)

**Step 2: Test manually**

1. Login as prof, go to a course, validate attendance
2. Go back to the same course — should show "Appel valide" banner
3. If within deadline: should show editable students + "Modifier l'appel" button
4. If past deadline: should show "Modification impossible"

If this flow works, no changes needed. If there's a bug, fix it.

**Step 3: Commit if changes made**

```bash
git add -A
git commit -m "fix: polish editable attendance flow"
```

---

## Task 13: Student Analytics — Backend

**Files:**
- Modify: `backend/app/api/v1/student.py`

**Step 1: Add GET /student/analytics endpoint**

Add to `backend/app/api/v1/student.py` after the existing endpoints:

```python
@router.get("/analytics")
async def student_analytics(
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    # Overall stats
    total = (await db.execute(
        select(func.count(AttendanceRecord.id)).where(AttendanceRecord.student_id == student.id)
    )).scalar() or 0
    attended = (await db.execute(
        select(func.count(AttendanceRecord.id))
        .where(AttendanceRecord.student_id == student.id, AttendanceRecord.status == "present")
    )).scalar() or 0
    absent = (await db.execute(
        select(func.count(AttendanceRecord.id))
        .where(AttendanceRecord.student_id == student.id, AttendanceRecord.status == "absent")
    )).scalar() or 0
    late = (await db.execute(
        select(func.count(AttendanceRecord.id))
        .where(AttendanceRecord.student_id == student.id, AttendanceRecord.status == "late")
    )).scalar() or 0
    rate = round((attended / total * 100), 1) if total > 0 else 0

    # By course name
    course_stmt = (
        select(
            Course.name,
            func.count(AttendanceRecord.id).label("total"),
            func.count().filter(AttendanceRecord.status == "present").label("attended"),
            func.count().filter(AttendanceRecord.status == "absent").label("absent"),
            func.count().filter(AttendanceRecord.status == "late").label("late"),
        )
        .join(Course, Course.id == AttendanceRecord.course_id)
        .where(AttendanceRecord.student_id == student.id)
        .group_by(Course.name)
        .order_by(Course.name)
    )
    course_rows = (await db.execute(course_stmt)).all()
    by_course = [
        {
            "course_name": row.name,
            "total": row.total,
            "attended": row.attended,
            "absent": row.absent,
            "late": row.late,
            "rate": round(row.attended / row.total * 100, 1) if row.total > 0 else 0,
        }
        for row in course_rows
    ]

    # By professor
    prof_stmt = (
        select(
            Professor.first_name,
            Professor.last_name,
            func.count(AttendanceRecord.id).label("total"),
            func.count().filter(AttendanceRecord.status == "present").label("attended"),
            func.count().filter(AttendanceRecord.status == "absent").label("absent"),
            func.count().filter(AttendanceRecord.status == "late").label("late"),
        )
        .join(Course, Course.id == AttendanceRecord.course_id)
        .join(Professor, Professor.id == Course.professor_id)
        .where(AttendanceRecord.student_id == student.id)
        .group_by(Professor.id)
        .order_by(Professor.last_name)
    )
    prof_rows = (await db.execute(prof_stmt)).all()
    by_professor = [
        {
            "professor_name": f"{row.first_name} {row.last_name}",
            "total": row.total,
            "attended": row.attended,
            "absent": row.absent,
            "late": row.late,
            "rate": round(row.attended / row.total * 100, 1) if row.total > 0 else 0,
        }
        for row in prof_rows
    ]

    return {
        "stats": {
            "total_courses": total,
            "attended": attended,
            "absent": absent,
            "late": late,
            "rate": rate,
        },
        "by_course": by_course,
        "by_professor": by_professor,
    }
```

Add import at top: `from app.models.course import Course` and `from app.models.professor import Professor` (Course is already imported).

**Step 2: Commit**

```bash
git add backend/app/api/v1/student.py
git commit -m "feat: add student analytics endpoint (by course, by professor)"
```

---

## Task 14: Student Analytics — Frontend

**Files:**
- Modify: `frontend/src/app/student/page.tsx` (add analytics section)

**Step 1: Add SWR hook for student analytics**

Add at the top of `frontend/src/app/student/page.tsx` (after existing hooks):

```typescript
interface StudentAnalytics {
  stats: { total_courses: number; attended: number; absent: number; late: number; rate: number };
  by_course: { course_name: string; total: number; attended: number; absent: number; late: number; rate: number }[];
  by_professor: { professor_name: string; total: number; attended: number; absent: number; late: number; rate: number }[];
}

function useStudentAnalytics() {
  return useSWR<StudentAnalytics>("student-analytics", {
    fetcher: () => api.get<StudentAnalytics>("/api/v1/student/analytics"),
  });
}
```

**Step 2: Add analytics section to student dashboard**

In the `StudentDashboard` component, add after the "Historique de presence" section (after line 452, before the closing `</main>`):

- Collapsible "Mes statistiques" section
- Stats cards row: Total cours, Present, Absent, En retard, Taux
- "Par matiere" table: Cours | Total | Present | Absent | Retard | Taux
- "Par professeur" table: Professeur | Total | Present | Absent | Retard | Taux
- Use the same table patterns as the existing attendance history table
- Rate badge with green/yellow/red color based on percentage

**Step 3: Commit**

```bash
git add frontend/src/app/student/page.tsx
git commit -m "feat: add student analytics section with stats by course and professor"
```

---

## Summary of All Tasks

| Task | Feature | Backend | Frontend | Commits |
|------|---------|---------|----------|---------|
| 1 | Admin header | — | layout.tsx | 1 |
| 2 | CSV fix | — | page.tsx | 1 |
| 3 | Student profile BE | admin.py | — | 1 |
| 4 | Student profile FE | — | students/[id], use-admin, page | 1 |
| 5 | Professor profile BE | admin.py | — | 1 |
| 6 | Professor profile FE | — | professors/[id], use-admin, page | 1 |
| 7 | Justification detail BE | new model, admin.py, student.py | — | 1 |
| 8 | Justification detail FE | — | justifications/[id], use-admin, page | 1 |
| 9 | Clickable KPIs | — | analytics/page, students-at-risk/page | 1 |
| 10 | Prof history BE | courses.py | — | 1 |
| 11 | Prof history FE | — | dashboard/history, use-courses, dashboard | 1 |
| 12 | Editable attendance | verify | verify | 0-1 |
| 13 | Student analytics BE | student.py | — | 1 |
| 14 | Student analytics FE | — | student/page | 1 |

**Total: 14 tasks, ~13 commits**
