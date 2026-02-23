import json
import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog


async def create_audit_log(
    db: AsyncSession,
    event_type: str,
    actor_type: str,
    actor_id: uuid.UUID,
    target_type: str,
    target_id: uuid.UUID,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    metadata: Optional[dict] = None,
):
    log = AuditLog(
        event_type=event_type,
        actor_type=actor_type,
        actor_id=actor_id,
        target_type=target_type,
        target_id=target_id,
        ip_address=ip_address,
        user_agent=user_agent,
        extra_data=json.dumps(metadata) if metadata else None,
    )
    db.add(log)
