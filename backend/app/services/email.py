import resend
from app.core.config import settings
from app.services.email_templates import signature_email, monthly_report, justification_reviewed


class EmailService:
    def __init__(self):
        resend.api_key = settings.RESEND_API_KEY

    async def send_signature_email(
        self, student_email: str, student_name: str,
        course_name: str, course_date: str, signature_url: str,
    ):
        if not settings.RESEND_API_KEY:
            print(f"[DEV] Signature email for {student_name}: {signature_url}")
            return

        resend.Emails.send({
            "from": "Emargement <noreply@yourdomain.com>",
            "to": student_email,
            "subject": f"Signez votre presence - {course_name}",
            "html": signature_email(student_name, course_name, course_date, signature_url),
        })

    async def send_monthly_report(
        self, contact_email: str, contact_name: str,
        student_name: str, month: str, pdf_bytes: bytes,
    ):
        if not settings.RESEND_API_KEY:
            print(f"[DEV] Monthly report email for {student_name} to {contact_name}")
            return

        import base64
        resend.Emails.send({
            "from": "Emargement <noreply@yourdomain.com>",
            "to": contact_email,
            "subject": f"Rapport d'assiduite - {student_name} - {month}",
            "html": monthly_report(contact_name, student_name, month),
            "attachments": [{
                "filename": f"rapport-assiduite-{student_name.lower().replace(' ', '-')}-{month}.pdf",
                "content": base64.b64encode(pdf_bytes).decode(),
            }],
        })

    async def send_justification_reviewed(
        self, student_email: str, student_name: str,
        course_name: str, course_date: str, status: str,
    ):
        if not settings.RESEND_API_KEY:
            print(f"[DEV] Justification {status} email for {student_name} - {course_name}")
            return

        subject_status = "acceptee" if status == "approved" else "refusee"
        resend.Emails.send({
            "from": "Emargement <noreply@yourdomain.com>",
            "to": student_email,
            "subject": f"Justification {subject_status} - {course_name}",
            "html": justification_reviewed(student_name, course_name, course_date, status),
        })


email_service = EmailService()
