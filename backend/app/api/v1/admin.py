import asyncio
import csv
import io
import json
import re
from datetime import date, datetime, time
from pathlib import Path
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.auth import require_admin
from app.models.professor import Professor
from app.models.student import Student
from app.models.course import Course
from app.models.course_enrollment import CourseEnrollment
from app.models.attendance_record import AttendanceRecord
from app.models.justification import Justification
from app.models.monthly_report import MonthlyReport
from app.models.notification import Notification
from app.models.audit_log import AuditLog
from app.schemas.student import StudentWithAttendanceResponse
from app.schemas.auth import ProfessorResponse
from app.schemas.attendance import JustificationAdminResponse, ReviewJustificationRequest
from app.services.audit import create_audit_log
from app.core.sanitize import sanitize_text

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _parse_iso_datetime(value: str) -> datetime:
    """Parse an ISO 8601 datetime string, handling +HH:MM timezone offsets
    that Python 3.9's datetime.fromisoformat() does not support."""
    cleaned = re.sub(r"[+-]\d{2}:\d{2}$", "", value)
    return datetime.fromisoformat(cleaned)


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    total_students = (await db.execute(select(func.count(Student.id)))).scalar() or 0
    total_professors = (await db.execute(select(func.count(Professor.id)))).scalar() or 0

    today = date.today()
    start = datetime.combine(today, time.min)
    end = datetime.combine(today, time.max)
    total_courses_today = (await db.execute(
        select(func.count(Course.id)).where(Course.start_time >= start, Course.start_time <= end)
    )).scalar() or 0

    # Global attendance rate
    total_records = (await db.execute(select(func.count(AttendanceRecord.id)))).scalar() or 0
    present_records = (await db.execute(
        select(func.count(AttendanceRecord.id)).where(AttendanceRecord.status.in_(["present", "late"]))
    )).scalar() or 0
    global_rate = (present_records / total_records * 100) if total_records > 0 else 0

    # Alerts: students with rate < 70%
    low_attendance_count = 0  # Simplified for MVP

    return {
        "total_students": total_students,
        "total_professors": total_professors,
        "total_courses_today": total_courses_today,
        "global_attendance_rate": round(global_rate, 1),
        "total_attendance_records": total_records,
        "low_attendance_alerts": low_attendance_count,
    }


@router.get("/professors", response_model=list[ProfessorResponse])
async def get_professors(db: AsyncSession = Depends(get_db)):
    professors = (await db.execute(select(Professor).order_by(Professor.last_name))).scalars().all()
    return [
        ProfessorResponse(
            id=str(p.id), email=p.email, first_name=p.first_name,
            last_name=p.last_name, role=p.role,
        )
        for p in professors
    ]


@router.get("/students", response_model=list[StudentWithAttendanceResponse])
async def get_students(db: AsyncSession = Depends(get_db)):
    students = (await db.execute(select(Student).order_by(Student.last_name))).scalars().all()
    result = []
    for s in students:
        # Get attendance stats
        total = (await db.execute(
            select(func.count(AttendanceRecord.id)).where(AttendanceRecord.student_id == s.id)
        )).scalar() or 0
        attended = (await db.execute(
            select(func.count(AttendanceRecord.id))
            .where(AttendanceRecord.student_id == s.id, AttendanceRecord.status == "present")
        )).scalar() or 0
        absent = (await db.execute(
            select(func.count(AttendanceRecord.id))
            .where(AttendanceRecord.student_id == s.id, AttendanceRecord.status == "absent")
        )).scalar() or 0
        late = (await db.execute(
            select(func.count(AttendanceRecord.id))
            .where(AttendanceRecord.student_id == s.id, AttendanceRecord.status == "late")
        )).scalar() or 0
        rate = (attended / total * 100) if total > 0 else None

        result.append(StudentWithAttendanceResponse(
            id=str(s.id), email=s.email, first_name=s.first_name,
            last_name=s.last_name, is_alternance=s.is_alternance,
            attendance_rate=round(rate, 1) if rate is not None else None,
            total_courses=total, attended=attended, absent=absent, late=late,
        ))
    return result


# ---------- Justification management ----------

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads" / "justifications"


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


@router.put("/justifications/{justification_id}/review")
async def review_justification(
    justification_id: str,
    body: ReviewJustificationRequest,
    request: Request,
    professor: Professor = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Justification).where(Justification.id == UUID(justification_id))
    result = await db.execute(stmt)
    justif = result.scalar_one_or_none()
    if not justif:
        raise HTTPException(status_code=404, detail="Justification not found")
    if justif.status != "pending":
        raise HTTPException(status_code=400, detail="Already reviewed")
    if body.decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Decision must be 'approved' or 'rejected'")

    # Sanitize admin comment
    if body.comment:
        body.comment = sanitize_text(body.comment)

    justif.status = body.decision
    justif.reviewed_at = datetime.utcnow()
    justif.reviewed_by = professor.id

    decision_text = "approuvee" if body.decision == "approved" else "refusee"
    notification = Notification(
        student_id=justif.student_id,
        type="justification_reviewed",
        title=f"Justification {decision_text}",
        message=f"Votre justification a ete {decision_text}." + (f" Commentaire: {body.comment}" if body.comment else ""),
        data=json.dumps({"justification_id": str(justif.id), "decision": body.decision}),
    )
    db.add(notification)
    await create_audit_log(
        db, "justification_review", "admin", professor.id, "justification", justif.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        metadata={"decision": body.decision, "comment": body.comment},
    )
    await db.commit()
    return {"ok": True, "status": justif.status}


@router.get("/justification-files/{justification_id}/{filename}")
async def serve_justification_file_admin(
    justification_id: str,
    filename: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Justification).where(Justification.id == UUID(justification_id))
    result = await db.execute(stmt)
    justif = result.scalar_one_or_none()
    if not justif:
        raise HTTPException(status_code=404, detail="Justification not found")
    safe_filename = Path(filename).name
    file_path = UPLOADS_DIR / justification_id / safe_filename
    if not await asyncio.to_thread(file_path.exists):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)


# ---------- Report PDF ----------

REPORTS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads" / "reports"


@router.get("/reports/{report_id}/pdf")
async def serve_report_pdf(
    report_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(MonthlyReport).where(MonthlyReport.id == UUID(report_id))
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if not report.pdf_url:
        raise HTTPException(status_code=404, detail="PDF not available for this report")

    # pdf_url is a relative path like "uploads/reports/{student_id}/{month}.pdf"
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    file_path = base_dir / report.pdf_url
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found on disk")

    return FileResponse(file_path, media_type="application/pdf")


# ---------- Audit logs ----------


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
        stmt = stmt.where(AuditLog.created_at >= _parse_iso_datetime(start_date))
    if end_date:
        stmt = stmt.where(AuditLog.created_at <= _parse_iso_datetime(end_date))
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    logs = result.scalars().all()

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
            "metadata": json.loads(log.extra_data) if log.extra_data else None,
            "created_at": log.created_at.isoformat(),
        })
    return responses


@router.get("/audit-logs/export-csv")
async def export_audit_logs_csv(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    if start_date:
        stmt = stmt.where(AuditLog.created_at >= _parse_iso_datetime(start_date))
    if end_date:
        stmt = stmt.where(AuditLog.created_at <= _parse_iso_datetime(end_date))
    result = await db.execute(stmt)
    logs = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Type", "Acteur", "Cible", "IP", "User-Agent", "Metadata"])
    for log in logs:
        writer.writerow([
            log.created_at.isoformat(), log.event_type,
            f"{log.actor_type}:{log.actor_id}", f"{log.target_type}:{log.target_id}",
            log.ip_address or "", log.user_agent or "", log.extra_data or "",
        ])
    output.seek(0)
    return StreamingResponse(
        output, media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_logs.csv"},
    )
