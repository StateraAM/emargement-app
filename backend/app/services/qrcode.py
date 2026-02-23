import io
import qrcode
from app.core.config import settings


def generate_qr_code(course_id: str) -> bytes:
    """Generate a QR code that links to the course signing page."""
    url = f"{settings.FRONTEND_URL}/sign/qr/{course_id}"
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue()
