# FIGM Code Inspector — Privacy & Data Retention Policy

Scope of data collected by the platform, what happens to submitted source code specifically, retention, deletion, administrator access, optional third-party AI processing, and how this differs from the separate research study. This document describes the current codebase and database schema (`prisma/schema.prisma`) as implemented — it is not a legal document, and every claim below is traceable to the code that implements it.

---

## 1. Data Collected

Creating an account and using the platform stores the following in the application database (PostgreSQL via Supabase, or the local `JsonStorageProvider` fallback):

- **Account information**: email address, full name, password, role (`ADMIN`, `AUDITOR`, or `DEVELOPER`), and an optional API key.
  - Passwords are never stored in plaintext. They are hashed with `scrypt` (Node's built-in `crypto.scryptSync`) and stored as a salted hash (`src/auth/auth-service.ts`). A legacy PBKDF2 hash format is transparently upgraded to `scrypt` on the user's next successful login.
- **Project metadata**: project name, description, framework, and repository URL, for projects you create in the workspace.
- **Scan records**: for each scan you run — the file name, detected framework, and timing/memory/quality-score metrics, plus a `diagnostics` JSON blob containing the findings produced for that scan.

---

## 2. What Happens to the Source Code You Submit

This is the part most users will care about most, stated precisely:

- **We do not store your full submitted source code as a standalone file or database record.** The complete file(s) you submit for scanning are processed in memory to produce findings and are not persisted as a whole afterward.
- **We do store short code snippets.** Each individual finding a scan produces includes the specific line(s) of code that triggered it (an `offendingCodeSnippet` field), and these snippets are embedded inside that scan's `diagnostics` JSON blob in the database. If your code has 10 findings, 10 short snippets (not the surrounding file) are retained.

In short: **not** "we never store your code" (false — snippets are stored), and **not** "we store your full source code" (also false — only the flagged lines are retained, embedded in the diagnostics for each finding).

---

## 3. Retention

There is no automatic expiry or deletion job in this codebase for scan records, project records, or account data. Data — including embedded code snippets inside `diagnostics` — is retained **indefinitely** until you delete the specific scan or your account (see below). No fixed retention period (e.g. "90 days") is enforced or claimed.

---

## 4. Account Deletion

Deleting your account (`UserRepository.deleteAccount()`, which performs a Prisma `user.delete()`) permanently removes, via cascading foreign-key deletes (`onDelete: Cascade` in `prisma/schema.prisma`):

- Your projects
- Your scan reports, including every embedded code snippet inside their `diagnostics` blobs
- Your notifications
- Your settings
- Your API keys
- Your saved reports
- Your AI-assisted remediation history
- Your export history

**Security audit-log entries** that reference your account are handled differently: the entry itself is **retained**, but the link to your account is cleared (`onDelete: SetNull` on `AuditLog.user`) rather than the log entry being deleted. This is standard practice for security/compliance record-keeping — the log continues to exist in anonymized form after account deletion.

---

## 5. Administrator Access

Users with the `ADMIN` role can access other users' account records and scan data through the admin panel, for support, moderation, and security purposes. This is a platform-design fact, not a hidden capability — if you hold the `AUDITOR` or `DEVELOPER` role, administrators of the deployment you use can view your account and scan data.

---

## 6. AI-Assisted Remediation (Optional, Third-Party, Deployment-Dependent)

FIGM Code Inspector can generate AI-assisted fix suggestions for findings. Whether this involves a third party depends on how the specific deployment you're using is configured:

- **If a `GEMINI_API_KEY` is configured** in the deployment's environment, submitted code and diagnostic content for a given finding may be sent to Google's Generative Language API (Gemini) to generate a remediation suggestion.
- **If no key is configured**, the system falls back to a fully local, deterministic, template-based remediation engine (`src/engine/remediation-engine.ts`) — no code or diagnostic content is transmitted to any third party for remediation in this mode.

This is not always on and not always off — it depends on the deployment. **In this specific deployment (the environment this document was written against), `GEMINI_API_KEY` is not currently set** in `.env` or `.env.local` — as of this writing, this deployment runs the local, no-third-party fallback path.

---

## 7. Research-Study Data Is Kept Separate

If you separately participate in the FIGM usability research study (a distinct, opt-in undergraduate research activity — see `research/CONSENT_FORM.md`), that participation is governed by its own explicit informed-consent process and is **not** automatically linked to your ordinary platform account or scan usage. The two data flows — platform usage and research-study participation — are not conflated: using the platform does not enroll you in the study, and the study does not read your platform account data without the separate consent process covering it.

---

## 8. Questions

This is an undergraduate research prototype (NSBM Green University, IS303.2 Research Methodology coursework), not a commercial service with a dedicated privacy contact. See `SECURITY.md` for the platform's security controls and `DATABASE.md` for the underlying schema referenced throughout this document.
