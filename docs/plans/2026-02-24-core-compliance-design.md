# Design: Core Compliance — Admin Justificatifs, Logs d'Audit, Exports, Role Externe

**Date:** 2026-02-24
**Scope:** 4 axes d'amelioration bases sur le cahier des charges SaaS CFA
**Approche:** Incremental (axe par axe, backend+frontend ensemble)
**Hors scope:** Offline First, Module Predictif (v2), Coffre-fort numerique (v2), Integrations API (v2), CRM Formation (source Galia)

---

## Axe 1 : Admin Review des Justificatifs

### Etat actuel
- Etudiants deposent des justificatifs (`POST /student/justify/{record_id}`)
- Modele `Justification` avec `status` (pending/approved/rejected), `reviewed_by`, `reviewed_at`
- Pas d'endpoint admin pour lister/approuver/refuser
- Pas de page admin pour gerer les justificatifs

### Backend — 3 nouveaux endpoints dans `admin.py`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/justifications` | Liste toutes les justifications (filtrable par status). Inclut nom etudiant, cours, date, raison, fichiers. |
| PUT | `/admin/justifications/{id}/review` | Approuver ou refuser. Body: `{ decision: "approved"\|"rejected", comment?: string }`. Met a jour `status`, `reviewed_by`, `reviewed_at`. |
| GET | `/admin/justification-files/{justification_id}/{filename}` | Servir les fichiers uploades (acces admin). |

### Frontend — Section dans `/admin`

- Onglet/section "Justificatifs" avec tableau : Etudiant | Cours | Date | Raison | Fichiers | Statut | Actions
- Filtres par statut (badges cliquables)
- Boutons "Approuver" / "Refuser" avec modal de confirmation (+ champ commentaire optionnel pour refus)
- Badge compteur de justificatifs en attente dans le header admin

### Notification retour
- Quand l'admin approuve/refuse, creer une notification pour l'etudiant (`type: "justification_reviewed"`)

---

## Axe 2 : Logs d'Audit des Signatures

### Etat actuel
- `attendance_records` stocke : `signed_at`, `signature_ip`, `signature_user_agent`, `signature_data`
- Pas de table d'audit dediee, pas de traçabilite des modifications

### Nouveau modele `AuditLog`

```
audit_logs:
  id: UUID PK
  event_type: string  — "signature", "attendance_validation", "attendance_edit",
                        "justification_submit", "justification_review"
  actor_type: string  — "student", "professor", "admin"
  actor_id: UUID      — FK vers student ou professor
  target_type: string — "attendance_record", "justification"
  target_id: UUID
  ip_address: string
  user_agent: string
  metadata: JSON text — donnees complementaires (ex: ancien status → nouveau status)
  created_at: datetime
```

### Points d'integration

- Etudiant signe → log "signature"
- Prof valide l'emargement → log "attendance_validation"
- Prof modifie l'emargement → log "attendance_edit" (ancien/nouveau status dans metadata)
- Etudiant depose justificatif → log "justification_submit"
- Admin approuve/refuse justificatif → log "justification_review"

### Frontend admin — Section "Logs d'audit"

- Tableau chronologique avec filtres par type d'evenement et par date
- Detail expandable : IP, user-agent, metadata
- Export CSV des logs (preuve Qualiopi)

### Note sur la geolocalisation
- IP seulement (localisation approximative). Geoloc GPS reportee (necessite consentement RGPD explicite).

---

## Axe 3 : Exports Conformite

### 3.1 Certificat de Realisation (obligation Qualiopi)

Document PDF par etudiant/formation :
- Nom de l'organisme, nom de la formation
- Identite de l'apprenant
- Periode (date debut → date fin)
- Duree totale prevue vs duree realisee (en heures)
- Taux de presence
- Signature numerique de l'organisme (texte + date)

**Backend :**
- `POST /admin/exports/certificate` — Body: `{ student_id, start_date, end_date }`. Genere et retourne le PDF.
- `POST /admin/exports/certificates-bulk` — Generer pour tous les etudiants sur une periode. Retourne un ZIP.

### 3.2 Export OPCO (heures prevues vs realisees)

Tableau croise par etudiant : heures de cours prevues (somme des durees inscrit) vs heures realisees (present/en retard).

**Backend :**
- `GET /admin/exports/opco?start_date=...&end_date=...&format=csv` — Retourne le CSV.

### Frontend admin — Section "Exports"

- Formulaire : selectionner etudiant(s) + periode
- Bouton "Generer certificat(s)" → telecharge PDF/ZIP
- Bouton "Export OPCO" → telecharge CSV
- Selecteur de periode (date debut/fin)

---

## Axe 4 : Role Externe (Tuteur/Entreprise)

### Etat actuel
- Table `student_contacts` avec `type` (parent|tutor), email, nom, entreprise
- Rapports mensuels envoyes par email
- Pas de login ni de dashboard pour les contacts

### Modele
- Ajouter `password_hash` sur `student_contacts`
- Role implicite : tout contact qui se connecte est un "externe"

### Auth
- Etendre le login unifie (`POST /auth/login`) pour les contacts externes
- JWT inclut `type: "external"` + `contact_id` + `student_id`

### Backend

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/external/dashboard` | external JWT | Profil etudiant, taux de presence, historique, justificatifs |
| GET | `/external/reports` | external JWT | Liste rapports mensuels |
| GET | `/external/reports/{id}/pdf` | external JWT | Telecharger un PDF |

### Frontend — Page `/external`

- Login redirige vers `/external` si `type === "external"`
- Header avec "Suivi de [Prenom Nom]" + deconnexion
- Carte resumee : taux de presence, absences, retards
- Tableau d'historique de presence (lecture seule)
- Liste des rapports mensuels avec bouton "Telecharger PDF"

---

## Ordre d'implementation

1. **Axe 1** — Admin Review Justificatifs (fondation, debloque le workflow complet)
2. **Axe 2** — Logs d'Audit (s'integre dans les endpoints existants + Axe 1)
3. **Axe 3** — Exports Conformite (depend des stats deja calculees)
4. **Axe 4** — Role Externe (independant, touche a l'auth + nouvelle page)
