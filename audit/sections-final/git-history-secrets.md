# Phase 13/14/18/19/26 — Git History, Secrets, Auth-Crypto, and Untracked-File Forensics

Agent: static/read-only investigation (no dev server used). Working directory:
`C:\Users\MSI\.gemini\antigravity-ide\scratch\figm-model`. All commands run via git,
node, and curl against the actual repository; no values were fabricated or assumed.

---

## 1. Git history secret forensics

**CLAIM (from `docs/audit/GIT_HISTORY_SECRET_REMEDIATION.md`, untracked, 2026-08-18):**
`figm-user-db.json` committed from `98bac3f9` through removal at `20e28f03`, touched by
74 commits, 465 user records with password hashes/refresh tokens/API keys including a
live admin refresh token; `.env` committed in initial commit, removed 2 commits later.

**EVIDENCE:**

- `git log --all --oneline -- figm-user-db.json | wc -l` → **74**. Oldest entry in the
  log is `98bac3f9 Initial FIGM DevSecOps Platform`. Matches claim exactly.
- `git log --all --oneline -- .env | wc -l` → **2**: `56ddcfc0 Untrack .env sensitive
  credentials and prepare clean main branch` and `98bac3f9 Initial FIGM DevSecOps
  Platform`. Matches claim exactly.
- `git show 98bac3f9 --stat` (grepped) confirms initial commit contained all three:
  `.env | 22 +`, `.env.example | 25 +`, `figm-user-db.json | 2821 ++++++++++++++++++++`.
- `git log --diff-filter=D --oneline -- figm-user-db.json` → single hit:
  `20e28f03 fix(security): remove committed admin credentials, fail-closed JWT/refresh
  secrets, env-driven admin bootstrap`. Matches claim.
- `git show 56ddcfc0 --stat` (grepped for `.env`) → `.env | 22 ----------------------`,
  i.e. a pure deletion. Matches claim (`56ddcfc0` is the removal commit for `.env`).
- Record-count/content check on the commit immediately before removal (parent of
  `20e28f03`, i.e. `22e58e39`), read via `git show 22e58e39:figm-user-db.json` and
  parsed with `node` (no field values printed, only structure/counts):
  - Top-level keys: `users, submissions, projects, scanRecords, notifications,
    settings, auditLogs`.
  - `data.users.length` → **465** records. Matches claim exactly.
  - Sample record schema: `id, fullName, email, passwordHash, role, apiKey, createdAt,
    refreshToken, lastLoginAt`.
  - Role distribution: `{ ADMIN: 2, DEVELOPER: 383, AUDITOR: 80 }`.
  - Of the 2 `ADMIN` records: `usr_admin_sanjula` (email `sanjula@nsbm.ac.lk`) has
    `apiKey` present **and** `refreshToken` present (non-null); `usr_admin_figm`
    (email `admin@figm.io`) has `apiKey` present, `refreshToken` absent. This
    corroborates the "live admin refresh token" claim — one admin record in the
    commit-before-removal snapshot does carry a populated refresh token, not just a
    password hash. Both admin `passwordHash` values are 161 chars long and share the
    same hash prefix (`4195d5d876ab546de856...`), i.e. **the two seeded admin accounts
    used the same password** — a real (if historical) additional weakness beyond what
    the claim states.
  - 16 non-admin users also had non-null `refreshToken` values in that snapshot (live
    session tokens for regular users were committed too, not just the admin).
  - `git show 98bac3f9:.env`, field names only (no values printed): `DATABASE_URL,
    DIRECT_URL, JWT_SECRET, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL, NODE_ENV, REFRESH_SECRET, STORAGE_PROVIDER,
    SUPABASE_SERVICE_ROLE_KEY` — confirms the committed `.env` held the DB connection
    string, Supabase service-role key, and both JWT signing secrets, not just
    placeholder/dev values (this is a field-presence check only; no values were read
    into this report).
- Current tracking state: `git ls-files figm-user-db.json` → empty output (untracked).
  `git ls-files .env` → empty output (untracked). Both confirmed absent from the
  current index.
- `.gitignore`: line 24 `figm-user-db.json` (with an explanatory comment referencing
  "SEC-01" at lines 20-23), line 7 `.env`, line 18 `.env*`. Both files are ignored
  going forward.

**VERDICT: FIXED AND VERIFIED (removal from tracking) / CONTRADICTED-BY-OMISSION (severity
understated)** — every specific number in the `GIT_HISTORY_SECRET_REMEDIATION.md` claim
(74 commits, 2 commits, 465 records, initial-commit inclusion, exact removal commits)
independently reproduces exactly. The claim is accurate as far as it goes, but it
undersells the finding: it doesn't mention (a) 16 non-admin refresh tokens were also
committed, or (b) both seeded admin accounts shared one password hash. The files are
correctly removed from the current tree and gitignored going forward, but **removal from
the tip does not remove them from history** — anyone with clone access to any commit
before `20e28f03`/`56ddcfc0` (i.e. all of git history, since git history is immutable
unless force-rewritten) still has the 465 records and the `.env` values. There is no
evidence in this repository that history was rewritten (`git filter-repo`/`BFG`) — see
Section 3 for the reachability check.

Additional check: are `98bac3f9` and `56ddcfc0`/`20e28f03` still reachable from `main`
tip (i.e. history was never rewritten to purge them)?

```
git merge-base --is-ancestor 98bac3f9 main && echo "98bac3f9 IS an ancestor of main"
```

Result: **`98bac3f9 IS an ancestor of main`** — confirmed via a direct follow-up check
(see raw command below). History was never rewritten; the secret-bearing commits remain
permanently reachable from `main` in this repository's `.git` (and in any existing clone
or fork), which is the actual residual risk regardless of what the current working tree
contains.

---

## 2. Repo-wide fresh secret sweep (current tracked working tree only)

**EVIDENCE** (`git grep`, tracked files only, exit code 1 = "no match" reported honestly
below rather than omitted):

| Pattern | Result |
|---|---|
| `AIza[0-9A-Za-z_-]{35}` (Google API key) | No matches (`git grep` exit 1). |
| `sk-[A-Za-z0-9]{20,}` (OpenAI-shaped key) | No matches (`git grep` exit 1). |
| `BEGIN.*PRIVATE KEY` (PEM block) | No matches (`git grep` exit 1). |
| `eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}` (JWT-shaped literal) | No matches (`git grep` exit 1). |
| `postgres(ql)?://[^:]+:[^@]+@` (connection string with creds) | 16 hits — see below. |

`postgres://` hits, judged individually:

- `.env.example:31-32` — `postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:...` — **placeholder** (`YOUR_PROJECT_REF`/`YOUR_PASSWORD` tokens, not real values).
- `.github/workflows/figm-scan.yml:40,41,49,50,57,58` — `${{ secrets.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres' }}` — **placeholder/CI default**: the real value comes from a GitHub Actions `secrets.*` reference; `postgres:postgres@localhost` is only a fallback for when the secret isn't configured (e.g. forked-PR CI runs), pointing at a CI-local ephemeral Postgres service, not a reachable production host.
- `ENV_VARIABLES.md:20-21`, `GITHUB_ACTIONS_DEVSECOPS_GUIDE.md:54-55`, `INSTALL.md:63-64`, `docs/migration_guide.md:25-26` — all documentation examples using `password`, `[PASSWORD]`, `pass`, or `your-project` placeholder tokens — **documentation placeholders**, not real credentials.
- `prisma.config.ts:8` — `process.env.DIRECT_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/figmdb'` — **local-dev fallback default**, same pattern as the CI workflow, only used when no env var is set.

No AIza/sk-/PEM/JWT-literal hits at all. Additional targeted greps run:

- `SUPABASE_SERVICE_ROLE_KEY\s*=` → only `.env.example:28` (`"YOUR_SUPABASE_SERVICE_ROLE_KEY"` placeholder) and `INSTALL.md:62` (`your-supabase-service-role-key` placeholder). No real key.
- `sbp_[a-z0-9]{20,}` (Supabase personal access token shape) → no matches.
- `JWT_SECRET` full-repo grep → all hits are either doc examples with placeholder text, code that reads `process.env.JWT_SECRET`, or the intentional hardcoded **dev-only fallback literal** `'figm-multi-tenant-super-secret-key-2026'` in `src/auth/auth-service.ts:80` (see Section 4 — this fallback is documented as insecure-by-design for `development`/`test` only, and the code fails closed everywhere else). The identical string also appears in a **compiled/tracked build artifact**, `vscode-extension/out/src/auth/auth-service.js:21` (`git ls-files` confirms 152 files under `vscode-extension/out/` are tracked) — i.e. the same non-secret dev-fallback constant is duplicated into a checked-in build output directory. Not a secret leak (it's a public, documented dev default, not a real key), but it is dead/duplicated compiled code checked into source control.

**VERDICT: NOT VERIFIED → CONFIRMED CLEAN.** Zero real secrets found in the current
tracked working tree across all five patterns. All `postgres://`-with-credentials hits
are placeholders or documented localhost/CI fallback defaults. This matches
`audit/new-02.md:115`'s prior claim of "zero real secrets," independently reproduced
here with the exact same regex family plus PEM/JWT-literal checks that
`audit/new-02.md` did not explicitly list.

---

## 3. Repository visibility

**CLAIM:** the repo is a private GitHub repo at `github.com/ssanjula2/FIGM`.

**EVIDENCE:** Outbound network access is available in this sandbox (unauthenticated
`curl` succeeded). Confirmed remote: `git remote -v` → `origin
https://github.com/ssanjula2/FIGM.git`.

```
curl -s -o /dev/null -w "HTTP_STATUS:%{http_code}\n" https://api.github.com/repos/ssanjula2/FIGM
→ HTTP_STATUS:404
curl -s https://api.github.com/repos/ssanjula2/FIGM
→ {"message":"Not Found","documentation_url":"...","status":"404"}
curl -s -o /dev/null -w "HTTP_STATUS:%{http_code}\n" https://github.com/ssanjula2/FIGM
→ HTTP_STATUS:404 (HTML page, <title>Page not found · GitHub · GitHub</title>)
curl -s -o /dev/null -w "HTTP_STATUS:%{http_code}\n" https://api.github.com/users/ssanjula2
→ HTTP_STATUS:200 (the ssanjula2 account itself does exist)
```

GitHub's API and web UI return an identical `404` for a genuinely nonexistent
repository and for a private repository when the requester is unauthenticated — the
two cases are indistinguishable from an anonymous request by design (this prevents
using 403-vs-404 to enumerate the existence of private repos). This agent has no
authenticated GitHub credentials available to disambiguate further (no `gh auth
status` session, no token).

**VERDICT: PARTIALLY VERIFIED.** Confirmed: the repository at
`github.com/ssanjula2/FIGM` is **not publicly browsable/accessible** — a plain
unauthenticated request cannot see it, which is the operationally relevant fact (a
random unauthenticated internet user cannot read the repo or its history right now).
**NOT VERIFIED**: whether that 404 is specifically because the repo is set to
"Private" (as claimed) versus some other explanation (renamed, deleted, transferred,
never actually pushed) — that distinction is not resolvable without authenticated
`gh`/API access, which this agent does not have. Do not treat "private" as confirmed;
treat "not publicly reachable" as confirmed.

---

## 4. Password hashing / API key randomness

**Current algorithm** — `src/auth/auth-service.ts`:

- Lines 111-115: `const SCRYPT_PREFIX = 'scrypt:'; const SCRYPT_KEYLEN = 64; const
  SCRYPT_OPTIONS: crypto.ScryptOptions = { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 *
  1024 };` — Node's built-in `crypto.scryptSync`. **N=65536 is 2^16, not 2^17** — the
  inline comment at lines 121-122 ("Hash password securely using scrypt (N=2^17, r=8,
  p=1)") **mis-states its own constant** (2^17 = 131072 ≠ 65536). The code comment
  block at lines 100-105 correctly says "N=2^16" and explicitly frames it as "OWASP's
  own explicitly-endorsed lighter alternative to N=2^17," so the actual parameter
  choice is a documented, deliberate one — the *docstring* directly above
  `hashPassword` (line 122) is simply wrong/stale.
- Line 125: `const salt = crypto.randomBytes(16).toString('hex');` — cryptographically
  random 16-byte salt, freshly generated per password.
- Line 127: `return \`${SCRYPT_PREFIX}${salt}:${hash}\`;` — self-describing format tag.
- Lines 135-156 (`verifyPassword`): branches on the `scrypt:` prefix; if present,
  re-derives with the stored salt and compares via `crypto.timingSafeEqual` (line
  145) — constant-time. If absent, falls back to the **legacy format**: line 151
  `crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512')`, i.e. PBKDF2-SHA512 at
  10,000 iterations (the original SEC-06 weakness), also compared with
  `timingSafeEqual` (line 155).

**Cross-check against commit `c6a63b33` claim** ("migrate password hashing from
PBKDF2/10k to scrypt, transparent rehash-on-login"):

- `git show c6a63b33 --stat` was not separately re-run in this pass since the current
  file content (read in full above) already demonstrates the end state matches the
  claim: scrypt is genuinely what `hashPassword`/new-hash verification use today, and
  old PBKDF2 hashes still verify (necessary for backward compatibility with the 465
  legacy accounts documented in Section 1).
- **Rehash-on-login path** — `needsRehash` (lines 164-166): `return !!storedHash &&
  !storedHash.startsWith(SCRYPT_PREFIX);` i.e. true for any hash without the
  `scrypt:` tag (the legacy PBKDF2 format). Wired into `app/api/auth/login/route.ts`:
  - Line 43: `const valid = verifyPassword(password, user.passwordHash);` — verifies
    against **whichever** format (PBKDF2 or scrypt) is currently stored, using the
    just-submitted plaintext password, **before** any rehash decision.
  - Line 65: `const rehashedPassword = needsRehash(user.passwordHash) ?
    hashPassword(password) : undefined;` — only recomputes a new scrypt hash from the
    same verified-correct plaintext if the stored hash was legacy.
  - Lines 67-71: `await provider.updateUser(user.id, { refreshToken, lastLoginAt: ...,
    ...(rehashedPassword ? { passwordHash: rehashedPassword } : {}) });` — persists
    the upgraded hash only when one was computed.
  - Order of operations is correct: verify-old-hash-first, then rehash-with-new-algo,
    then persist — matches the intended "transparent upgrade on next login" design,
    with no forced reset and no risk of locking out users who haven't logged in since
    the migration.

**API key randomness** — `src/auth/user-db.ts`:

- **Admin bootstrap path** (`getDefaultUsers`, line 191): `apiKey: \`figm_key_${
  crypto.randomBytes(16).toString('hex')}\`` — cryptographically strong
  (`crypto.randomBytes`), generated fresh per process boot (comment at lines 189-190
  notes this replaced two previously-hardcoded, source-committed literals
  `figm_key_admin_sanjula`/`figm_key_admin_figm`).
- **Regular user creation path** (`createUser`, line 304): `apiKey: \`figm_key_${
  crypto.randomBytes(16).toString('hex')}\`` — identical, cryptographically strong.
  Inline comment (lines 301-303) explicitly references "NEW-01" and states the prior
  implementation was `` `Date.now()_${Math.random()...}` `` (weak/guessable) and that
  this now "matches the admin-bootstrap path's already-correct pattern."
- Note: the record **`id`** field (not the API key) at line 296 — `id: user.id ||
  \`usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}\`` — still uses
  weak `Date.now()`/`Math.random()`. This is a non-secret internal identifier, not
  used as a credential anywhere observed, so it is out of scope for "API key
  randomness" but noted for completeness. The same weak pattern is reused for
  `proj_`, `scan_`, `notif_`, `sub_`, `log_` prefixed IDs elsewhere in the same file —
  consistent (all non-secret identifiers, not credentials).

**VERDICT: FIXED AND VERIFIED.** scrypt (N=2^16, r=8, p=1) is genuinely the current
hashing algorithm with a cryptographically random salt; the transparent
rehash-on-login path is wired correctly and in the correct order (verify old → rehash
→ persist). Both admin-bootstrap and regular-user API key generation use
`crypto.randomBytes(16)`. One **cosmetic documentation defect**: the docstring at
`src/auth/auth-service.ts:122` says "N=2^17" while the actual constant (line 115) and
the design-rationale comment (lines 100-105) both correctly say/use 2^16 — a
comment/code mismatch, not a security defect.

---

## 5. CSV export injection

`src/engine/export-service.ts` read in full (212 lines).

**Current escaping logic** — lines 12-14:
```ts
function sanitizeCsvCell(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}
```
This tests whether a cell value **starts with** `=`, `+`, `-`, or `@` and, if so,
prefixes a literal single-quote — the standard formula-injection mitigation (forces
Excel/Sheets to render the cell as text rather than evaluate it as a formula).

Applied at every interpolated field in `exportCSV` (lines 58-79):
- `ruleId` (line 67), `ruleName` (line 68), `severity` (line 69), `domain` (line 70) —
  each individually run through `sanitizeCsvCell`.
- `offendingCodeSnippet` (line 71) and `remediation` (line 72) — run through
  `sanitizeCsvCell` **and then** quote-escaped: `` `"${sanitizeCsvCell(d.offendingCodeSnippet
  || '').replace(/"/g, '""')}"` `` — i.e. formula-neutralization happens before the
  standard CSV double-quote escaping, both defenses stacked on the two
  free-text/attacker-influenceable fields.

**VERDICT: FIXED AND VERIFIED.** The current code neutralizes leading
`=`/`+`/`-`/`@` (formula-injection) on every exported field, not merely quote-escaping.
This matches the SEC-07 remediation described in the source comment block
(`export-service.ts:3-11`, which explicitly cites "SEC-07").

---

## 6. Admin apiKey exposure

`app/api/admin/users/route.ts` read in full (98 lines).

**Current mapping code** — lines 11-15 and 24-32:
```ts
function maskApiKey(apiKey: string | null | undefined): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 4) return '*'.repeat(apiKey.length);
  return `${'*'.repeat(apiKey.length - 4)}${apiKey.slice(-4)}`;
}
...
const users = allUsers.map((u) => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName,
  role: u.role,
  apiKey: maskApiKey(u.apiKey),
  createdAt: u.createdAt,
  lastLoginAt: u.lastLoginAt || u.createdAt,
}));
```
The GET handler (`authorizeRole(request, ['ADMIN'])`-gated, lines 17-21) returns each
user's `apiKey` **masked** — all characters replaced with `*` except the last 4, via
`maskApiKey`. The comment block at lines 6-10 explicitly cites "SEC-08" and explains
the rationale (limiting blast radius of an admin-account compromise; full key is only
ever visible to the owning user via a separate `/api/profile` self-service route not
touched by this file — this agent did not independently verify that route in this
pass, out of this task's scope).

**VERDICT: FIXED AND VERIFIED.** The admin-users list endpoint returns other users'
`apiKey` **masked** (last 4 characters only), not plaintext and not fully omitted.
Matches the SEC-08 remediation.

---

## 7. CI/CD and deployment config secrets

- `.github/workflows/figm-scan.yml` (108 lines, only workflow file present —
  `.github/workflows/*.yml` glob returned exactly this one file): every credential
  reference goes through `${{ secrets.* }}` (lines 40-41, 49-50, 57-60, 76). The only
  literal, non-secret-reference values are `postgresql://postgres:postgres@localhost:5432/postgres`
  fallbacks (lines 40, 41, 49, 50, 57, 58) — a standard Postgres default used only when
  the corresponding `secrets.DATABASE_URL`/`secrets.DIRECT_URL` isn't configured (e.g.
  fork PRs without repo secrets), pointing at an ephemeral CI-local service, not a
  reachable host. No hardcoded real credentials.
- `vercel.json` (12 lines) — only non-secret build/env config:
  `"env": { "STORAGE_PROVIDER": "supabase" }`. No credentials of any kind.
- `prisma.config.ts` (10 lines) — `url: process.env.DIRECT_URL ||
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/figmdb'`
  — same non-secret localhost fallback pattern as the CI workflow. No hardcoded real
  credentials.

**VERDICT: FIXED AND VERIFIED / CONFIRMED CLEAN.** No hardcoded, non-placeholder
credentials found in the sole GitHub Actions workflow, `vercel.json`, or
`prisma.config.ts`.

---

## 8. Untracked scratch clutter

`git status --porcelain | grep '^??'` → **64 untracked entries** (full list captured;
one entry, `scratch/upload-test-files/`, is a directory containing 3 files:
`AnotherBad.tsx`, `BadComponent.jsx`, `Clean.tsx`).

**Root-level stray files (2, outside `scratch/`):**
| File | Size | Content | Risk |
|---|---|---|---|
| `FIGM_CODE_EXPORT.txt` | 24,843 lines | A raw concatenation of source files (`===== <path> =====` section headers followed by file contents) — a code-export/dump tool's output. Grepped for `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL=`, `JWT_SECRET`, `AIza...`, `sk-...` — only source-code references to env-var *names* found (e.g. `process.env.SUPABASE_SERVICE_ROLE_KEY`), no values. | Low — clutter, not a secret leak, but a 24.8k-line dump of the entire codebase sitting at repo root is unusual and should not ship. |
| `debug-complexity.ts` | 18 lines | A trivial ad-hoc script exercising `ComplexityEngine`/`SourceParser` against an inline nested-if snippet. | None — benign debug scratch. |

Also present at root: `test-suite-output.txt` (1,960 lines) — raw test-runner output,
not inspected line-by-line beyond confirming it's plain test output, not secrets.

**`scratch/` directory (61 files + 1 subdirectory):**

Categorized by apparent purpose:
- **Batch/probe test scripts** (`.ts`/`.mjs`, ~30 files): `batch1-probe.ts` through
  `batch13-*.ts`, `react01-probe.ts`/`react03-probe*.ts`, `audit2-*.ts`,
  `reaudit-edge-cases.ts`, `dogfood-*.ts`, `diag-next02.ts`, `perf-large.mjs`,
  `audit-dynprofiler-*` — ad-hoc TypeScript probes clearly written for this and prior
  audit cycles to exercise specific endpoints/behaviors against a locally running dev
  server. Consistent with the parallel live-testing agent's session artifacts plus
  this project's documented pattern of scratch-script-driven manual testing.
- **Captured live-session artifacts (JWT/cookie-shaped, 7 files):**
  `scratch/access-token.txt` (287B), `scratch/refresh-token.txt` (280B),
  `scratch/audit-token-b.txt` (283B), `scratch/none-alg-jwt.txt` (189B),
  `scratch/cookies.txt` (135B, Netscape cookie-jar format), `scratch/audit-token-a.txt`
  (0 bytes, empty), `scratch/user-id.txt` (36 bytes, a UUID). Decoded (payload only,
  not the signature, and with `sub`/`email` redacted in this report) the JWT header/
  payload of `scratch/access-token.txt`: `{"alg":"HS256","typ":"JWT"}` /
  `{"name":"Sec Probe Six","role":"DEVELOPER", ...}` — the account name "Sec Probe Six"
  confirms this is a synthetic test account created by an automated probe against a
  local/dev instance, not a real user's captured session. Several `scratch/*.json`
  response dumps (`reg-resp.json`, `reg-resp3.json`, `reg4.json`, `reg6.json`) also
  contain live-format `accessToken`/`refreshToken` JWT strings from registration-flow
  test probes, same pattern.
- **JSON test fixtures/response captures:** `own-projects.json/2/3`,
  `own-reports.json`, `reg-resp*.json`, `reg4.json`, `reg6.json`, `forged-scan.json`
  (28 bytes, `{"error":...}` — an error-response capture, not a real scan).
- **Misc single-value files:** `migration-name.txt` (15B, a timestamp string
  `20260818075914`), `live-scan-code.txt`, `full-test-run.txt`/`full-test-run2.txt`,
  `test-run-final-audit.txt`, `reaudit-test-run.txt` — raw command-output captures.
- **`baseline-migration.sql`** — a Prisma migration SQL file, presumably staged for
  the PROD-02 baseline-migration fix (see recent commit `77e76fe9`) but not yet
  committed into `prisma/migrations/`.
- **`scratch/upload-test-files/`** — 3 sample React component files (`Clean.tsx`,
  `BadComponent.jsx`, `AnotherBad.tsx`) used as multi-file upload test fixtures for
  the live-scan page (see recent commit `02ed599d`). Benign.

**Critical structural finding:** `scratch/` is **not listed in `.gitignore`** (full
`.gitignore` re-read and confirmed — it covers `node_modules`, `.next`, `dist`,
`build`, `coverage`, `*.log`, `.env`/`.env*`, `figm-ci-report.*`, `figm-scan-report.*`,
`research/raw/real/*`, `.vercel`, `figm-user-db.json`, and
`benchmarks/real-world/.repo-clones/` — no `scratch` entry anywhere). This means the
64 untracked files currently sitting there — including 7+ files containing live
JWT-format access/refresh tokens and session cookies — are untracked **only because no
one has run `git add` on them yet**, not because git is configured to exclude them.
A single `git add -A`/`git add .` (explicitly warned against in this agent's own
operating instructions, but not enforced at the repository-config level) would stage
all of it, including the token files, directly reproducing the exact class of incident
(`figm-user-db.json`/`.env`, Section 1) this project has already suffered once and
documented extensively.

**VERDICT: NEW FINDING — PLANNED MITIGATION MISSING.** The specific committed secrets
from Section 1 are gone from the tree and gitignored; however, the structural gap that
allowed that incident (no `.gitignore` guard for ad-hoc local/scratch artifacts
containing credentials) has not been closed. It has simply moved to a new directory
name (`scratch/` instead of repo root).

---

## Reconciliation table — prior finding IDs

| ID | Original finding (per `audit/new.md`) | Current status (this pass) | Evidence |
|---|---|---|---|
| SEC-06 | PBKDF2 at 10,000 iterations, below OWASP guidance | **FIXED AND VERIFIED** — migrated to scrypt (N=2^16, r=8, p=1) with random salt; legacy PBKDF2 hashes still verify and are transparently rehashed on next successful login | `src/auth/auth-service.ts:100-166`, `app/api/auth/login/route.ts:43-71` |
| SEC-07 | CSV export formula-injection risk (unescaped `=`/`+`/`-`/`@`) | **FIXED AND VERIFIED** — `sanitizeCsvCell` neutralizes all four leading characters on every exported field | `src/engine/export-service.ts:3-14,58-79` |
| SEC-08 | Admin route returns plaintext API keys | **FIXED AND VERIFIED** — `maskApiKey` returns only the last 4 characters, rest asterisked | `app/api/admin/users/route.ts:11-32` |
| NEW-01 | Weak (`Date.now()`/`Math.random()`) API key generation | **FIXED AND VERIFIED** — both admin-bootstrap and regular-user paths use `crypto.randomBytes(16)` | `src/auth/user-db.ts:191,304` |
| (unlabeled, `audit/new.md:204`) | Hardcoded fallback JWT/refresh secrets used whenever env vars absent, boot-check only exact `NODE_ENV==='production'` | **FIXED AND VERIFIED** — fallback now restricted to an explicit allow-list (`development`/`test` only via `INSECURE_FALLBACK_ALLOWED_ENVS`); every other value (including unset) fails closed | `src/auth/auth-service.ts:18-77` |

---

## New findings (this pass)

| ID (proposed) | Severity | Finding |
|---|---|---|
| NEW-GITHIST-01 | **Informational** | Independently reproduced all quantitative claims in `docs/audit/GIT_HISTORY_SECRET_REMEDIATION.md` (74 commits, 2 commits, 465 records, exact removal commits) — the document is accurate but incomplete: it omits that 16 non-admin refresh tokens were also committed and that both seeded admin accounts shared one password hash. |
| NEW-GITHIST-02 | **Medium (residual/inherent)** | `98bac3f9` (containing the full `.env` and `figm-user-db.json`) is still an ancestor of `main` — history was never rewritten (no `filter-repo`/BFG pass found). Anyone with any historical clone, fork, or access to any pre-`20e28f03` commit still has the 465 user records and `.env` secrets. This is expected/inherent to "remove going forward" remediations, not a code defect, but should be explicitly flagged as an open residual risk (mitigated only by rotating `JWT_SECRET`/`REFRESH_SECRET`/DB credentials/admin passwords, which `ENV_VARIABLES.md:30` already recommends — this agent did not verify whether that rotation actually happened). |
| NEW-SCRATCH-01 | **Medium** | `scratch/` (61 files, including live JWT-format tokens/cookies from test probes) is not in `.gitignore`. A routine `git add -A` would restage credential-shaped files, repeating the structural failure mode of the original incident under a new directory name. Recommend adding `scratch/` to `.gitignore` (or moving these files outside the repo entirely). |
| NEW-SCRATCH-02 | **Low** | Root-level `FIGM_CODE_EXPORT.txt` (24,843 lines) is a full source-code dump sitting untracked at repo root; benign in content (grepped clean of secrets) but should not persist in a shipped/reviewed project directory. |
| NEW-DOC-01 | **Low (cosmetic)** | `src/auth/auth-service.ts:122` docstring says "scrypt (N=2^17, r=8, p=1)" but the actual constant (line 115) is `N: 65536` = 2^16, matching the correct rationale in the nearby comment block (lines 100-105). Comment/code mismatch only — not a security defect. |
| NEW-BUILD-01 | **Low** | `vscode-extension/out/` (152 tracked files, compiled/built output) is checked into git, including a duplicate of the dev-fallback JWT secret constant (`vscode-extension/out/src/auth/auth-service.js:21`). Not a secret leak (same non-secret dev default), but committing build artifacts is generally discouraged practice. |

---

## Commands run (for reproducibility, non-exhaustive list of the load-bearing ones)

```
git log --all --oneline -- figm-user-db.json | wc -l
git log --all --oneline -- .env | wc -l
git show 98bac3f9 --stat | grep -E "figm-user-db.json|\.env"
git log --diff-filter=D --oneline -- figm-user-db.json
git log --diff-filter=D --oneline -- .env
git ls-files figm-user-db.json
git ls-files .env
git show 22e58e39:figm-user-db.json | node -e "... count only, no values printed ..."
git grep -n -E "AIza[0-9A-Za-z_-]{35}" -- .
git grep -n -E "sk-[A-Za-z0-9]{20,}" -- .
git grep -n -E "postgres(ql)?://[^:]+:[^@]+@" -- .
git grep -n -E "BEGIN.*PRIVATE KEY" -- .
git grep -n -E "eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}" -- .
curl -s https://api.github.com/repos/ssanjula2/FIGM
curl -s -L https://github.com/ssanjula2/FIGM
curl -s https://api.github.com/users/ssanjula2
git merge-base --is-ancestor 98bac3f9 main
git status --porcelain | grep '^??'
```
