# backend/app/services/galia.py
from abc import ABC, abstractmethod
from datetime import date, datetime
from app.core.config import settings


class GaliaServiceInterface(ABC):
    @abstractmethod
    async def sync_courses(self, professor_galia_id: str, target_date: date) -> list[dict]:
        """Fetch courses from Galia for a professor on a given date."""

    @abstractmethod
    async def sync_students(self, course_galia_id: str) -> list[dict]:
        """Fetch enrolled students for a course from Galia."""

    @abstractmethod
    async def push_attendance(self, course_galia_id: str, records: list[dict]) -> bool:
        """Push attendance records back to Galia."""


class MockGaliaService(GaliaServiceInterface):
    """Mock implementation for development without Galia API access."""

    async def sync_courses(self, professor_galia_id: str, target_date: date) -> list[dict]:
        return [
            {"galia_id": "GALIA-C001", "name": "Marketing L3", "room": "B204",
             "start_time": datetime(target_date.year, target_date.month, target_date.day, 9, 0),
             "end_time": datetime(target_date.year, target_date.month, target_date.day, 11, 0)},
            {"galia_id": "GALIA-C002", "name": "Finance M1", "room": "A102",
             "start_time": datetime(target_date.year, target_date.month, target_date.day, 14, 0),
             "end_time": datetime(target_date.year, target_date.month, target_date.day, 16, 0)},
        ]

    async def sync_students(self, course_galia_id: str) -> list[dict]:
        return [
            {"galia_id": "GALIA-S001", "email": "alice.martin@etu.fr", "first_name": "Alice", "last_name": "Martin", "is_alternance": True},
            {"galia_id": "GALIA-S002", "email": "bob.bernard@etu.fr", "first_name": "Bob", "last_name": "Bernard", "is_alternance": False},
        ]

    async def push_attendance(self, course_galia_id: str, records: list[dict]) -> bool:
        print(f"[MOCK] Pushed {len(records)} attendance records to Galia for course {course_galia_id}")
        return True


class GaliaAPIService(GaliaServiceInterface):
    """Real Galia API integration — implement when API access is available."""

    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key

    async def sync_courses(self, professor_galia_id: str, target_date: date) -> list[dict]:
        raise NotImplementedError("Galia API integration pending — need API credentials")

    async def sync_students(self, course_galia_id: str) -> list[dict]:
        raise NotImplementedError("Galia API integration pending — need API credentials")

    async def push_attendance(self, course_galia_id: str, records: list[dict]) -> bool:
        raise NotImplementedError("Galia API integration pending — need API credentials")


def get_galia_service() -> GaliaServiceInterface:
    if settings.GALIA_MOCK:
        return MockGaliaService()
    return GaliaAPIService(base_url="", api_key="")
