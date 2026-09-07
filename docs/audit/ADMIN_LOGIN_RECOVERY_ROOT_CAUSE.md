# Admin Login Recovery — Root Cause Investigation

Date: 2026-09-07
Scope: `sanjula@nsbm.ac.lk` (id `usr_admin_sanjula`, role `ADMIN`) login continues to fail on
`https://figm-code-inspector.vercel.app` after a manual `password_hash` UPDATE in the Supabase SQL
Editor (using this project's own `hashPassword()` output) that the editor itself confirmed matched
exactly one row.

## 1. Exact production login function chain

```
POST /api/auth/login  (app/api/auth/login/route.ts)
  → validateEmail(email)                              (format check only -- no normalization)
  → RepositoryFactory.getStorageProvider()             (src/storage/repository-factory.ts)
  → provider.findUserByEmail(email)                    (SupabaseStorageProvider, src/storage/supabase-storage-provider.ts)
      → this.db().user.findUnique({ where: { email } })
      → mapUser(u)                                     (maps raw Prisma row -> DBUser)
  → verifyPassword(password, user.passwordHash)        (src/auth/auth-service.ts)
  → signJWT(payload, user.tokenVersion, 3600)
  → signRefreshToken(payload, 604800)
  → provider.updateUser(user.id, { refreshToken, lastLoginAt, ...rehash-if-legacy })
  → sets figm_token / figm_refresh_token cookies, returns 200
```

`src/engine/user-repository.ts` is **not** part of this path at all (confirmed: zero references to
`findUserByEmail`/login anywhere in that file) — it's only used by admin actions like
`PATCH /api/admin/users`'s password reset.

## 2. Database field mapping — PASS

`SupabaseStorageProvider`'s `mapUser()` (line ~22-43):
```ts
function mapUser(u: any): DBUser {
  return {
    id: u.id,
    email: u.email,
    passwordHash: u.passwordHash,   // <-- proven present, not assumed
    ...
```
Prisma's `User.passwordHash` field is mapped from the real column via
`@map("password_hash")` (`prisma/schema.prisma:96`). There is no path by which a populated
`password_hash` column becomes `undefined`/`null` at the application layer — confirmed directly
from source (also covered by a new regression test asserting this exact line exists).

## 3. Hash format compatibility — PASS

`hashPassword()`/`verifyPassword()` (`src/auth/auth-service.ts:117-162`) are self-consistent:
`scrypt:<16-byte-hex-salt>:<64-byte-hex-hash>`, N=65536, r=8, p=1, `crypto.timingSafeEqual` for
comparison (length-checked first, so no accidental exception). Confirmed via a real local round
trip (new test: `hashPassword(pw)` → `verifyPassword(pw, hash) === true`,
`verifyPassword('wrong', hash) === false`) — no discrepancy found between the two functions'
parsing of the `scrypt:` prefix, split(':'), or derived-key length.

## 4. Email normalization — REAL GAP FOUND AND FIXED

`validateEmail()` only checks format (trims internally for the regex test, but returns a boolean,
never a normalized value). The **raw, unnormalized** `email` from the request body was passed
straight into `findUserByEmail()`. That function itself lowercased the query
(`email.toLowerCase()`) but **never trimmed it** — in either storage backend:

- `SupabaseStorageProvider.findUserByEmail`: `where: { email: email.toLowerCase() } }` (no trim)
- `UserDB.findUserByEmail` (JSON backend): `u.email.toLowerCase() === email.toLowerCase()` (no trim)

`User.email` is a plain Postgres `text` column (`@unique`, no `citext`/case-insensitive
collation) — exact-match comparison. A login attempt with any incidental leading/trailing
whitespace (copy-paste from an email client, a password manager, a Supabase table-editor cell,
etc.) around an otherwise-correct, cleanly-stored email would silently fail to match — and because
`/api/auth/login` deliberately returns the identical generic `401 INVALID_CREDENTIALS` for both
"no such user" and "wrong password" (to prevent account-email enumeration via response
differences), this failure mode is **completely indistinguishable from a wrong password** to
whoever is typing it in.

**Fixed**: both `findUserByEmail` implementations now `.trim()` the incoming lookup value before
lowercasing (`src/storage/supabase-storage-provider.ts`, `src/auth/user-db.ts`). Proven by a new
regression test that logs in successfully with `"  email@example.com  "` against a cleanly-stored
row — this exact scenario failed before the fix and passes after it.

**Important caveat**: this is a real, independently-justified bug, found and fixed during this
investigation — it is **not confirmed** to be the specific cause of this incident. The manual
`UPDATE ... WHERE email = 'sanjula@nsbm.ac.lk'` you ran matched exactly one row, which means the
*stored* email has no such whitespace. Whether *your login attempt itself* had incidental
whitespace (e.g. a browser autofill, a pasted value with a trailing newline) is not something I can
observe from code. Worth testing regardless, now that it's fixed either way.

## 5. Is Vercel connected to the same Supabase project you edited? — UNCONFIRMED

This is the most likely actual root cause given this session's own prior finding: this repository
has **two separate Vercel projects** deployed from the same GitHub repo —
`figm-code-inspector` and `figm-model` — discovered earlier this session when both received
production deployments from the same push. If the SQL Editor session you used is attached to a
*different* Supabase project than whichever one `figm-code-inspector`'s Production `DATABASE_URL`
actually points at, the UPDATE would have succeeded (against the *wrong* database) while
production login keeps checking a completely different, unmodified `password_hash`.

I could not verify this myself: directly inspecting `DATABASE_URL`/connection details was
explicitly out of scope (no secrets to be printed), and an attempt to open a narrowly-scoped,
read-only production DB connection was blocked by this session's own permission classifier
regardless of framing — I did not attempt to work around that block.

**Please check this yourself** (needs no secret-sharing with me):
1. In the **Supabase dashboard** for the project whose SQL Editor you used: Project Settings →
   General → note the **Project ID / reference** (a short string like `abcdefghijklmnop`) and/or
   the **Region**.
2. In the **Vercel dashboard** for the `figm-code-inspector` project → Settings → Environment
   Variables → Production → open `DATABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`, which is
   explicitly a public, non-secret value safe to look at) and compare the **hostname's project
   reference** against step 1. They must match exactly.

```
VERCEL_AND_SQL_EDITOR_SAME_DATABASE=UNCONFIRMED
```

If they don't match, that's root cause **A** (below) — the fix is entirely operational (edit the
correct project, or point Vercel's `DATABASE_URL` at the project you actually edited, then
redeploy), not a code change.

## 6. Local diagnostic helper

`scripts/tmp-verify-password-local.ts` (temporary, delete after use) — prompts interactively
(masked input) for a password and either a pasted hash or generates one locally, calls the real
`verifyPassword()`, and prints only `PASS`/`FAIL`. Needs a real terminal:

```
! node --import tsx scripts/tmp-verify-password-local.ts
```

## 7. Vercel Logs — what a failed login attempt actually shows

`AuditLogger.logEvent()` writes **only to the database** (`audit_logs` table) — it never calls
`console.*`, so the specific internal reason ("User not found" vs "Password mismatch") is **not
visible in Vercel Runtime Logs at all**, only via the admin dashboard's audit log view (circular if
you're locked out). The login route's own `catch` block also never calls `console.error` for a 500.

What Vercel Logs *does* show for `POST /api/auth/login`: the **HTTP status code**, which safely
distinguishes:
- `400` → malformed request (missing/invalid email or password field)
- `401` → invalid credentials — user not found **or** password mismatch (deliberately
  indistinguishable from logs alone, to prevent email enumeration — this is correct, existing
  behavior, not a gap)
- `500` → a genuine server/infra error (e.g. DB unreachable); the response **body** would contain
  `err.message` in this one case (a pre-existing, separate info-disclosure pattern, out of scope
  for this investigation since it wasn't asked about and isn't the reported symptom)

**Exact safe command** to inspect after one failed attempt:
```
vercel logs --project figm-code-inspector --environment production --since 15m -q "auth/login"
```

## 8. Outcome

Both **B** (mapping bug) and **C** (hash incompatibility) are ruled out — proven clean from source
and by new passing tests. **D** (normalization bug) was real and is fixed. **A** (wrong Supabase
project) is the leading suspect but requires your own dashboard comparison to confirm — I cannot
determine it safely from here. If A turns out to be true, no further code change is needed; if A is
ruled out and D's whitespace fix also doesn't explain it, the next step would be re-attempting
recovery with a freshly-generated hash immediately followed by a login attempt, watching Vercel Logs
per section 7.
