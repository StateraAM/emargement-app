import resend
from app.core.config import settings


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
            "html": f"""
                <h2>Bonjour {student_name},</h2>
                <p>Vous avez ete note(e) present(e) au cours <strong>{course_name}</strong> du {course_date}.</p>
                <p><a href="{signature_url}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
                    Signer ma presence
                </a></p>
                <p>Ce lien expire dans 24 heures.</p>
            """,
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
            "html": f"""
                <h2>Bonjour {contact_name},</h2>
                <p>Veuillez trouver ci-joint le rapport d'assiduite mensuel de <strong>{student_name}</strong> pour le mois de {month}.</p>
            """,
            "attachments": [{
                "filename": f"rapport-assiduite-{student_name.lower().replace(' ', '-')}-{month}.pdf",
                "content": base64.b64encode(pdf_bytes).decode(),
            }],
        })


email_service = EmailService()
