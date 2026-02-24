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
from app.models.justification_comment import JustificationComment
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


@router.get("/courses")
async def get_admin_courses(
    date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    from datetime import date as date_type
    if date:
        try:
            target_date = date_type.fromisoformat(date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format, expected YYYY-MM-DD")
    else:
        target_date = date_type.today()

    day_start = datetime.combine(target_date, time.min)
    day_end = datetime.combine(target_date, time.max)

    # Main query: courses with professor and attendance aggregations
    stmt = (
        select(
            Course.id,
            Course.name,
            Course.room,
            Course.start_time,
            Course.end_time,
            Professor.first_name.label("prof_first"),
            Professor.last_name.label("prof_last"),
            func.count(func.distinct(CourseEnrollment.student_id)).label("total_students"),
            func.count(func.distinct(AttendanceRecord.id)).filter(AttendanceRecord.status == "present").label("present_count"),
            func.count(func.distinct(AttendanceRecord.id)).filter(AttendanceRecord.status == "absent").label("absent_count"),
            func.count(func.distinct(AttendanceRecord.id)).filter(AttendanceRecord.status == "late").label("late_count"),
            func.count(func.distinct(AttendanceRecord.id)).filter(
                (AttendanceRecord.signed_at != None) | (AttendanceRecord.qr_signed_at != None)
            ).label("signed_count"),
            func.count(AttendanceRecord.id).label("record_count"),
        )
        .join(Professor, Professor.id == Course.professor_id)
        .outerjoin(CourseEnrollment, CourseEnrollment.course_id == Course.id)
        .outerjoin(AttendanceRecord, AttendanceRecord.course_id == Course.id)
        .where(Course.start_time >= day_start, Course.start_time <= day_end)
        .group_by(Course.id, Professor.first_name, Professor.last_name)
        .order_by(Course.start_time.desc())
    )
    rows = (await db.execute(stmt)).all()

    return [
        {
            "id": str(row.id),
            "name": row.name,
            "room": row.room,
            "start_time": row.start_time.isoformat(),
            "end_time": row.end_time.isoformat(),
            "professor_name": f"{row.prof_first} {row.prof_last}",
            "total_students": row.total_students,
            "present_count": row.present_count,
            "absent_count": row.absent_count,
            "late_count": row.late_count,
            "signed_count": row.signed_count,
            "is_validated": row.record_count > 0,
        }
        for row in rows
    ]


@router.get("/courses/{course_id}")
async def get_admin_course_detail(
    course_id: str,
    db: AsyncSession = Depends(get_db),
):
    course = await db.get(Course, UUID(course_id))
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    professor = await db.get(Professor, course.professor_id)

    # Get attendance records with student info
    stmt = (
        select(AttendanceRecord, Student)
        .join(Student, Student.id == AttendanceRecord.student_id)
        .where(AttendanceRecord.course_id == course.id)
        .order_by(Student.last_name, Student.first_name)
    )
    rows = (await db.execute(stmt)).all()

    return {
        "id": str(course.id),
        "name": course.name,
        "room": course.room,
        "start_time": course.start_time.isoformat(),
        "end_time": course.end_time.isoformat(),
        "professor_name": f"{professor.first_name} {professor.last_name}" if professor else "Unknown",
        "students": [
            {
                "student_id": str(student.id),
                "student_name": f"{student.first_name} {student.last_name}",
                "status": record.status,
                "signed_at": record.signed_at.isoformat() if record.signed_at else None,
                "qr_signed_at": record.qr_signed_at.isoformat() if record.qr_signed_at else None,
            }
            for record, student in rows
        ],
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
