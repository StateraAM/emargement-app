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
