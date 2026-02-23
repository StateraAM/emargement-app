from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    data: Optional[str] = None
    record_id: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
