import asyncio
from datetime import date, datetime, timedelta
from pathlib import Path
from sqlalchemy import select, func
from app.core.database import async_session
from app.models.student import Student
from app.models.student_contact import StudentContact
from app.models.course import Course
from app.models.course_enrollment import CourseEnrollment
from app.models.attendance_record import AttendanceRecord
from app.models.monthly_report import MonthlyReport
from app.services.pdf import generate_attendance_pdf
from app.services.email import email_service

REPORTS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "reports"

FRENCH_MONTHS = [
    "", "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre"
]


async def generate_monthly_reports():
    """Generate and send monthly attendance reports. Runs on 1st of each month."""
    today = date.today()
    # Report for previous month
    first_of_this_month = today.replace(day=1)
    last_month_end = first_of_this_month - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)
    month_label = f"{FRENCH_MONTHS[last_month_end.month]} {last_month_end.year}"

    async with async_session() as db:
        # Get all students
        students = (await db.execute(select(Student))).scalars().all()

        for student in students:
            # Get courses the student was enrolled in during last month
            stmt = (
                select(Course)
                .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
                .where(CourseEnrollment.student_id == student.id)
                .where(Course.start_time >= datetime.combine(last_month_start, datetime.min.time()))
                .where(Course.start_time < datetime.combine(first_of_this_month, datetime.min.time()))
            )
            courses = (await db.execute(stmt)).scalars().all()
            if not courses:
                continue

            # Get attendance records
            course_ids = [c.id for c in courses]
            stmt = (
                select(AttendanceRecord)
                .where(AttendanceRecord.student_id == student.id)
                .where(AttendanceRecord.course_id.in_(course_ids))
            )
            records = (await db.execute(stmt)).scalars().all()
            records_by_course = {r.course_id: r for r in records}

            # Calculate stats
            total = len(courses)
            attended = sum(1 for r in records if r.status == "present")
            absent = sum(1 for r in records if r.status == "absent")
            late = sum(1 for r in records if r.status == "late")
            # Students with no record for a course count as absent
            absent += total - len(records)
            rate = (attended / total * 100) if total > 0 else 0

            stats = {
                "total_courses": total, "attended": attended,
                "absent": absent, "late": late, "attendance_rate": rate,
            }

            # Build course details
            course_details = []
            for c in sorted(courses, key=lambda x: x.start_time):
                rec = records_by_course.get(c.id)
                status_map = {"present": "Present", "absent": "Absent", "late": "En retard"}
                course_details.append({
                    "date": c.start_time.strftime("%d/%m/%Y"),
                    "course": c.name,
                    "status": status_map.get(rec.status, "Absent") if rec else "Absent",
                    "signed": rec.signed_at is not None if rec else False,
                })

            # Generate PDF
            pdf_bytes = generate_attendance_pdf(
                student_name=f"{student.first_name} {student.last_name}",
                month=month_label,
                school_name="Ecole de Commerce",
                stats=stats,
                course_details=course_details,
            )

            # Save PDF to disk
            student_dir = REPORTS_DIR / str(student.id)
            await asyncio.to_thread(student_dir.mkdir, parents=True, exist_ok=True)
            month_filename = f"{last_month_end.year}-{last_month_end.month:02d}.pdf"
            pdf_path = student_dir / month_filename
            await asyncio.to_thread(pdf_path.write_bytes, pdf_bytes)
            relative_pdf_url = f"uploads/reports/{student.id}/{month_filename}"

            # Send to all contacts
            contacts_stmt = select(StudentContact).where(StudentContact.student_id == student.id)
            contacts = (await db.execute(contacts_stmt)).scalars().all()

            for contact in contacts:
                await email_service.send_monthly_report(
                    contact_email=contact.email,
                    contact_name=f"{contact.first_name} {contact.last_name}",
                    student_name=f"{student.first_name} {student.last_name}",
                    month=month_label,
                    pdf_bytes=pdf_bytes,
                )

                report = MonthlyReport(
                    student_id=student.id, contact_id=contact.id,
                    month=last_month_start,
                    total_courses=total, attended=attended,
                    absent=absent, late=late, attendance_rate=rate,
                    pdf_url=relative_pdf_url, sent_at=datetime.utcnow(),
                )
                db.add(report)

        await db.commit()
        print(f"Monthly reports generated for {month_label}")
