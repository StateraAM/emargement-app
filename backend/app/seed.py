"""Seed database with rich mock data for development and analytics."""
import asyncio
import json
import random
import uuid
from datetime import datetime, date, timedelta
from pathlib import Path
from passlib.context import CryptContext
from app.core.database import async_session, engine, Base
from app.models import *

random.seed(42)

pwd_context = CryptContext(schemes=["bcrypt"])

# Pre-hash passwords once (bcrypt is slow)
PROF_HASH = pwd_context.hash("password123")
ADMIN_HASH = pwd_context.hash("admin123")
PROF2_HASH = pwd_context.hash("prof123")
STUDENT_HASH = pwd_context.hash("student123")
PARENT_HASH = pwd_context.hash("parent123")

COURSE_NAMES = [
    "Marketing L3", "Finance M1", "Strategie M2", "Droit des affaires L3",
    "Comptabilite M1", "Economie L3", "Anglais M2", "Management M1",
    "RH L3", "Communication L3",
]

ROOMS = ["A102", "A201", "B102", "B204", "C105", "C301", "D203", "D310"]

# 2-hour time blocks: (start_hour, end_hour)
TIME_BLOCKS = [(9, 11), (11, 13), (14, 16), (16, 18)]


def _weekdays_back(n: int) -> list[date]:
    """Return the last n weekdays before today, most recent first."""
    days = []
    d = date.today() - timedelta(days=1)
    while len(days) < n:
        if d.weekday() < 5:  # Mon-Fri
            days.append(d)
        d -= timedelta(days=1)
    return days


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # ── Professors ───────────────────────────────────────────────
        prof1 = Professor(
            id=uuid.uuid4(), email="jean.dupont@ecole.fr",
            first_name="Jean", last_name="Dupont",
            password_hash=PROF_HASH, role="prof",
        )
        admin = Professor(
            id=uuid.uuid4(), email="admin@ecole.fr",
            first_name="Admin", last_name="Ecole",
            password_hash=ADMIN_HASH, role="admin",
        )
        prof2 = Professor(
            id=uuid.uuid4(), email="marie.bernard@ecole.fr",
            first_name="Marie", last_name="Bernard",
            password_hash=PROF2_HASH, role="prof",
        )
        professors = [prof1, admin, prof2]
        db.add_all(professors)

        # ── Students (15) ────────────────────────────────────────────
        student_data = [
            # --- 5 "good" students (idx 0-4): 85-95% present, rarely late ---
            ("alice.martin@etu.fr", "Alice", "Martin", True),
            ("bob.bernard@etu.fr", "Bob", "Bernard", False),
            ("claire.petit@etu.fr", "Claire", "Petit", True),
            ("david.leroy@etu.fr", "David", "Leroy", False),
            ("emma.moreau@etu.fr", "Emma", "Moreau", True),
            # --- 5 "average" students (idx 5-9): 65-80% present, sometimes late ---
            ("frank.simon@etu.fr", "Frank", "Simon", False),
            ("gaelle.laurent@etu.fr", "Gaelle", "Laurent", False),
            ("hugo.michel@etu.fr", "Hugo", "Michel", True),
            ("iris.garcia@etu.fr", "Iris", "Garcia", True),
            ("julien.roux@etu.fr", "Julien", "Roux", False),
            # --- 5 "at-risk" students (idx 10-14): 40-60% present, often late ---
            ("kevin.fournier@etu.fr", "Kevin", "Fournier", False),
            ("laura.girard@etu.fr", "Laura", "Girard", True),
            ("maxime.bonnet@etu.fr", "Maxime", "Bonnet", False),
            ("nina.dupuis@etu.fr", "Nina", "Dupuis", True),
            ("olivier.lambert@etu.fr", "Olivier", "Lambert", False),
        ]

        students: list[Student] = []
        for email, first, last, alt in student_data:
            s = Student(
                id=uuid.uuid4(), email=email, first_name=first, last_name=last,
                is_alternance=alt, password_hash=STUDENT_HASH,
            )
            students.append(s)
            db.add(s)

        # ── Student Contacts (for alternance students) ───────────────
        for s in students:
            if s.is_alternance:
                db.add(StudentContact(
                    student_id=s.id, type="parent",
                    email="parent.%s@mail.fr" % s.last_name.lower(),
                    first_name="Parent", last_name=s.last_name,
                    password_hash=PARENT_HASH,
                ))
                db.add(StudentContact(
                    student_id=s.id, type="tutor",
                    email="tuteur.%s@entreprise.fr" % s.last_name.lower(),
                    first_name="Tuteur", last_name=s.last_name,
                    company="Entreprise SA",
                    password_hash=PARENT_HASH,
                ))

        # ── Attendance behaviour profiles ─────────────────────────────
        # Each profile: (present_prob, late_if_present_prob, sign_if_present_prob)
        good_profile = (0.92, 0.05, 0.85)
        avg_profile = (0.73, 0.15, 0.70)
        risk_profile = (0.50, 0.30, 0.55)

        def _profile_for(idx: int):
            if idx < 5:
                return good_profile
            elif idx < 10:
                return avg_profile
            else:
                return risk_profile

        # ── Helper: create attendance record for a student ────────────
        def _make_attendance(course_id, student, student_idx, course_dt):
            """Return an AttendanceRecord (or None if student has no record yet)."""
            present_prob, late_prob, sign_prob = _profile_for(student_idx)
            r = random.random()

            if r < present_prob:
                # Present or late
                if random.random() < late_prob:
                    status = "late"
                else:
                    status = "present"
            else:
                status = "absent"

            marked_at = course_dt + timedelta(minutes=random.randint(5, 15))
            token = uuid.uuid4()
            token_expires = marked_at + timedelta(hours=24)

            signed_at = None
            if status in ("present", "late"):
                if random.random() < sign_prob:
                    signed_at = marked_at + timedelta(
                        minutes=random.randint(10, 120)
                    )

            return AttendanceRecord(
                id=uuid.uuid4(),
                course_id=course_id,
                student_id=student.id,
                status=status,
                marked_by_prof_at=marked_at,
                signature_token=token,
                signature_token_expires=token_expires,
                signed_at=signed_at,
            )

        # ── Past 30 weekdays of courses ───────────────────────────────
        past_days = _weekdays_back(30)
        all_courses: list[Course] = []
        all_enrollments: list[CourseEnrollment] = []
        all_records: list[AttendanceRecord] = []

        # Professors who teach (prof1 and prof2; admin only teaches occasionally)
        teaching_profs = [prof1, prof2, admin]

        for day in past_days:
            # 3-5 courses per day
            n_courses = random.randint(3, 5)
            # Pick time blocks for the day
            day_blocks = random.sample(TIME_BLOCKS, min(n_courses, len(TIME_BLOCKS)))
            if n_courses > len(TIME_BLOCKS):
                day_blocks.append(random.choice(TIME_BLOCKS))

            for i, (start_h, end_h) in enumerate(day_blocks[:n_courses]):
                course_name = COURSE_NAMES[
                    (past_days.index(day) * 5 + i) % len(COURSE_NAMES)
                ]
                prof = teaching_profs[i % len(teaching_profs)]
                room = ROOMS[(past_days.index(day) + i) % len(ROOMS)]

                c = Course(
                    id=uuid.uuid4(),
                    name=course_name,
                    professor_id=prof.id,
                    room=room,
                    start_time=datetime(day.year, day.month, day.day, start_h, 0),
                    end_time=datetime(day.year, day.month, day.day, end_h, 0),
                )
                all_courses.append(c)

                # Enroll all students
                for s in students:
                    all_enrollments.append(
                        CourseEnrollment(course_id=c.id, student_id=s.id)
                    )

                # Create attendance records
                course_dt = datetime(day.year, day.month, day.day, start_h, 0)
                for idx, s in enumerate(students):
                    rec = _make_attendance(c.id, s, idx, course_dt)
                    all_records.append(rec)

        db.add_all(all_courses)
        db.add_all(all_enrollments)
        db.add_all(all_records)

        # ── Today's courses (keep existing structure) ─────────────────
        now = datetime.now()
        today = date.today()
        current_hour = now.hour

        courses_today_data = [
            ("Marketing L3", "B204", 9, 11, prof1),
            ("Finance M1", "A102", current_hour, current_hour + 2, prof1),
            ("Strategie M2", "C301", current_hour + 3, current_hour + 5, prof2),
        ]
        courses_today: list[Course] = []
        for name, room, start_h, end_h, prof in courses_today_data:
            c = Course(
                id=uuid.uuid4(), name=name, professor_id=prof.id, room=room,
                start_time=datetime(today.year, today.month, today.day, min(start_h, 23), 0),
                end_time=datetime(today.year, today.month, today.day, min(end_h, 23), 0),
            )
            courses_today.append(c)
            db.add(c)

        # Enroll all students in today's courses
        for c in courses_today:
            for s in students:
                db.add(CourseEnrollment(course_id=c.id, student_id=s.id))

        # ── Justifications (seed for testing review flow) ─────────────
        # Collect absent records per student for justification seeding
        absent_records_by_student: dict[uuid.UUID, list[AttendanceRecord]] = {}
        for r in all_records:
            if r.status == "absent":
                absent_records_by_student.setdefault(r.student_id, []).append(r)

        justification_data = [
            # (student_idx, reason, status, reviewed_by_prof)
            (0, "Rendez-vous medical - certificat joint", "pending", None),
            (1, "Rendez-vous medical - certificat joint", "pending", None),
            (2, "Probleme de transport - greve SNCF", "pending", None),
            (5, "Maladie - certificat medical", "approved", admin),
            (6, "Urgence familiale", "approved", admin),
            (7, "Rendez-vous dentaire", "approved", prof1),
            (10, "Panne de reveil", "rejected", admin),
            (11, "Raison personnelle", "rejected", prof2),
            (12, "Rendez-vous administratif en mairie", "pending", None),
        ]

        all_justifications: list[Justification] = []
        for student_idx, reason, jstatus, reviewer in justification_data:
            student = students[student_idx]
            absent_list = absent_records_by_student.get(student.id, [])
            if not absent_list:
                continue
            # Pick a random absent record that doesn't already have a justification
            used_record_ids = {j.attendance_record_id for j in all_justifications}
            available = [r for r in absent_list if r.id not in used_record_ids]
            if not available:
                continue
            target_record = random.choice(available)

            justif_id = uuid.uuid4()

            # Create sample uploaded files for justifications mentioning "certificat"
            file_paths_json = None
            if "certificat" in reason.lower():
                justif_upload_dir = Path(__file__).resolve().parent.parent / "uploads" / "justifications" / str(justif_id)
                justif_upload_dir.mkdir(parents=True, exist_ok=True)
                # Create a sample PDF-like file
                sample_pdf = justif_upload_dir / "certificat_medical.pdf"
                sample_pdf.write_bytes(b"%PDF-1.4 Sample certificat medical pour test")
                # Create a sample image
                sample_img = justif_upload_dir / "justificatif.png"
                # Minimal valid PNG (1x1 white pixel)
                sample_img.write_bytes(
                    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
                    b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00"
                    b"\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00"
                    b"\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
                )
                file_paths_json = json.dumps(["certificat_medical.pdf", "justificatif.png"])

            j = Justification(
                id=justif_id,
                attendance_record_id=target_record.id,
                student_id=student.id,
                reason=reason,
                file_paths=file_paths_json,
                status=jstatus,
                created_at=target_record.marked_by_prof_at + timedelta(hours=random.randint(2, 48)),
            )
            if jstatus in ("approved", "rejected") and reviewer:
                j.reviewed_at = j.created_at + timedelta(hours=random.randint(1, 24))
                j.reviewed_by = reviewer.id
            all_justifications.append(j)

        db.add_all(all_justifications)

        # ── Notifications for unsigned recent records ─────────────────
        # Find a recent "late" unsigned record for Alice (good student with a late)
        unsigned_late_records = [
            r for r in all_records
            if r.student_id == students[0].id
            and r.status == "late"
            and r.signed_at is None
        ]
        if unsigned_late_records:
            rec = unsigned_late_records[-1]
            db.add(Notification(
                student_id=students[0].id, type="signature_request",
                title="Signature requise",
                message="Veuillez signer votre presence pour le cours",
                data=json.dumps({
                    "record_id": str(rec.id),
                    "signature_token": str(rec.signature_token),
                }),
                is_read=False,
            ))

        await db.commit()

        # ── Print summary ─────────────────────────────────────────────
        total_courses = len(all_courses) + len(courses_today)
        print("=" * 60)
        print("SEED COMPLETE")
        print("=" * 60)
        print(f"Professors:  {len(professors)}")
        print(f"Students:    {len(students)} ({sum(1 for s in students if s.is_alternance)} alternance)")
        print(f"Past courses: {len(all_courses)} (30 weekdays)")
        print(f"Today courses: {len(courses_today)}")
        print(f"Total courses: {total_courses}")
        print(f"Enrollments: {len(all_enrollments) + len(courses_today) * len(students)}")
        print(f"Attendance records: {len(all_records)}")
        pending_j = sum(1 for j in all_justifications if j.status == "pending")
        approved_j = sum(1 for j in all_justifications if j.status == "approved")
        rejected_j = sum(1 for j in all_justifications if j.status == "rejected")
        print(f"Justifications: {len(all_justifications)} (pending={pending_j}, approved={approved_j}, rejected={rejected_j})")
        print("-" * 60)

        # Stats per profile
        for label, start_idx, end_idx in [
            ("Good (0-4)", 0, 5), ("Average (5-9)", 5, 10), ("At-risk (10-14)", 10, 15)
        ]:
            group_ids = {students[i].id for i in range(start_idx, end_idx)}
            group_recs = [r for r in all_records if r.student_id in group_ids]
            present = sum(1 for r in group_recs if r.status in ("present", "late"))
            total = len(group_recs)
            signed = sum(1 for r in group_recs if r.signed_at is not None)
            rate = (present / total * 100) if total else 0
            print(f"  {label}: {rate:.0f}% attendance, {signed}/{present} signed")

        print("-" * 60)
        print("Test accounts:")
        print("  Prof:  jean.dupont@ecole.fr / password123")
        print("  Prof:  marie.bernard@ecole.fr / prof123")
        print("  Admin: admin@ecole.fr / admin123")
        print("  Student: alice.martin@etu.fr / student123")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed())
