from app.services.pdf import generate_attendance_pdf


def test_generate_pdf():
    pdf_bytes = generate_attendance_pdf(
        student_name="Alice Martin",
        month="Fevrier 2026",
        school_name="Ecole de Commerce",
        stats={"total_courses": 20, "attended": 18, "absent": 1, "late": 1, "attendance_rate": 90.0},
        course_details=[
            {"date": "01/02/2026", "course": "Marketing L3", "status": "Present", "signed": True},
            {"date": "03/02/2026", "course": "Finance M1", "status": "Absent", "signed": False},
        ],
    )
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 100
    assert pdf_bytes[:4] == b"%PDF"
