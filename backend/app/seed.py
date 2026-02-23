"""Seed database with mock data for development."""
import asyncio
import uuid
from datetime import datetime, date
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

        # Courses (today)
        today = date.today()
        courses_data = [
            ("Marketing L3", "B204", 9, 11),
            ("Finance M1", "A102", 14, 16),
            ("Strategie M2", "C301", 16, 18),
        ]
        courses = []
        for name, room, start_h, end_h in courses_data:
            c = Course(
                id=uuid.uuid4(), name=name, professor_id=prof1.id, room=room,
                start_time=datetime(today.year, today.month, today.day, start_h, 0),
                end_time=datetime(today.year, today.month, today.day, end_h, 0),
            )
            courses.append(c)
            db.add(c)

        # Enroll all students in all courses
        for c in courses:
            for s in students:
                db.add(CourseEnrollment(course_id=c.id, student_id=s.id))

        await db.commit()
        print("Seeded: %d profs, %d students, %d courses" % (2, len(students), len(courses)))


if __name__ == "__main__":
    asyncio.run(seed())
