# Core Compliance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add admin justification review, audit logs, compliance exports (Qualiopi certificates + OPCO), and external role (tutor/company login + dashboard).

**Architecture:** Incremental — 4 axes implemented sequentially. Each axis is backend endpoints + tests + frontend UI. All backend endpoints use FastAPI async with SQLAlchemy. Frontend uses Next.js App Router + SWR hooks + Tailwind CSS variables.

**Tech Stack:** FastAPI, SQLAlchemy async, Pydantic v2, pytest + httpx, Next.js 14, TypeScript, SWR, ReportLab (PDF), csv module (OPCO export)

---

## Axe 1: Admin Review des Justificatifs

### Task 1: Backend — GET /admin/justifications endpoint

**Files:**
- Modify: `backend/app/api/v1/admin.py`
- Modify: `backend/app/schemas/attendance.py` (add justification response schema)

**Step 1: Add JustificationAdminResponse schema**

In `backend/app/schemas/attendance.py`, add at the end:

```python
class JustificationAdminResponse(BaseModel):
    id: str
    student_name: str
    student_email: str
    course_name: str
    course_date: str
    record_status: str
    reason: str
    file_urls: list[str]
    status: str
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by_name: Optional[str] = None
    comment: Optional[str] = None
```

**Step 2: Add GET /admin/justifications endpoint**

In `backend/app/api/v1/admin.py`, add imports and endpoint:

```python
# Additional imports
from typing import Optional
from app.models.justification import Justification
from app.models.course import Course
from app.schemas.attendance import JustificationAdminResponse

@router.get("/justifications", response_model=list[JustificationAdminResponse])
async def list_justifications(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Justification, Student, AttendanceRecord, Course, Professor)
        .join(Student, Justification.student_id == Student.id)
        .join(AttendanceRecord, Justification.attendance_record_id == AttendanceRecord.id)
        .join(Course, AttendanceRecord.course_id == Course.id)
        .outerjoin(Professor, Justification.reviewed_by == Professor.id)
        .order_by(Justification.created_at.desc())
    )
    if status:
        stmt = stmt.where(Justification.status == status)
    result = await db.execute(stmt)
    rows = result.all()
    responses = []
    for justif, student, record, course, reviewer in rows:
        file_names = json.loads(justif.file_paths) if justif.file_paths else []
        file_urls = [
            f"/api/v1/admin/justification-files/{justif.id}/{fname}"
            for fname in file_names
        ]
        responses.append(JustificationAdminResponse(
            id=str(justif.id),
            student_name=f"{student.first_name} {student.last_name}",
            student_email=student.email,
            course_name=course.name,
            course_date=course.start_time.strftime("%d/%m/%Y %H:%M"),
            record_status=record.status,
            reason=justif.reason,
            file_urls=file_urls,
            status=justif.status,
            created_at=justif.created_at,
            reviewed_at=justif.reviewed_at,
            reviewed_by_name=f"{reviewer.first_name} {reviewer.last_name}" if reviewer else None,
        ))
    return responses
```

Add `import json` at top of admin.py.

**Step 3: Run backend tests to verify no regression**

```bash
cd backend && pytest -v
```

**Step 4: Commit**

```bash
git add backend/app/api/v1/admin.py backend/app/schemas/attendance.py
git commit -m "feat: add GET /admin/justifications endpoint"
```

---

### Task 2: Backend — PUT /admin/justifications/{id}/review endpoint

**Files:**
- Modify: `backend/app/api/v1/admin.py`
- Modify: `backend/app/schemas/attendance.py` (add review request schema)

**Step 1: Add ReviewJustificationRequest schema**

In `backend/app/schemas/attendance.py`:

```python
class ReviewJustificationRequest(BaseModel):
    decision: str  # "approved" | "rejected"
    comment: Optional[str] = None
```

**Step 2: Add PUT endpoint**

In `backend/app/api/v1/admin.py`:

```python
from app.models.notification import Notification

@router.put("/justifications/{justification_id}/review")
async def review_justification(
    justification_id: str,
    body: ReviewJustificationRequest,
    professor: Professor = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from uuid import UUID
    stmt = select(Justification).where(Justification.id == UUID(justification_id))
    result = await db.execute(stmt)
    justif = result.scalar_one_or_none()
    if not justif:
        raise HTTPException(status_code=404, detail="Justification not found")
    if justif.status != "pending":
        raise HTTPException(status_code=400, detail="Already reviewed")
    if body.decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Decision must be 'approved' or 'rejected'")

    justif.status = body.decision
    justif.reviewed_at = datetime.utcnow()
    justif.reviewed_by = professor.id

    # Create notification for student
    decision_text = "approuvee" if body.decision == "approved" else "refusee"
    notification = Notification(
        student_id=justif.student_id,
        type="justification_reviewed",
        title=f"Justification {decision_text}",
        message=f"Votre justification a ete {decision_text}." + (f" Commentaire: {body.comment}" if body.comment else ""),
        data=json.dumps({"justification_id": str(justif.id), "decision": body.decision}),
    )
    db.add(notification)
    await db.commit()

    return {"ok": True, "status": justif.status}
```

Add `from app.schemas.attendance import ReviewJustificationRequest` import.

**Step 3: Run tests**

```bash
cd backend && pytest -v
```

**Step 4: Commit**

```bash
git add backend/app/api/v1/admin.py backend/app/schemas/attendance.py
git commit -m "feat: add PUT /admin/justifications/{id}/review endpoint"
```

---

### Task 3: Backend — Admin file serving endpoint

**Files:**
- Modify: `backend/app/api/v1/admin.py`

**Step 1: Add file serving endpoint**

```python
from pathlib import Path
from fastapi.responses import FileResponse

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads" / "justifications"

@router.get("/justification-files/{justification_id}/{filename}")
async def serve_justification_file_admin(
    justification_id: str,
    filename: str,
    db: AsyncSession = Depends(get_db),
):
    from uuid import UUID
    stmt = select(Justification).where(Justification.id == UUID(justification_id))
    result = await db.execute(stmt)
    justif = result.scalar_one_or_none()
    if not justif:
        raise HTTPException(status_code=404, detail="Justification not found")

    safe_filename = Path(filename).name
    file_path = UPLOADS_DIR / justification_id / safe_filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)
```

**Step 2: Run tests**

```bash
cd backend && pytest -v
```

**Step 3: Commit**

```bash
git add backend/app/api/v1/admin.py
git commit -m "feat: add admin justification file serving endpoint"
```

---

### Task 4: Backend — Tests for admin justification endpoints

**Files:**
- Modify: `backend/tests/conftest.py` (add justification seed data)
- Create: `backend/tests/test_admin_justifications.py`

**Step 1: Add justification seed data in conftest.py**

After existing seed data (attendance records etc.), add:

```python
# Create a justification for student1 on course1 (requires an attendance record with status=absent)
# Find or create an absent attendance record, then:
justification1 = Justification(
    id=uuid.uuid4(),
    attendance_record_id=<absent_record_id>,
    student_id=student1.id,
    reason="Certificat medical",
    file_paths=json.dumps(["medical.pdf"]),
    status="pending",
)
db.add(justification1)
await db.flush()
```

Store `justification1.id` as a fixture-accessible value (e.g., add to a globals dict or create separate fixtures).

**Step 2: Write tests**

```python
# backend/tests/test_admin_justifications.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_list_justifications_requires_admin(client: AsyncClient):
    # Login as non-admin prof
    login = await client.post("/api/v1/auth/login", json={"email": "jean.dupont@ecole.fr", "password": "password123"})
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/admin/justifications", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403

@pytest.mark.asyncio
async def test_list_justifications_as_admin(client: AsyncClient):
    login = await client.post("/api/v1/auth/login", json={"email": "admin@ecole.fr", "password": "admin123"})
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/admin/justifications", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)

@pytest.mark.asyncio
async def test_list_justifications_filter_by_status(client: AsyncClient):
    login = await client.post("/api/v1/auth/login", json={"email": "admin@ecole.fr", "password": "admin123"})
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/admin/justifications?status=pending", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    for j in resp.json():
        assert j["status"] == "pending"

@pytest.mark.asyncio
async def test_review_justification_approve(client: AsyncClient):
    login = await client.post("/api/v1/auth/login", json={"email": "admin@ecole.fr", "password": "admin123"})
    token = login.json()["access_token"]
    # Get pending justifications
    resp = await client.get("/api/v1/admin/justifications?status=pending", headers={"Authorization": f"Bearer {token}"})
    pending = resp.json()
    if len(pending) > 0:
        jid = pending[0]["id"]
        resp = await client.put(
            f"/api/v1/admin/justifications/{jid}/review",
            json={"decision": "approved"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "approved"

@pytest.mark.asyncio
async def test_review_justification_already_reviewed(client: AsyncClient):
    login = await client.post("/api/v1/auth/login", json={"email": "admin@ecole.fr", "password": "admin123"})
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/admin/justifications?status=approved", headers={"Authorization": f"Bearer {token}"})
    approved = resp.json()
    if len(approved) > 0:
        jid = approved[0]["id"]
        resp = await client.put(
            f"/api/v1/admin/justifications/{jid}/review",
            json={"decision": "rejected"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400
```

**Step 3: Run tests**

```bash
cd backend && pytest tests/test_admin_justifications.py -v
```

**Step 4: Commit**

```bash
git add backend/tests/
git commit -m "test: add admin justification review tests"
```

---

### Task 5: Frontend — Admin justifications hook

**Files:**
- Modify: `frontend/src/hooks/use-admin.ts`

**Step 1: Add types and hook**

```typescript
export interface AdminJustification {
  id: string;
  student_name: string;
  student_email: string;
  course_name: string;
  course_date: string;
  record_status: string;
  reason: string;
  file_urls: string[];
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  comment: string | null;
}

export function useAdminJustifications(status?: string) {
  const params = status ? `?status=${status}` : "";
  return useSWR<AdminJustification[]>(`admin-justifications-${status || "all"}`, {
    fetcher: () => api.get<AdminJustification[]>(`/api/v1/admin/justifications${params}`),
    refreshInterval: 15000,
  });
}

export async function reviewJustification(id: string, decision: string, comment?: string) {
  return api.put<{ ok: boolean; status: string }>(`/api/v1/admin/justifications/${id}/review`, {
    decision,
    comment,
  });
}
```

**Step 2: Commit**

```bash
git add frontend/src/hooks/use-admin.ts
git commit -m "feat: add admin justifications SWR hook"
```

---

### Task 6: Frontend — Admin justifications section in admin page

**Files:**
- Modify: `frontend/src/app/admin/page.tsx`

**Step 1: Add justifications section**

Import the new hook and add a new section between stats and students table. The section includes:
- Pending count badge in a tab/header
- Filter buttons (Tous, En attente, Approuves, Refuses) — same pattern as student history filters
- Table: Etudiant | Cours | Date | Raison | Fichiers | Statut | Actions
- "Approuver" (green) and "Refuser" (red) buttons for pending items
- Refusal shows a modal/inline input for optional comment
- On review success: `mutate()` the justifications SWR key

Follow existing patterns:
- CSS variable classes (`var(--color-*)`)
- `var(--font-playfair)` for section headings
- `rounded-2xl border border-[var(--color-border-light)]` card wrapper
- Badge styles matching `statusLabel()` pattern from student page

**Step 2: Test manually in browser**

Visit http://localhost:3000/admin — verify justifications section renders.

**Step 3: Commit**

```bash
git add frontend/src/app/admin/page.tsx
git commit -m "feat: add justifications review section to admin dashboard"
```

---

### Task 7: Frontend — Justification notification display for students

**Files:**
- Modify: `frontend/src/app/student/page.tsx` (handle `justification_reviewed` notification type in pending signatures area or show as toast)

**Step 1: Ensure justification_reviewed notifications appear**

The student dashboard already shows notifications. Add handling so `justification_reviewed` notifications appear in the notification bell dropdown (if one exists) or as a visible section. The key point is that students see "Votre justification a ete approuvee/refusee" somewhere visible.

If the notification bell component (`notification-bell.tsx`) already displays all notification types, this may just work. Verify and adjust if needed.

**Step 2: Commit**

```bash
git add frontend/src/app/student/page.tsx frontend/src/components/notification-bell.tsx
git commit -m "feat: display justification review notifications for students"
```

---

## Axe 2: Logs d'Audit

### Task 8: Backend — AuditLog model + migration

**Files:**
- Create: `backend/app/models/audit_log.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: Create AuditLog model**

```python
# backend/app/models/audit_log.py
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    # "signature", "attendance_validation", "attendance_edit",
    # "justification_submit", "justification_review"
    actor_type: Mapped[str] = mapped_column(String, nullable=False)  # "student", "professor", "admin"
    actor_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    target_type: Mapped[str] = mapped_column(String, nullable=False)  # "attendance_record", "justification"
    target_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    metadata: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
```

**Step 2: Register in __init__.py**

Add to `backend/app/models/__init__.py`:
```python
from app.models.audit_log import AuditLog
```
And add `"AuditLog"` to `__all__`.

**Step 3: Run tests to verify model loads**

```bash
cd backend && pytest -v
```

**Step 4: Commit**

```bash
git add backend/app/models/audit_log.py backend/app/models/__init__.py
git commit -m "feat: add AuditLog model"
```

---

### Task 9: Backend — Audit logging helper + integrate into existing endpoints

**Files:**
- Create: `backend/app/services/audit.py`
- Modify: `backend/app/api/v1/student.py` (sign, justify)
- Modify: `backend/app/api/v1/attendance.py` (validate, update)
- Modify: `backend/app/api/v1/admin.py` (review justification)

**Step 1: Create audit helper**

```python
# backend/app/services/audit.py
import json
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog


async def create_audit_log(
    db: AsyncSession,
    event_type: str,
    actor_type: str,
    actor_id: uuid.UUID,
    target_type: str,
    target_id: uuid.UUID,
    ip_address: str | None = None,
    user_agent: str | None = None,
    metadata: dict | None = None,
):
    log = AuditLog(
        event_type=event_type,
        actor_type=actor_type,
        actor_id=actor_id,
        target_type=target_type,
        target_id=target_id,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata=json.dumps(metadata) if metadata else None,
    )
    db.add(log)
    # Don't commit here — caller is responsible for commit
```

**Step 2: Integrate into endpoints**

Add `from fastapi import Request` to each router that needs IP/user-agent. Add `request: Request` parameter to each endpoint. Call `create_audit_log()` before `await db.commit()`.

**Endpoints to instrument:**

1. `student.py: sign_attendance_record` — event_type="signature", actor_type="student"
2. `student.py: justify_absence` — event_type="justification_submit", actor_type="student"
3. `attendance.py: validate_attendance` (POST) — event_type="attendance_validation", actor_type="professor"
4. `attendance.py: update_attendance` (PUT) — event_type="attendance_edit", actor_type="professor", metadata={old_statuses, new_statuses}
5. `admin.py: review_justification` — event_type="justification_review", actor_type="admin"

Pattern for getting IP/user-agent:
```python
ip = request.client.host if request.client else None
ua = request.headers.get("user-agent")
```

**Step 3: Run tests**

```bash
cd backend && pytest -v
```

**Step 4: Commit**

```bash
git add backend/app/services/audit.py backend/app/api/v1/student.py backend/app/api/v1/attendance.py backend/app/api/v1/admin.py
git commit -m "feat: integrate audit logging into all key endpoints"
```

---

### Task 10: Backend — Admin audit log endpoints

**Files:**
- Modify: `backend/app/api/v1/admin.py`

**Step 1: Add GET /admin/audit-logs endpoint**

```python
from app.models.audit_log import AuditLog

@router.get("/audit-logs")
async def list_audit_logs(
    event_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    if event_type:
        stmt = stmt.where(AuditLog.event_type == event_type)
    if start_date:
        stmt = stmt.where(AuditLog.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        stmt = stmt.where(AuditLog.created_at <= datetime.fromisoformat(end_date))
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    logs = result.scalars().all()

    # Resolve actor names
    responses = []
    for log in logs:
        actor_name = None
        if log.actor_type == "student":
            s = (await db.execute(select(Student).where(Student.id == log.actor_id))).scalar_one_or_none()
            actor_name = f"{s.first_name} {s.last_name}" if s else "Unknown"
        else:
            p = (await db.execute(select(Professor).where(Professor.id == log.actor_id))).scalar_one_or_none()
            actor_name = f"{p.first_name} {p.last_name}" if p else "Unknown"
        responses.append({
            "id": str(log.id),
            "event_type": log.event_type,
            "actor_type": log.actor_type,
            "actor_name": actor_name,
            "target_type": log.target_type,
            "target_id": str(log.target_id),
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "metadata": json.loads(log.metadata) if log.metadata else None,
            "created_at": log.created_at.isoformat(),
        })
    return responses
```

**Step 2: Add GET /admin/audit-logs/export-csv endpoint**

```python
from fastapi.responses import StreamingResponse
import csv
import io

@router.get("/audit-logs/export-csv")
async def export_audit_logs_csv(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    if start_date:
        stmt = stmt.where(AuditLog.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        stmt = stmt.where(AuditLog.created_at <= datetime.fromisoformat(end_date))
    result = await db.execute(stmt)
    logs = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Type", "Acteur", "Cible", "IP", "User-Agent", "Metadata"])
    for log in logs:
        writer.writerow([
            log.created_at.isoformat(), log.event_type,
            f"{log.actor_type}:{log.actor_id}", f"{log.target_type}:{log.target_id}",
            log.ip_address or "", log.user_agent or "", log.metadata or "",
        ])
    output.seek(0)
    return StreamingResponse(
        output, media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_logs.csv"},
    )
```

**Step 3: Run tests**

```bash
cd backend && pytest -v
```

**Step 4: Commit**

```bash
git add backend/app/api/v1/admin.py
git commit -m "feat: add admin audit logs endpoints with CSV export"
```

---

### Task 11: Frontend — Audit logs section in admin page

**Files:**
- Modify: `frontend/src/hooks/use-admin.ts`
- Modify: `frontend/src/app/admin/page.tsx`

**Step 1: Add hook**

```typescript
export interface AuditLogEntry {
  id: string;
  event_type: string;
  actor_type: string;
  actor_name: string;
  target_type: string;
  target_id: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export function useAuditLogs(eventType?: string, limit = 50) {
  const params = new URLSearchParams();
  if (eventType) params.set("event_type", eventType);
  params.set("limit", String(limit));
  return useSWR<AuditLogEntry[]>(`admin-audit-logs-${eventType || "all"}`, {
    fetcher: () => api.get<AuditLogEntry[]>(`/api/v1/admin/audit-logs?${params}`),
  });
}
```

**Step 2: Add audit logs section to admin page**

New section at the bottom of admin page:
- Heading "Logs d'audit"
- Filter buttons by event type (Tous, Signatures, Validations, Modifications, Justificatifs)
- Table: Date | Type | Acteur | Cible | IP
- Expandable rows showing user-agent + metadata JSON
- "Exporter CSV" button that opens `/api/v1/admin/audit-logs/export-csv` in new tab

**Step 3: Commit**

```bash
git add frontend/src/hooks/use-admin.ts frontend/src/app/admin/page.tsx
git commit -m "feat: add audit logs section to admin dashboard"
```

---

## Axe 3: Exports Conformite

### Task 12: Backend — Certificate PDF generation service

**Files:**
- Modify: `backend/app/services/pdf.py`

**Step 1: Add certificate generation function**

```python
def generate_certificate_pdf(
    school_name: str,
    student_name: str,
    student_email: str,
    period_start: str,
    period_end: str,
    total_hours_planned: float,
    total_hours_realized: float,
    attendance_rate: float,
) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=25*mm, bottomMargin=25*mm)
    styles = getSampleStyleSheet()
    elements = []

    # Title: "CERTIFICAT DE REALISATION"
    title_style = ParagraphStyle("CertTitle", parent=styles["Title"], fontSize=18, alignment=1)
    elements.append(Paragraph("CERTIFICAT DE REALISATION", title_style))
    elements.append(Spacer(1, 15*mm))

    # Body paragraphs with school name, student info, period, hours, rate
    body_style = ParagraphStyle("CertBody", parent=styles["Normal"], fontSize=11, leading=16)
    elements.append(Paragraph(f"<b>Organisme de formation :</b> {school_name}", body_style))
    elements.append(Spacer(1, 5*mm))
    elements.append(Paragraph(f"<b>Apprenant :</b> {student_name} ({student_email})", body_style))
    elements.append(Spacer(1, 5*mm))
    elements.append(Paragraph(f"<b>Periode :</b> du {period_start} au {period_end}", body_style))
    elements.append(Spacer(1, 5*mm))

    # Hours table
    hours_data = [
        ["Heures prevues", "Heures realisees", "Taux de presence"],
        [f"{total_hours_planned:.1f}h", f"{total_hours_realized:.1f}h", f"{attendance_rate:.1f}%"],
    ]
    hours_table = Table(hours_data, colWidths=[60*mm, 60*mm, 60*mm])
    hours_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563eb")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#f3f4f6")),
    ]))
    elements.append(hours_table)
    elements.append(Spacer(1, 15*mm))

    # Signature line
    elements.append(Paragraph(f"Fait le {datetime.now().strftime('%d/%m/%Y')}", body_style))
    elements.append(Spacer(1, 10*mm))
    elements.append(Paragraph(f"Pour {school_name},", body_style))
    elements.append(Paragraph("Signature de l'organisme", body_style))

    doc.build(elements)
    return buf.getvalue()
```

**Step 2: Commit**

```bash
git add backend/app/services/pdf.py
git commit -m "feat: add certificate of completion PDF generator"
```

---

### Task 13: Backend — Export endpoints (certificate + OPCO)

**Files:**
- Create: `backend/app/api/v1/exports.py`
- Modify: `backend/app/main.py` (register router)

**Step 1: Create exports router**

```python
# backend/app/api/v1/exports.py
import csv
import io
import zipfile
from datetime import datetime, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.auth import require_admin
from app.models.student import Student
from app.models.course import Course
from app.models.course_enrollment import CourseEnrollment
from app.models.attendance_record import AttendanceRecord
from app.services.pdf import generate_certificate_pdf
from pydantic import BaseModel

router = APIRouter(prefix="/admin/exports", tags=["exports"], dependencies=[Depends(require_admin)])

SCHOOL_NAME = "Ecole de Commerce"  # TODO: make configurable


class CertificateRequest(BaseModel):
    student_id: str
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD


async def _compute_student_hours(db, student_id, start_dt, end_dt):
    """Compute planned and realized hours for a student in a date range."""
    from uuid import UUID
    sid = UUID(student_id) if isinstance(student_id, str) else student_id

    # Planned hours: courses the student is enrolled in within the date range
    planned_stmt = (
        select(Course)
        .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
        .where(
            CourseEnrollment.student_id == sid,
            Course.start_time >= start_dt,
            Course.end_time <= end_dt,
        )
    )
    planned_courses = (await db.execute(planned_stmt)).scalars().all()
    total_planned = sum(
        (c.end_time - c.start_time).total_seconds() / 3600 for c in planned_courses
    )

    # Realized hours: courses where student was present or late
    realized_stmt = (
        select(Course)
        .join(AttendanceRecord, AttendanceRecord.course_id == Course.id)
        .where(
            AttendanceRecord.student_id == sid,
            AttendanceRecord.status.in_(["present", "late"]),
            Course.start_time >= start_dt,
            Course.end_time <= end_dt,
        )
    )
    realized_courses = (await db.execute(realized_stmt)).scalars().all()
    total_realized = sum(
        (c.end_time - c.start_time).total_seconds() / 3600 for c in realized_courses
    )

    rate = (total_realized / total_planned * 100) if total_planned > 0 else 0
    return total_planned, total_realized, rate


@router.post("/certificate")
async def generate_certificate(
    body: CertificateRequest,
    db: AsyncSession = Depends(get_db),
):
    from uuid import UUID
    student = (await db.execute(select(Student).where(Student.id == UUID(body.student_id)))).scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    start_dt = datetime.fromisoformat(body.start_date)
    end_dt = datetime.fromisoformat(body.end_date + "T23:59:59")

    planned, realized, rate = await _compute_student_hours(db, student.id, start_dt, end_dt)

    pdf_bytes = generate_certificate_pdf(
        school_name=SCHOOL_NAME,
        student_name=f"{student.first_name} {student.last_name}",
        student_email=student.email,
        period_start=body.start_date,
        period_end=body.end_date,
        total_hours_planned=planned,
        total_hours_realized=realized,
        attendance_rate=rate,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=certificat_{student.last_name}_{student.first_name}.pdf"},
    )


@router.post("/certificates-bulk")
async def generate_certificates_bulk(
    start_date: str,
    end_date: str,
    db: AsyncSession = Depends(get_db),
):
    students = (await db.execute(select(Student).order_by(Student.last_name))).scalars().all()
    start_dt = datetime.fromisoformat(start_date)
    end_dt = datetime.fromisoformat(end_date + "T23:59:59")

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for student in students:
            planned, realized, rate = await _compute_student_hours(db, student.id, start_dt, end_dt)
            if planned == 0:
                continue
            pdf_bytes = generate_certificate_pdf(
                school_name=SCHOOL_NAME,
                student_name=f"{student.first_name} {student.last_name}",
                student_email=student.email,
                period_start=start_date,
                period_end=end_date,
                total_hours_planned=planned,
                total_hours_realized=realized,
                attendance_rate=rate,
            )
            zf.writestr(f"certificat_{student.last_name}_{student.first_name}.pdf", pdf_bytes)

    zip_buf.seek(0)
    return Response(
        content=zip_buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=certificats.zip"},
    )


@router.get("/opco")
async def export_opco(
    start_date: str,
    end_date: str,
    db: AsyncSession = Depends(get_db),
):
    students = (await db.execute(select(Student).order_by(Student.last_name))).scalars().all()
    start_dt = datetime.fromisoformat(start_date)
    end_dt = datetime.fromisoformat(end_date + "T23:59:59")

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(["Nom", "Prenom", "Email", "Heures Prevues", "Heures Realisees", "Taux (%)"])

    for student in students:
        planned, realized, rate = await _compute_student_hours(db, student.id, start_dt, end_dt)
        if planned == 0:
            continue
        writer.writerow([
            student.last_name, student.first_name, student.email,
            f"{planned:.1f}", f"{realized:.1f}", f"{rate:.1f}",
        ])

    output.seek(0)
    return StreamingResponse(
        output, media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=export_opco.csv"},
    )
```

**Step 2: Register router in main.py**

```python
from app.api.v1.exports import router as exports_router
app.include_router(exports_router, prefix="/api/v1")
```

**Step 3: Run tests**

```bash
cd backend && pytest -v
```

**Step 4: Commit**

```bash
git add backend/app/api/v1/exports.py backend/app/main.py
git commit -m "feat: add export endpoints (certificate PDF + OPCO CSV)"
```

---

### Task 14: Frontend — Exports section in admin page

**Files:**
- Modify: `frontend/src/hooks/use-admin.ts`
- Modify: `frontend/src/app/admin/page.tsx`

**Step 1: Add export functions to hook**

```typescript
export async function generateCertificate(studentId: string, startDate: string, endDate: string) {
  const resp = await fetch(`${API_URL}/api/v1/admin/exports/certificate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify({ student_id: studentId, start_date: startDate, end_date: endDate }),
  });
  if (!resp.ok) throw new Error("Failed to generate certificate");
  return resp.blob();
}

// Import API_URL from lib/api
```

**Step 2: Add exports section to admin page**

New section "Exports" in admin page with:
- Date range picker (start/end date inputs)
- Student selector (dropdown from existing students list, or "Tous" for bulk)
- "Generer Certificat" button — single student → downloads PDF, "Tous" → downloads ZIP
- "Export OPCO" button — opens CSV download with selected date range
- Use `URL.createObjectURL(blob)` + temporary `<a>` to trigger download

**Step 3: Commit**

```bash
git add frontend/src/hooks/use-admin.ts frontend/src/app/admin/page.tsx
git commit -m "feat: add exports section (certificates + OPCO) to admin dashboard"
```

---

## Axe 4: Role Externe (Tuteur/Entreprise)

### Task 15: Backend — Add password_hash to StudentContact model

**Files:**
- Modify: `backend/app/models/student_contact.py`

**Step 1: Add password_hash field**

```python
password_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
```

**Step 2: Run tests**

```bash
cd backend && pytest -v
```

**Step 3: Commit**

```bash
git add backend/app/models/student_contact.py
git commit -m "feat: add password_hash to StudentContact model"
```

---

### Task 16: Backend — Extend auth for external login

**Files:**
- Modify: `backend/app/core/auth.py`
- Modify: `backend/app/api/v1/auth.py`

**Step 1: Add get_current_external dependency**

In `backend/app/core/auth.py`:

```python
from app.models.student_contact import StudentContact

async def get_current_external(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> StudentContact:
    try:
        payload = jwt.decode(credentials.credentials, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("user_type") != "external":
        raise HTTPException(status_code=403, detail="External access required")
    contact_id = payload.get("sub")
    contact = (await db.execute(
        select(StudentContact).where(StudentContact.id == uuid_mod.UUID(contact_id))
    )).scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=401, detail="Contact not found")
    return contact
```

**Step 2: Extend login endpoint**

In `backend/app/api/v1/auth.py`, after checking professors and students, add:

```python
# Try external (student contact) login
contact_result = await db.execute(select(StudentContact).where(StudentContact.email == body.email))
contact = contact_result.scalar_one_or_none()
if contact and contact.password_hash and verify_password(body.password, contact.password_hash):
    token = create_access_token({"sub": str(contact.id)}, user_type="external")
    return {
        "access_token": token,
        "user": {
            "id": str(contact.id),
            "email": contact.email,
            "first_name": contact.first_name,
            "last_name": contact.last_name,
            "type": "external",
            "student_id": str(contact.student_id),
            "contact_type": contact.type,
        },
    }
```

Import `StudentContact` at the top.

**Step 3: Extend GET /auth/me for external**

In the `/me` endpoint, after student check, add external check:

```python
if payload.get("user_type") == "external":
    contact = (await db.execute(select(StudentContact).where(StudentContact.id == uuid_mod.UUID(sub)))).scalar_one_or_none()
    if contact:
        return {
            "id": str(contact.id), "email": contact.email,
            "first_name": contact.first_name, "last_name": contact.last_name,
            "type": "external", "student_id": str(contact.student_id),
            "contact_type": contact.type,
        }
```

**Step 4: Run tests**

```bash
cd backend && pytest -v
```

**Step 5: Commit**

```bash
git add backend/app/core/auth.py backend/app/api/v1/auth.py
git commit -m "feat: extend auth for external (tutor/company) login"
```

---

### Task 17: Backend — External dashboard endpoints

**Files:**
- Create: `backend/app/api/v1/external.py`
- Modify: `backend/app/main.py` (register router)

**Step 1: Create external router**

```python
# backend/app/api/v1/external.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.auth import get_current_external
from app.models.student_contact import StudentContact
from app.models.student import Student
from app.models.attendance_record import AttendanceRecord
from app.models.course import Course
from app.models.monthly_report import MonthlyReport
from app.models.justification import Justification

router = APIRouter(prefix="/external", tags=["external"])


@router.get("/dashboard")
async def external_dashboard(
    contact: StudentContact = Depends(get_current_external),
    db: AsyncSession = Depends(get_db),
):
    student = (await db.execute(select(Student).where(Student.id == contact.student_id))).scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Attendance stats
    total = (await db.execute(
        select(func.count(AttendanceRecord.id)).where(AttendanceRecord.student_id == student.id)
    )).scalar() or 0
    present = (await db.execute(
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
    rate = (present / total * 100) if total > 0 else 0

    # Attendance history
    history_stmt = (
        select(AttendanceRecord, Course)
        .join(Course, AttendanceRecord.course_id == Course.id)
        .where(AttendanceRecord.student_id == student.id)
        .order_by(Course.start_time.desc())
    )
    history_result = await db.execute(history_stmt)
    history = [
        {
            "course_name": course.name,
            "course_date": course.start_time.strftime("%d/%m/%Y %H:%M"),
            "room": course.room,
            "status": record.status,
            "signed_at": record.signed_at.isoformat() if record.signed_at else None,
        }
        for record, course in history_result.all()
    ]

    return {
        "student": {
            "first_name": student.first_name,
            "last_name": student.last_name,
            "email": student.email,
            "is_alternance": student.is_alternance,
        },
        "stats": {
            "total_courses": total,
            "present": present,
            "absent": absent,
            "late": late,
            "attendance_rate": round(rate, 1),
        },
        "history": history,
    }


@router.get("/reports")
async def list_reports(
    contact: StudentContact = Depends(get_current_external),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(MonthlyReport)
        .where(MonthlyReport.student_id == contact.student_id)
        .order_by(MonthlyReport.month.desc())
    )
    result = await db.execute(stmt)
    reports = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "month": r.month.isoformat(),
            "total_courses": r.total_courses,
            "attended": r.attended,
            "absent": r.absent,
            "late": r.late,
            "attendance_rate": float(r.attendance_rate) if r.attendance_rate else None,
        }
        for r in reports
    ]
```

**Step 2: Register in main.py**

```python
from app.api.v1.external import router as external_router
app.include_router(external_router, prefix="/api/v1")
```

**Step 3: Run tests**

```bash
cd backend && pytest -v
```

**Step 4: Commit**

```bash
git add backend/app/api/v1/external.py backend/app/main.py
git commit -m "feat: add external dashboard and reports endpoints"
```

---

### Task 18: Backend — Seed external contact with password

**Files:**
- Modify: `backend/app/seed.py` (or equivalent seed script)

**Step 1: Update seed to set password_hash on existing student contacts**

```python
# For the existing StudentContact entries, set password_hash
from app.core.auth import hash_password
contact.password_hash = hash_password("parent123")
```

**Step 2: Run seed**

```bash
cd backend && python -m app.seed
```

**Step 3: Commit**

```bash
git add backend/app/seed.py
git commit -m "feat: seed external contact with login password"
```

---

### Task 19: Frontend — Extend auth hook for external type

**Files:**
- Modify: `frontend/src/hooks/use-auth.ts`

**Step 1: Add isExternal computed property**

In the auth hook, add:
```typescript
const isExternal = user?.type === "external";
```

Return `isExternal` from the hook.

**Step 2: Update login redirect**

In the login page, add external redirect:
```typescript
if (data.user.type === "external") {
  router.push("/external");
}
```

**Step 3: Commit**

```bash
git add frontend/src/hooks/use-auth.ts frontend/src/app/login/page.tsx
git commit -m "feat: extend auth hook for external role routing"
```

---

### Task 20: Frontend — External dashboard page

**Files:**
- Create: `frontend/src/app/external/page.tsx`
- Create: `frontend/src/hooks/use-external.ts`

**Step 1: Create external hook**

```typescript
// frontend/src/hooks/use-external.ts
"use client";
import useSWR from "swr";
import { api } from "@/lib/api";

export interface ExternalDashboard {
  student: { first_name: string; last_name: string; email: string; is_alternance: boolean };
  stats: { total_courses: number; present: number; absent: number; late: number; attendance_rate: number };
  history: Array<{
    course_name: string; course_date: string; room: string | null;
    status: string; signed_at: string | null;
  }>;
}

export interface ExternalReport {
  id: string; month: string; total_courses: number;
  attended: number; absent: number; late: number; attendance_rate: number | null;
}

export function useExternalDashboard() {
  return useSWR<ExternalDashboard>("external-dashboard", {
    fetcher: () => api.get<ExternalDashboard>("/api/v1/external/dashboard"),
  });
}

export function useExternalReports() {
  return useSWR<ExternalReport[]>("external-reports", {
    fetcher: () => api.get<ExternalReport[]>("/api/v1/external/reports"),
  });
}
```

**Step 2: Create external page**

`frontend/src/app/external/page.tsx` — Layout following the app's design system:
- Header: "Suivi de [student.first_name] [student.last_name]" + logout button
- 3 stat cards: Taux de presence (%), Absences (count), Retards (count)
- Attendance history table (read-only): Date | Cours | Salle | Statut | Signe
- Monthly reports section: list with month label + "Telecharger" button (if PDF available)
- Same CSS variable patterns as rest of app (`var(--color-*)`, `var(--font-playfair)`)
- Auth guard: redirect to `/login` if not external

**Step 3: Commit**

```bash
git add frontend/src/hooks/use-external.ts frontend/src/app/external/page.tsx
git commit -m "feat: add external (tutor/company) dashboard page"
```

---

### Task 21: Backend + Frontend — Tests for external flow

**Files:**
- Create: `backend/tests/test_external.py`
- Modify: `backend/tests/conftest.py` (seed contact with password)

**Step 1: Add contact password to conftest seed**

```python
contact.password_hash = pwd_context.hash("parent123")
```

**Step 2: Write tests**

```python
# backend/tests/test_external.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_external_login(client: AsyncClient):
    resp = await client.post("/api/v1/auth/login", json={
        "email": "<contact_email_from_seed>",
        "password": "parent123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["type"] == "external"
    assert "access_token" in data

@pytest.mark.asyncio
async def test_external_dashboard(client: AsyncClient):
    login = await client.post("/api/v1/auth/login", json={
        "email": "<contact_email>", "password": "parent123",
    })
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/external/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "student" in data
    assert "stats" in data
    assert "history" in data

@pytest.mark.asyncio
async def test_external_cannot_access_admin(client: AsyncClient):
    login = await client.post("/api/v1/auth/login", json={
        "email": "<contact_email>", "password": "parent123",
    })
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/admin/stats", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403

@pytest.mark.asyncio
async def test_external_reports(client: AsyncClient):
    login = await client.post("/api/v1/auth/login", json={
        "email": "<contact_email>", "password": "parent123",
    })
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/external/reports", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
```

**Step 3: Run tests**

```bash
cd backend && pytest tests/test_external.py -v
```

**Step 4: Commit**

```bash
git add backend/tests/test_external.py backend/tests/conftest.py
git commit -m "test: add external login and dashboard tests"
```

---

### Task 22: Final — Restart servers, verify, push

**Step 1: Run full test suite**

```bash
cd backend && pytest -v
```

**Step 2: Build frontend**

```bash
cd frontend && npm run build
```

**Step 3: Kill and restart servers**

```bash
lsof -ti:8000 | xargs kill -9; lsof -ti:3000 | xargs kill -9
cd backend && uvicorn app.main:app --reload --port 8000 &
cd frontend && npm run dev &
```

**Step 4: Push**

```bash
git push origin main
```
