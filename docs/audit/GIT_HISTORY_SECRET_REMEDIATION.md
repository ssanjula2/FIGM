# Git History Secret Remediation

**Status as of 2026-08-18.** This document is descriptive and prescriptive, not a record of an
executed history rewrite — **no destructive git operation (`filter-repo`, force-push, branch
deletion) has been run.** Per this pass's own instructions, that step requires a deliberate,
separate decision by a repo owner, made with full awareness that it rewrites every commit hash in
the repository and breaks every existing clone/fork/PR. This document exists so that decision can
be made with accurate, current information instead of guessed history.

## 1. What is actually exposed, and where

Two files were historically committed to this repository containing real credential material.
Neither is exposed in the **current working tree or any commit reachable from the current tip of
`main`** — both were removed from tracking (`.gitignore`d) partway through the project's history.
The exposure is **git-history-only**: recoverable by anyone who fetches the full history (a normal
`git clone`), not visible by browsing the current files.

| File | First committed | Removed from tracking | Commits touching it | What it contained |
|---|---|---|---|---|
| `figm-user-db.json` | `98bac3f9` (2026-08-05, initial commit) | `20e28f03` (2026-08-13) | **74** | The full local user database as of each commit: password hashes, refresh tokens, API keys, for every registered user at that point in time. The commit immediately before removal contained 465 user records, including a real (non-empty) `refreshToken` for the `sanjula@nsbm.ac.lk` ADMIN account. |
| `.env` | `98bac3f9` (2026-08-05, initial commit) | `56ddcfc0` (2026-08-05, 2nd commit) | 2 | Whatever real environment values were configured at that moment (`JWT_SECRET`, `REFRESH_SECRET`, database connection strings, etc., per this repo's `.env` shape). Only 2 commits, so the exposure window here is much narrower than `figm-user-db.json`'s.

**Repo-wide secret-pattern grep of every currently-tracked file** (API-key-shaped, OpenAI-key-shaped,
PEM blocks, `postgres://user:pass@host`) found **zero real secrets in the current tree** — only
`.env.example`'s own intentional placeholder values and localhost dev-default connection strings.

**Repository visibility, confirmed live:** `https://api.github.com/repos/ssanjula2/FIGM` returns
`404 Not Found` to an unauthenticated request, confirming the repo is **private**. This meaningfully
narrows the realistic exposure surface (limited to whoever has/had collaborator access) compared to
a public repo, but does not eliminate it — collaborator history was not independently verified as
part of this pass, and anyone who cloned the repo while a credential-bearing commit was live
retains that history locally regardless of the repo's current visibility setting.

## 2. Live credential status (verified this pass, no secret values printed)

Checked the **actual configured Supabase database** (not assumed) for whether the specific
historically-exposed credentials are still active:

- **Two ADMIN accounts (`admin@figm.io`, `sanjula@nsbm.ac.lk`) still authenticate with the exact
  default password (`Admin123456!`) that was committed to `figm-user-db.json` and separately
  printed in cleartext in a prior audit document (`audit/new.md`).** This is a **live, currently
  exploitable** credential, not merely a historical one — confirmed by calling `verifyPassword()`
  against the real stored hash for both accounts, without printing the password or hash anywhere.
- **`sanjula@nsbm.ac.lk`'s stored refresh token has been revoked** as part of this same pass (see
  §3below for the bug this uncovered) — the account will require a fresh login next time, but the
  **password itself was deliberately left unchanged**, per an explicit decision: this document's
  author does not know whether these are accounts a real person is actively depending on right now,
  and changing a live password unilaterally risks locking someone out with no coordinated handoff.
  **Recommended next step, for a repo owner to perform directly:** change both accounts' passwords
  via `PATCH /api/admin/users` (the existing admin panel), or `resolveBootstrapAdminPassword()`'s
  env-driven bootstrap path for a fresh deploy.
- **`JWT_SECRET`/`REFRESH_SECRET` rotation status**: `.env` currently has both set to real,
  non-placeholder 64-character values (confirmed by length, not printed). Whether these are the
  *same* values that were briefly committed in the initial 2 commits (2026-08-05) or were rotated
  since is **not verified** — if they are unchanged since that initial exposure, any JWT signed with
  them (including one an attacker could forge, since a leaked signing secret allows minting
  arbitrary valid tokens, not just replaying stolen ones) would still validate. **Recommended: rotate
  both `JWT_SECRET` and `REFRESH_SECRET` regardless of whether the history rewrite below happens
  soon** — this instantly invalidates every outstanding token network-wide (including any a leaked
  history could have enabled forging) and is far lower-risk than a full history rewrite: it doesn't
  touch git at all, doesn't break any clone, and every legitimate user simply needs to log in again
  (matches the same "worst case is a fresh login" cost as the refresh-token revocation above).

## 3. A related bug this review found and fixed (not a git-history issue, but directly relevant)

While verifying refresh-token revocation as part of this remediation review, found that
`POST /api/auth/logout` was **not actually revoking the stored refresh token at all** against the
real Supabase/Prisma-backed storage provider, despite reporting success and correctly clearing the
client-side cookies. Root cause: `updateUser(userId, { refreshToken: undefined })` — Prisma's
`update()` silently treats an `undefined`-valued field as "not included in this update," not "clear
it"; only an explicit `null` actually clears a nullable column. Confirmed live (register → note the
DB-stored refresh token → logout → re-check the DB: value was byte-for-byte unchanged → the
pre-logout refresh token could still successfully mint new access tokens via `/api/auth/refresh`).

**Meaning**: any refresh token that leaked via the git-history exposure above (or any other means —
XSS, a MITM, a stolen device) would have remained fully valid for its entire 7-day life even after
the legitimate user clicked "log out," until this fix. Fixed in `app/api/auth/logout/route.ts`
(`refreshToken: null`, plus widened `DBUser.refreshToken`'s type to `string | null`); verified live
against the real DB (refresh-after-logout now correctly returns `401 TOKEN_REVOKED`, was `200`
before), and covered by two new permanent regression tests in
`tests/security-remediation.test.ts`. This is the reason §2's `sanjula@nsbm.ac.lk` token
revocation above only became genuinely effective once this fix landed.

## 4. Recommended remediation, in priority order

1. **Rotate `JWT_SECRET` and `REFRESH_SECRET`** in the real deployment's environment configuration.
   Immediate, zero git risk, invalidates every outstanding token instantly.
2. **Change the password for `admin@figm.io` and `sanjula@nsbm.ac.lk`** (still the historically-
   exposed default) via the admin panel or a direct DB update. Coordinate with whoever actually
   uses these accounts first if they're live.
3. **Rewrite git history to purge `figm-user-db.json` and `.env`** — see the exact commands below.
   Lower priority than 1/2 because a private repo with rotated live credentials means the
   historical file content is a stale, already-invalidated secret to anyone finding it after 1/2 are
   done — still worth doing for defense-in-depth and to stop the exposure from growing with every
   future clone, but not itself an active vulnerability once 1/2 are complete.
4. **Notify anyone with an existing local clone** before force-pushing (step 3) that they must
   re-clone rather than pull/rebase — a rewritten history is incompatible with their existing clone's
   commit graph.

## 5. Exact history-rewrite procedure (NOT executed — for a repo owner to run deliberately)

Requires [`git-filter-repo`](https://github.com/newren/git-filter-repo) (not installed in this
environment; the classic `git filter-branch` also works but is officially deprecated by Git itself
in favor of `filter-repo`, is drastically slower on a repo this size, and has known correctness
footguns around merge commits — use `filter-repo`).

```bash
# 1. Make a full backup mirror clone first -- filter-repo operates on a fresh clone by design and
#    refuses to run on a repo with an existing remote configured, as a safety rail. This backup is
#    your rollback if anything looks wrong afterward.
git clone --mirror https://github.com/ssanjula2/FIGM.git figm-backup-mirror-$(date +%Y%m%d)

# 2. Fresh clone to actually rewrite (filter-repo refuses to run in-place on your working clone).
git clone https://github.com/ssanjula2/FIGM.git figm-history-rewrite
cd figm-history-rewrite

# 3. Install git-filter-repo if not already available (it's a single Python script + pip package).
pip install git-filter-repo
# or: brew install git-filter-repo   (macOS)

# 4. Purge both paths from EVERY commit in EVERY branch/tag's history.
git filter-repo --path figm-user-db.json --path .env --invert-paths

# 5. Re-add the remote (filter-repo removes it as a safety measure so you don't accidentally
#    push a rewrite to the wrong place) and force-push every branch and tag.
git remote add origin https://github.com/ssanjula2/FIGM.git
git push origin --force --all
git push origin --force --tags

# 6. Verify the purge actually worked against the NEW remote history.
git log --all --oneline -- figm-user-db.json   # must print nothing
git log --all --oneline -- .env                # must print nothing
```

**After force-pushing:**
- Every collaborator with an existing local clone must **delete their clone and re-clone fresh** --
  `git pull`/`git rebase` against a force-pushed, history-rewritten remote produces a broken,
  duplicated commit graph, not a clean sync.
- Any open pull requests based on the old history will show as unmergeable/conflicting and need to
  be recreated from a fresh branch off the new history.
- Any fork of this repository (if one exists) **retains the old, unpurged history independently** --
  filter-repo only rewrites the one remote you push it to. If a fork exists, it needs the identical
  treatment separately, or deleting/recreating.
- GitHub caches some data (e.g. commit references in closed PRs/issues) that can retain visibility
  into old blobs even after a force-push; for a truly complete purge on GitHub specifically, contact
  GitHub Support to request cache invalidation for the removed objects
  (https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

## 6. What this pass did NOT do

- Did not run `git filter-repo` or any history-rewriting command.
- Did not force-push anything.
- Did not change either admin account's password.
- Did not rotate `JWT_SECRET`/`REFRESH_SECRET`.
- Did not print any secret value (password, hash, token, or connection string) anywhere in this
  document, in test output, or in any script's console output — every check above used boolean/
  length-only comparisons.

All four are real, actionable next steps a repo owner should perform directly, in the priority
order listed in §4 — the two lowest-risk, highest-value ones (secret rotation, admin password
change) require no git operations at all and should not wait on a decision about the history
rewrite.
