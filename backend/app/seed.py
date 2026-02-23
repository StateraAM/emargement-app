"""Seed database with mock data for development."""
import asyncio
import json
import uuid
from datetime import datetime, date, timedelta
from passlib.context import CryptContext
from app.core.database import async_session, engine, Base
from app.models import *

pwd_context = CryptContext(schemes=["bcrypt"])


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # Professors
        prof1 = Professor(
            id=uuid.uuid4(), email="jean.dupont@ecole.fr",
            first_name="Jean", last_name="Dupont",
            password_hash=pwd_context.hash("password123"), role="prof"
        )
        admin = Professor(
            id=uuid.uuid4(), email="admin@ecole.fr",
            first_name="Admin", last_name="Ecole",
            password_hash=pwd_context.hash("admin123"), role="admin"
        )
        db.add_all([prof1, admin])

        # Students
        students = []
        student_data = [
            ("alice.martin@etu.fr", "Alice", "Martin", True),
            ("bob.bernard@etu.fr", "Bob", "Bernard", False),
            ("claire.petit@etu.fr", "Claire", "Petit", True),
            ("david.leroy@etu.fr", "David", "Leroy", False),
            ("emma.moreau@etu.fr", "Emma", "Moreau", True),
            ("frank.simon@etu.fr", "Frank", "Simon", False),
            ("gaelle.laurent@etu.fr", "Gaelle", "Laurent", False),
            ("hugo.michel@etu.fr", "Hugo", "Michel", True),
        ]
        for email, first, last, alt in student_data:
            s = Student(
                id=uuid.uuid4(), email=email, first_name=first, last_name=last,
                is_alternance=alt, password_hash=pwd_context.hash("student123"),
            )
            students.append(s)
            db.add(s)

        alice = students[0]
        bob = students[1]

        # Contacts for alternance students
        for s in students:
            if s.is_alternance:
                db.add(StudentContact(
                    student_id=s.id, type="parent",
                    email="parent.%s@mail.fr" % s.last_name.lower(),
                    first_name="Parent", last_name=s.last_name,
                ))
                db.add(StudentContact(
                    student_id=s.id, type="tutor",
                    email="tuteur.%s@entreprise.fr" % s.last_name.lower(),
                    first_name="Tuteur", last_name=s.last_name,
                    company="Entreprise SA",
                ))

        # --- Courses ---
        now = datetime.now()
        today = date.today()
        current_hour = now.hour

        # Today's courses: one past, one happening now, one upcoming
        courses_today = [
            ("Marketing L3", "B204", 9, 11),
            ("Finance M1", "A102", current_hour, current_hour + 2),  # in progress now
            ("Strategie M2", "C301", current_hour + 3, current_hour + 5),  # upcoming
        ]
        courses = []
        for name, room, start_h, end_h in courses_today:
            c = Course(
                id=uuid.uuid4(), name=name, professor_id=prof1.id, room=room,
                start_time=datetime(today.year, today.month, today.day, min(start_h, 23), 0),
                end_time=datetime(today.year, today.month, today.day, min(end_h, 23), 0),
            )
            courses.append(c)
            db.add(c)

        # Enroll all students in today's courses
        for c in courses:
            for s in students:
                db.add(CourseEnrollment(course_id=c.id, student_id=s.id))

        # --- Past attendance records (to give Alice history) ---
        past_now = datetime.utcnow()

        # Yesterday: Droit des affaires L3 — Alice present + signed
        yesterday = today - timedelta(days=1)
        c_droit = Course(
            id=uuid.uuid4(), name="Droit des affaires L3", professor_id=prof1.id, room="A201",
            start_time=datetime(yesterday.year, yesterday.month, yesterday.day, 10, 0),
            end_time=datetime(yesterday.year, yesterday.month, yesterday.day, 12, 0),
        )
        db.add(c_droit)
        for s in students:
            db.add(CourseEnrollment(course_id=c_droit.id, student_id=s.id))

        rec_id = uuid.uuid4()
        db.add(AttendanceRecord(
            id=rec_id, course_id=c_droit.id, student_id=alice.id, status="present",
            marked_by_prof_at=past_now - timedelta(days=1),
            signature_token=uuid.uuid4(), signature_token_expires=past_now + timedelta(hours=23),
            signed_at=past_now - timedelta(days=1, hours=-1),
        ))
        # Bob absent yesterday
        db.add(AttendanceRecord(
            id=uuid.uuid4(), course_id=c_droit.id, student_id=bob.id, status="absent",
            marked_by_prof_at=past_now - timedelta(days=1),
            signature_token=uuid.uuid4(), signature_token_expires=past_now + timedelta(hours=23),
        ))

        # 3 days ago: Comptabilite M1 — Alice late (unsigned)
        day3 = today - timedelta(days=3)
        c_compta = Course(
            id=uuid.uuid4(), name="Comptabilite M1", professor_id=prof1.id, room="B102",
            start_time=datetime(day3.year, day3.month, day3.day, 14, 0),
            end_time=datetime(day3.year, day3.month, day3.day, 16, 0),
        )
        db.add(c_compta)
        for s in students:
            db.add(CourseEnrollment(course_id=c_compta.id, student_id=s.id))

        rec_id_late = uuid.uuid4()
        token_late = uuid.uuid4()
        db.add(AttendanceRecord(
            id=rec_id_late, course_id=c_compta.id, student_id=alice.id, status="late",
            marked_by_prof_at=past_now - timedelta(days=3),
            signature_token=token_late, signature_token_expires=past_now + timedelta(days=20),
        ))
        # Notification for Alice's unsigned late record
        db.add(Notification(
            student_id=alice.id, type="signature_request",
            title="Signature requise",
            message="Veuillez signer votre presence pour le cours Comptabilite M1",
            data=json.dumps({"record_id": str(rec_id_late), "signature_token": str(token_late)}),
            is_read=False,
        ))

        # 5 days ago: Economie L3 — Alice absent
        day5 = today - timedelta(days=5)
        c_eco = Course(
            id=uuid.uuid4(), name="Economie L3", professor_id=prof1.id, room="C105",
            start_time=datetime(day5.year, day5.month, day5.day, 9, 0),
            end_time=datetime(day5.year, day5.month, day5.day, 11, 0),
        )
        db.add(c_eco)
        for s in students:
            db.add(CourseEnrollment(course_id=c_eco.id, student_id=s.id))

        db.add(AttendanceRecord(
            id=uuid.uuid4(), course_id=c_eco.id, student_id=alice.id, status="absent",
            marked_by_prof_at=past_now - timedelta(days=5),
            signature_token=uuid.uuid4(), signature_token_expires=past_now - timedelta(days=4),
        ))

        # Last week: Anglais M2 — Alice present + signed
        day7 = today - timedelta(days=7)
        c_anglais = Course(
            id=uuid.uuid4(), name="Anglais M2", professor_id=prof1.id, room="D203",
            start_time=datetime(day7.year, day7.month, day7.day, 11, 0),
            end_time=datetime(day7.year, day7.month, day7.day, 13, 0),
        )
        db.add(c_anglais)
        for s in students:
            db.add(CourseEnrollment(course_id=c_anglais.id, student_id=s.id))

        db.add(AttendanceRecord(
            id=uuid.uuid4(), course_id=c_anglais.id, student_id=alice.id, status="present",
            marked_by_prof_at=past_now - timedelta(days=7),
            signature_token=uuid.uuid4(), signature_token_expires=past_now - timedelta(days=6),
            signed_at=past_now - timedelta(days=7, hours=-1),
        ))

        await db.commit()
        total_courses = len(courses) + 4  # today + past
        print("Seeded: %d profs, %d students, %d courses (%d today + 4 past)" % (
            2, len(students), total_courses, len(courses)
        ))
        print("Alice has: 1 notification (unsigned Comptabilite), 4 attendance records")
        print("Bob has: 1 absent record (Droit des affaires, unjustified)")


if __name__ == "__main__":
    asyncio.run(seed())
