import uuid
import asyncio
from datetime import datetime, date, time, timedelta
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from httpx import AsyncClient, ASGITransport
from passlib.context import CryptContext

from app.core.database import Base, get_db
from app.models import *
from app.main import app

# SQLite in-memory for tests
TEST_DATABASE_URL = "sqlite+aiosqlite://"
engine_test = create_async_engine(TEST_DATABASE_URL, echo=False)
async_session_test = async_sessionmaker(engine_test, class_=AsyncSession, expire_on_commit=False)

pwd_context = CryptContext(schemes=["bcrypt"])


async def override_get_db():
    async with async_session_test() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database():
    """Create tables and seed test data once for the entire test session."""
    async with engine_test.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_test() as db:
        # Seed professors
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
        await db.flush()

        # Seed students
        students = []
        for i, (first, last, email) in enumerate([
            ("Alice", "Martin", "alice.martin@student.fr"),
            ("Bob", "Bernard", "bob.bernard@student.fr"),
            ("Claire", "Petit", "claire.petit@student.fr"),
            ("David", "Roux", "david.roux@student.fr"),
            ("Emma", "Leroy", "emma.leroy@student.fr"),
        ]):
            s = Student(
                id=uuid.uuid4(), email=email,
                first_name=first, last_name=last,
                is_alternance=(i % 2 == 0),
            )
            students.append(s)
        db.add_all(students)
        await db.flush()

        # Seed student contacts
        contact1 = StudentContact(
            id=uuid.uuid4(), student_id=students[0].id,
            type="parent", email="parent.martin@email.fr",
            first_name="Pierre", last_name="Martin",
        )
        db.add(contact1)
        await db.flush()

        # Seed courses (today)
        today = date.today()
        course1 = Course(
            id=uuid.uuid4(), name="Marketing L3",
            professor_id=prof1.id, room="A101",
            start_time=datetime.combine(today, time(9, 0)),
            end_time=datetime.combine(today, time(11, 0)),
        )
        course2 = Course(
            id=uuid.uuid4(), name="Finance M1",
            professor_id=prof1.id, room="B202",
            start_time=datetime.combine(today, time(14, 0)),
            end_time=datetime.combine(today, time(16, 0)),
        )
        db.add_all([course1, course2])
        await db.flush()

        # Seed enrollments (all 5 students in course1, 3 in course2)
        for s in students:
            db.add(CourseEnrollment(id=uuid.uuid4(), course_id=course1.id, student_id=s.id))
        for s in students[:3]:
            db.add(CourseEnrollment(id=uuid.uuid4(), course_id=course2.id, student_id=s.id))

        await db.commit()

    yield

    async with engine_test.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
