"""Branded HTML email templates for the emargement application."""

NAVY = "#1e3a5f"
GOLD = "#c8a951"
LIGHT_GRAY = "#f5f5f5"
DARK_GRAY = "#666666"


def _base_template(body_html: str) -> str:
    return f"""\
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:{LIGHT_GRAY};font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:{LIGHT_GRAY};padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
  <!-- Header -->
  <tr>
    <td style="background-color:{NAVY};padding:24px 32px;text-align:center;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">Emargement</h1>
    </td>
  </tr>
  <!-- Body -->
  <tr>
    <td style="padding:32px;">
      {body_html}
    </td>
  </tr>
  <!-- Footer -->
  <tr>
    <td style="background-color:{LIGHT_GRAY};padding:20px 32px;text-align:center;border-top:1px solid #e0e0e0;">
      <p style="margin:0;font-size:12px;color:{DARK_GRAY};">
        Emargement &mdash; Gestion de l'assiduite<br>
        Cet email a ete envoye automatiquement, merci de ne pas y repondre.
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>"""


def _cta_button(url: str, label: str) -> str:
    return (
        f'<a href="{url}" style="display:inline-block;background-color:{GOLD};color:#ffffff;'
        f'font-weight:600;font-size:16px;padding:14px 32px;border-radius:6px;'
        f'text-decoration:none;margin:16px 0;">{label}</a>'
    )


def signature_email(
    student_name: str, course_name: str, course_date: str, signature_url: str,
) -> str:
    body = f"""\
<h2 style="margin:0 0 16px;color:{NAVY};font-size:20px;">Bonjour {student_name},</h2>
<p style="margin:0 0 12px;font-size:15px;color:#333333;line-height:1.6;">
  Vous avez ete note(e) <strong>present(e)</strong> au cours
  <strong>{course_name}</strong> du <strong>{course_date}</strong>.
</p>
<p style="margin:0 0 12px;font-size:15px;color:#333333;line-height:1.6;">
  Veuillez confirmer votre presence en cliquant sur le bouton ci-dessous&nbsp;:
</p>
<p style="text-align:center;">
  {_cta_button(signature_url, "Signer ma presence")}
</p>
<p style="margin:16px 0 0;font-size:13px;color:{DARK_GRAY};">
  Ce lien expire dans 24 heures.
</p>"""
    return _base_template(body)


def monthly_report(
    contact_name: str, student_name: str, month: str,
) -> str:
    body = f"""\
<h2 style="margin:0 0 16px;color:{NAVY};font-size:20px;">Bonjour {contact_name},</h2>
<p style="margin:0 0 12px;font-size:15px;color:#333333;line-height:1.6;">
  Veuillez trouver ci-joint le <strong>rapport d'assiduite mensuel</strong>
  de <strong>{student_name}</strong> pour le mois de <strong>{month}</strong>.
</p>
<p style="margin:0 0 12px;font-size:15px;color:#333333;line-height:1.6;">
  Ce document recapitule les presences, absences et retards de l'etudiant(e)
  sur la periode concernee.
</p>
<p style="margin:16px 0 0;font-size:13px;color:{DARK_GRAY};">
  Le rapport est disponible en piece jointe au format PDF.
</p>"""
    return _base_template(body)


def justification_reviewed(
    student_name: str, course_name: str, course_date: str, status: str,
) -> str:
    if status == "approved":
        status_label = "acceptee"
        status_color = "#16a34a"
        detail = "Votre absence a ete justifiee avec succes."
    else:
        status_label = "refusee"
        status_color = "#dc2626"
        detail = "Votre justification n'a pas ete retenue. Contactez l'administration pour plus d'informations."

    body = f"""\
<h2 style="margin:0 0 16px;color:{NAVY};font-size:20px;">Bonjour {student_name},</h2>
<p style="margin:0 0 12px;font-size:15px;color:#333333;line-height:1.6;">
  Votre justification d'absence pour le cours
  <strong>{course_name}</strong> du <strong>{course_date}</strong>
  a ete <strong style="color:{status_color};">{status_label}</strong>.
</p>
<p style="margin:0 0 12px;font-size:15px;color:#333333;line-height:1.6;">
  {detail}
</p>"""
    return _base_template(body)
