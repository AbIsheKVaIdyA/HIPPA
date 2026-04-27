# CarePort — Implementation Report

**Document type:** Technical accomplishment summary (submission-ready)  
**Application:** Role-based hospital access portal (“CarePort”) with HIPAA-oriented design patterns  
**Repository:** HIPPA (Next.js + Supabase)

---

## 1. Executive summary

CarePort is a **multi-portal web application** that separates **administration, clinical staff, front desk, patients, and external partner hospitals** into distinct sign-in flows and dashboards. The system centers on **patient cases** with **encrypted PHI** stored in Supabase, **row-level security (RLS)** enforcing least-privilege access, and **server-side audit logging** for sensitive actions.

Major capabilities delivered:

- **Six role-specific portals** with dedicated login URLs and dashboard experiences.
- **Patient case lifecycle:** registration (front desk), assignment to doctor/nurse, encrypted demographics and clinical data, vitals, physician notes, file attachments, and patient-visible summaries where appropriate.
- **Partner hospital referrals:** time-bound (3-day) encrypted sharing of a minimal clinical request; partner submission of results; physician visibility of returned reports.
- **Staff and patient invites**, optional **email MFA for admin sign-in**, **audit log** for administrators, and **sign-in rate limiting** at the database layer.

---

## 2. Technology stack

| Layer | Technology |
|--------|----------------|
| Framework | **Next.js 16** (App Router), **React 19**, **TypeScript** |
| Styling | **Tailwind CSS v4**, **shadcn/ui**-style components, **Geist** fonts |
| Backend / DB | **Supabase** (PostgreSQL, Auth, Storage, RLS) |
| Validation | **Zod** |
| Email | **Resend** (invites, MFA-related email where configured) |
| Other | **Sonner** toasts, **Lucide** icons, **Firebase Admin** (optional MFA challenge storage when enabled) |

---

## 3. High-level architecture

- **Browser** → **Next.js** (UI + Route Handlers under `src/app/api/*`) → **Supabase** (auth session, Postgres with RLS, Storage for attachments).
- **PHI at rest:** Sensitive fields are **encrypted in the application** (AES-256-GCM-style patient data helpers) before insert; the database holds **ciphertext** for designated columns.
- **Authorization:** **Server routes** resolve the authenticated user’s **role** from `profiles` and enforce rules; **RLS** on tables prevents direct client access outside policy.
- **Session refresh:** Middleware (`middleware.ts`) uses `@supabase/ssr` patterns to keep auth cookies in sync.

---

## 4. Roles and portals

| Role | Portal slug | Purpose |
|------|-------------|---------|
| `admin` | `/login/admin` | Staff invites, audit log, settings-oriented tasks |
| `doctor` | `/login/doctor` | Case list (card layout), full clinical view, notes, visit updates, partner referrals |
| `nurse` | `/login/nurse` | Assigned cases, **vitals entry** with validated ranges, limited chart per RLS |
| `front_desk` | `/login/front-desk` | New registration, returning-patient search, case list (table layout) |
| `patient` | `/login/patient` | “My care” timeline and per-visit detail |
| `third_party_hospital` | `/login/partner-hospital` | Referral inbox, open/submit results |

The **home page** (`/`) lists all portals with navigation to each login route.

---

## 5. Database and migrations (Supabase)

Migrations live under `supabase/migrations/` and should be applied in order:

| File | Summary |
|------|---------|
| **001_profiles_and_rls.sql** | `user_role` enum, `profiles` table linked to `auth.users`, RLS, trigger to sync new users from metadata |
| **002_patient_cases_clinical.sql** | `patient_case_core`, encrypted PII/clinical/vitals/notes/files tables, storage bucket expectations, RLS policies, RPCs such as `create_patient_case`, role validation triggers |
| **003_fix_profiles_rls_recursion.sql** | RLS adjustments to avoid recursive policy issues on `profiles` |
| **004_patient_portal_case_meta.sql** | Metadata supporting patient portal access patterns |
| **005_audit_log_and_sign_in_rate_limit.sql** | `sign_in_rate_bucket` + `consume_sign_in_rate` (service role); **audit log** table for PHI-related events |
| **006_partner_referrals.sql** | `partner_referral` table, status enum, 3-day expiry trigger, role enforcement (assigned doctor, partner role), RLS |
| **007_profiles_partner_directory_rls.sql** | Policy so clinical users can read **`third_party_hospital`** profiles for partner picker / directory |

---

## 6. Security, privacy, and compliance-oriented features

> **Note:** This is a **technical demonstration** of common controls. Formal HIPAA compliance requires organizational policies, BAAs, hosting choices, penetration testing, and legal review.

- **Encryption:** Application-level encryption for patient-linked payloads before persistence; keys via environment (see `.env.example`).
- **RLS:** Policies restrict selects/inserts/updates by role and case membership (e.g., nurses excluded from raw **health issue** where designed).
- **Audit logging:** Server-side logging of PHI-related API actions (e.g., case open, partner referral events) into the audit table for **admin** review.
- **Least privilege:** Partner sees only referral payloads; doctor sees decrypted partner results via authorized API routes.
- **Rate limiting:** Sign-in attempts constrained via `consume_sign_in_rate` (configured from application code).

---

## 7. Authentication and MFA

- **Per-portal sign-in** (`/api/auth/sign-in`): Validates credentials against expected **portal/role** mapping so users cannot use the wrong portal for their account.
- **Email OTP / MFA:** Optional path for **admin** (`/login/admin`) when environment flags and Firebase-related config are enabled; other portals documented as **password-only** for demo simplicity.
- **Sign-out:** `/api/auth/sign-out` clears session; UI uses a shared sign-out control.
- **Invites:** Staff receive links to **set password**; patients can receive portal invites after front-desk registration when enabled.

---

## 8. Feature implementation by area

### 8.1 Front desk

- **New patient visit** form: assign doctor and nurse, demographics, health issue, optional link to **prior case** as follow-up.
- **Phone input:** **Digits only**, **10-digit** US-style validation at UI and API when provided.
- **Returning patient search** via API (`/api/patient-cases/search`) to prefill demographics.
- Case list uses **compact table** layout for operational density.

### 8.2 Doctor

- **Case list** in **card** layout: initials, “First visit” vs “Return visit”, status, relative “opened” time.
- **Case detail:** Patient demographics, health issue (when in scope), vitals history, clinical notes, visit updates with optional note + file upload, attachments list with signed URLs, **partner hospital referral** card.

### 8.3 Nurse

- **Case list** (cards) and **case detail** with **vital signs** form:
  - Separate **systolic / diastolic** blood pressure fields with `/` separator UX.
  - Sanitized numeric inputs; **client + server (Zod)** validation for plausible ranges (temperature, BP pattern, HR, SpO₂, height, weight).
  - At least one measurement or note required per submission.

### 8.4 Patient

- **My care** dashboard: timeline and visit cards with links to **visit detail** pages.
- Read-only views of information **shared by the care team** per API scope.

### 8.5 Admin

- **Invite staff** (email, name, role) with success messaging including login path hints.
- **Audit log** table UI with pagination/load-more pattern and filtering of columns (time, action, actor, resource, status, IP).

### 8.6 Partner hospital

- **Inbox** of referrals with status and navigation to detail.
- **Referral detail:** View encrypted request context, submit **result text** before expiry; doctors see **decrypted** results on the case referral card and list API.

---

## 9. API routes (summary)

Server routes under `src/app/api/` include (non-exhaustive):

- **Auth:** `sign-in`, `sign-out`, `verify-mfa`
- **Patient cases:** list/create, `search`, per-`caseId` detail, `notes`, `vitals`, `visit-update`, `attachments` (+ per-file signed URL)
- **Partner referrals:** list (doctor case / partner inbox), create, patch (submit/revoke), per-id GET
- **Admin:** `audit-log`
- **Invites:** `invites/staff`, `invites/patient`
- **Directory:** `staff-directory` (role-filtered staff for pickers)
- **Patient:** `patient/my-care`

All routes apply **role checks** and **audit** calls where implemented.

---

## 10. UI / UX accomplishments

- **Design system:** shadcn-style primitives (Button, Card, Input, Table, Badge, etc.), **emerald-forward** theme (replacing a generic blue clinical look), glass-style surfaces, responsive layouts.
- **Dashboard shell:** Wide content width (~92rem max), **sidebar navigation** on large screens for each portal, mobile **pill navigation** for section links.
- **Login:** Split hero + form on large screens, gradient hero panel, reinforced login card styling.
- **Accessibility:** Semantic labels on vital inputs (e.g., BP systolic/diastolic), keyboard-friendly controls.

---

## 11. Environment configuration

See **`.env.example`** for:

- Supabase URL and anon key (public)
- Service role key (server-only)
- `PATIENT_DATA_ENCRYPTION_KEY` (or equivalent) for crypto helpers
- Resend API for email
- Optional MFA-related variables

---

## 12. Build and quality

- **`npm run build`** succeeds (Next.js production build + TypeScript).
- **Lint** script available (`npm run lint`).

---

## 13. Repository and delivery

- Source is version-controlled; recent work has been **committed and pushed** to the remote `main` branch as applicable.
- **Migrations** must be applied to the target Supabase project for production parity.

---

## 14. Summary of accomplishments (checklist)

- [x] Multi-role portal architecture with Supabase Auth + `profiles`
- [x] Patient case model with encrypted PHI split and RLS
- [x] Front desk registration and follow-up linking
- [x] Doctor and nurse workflows with appropriate visibility
- [x] Vitals capture with realistic validation UX
- [x] Partner referral workflow (3-day expiry, submit/revoke, doctor visibility of results)
- [x] Admin invites and audit log
- [x] Patient “my care” experience
- [x] API + audit integration for sensitive actions
- [x] Modern UI: shell navigation, theme, case cards, referral presentation, login experience

---

*End of report.*
