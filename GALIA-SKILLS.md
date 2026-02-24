---
name: galia-api-emargements
description: >
  Skill for integrating with the SC-Form GALIA/GESSICA/SOFIA API Emargements (attendance/sign-in API).
  Use this skill whenever the user needs to: interact with SC-Form APIs, build an attendance or sign-in
  system connected to SC-Form, query sessions/séances from SC-Form, send absences or attendance data
  to SC-Form, retrieve trainee (stagiaire) information, manage training sessions, rooms, instructors,
  or modules via the SC-Form portal, or build any integration with GALIA, GESSICA, or SOFIA platforms.
  Also trigger when the user mentions "émargement", "SC-Form", "GALIA", "GESSICA", "SOFIA",
  "séances personnalisées", "absences stagiaires", or any attendance-tracking system for French
  training/education centers (organismes de formation).
---

# SC-Form API Emargements — Integration Skill

## Overview

The SC-Form API Emargements allows third-party applications to securely retrieve session, trainee,
instructor, and attendance data from SC-Form products (GALIA, GESSICA, SOFIA) and to send back
absence/attendance records. It follows RGPD (GDPR) compliance requirements.

**API Version:** V1.19 for SC-Form V18.00a

---

## Key Concepts

### Individualization Model

SC-Form supports **partial or complete individualization** of trainees within a session:

- **Action/Parcours d'origine**: A trainee attending a session may come from a different action
  (training program) than the one the session belongs to. The API returns a `Libelle_Parcours`
  property per personalized session to indicate the trainee's origin.

- **Individualized schedules**: Within a single session (e.g., 8h–10h), each trainee can have
  different start/end times and durations. Absences must respect these individual schedules:
  - Trainee scheduled 2h but absent → send **absence**
  - Trainee scheduled 2h but only attended 1h → send **partial absence**
  - Trainee scheduled 1h (individualized) and attended 1h → **NO absence** (this is expected)

- **Individualized subjects**: A Math session may be "Algèbre" for one trainee and "Maths renforcés"
  for another. The attendance record must reflect each trainee's individualized subject.

### Instructors (Intervenants)

- A session can have **zero, one, or multiple** instructors (co-animation).
- If multiple instructors: all must sign. Trainees sign only once.
- If no instructor is assigned, use a different viewpoint (room, action, trainee).

### Viewpoints (Points de vue)

Sessions can be queried from different perspectives:

| Viewpoint      | Parameter Value | Description |
|----------------|-----------------|-------------|
| No viewpoint   | *(omit Vue)*    | Raw list of all sessions |
| Room           | `SALLE`         | Sessions grouped by room |
| Instructor     | `INTERVENANT`   | Sessions grouped by instructor |
| Equipment      | `MATERIEL`      | Sessions grouped by equipment/resource |
| Origin Action  | `ACTION`        | Sessions for a specific training action (only trainees from that action) |
| Target Module  | `MODULE`        | Sessions for a module (all trainees regardless of origin action) |
| Trainee        | `INSCRIT`       | Sessions for a specific enrolled trainee |

---

## Authentication

All API calls require **HTTP Basic Authentication**.

```
Authorization: Basic <base64(username:password)>
```

**Example:**
- Username: `MORETON148`, Password: `Utilisateur789+`
- Base64 of `MORETON148:Utilisateur789+` → `TU9SRVRPTjE0ODpVdGlsaXNhdGV1cjc4OSs=`
- Header: `Authorization: Basic TU9SRVRPTjE0ODpVdGlsaXNhdGV1cjc4OSs=`

### Portal URL Structure

```
https://{ClientName}.SC-Form.net/{LogicielEDC}/API/...
```

Where `{LogicielEDC}` is one of: `GaliaEDC`, `GessicaEDC`, or `SofiaEDC`.

### Permissions

- To list sessions **not concerning the connected user**, the user must be an "intervenant" with
  the right **"Consultation des autres plannings"** or **"Spec"**.
- If the connected user is a trainee or instructor without this right, the API automatically
  filters to only their own sessions.

---

## API Endpoints

### A. Entity-Independent Referentials (no IDSociete needed for filtering by entity)

#### GET `/API/Entite/GetEntite?ACTION=SOCIETE`
Returns the list of legal entities (sociétés).

```json
[
  { "ID": 1, "Libelle": "SC-FORMATION" },
  { "ID": 2, "Libelle": "SC-PRESENTATION" }
]
```

#### GET `/API/Entite/GetEntite?ACTION=TYPABSEN`
Returns absence types.

```json
[
  {
    "ID": 1,
    "Reference": "MALAD",
    "Libelle": "Maladie",
    "Retard": false,
    "Absence": true,
    "Absence_A_Appel": false
  }
]
```

---

### B. Entity-Dependent Referentials (require `IDSociete`)

**Base URL pattern:**
```
GET /API/Entite/GetEntite?IDSociete={id}&ACTION={type}
```

Optional filter: `&ID={entityId}` to get a single entity.

| ACTION value   | Returns                        |
|----------------|--------------------------------|
| `BASE`         | Training sectors/sites         |
| `INTERVENANT`  | Instructors/trainers           |
| `SALLE`        | Rooms                          |
| `MATERIEL`     | Equipment/resources            |
| `ACTION`       | Training actions (programs)    |
| `MODULE`       | Modules within actions         |
| `INSCRIT`      | Enrolled trainees              |

#### Key Entity Structures

**Intervenant** (Instructor):
- `ID`, `Reference`, `Civilite`, `Nom`, `Prenom`
- `Email_Perso`, `Email_Pro`, `Telephone_Perso`, `Telephone_Pro`
- `Mobile_Perso`, `Mobile_Pro`
- `Adresse` (object with `NumRue`, `Adr1`–`Adr4`, `Ville`, `Code_Postal`, `Code_Insee`, `Pays`, `Arrondissement`)

**Salle** (Room):
- `ID`, `Reference`, `Libelle`, `Libelle_Court`, `Code_Secteur`, `NbPlace`
- `Adresse`, `Lieu`, `Proprietaire`

**Action** (Training Program):
- `ID`, `Reference`, `Libelle`, `Libelle_Court`
- `Debut`, `Fin` (ISO 8601 datetime)
- `Code_Analytique`, `Inscription_En_Ligne`
- `IDLieu_Site`, `Libelle_Lieu_Site`, `Libelle_Lieu`, `Libelle_Lieu_Court`

**Module**:
- `ID`, `Libelle`, `Libelle_Court`, `Debut`, `Fin`

**Inscrit** (Enrolled Trainee):
- `ID`
- `Stagiaire` (nested: `ID`, `Reference`, `Civilite`, `Nom`, `Prenom`, contacts, `Adresse`)
- `Date_Entree`, `Date_Sortie`, `Date_Sortie_Previsionnelle`
- `IDParcours_Groupe`, `Libelle_Parcours_Groupe`, `Libelle_Parcours`
- `Code_Analytique_Parcours`, `Code_Region`, `Type_Region`
- `Convention` (nested: `ID`, `Reference`, `Numero_interne`, `Client`, `Financeur`, `Tuteur`, `Commercial`, etc.)
- `Type_apprentissage` (boolean)
- `CIR` (social security number without key)

**Inscrit Optional Parameters:**

| Parameter              | Type    | Description |
|------------------------|---------|-------------|
| `IDACTION`             | Integer | Filter by action ID |
| `Debut`                | Date    | Filter active enrollments from this date |
| `Fin`                  | Date    | Filter active enrollments until this date |
| `Apprentissage`        | Boolean | Filter apprenticeship contracts only |
| `DebutInscription`     | Date    | Filter by enrollment start date (from) |
| `LimiteDebutInscription` | Date | Filter by enrollment start date (until) |
| `FinInscription`       | Date    | Filter by enrollment end date (from) |
| `LimiteFinInscription` | Date   | Filter by enrollment end date (until) |
| `Complet`              | Boolean | Include all conventions + exit reason |
| `CSecteur`             | String  | 2-char sector code |

**Actions Optional Parameter:**

| Parameter | Type    | Description |
|-----------|---------|-------------|
| `TC`      | Boolean | `true` = only troncs communs, `false` = exclude them, omit = all |

---

### C. Sessions (Séances)

#### GET `/API/PresenceSta/GetSeance`

**Required parameters:**

| Parameter   | Type    | Description |
|-------------|---------|-------------|
| `IDSociete` | Integer | Legal entity ID |
| `Debut`     | Date    | Start date filter (format: `YYYY-MM-DD`) |
| `Fin`       | Date    | End date filter (format: `YYYY-MM-DD`) |

**Optional parameters:**

| Parameter        | Type    | Description |
|------------------|---------|-------------|
| `Vue`            | String  | Viewpoint: `INTERVENANT`, `SALLE`, `INSCRIT`, `MODULE`, `ACTION` |
| `LstID`          | String  | Comma-separated IDs for the viewpoint entity (required if `Vue` is set) |
| `CSecteur`       | String  | 2-char sector code |
| `AvecConvention` | 0 or 1  | 1 (default): include convention data. 0: exclude |
| `FiltreSoc`      | Boolean | `true`: filter trainees by IDSociete |

#### Session Object Structure

```json
{
  "ID": "S67320",
  "Date": "2020-04-06T00:00:00",
  "Debut": "08:00:00",
  "Duree": "02:00:00",
  "Fin": "10:00:00",
  "IDModule": 2118,
  "IDAction": 207,
  "Libelle_Court": "Mathématiques",
  "Libelle": "Mathématiques",
  "Libelle_Action": "BTS Service Informatique aux Organisations 2019-2020",
  "IDLieu": 1,
  "Libelle_Lieu": "PARIS - Lieu général",
  "Seances_Persos": [ ... ],
  "Salles": [ ... ],
  "Intervenants": [ ... ],
  "Materiels": [ ... ]
}
```

#### Séance Perso (Personalized Session) Object

Each trainee gets a personalized session record within a session:

```json
{
  "Debut": "08:00:00",
  "Duree": "02:00:00",
  "Fin": "10:00:00",
  "Type_Seance": 1,
  "Libelle_Type_Seance": "Centre",
  "Debut_Absence": null,
  "Duree_Absence": "00:00:00",
  "Fin_Absence": null,
  "IDTypAbsen": null,
  "LTypAbsen": "",
  "Libelle_Court": "Mathématiques",
  "Libelle": "Mathématiques",
  "Module_Prevu": "Oui",
  "Personnalisee": "Non",
  "Inscrit": {
    "ID": 2914,
    "Stagiaire": { "ID": 764, "Reference": "SMZ00750", "Nom": "DUPONT", "Prenom": "Pierre" },
    "Date_Entree": "2019-09-02T00:00:00",
    "Date_Sortie": "2020-06-30T00:00:00",
    "Libelle_Parcours": "BTS SIO 2019-2020 en apprentissage",
    "Code_Analytique_Parcours": "BTS-00000001",
    "Convention": { ... }
  }
}
```

**Type_Seance values:** 1 = Centre, 2 = Auto-formation, 3 = Entreprise

**Absence fields:** When `Debut_Absence` and `Fin_Absence` are `null`, there is no recorded absence.

#### Viewpoint Example (Instructor)

```
GET /API/PresenceSta/GetSeance?IDSociete=1&Vue=INTERVENANT&Debut=2020-04-06&Fin=2020-04-06&LstId=29
```

Returns an array of instructor objects, each containing a `Seances` array with the same session structure.

---

### D. Sending Absences

#### GET `/API/AbsenceSta/GetStructure?IDSociete={id}`
Returns the data dictionary for the absence POST payload.

**Absence fields:**

| Field        | Type    | Required | Description |
|--------------|---------|----------|-------------|
| `IDInscrit`  | Integer | Yes      | Enrolled trainee ID |
| `Date`       | Date    | Yes      | Date of absence (format: `DD/MM/YYYY` or ISO) |
| `Debut`      | Time    | No       | Start time of absence (format: `HH:MM:SS` or `HH:MM`) |
| `Fin`        | Time    | No       | End time of absence |
| `IDTYPABSEN` | Integer | No       | Absence type ID (from TYPABSEN referential) |
| `Suppr`      | Boolean | No       | `true` to delete the absence, `false` to create/update |

#### POST `/API/AbsenceSta/Post?IDSociete={id}`

**Content-Type:** `application/json`

**Example payload:**
```json
{
  "IDInscrit": 2601,
  "Date": "2020-04-07T00:00:00",
  "Debut": "16:00:00",
  "Fin": "16:30:00",
  "IDTypAbsen": 1,
  "Suppr": false
}
```

**Success response:** `Status: 200` — `"L'enregistrement de l'absence a été réalisé!"`

---

### E. Internships & Company Visits

#### GET `/API/StageEntreprise/GetStageEntrep`

**Parameters:**

| Parameter   | Type    | Required | Description |
|-------------|---------|----------|-------------|
| `IDSociete` | Integer | Yes      | Legal entity ID |
| `Debut`     | Date    | Yes      | Start date |
| `Fin`       | Date    | Yes      | End date |
| `LstID`     | String  | No       | Comma-separated internship IDs |
| `CSecteur`  | String  | No       | Sector code |
| `IDAction`  | Integer | No       | Filter by action |

**Returns:** Internship objects with nested `Stagiaire`, `Entreprise`, `MaitreDeStage`,
`TuteurDeStage`, `Signataire`, `TuteurDuCentre`, and `Visites` arrays.

---

## Code Examples for Sending Absences

### Python

```python
import requests

url = "https://{domain}/{logiciel}/API/AbsenceSta/Post?IDSociete=1"
payload = {
    "IDInscrit": 2601,
    "Date": "2020-04-07T00:00:00",
    "Debut": "16:00:00",
    "Fin": "16:30:00",
    "IDTypAbsen": 1,
    "Suppr": False
}
headers = {
    "Content-Type": "application/json",
    "Authorization": "Basic <base64_credentials>"
}
response = requests.post(url, json=payload, headers=headers)
print(response.text)
```

### JavaScript (Fetch)

```javascript
const response = await fetch(
  "https://{domain}/{logiciel}/API/AbsenceSta/Post?IDSociete=1",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Basic <base64_credentials>"
    },
    body: JSON.stringify({
      IDInscrit: 2601,
      Date: "2020-04-07T00:00:00",
      Debut: "16:00:00",
      Fin: "16:30:00",
      IDTypAbsen: 1,
      Suppr: false
    })
  }
);
const result = await response.text();
console.log(result);
```

### C# (RestSharp)

```csharp
var client = new RestClient("https://{domain}/{logiciel}/API/AbsenceSta/Post?IDSociete=1");
var request = new RestRequest(Method.POST);
request.AddHeader("Content-Type", "application/json");
request.AddHeader("Authorization", "Basic <base64_credentials>");
request.AddParameter("application/json",
    "{\"IDInscrit\":2601,\"Date\":\"2020-04-07T00:00:00\",\"Debut\":\"16:00:00\",\"Fin\":\"16:30:00\",\"IDTypAbsen\":1,\"Suppr\":false}",
    ParameterType.RequestBody);
IRestResponse response = client.Execute(request);
```

---

## Common Integration Workflow

1. **Authenticate** with HTTP Basic Auth
2. **Get legal entities**: `GET /API/Entite/GetEntite?ACTION=SOCIETE`
3. **Get absence types**: `GET /API/Entite/GetEntite?ACTION=TYPABSEN`
4. **Get referentials** (instructors, rooms, trainees, etc.) for the chosen `IDSociete`
5. **Get sessions**: `GET /API/PresenceSta/GetSeance` with desired viewpoint and date range
6. **Display attendance sheet** using the session + personalized session data
7. **Collect signatures/attendance** from the UI
8. **Send absences**: `POST /API/AbsenceSta/Post` for each absent trainee

---

## Important Notes

- All dates use ISO 8601 format (`YYYY-MM-DDT00:00:00`)
- All times use `HH:MM:SS` or `HH:MM` format
- Session IDs are **strings** prefixed with "S" (e.g., `"S67320"`)
- Entity IDs are **integers**
- The API supports RGPD compliance — only authorized data is returned based on user permissions
- Convention data can be excluded with `AvecConvention=0` for lighter responses
- Always respect individualized schedules when reporting absences
