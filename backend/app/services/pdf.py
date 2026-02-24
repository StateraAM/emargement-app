import io
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


def generate_attendance_pdf(
    student_name: str,
    month: str,
    school_name: str,
    stats: dict,
    course_details: list[dict],
) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm)
    styles = getSampleStyleSheet()
    elements = []

    # Title
    title_style = ParagraphStyle("Title2", parent=styles["Title"], fontSize=18, spaceAfter=10*mm)
    elements.append(Paragraph("Rapport d'Assiduite", title_style))
    elements.append(Paragraph(f"{school_name}", styles["Normal"]))
    elements.append(Spacer(1, 5*mm))
    elements.append(Paragraph(f"<b>Etudiant:</b> {student_name}", styles["Normal"]))
    elements.append(Paragraph(f"<b>Periode:</b> {month}", styles["Normal"]))
    elements.append(Spacer(1, 8*mm))

    # Stats summary
    stats_data = [
        ["Total cours", "Present", "Absent", "Retard", "Taux"],
        [
            str(stats["total_courses"]),
            str(stats["attended"]),
            str(stats["absent"]),
            str(stats["late"]),
            f"{stats['attendance_rate']:.0f}%",
        ],
    ]
    stats_table = Table(stats_data, colWidths=[80, 80, 80, 80, 80])
    stats_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563eb")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
    ]))
    elements.append(stats_table)
    elements.append(Spacer(1, 8*mm))

    # Course details table
    elements.append(Paragraph("<b>Detail des cours</b>", styles["Normal"]))
    elements.append(Spacer(1, 3*mm))
    detail_data = [["Date", "Cours", "Statut", "Signe"]]
    for course in course_details:
        detail_data.append([
            course["date"],
            course["course"],
            course["status"],
            "Oui" if course["signed"] else "Non",
        ])

    detail_table = Table(detail_data, colWidths=[80, 150, 80, 60])
    detail_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563eb")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
    ]))
    elements.append(detail_table)

    doc.build(elements)
    return buf.getvalue()


def generate_certificate_pdf(
    school_name: str,
    student_name: str,
    student_email: str,
    period_start: str,
    period_end: str,
    total_hours_planned: float,
    total_hours_realized: float,
    attendance_rate: float,
) -> bytes:
    from datetime import datetime
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=25*mm, bottomMargin=25*mm)
    styles = getSampleStyleSheet()
    elements = []

    title_style = ParagraphStyle("CertTitle", parent=styles["Title"], fontSize=18, alignment=1)
    elements.append(Paragraph("CERTIFICAT DE REALISATION", title_style))
    elements.append(Spacer(1, 15*mm))

    body_style = ParagraphStyle("CertBody", parent=styles["Normal"], fontSize=11, leading=16)
    elements.append(Paragraph(f"<b>Organisme de formation :</b> {school_name}", body_style))
    elements.append(Spacer(1, 5*mm))
    elements.append(Paragraph(f"<b>Apprenant :</b> {student_name} ({student_email})", body_style))
    elements.append(Spacer(1, 5*mm))
    elements.append(Paragraph(f"<b>Periode :</b> du {period_start} au {period_end}", body_style))
    elements.append(Spacer(1, 5*mm))

    hours_data = [
        ["Heures prevues", "Heures realisees", "Taux de presence"],
        [f"{total_hours_planned:.1f}h", f"{total_hours_realized:.1f}h", f"{attendance_rate:.1f}%"],
    ]
    hours_table = Table(hours_data, colWidths=[60*mm, 60*mm, 60*mm])
    hours_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563eb")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#f3f4f6")),
    ]))
    elements.append(hours_table)
    elements.append(Spacer(1, 15*mm))

    elements.append(Paragraph(f"Fait le {datetime.now().strftime('%d/%m/%Y')}", body_style))
    elements.append(Spacer(1, 10*mm))
    elements.append(Paragraph(f"Pour {school_name},", body_style))
    elements.append(Paragraph("Signature de l'organisme", body_style))

    doc.build(elements)
    return buf.getvalue()
