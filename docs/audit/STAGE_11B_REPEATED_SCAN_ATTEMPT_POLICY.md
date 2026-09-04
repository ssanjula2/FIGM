# Stage 11B — Repeated-Scan Attempt Policy

Baseline: `research-freeze-v5` (`0d287d6d8408c319bae839811d1ac52c0cd71f3f`) — **unchanged, unmoved,
unretagged** (re-verified in Section 4). This stage adds a repository-level
classification to `ParticipantRepository.getResearchDataset()` (the same file Stage 8A introduced
and Stage 11A left unmodified) on top of `main`, exactly the same "forward evolution, not a
retroactive edit to the frozen tag" pattern used by every prior post-freeze stage.

---

## 1. Policy (exact, as specified)

- A real participant **may** scan the same study fixture multiple times.
- Repeat scans are **never blocked in the UI** — confirmed still true this stage; no UI change was
  needed (Stage 11A's readiness audit already established the flow imposes no client-side or
  server-side cap on scan count).
- For **primary** human-study analysis, use only the **first valid post-consent attempt** for each
  (participant, fixture) pair.
- **Later valid post-consent attempts** are preserved as **secondary interaction data** — never
  overwritten, never deleted, never counted as an additional primary observation.
- **Pre-consent attempts** remain excluded entirely (unchanged from Stage 8A).
- **QA/protocol (`ASSIGNED`-only) participants** remain excluded entirely (unchanged).
- **`REVOKED`** participants remain excluded entirely (unchanged).
- No participant activity was fabricated to demonstrate or test this policy — every test fixture
  below uses the real repository/storage-provider stack, real timestamps, real scan records.

## 2. Implementation (smallest necessary change)

Single file changed: `src/engine/participant-repository.ts`. No new endpoint, no new repository
method beyond two trivial pure filters, no UI change, no schema/migration change.

**`ResearchDatasetScanRow`** gained one field:

```ts
attemptType: 'PRIMARY' | 'SECONDARY';
```

**`getResearchDataset()`**'s per-user loop now sorts that user's already-consent-filtered eligible
scans by `createdAt` ascending, and — grouping purely by `fileName` (the fixture identity a
"participant × fixture" pair reduces to in this schema, since a row is already scoped to one
`userId`) — tags the first occurrence of each `fileName` as `'PRIMARY'` and every subsequent
occurrence as `'SECONDARY'`. Every eligible row is still returned (nothing is dropped); the method
still returns a flat, chronologically-sorted array, now carrying this one extra field. No existing
field changed meaning or shape.

Two new pure, one-line static helpers give the two named views the policy calls for, without
requiring every consumer to reimplement the filter:

```ts
ParticipantRepository.filterPrimaryResearchAttempts(rows)    // rows.filter(r => r.attemptType === 'PRIMARY')
ParticipantRepository.filterSecondaryResearchAttempts(rows)  // rows.filter(r => r.attemptType === 'SECONDARY')
```

Both operate on an already-fetched `getResearchDataset()` result — neither re-queries the storage
provider, so there is exactly one database-reading code path for research data, unchanged from
Stage 8A's own "never source a real research export from anywhere but this method" invariant.

No route or script currently consumes `getResearchDataset()`'s output (verified by grep — it is
repository-level only, as it has been since Stage 8A), so no other file required a change.

## 3. Why `(userId, fileName)` and not something finer/coarser

The study design (`app/user-study/page.tsx`) has exactly four fixed benchmark fixtures — one
`fileName` per framework condition (`UserProfile.jsx`, `DashboardPage.tsx`,
`SearchPanel.component.ts`, `DataGrid.vue`) — so "fixture" and "the scan's own `fileName`" are the
same concept in this schema; no separate fixture-ID field exists or is needed. Grouping is already
implicitly per-participant, since `getResearchDataset()`'s outer loop iterates one
`CONSENT_VERIFIED` user at a time — so `(userId, fileName)` is exactly "participant × fixture," not
an approximation of it.

## 4. Freeze integrity re-verified

```
git rev-parse HEAD (before this stage)  -> 613a88d5e6b6b6a6b93f8ceb1dda1b9cf6e5542e
git rev-list -n 1 research-freeze-v5    -> 0d287d6d8408c319bae839811d1ac52c0cd71f3f  (unchanged)
```

`git diff --name-only research-freeze-v5 HEAD` continues to show only `docs/` files differing —
this stage's one source change (`src/engine/participant-repository.ts`) lands on top of `main`,
exactly like Stage 8A's original gate and Stage 11A's auth fix; none of it touches or moves the
`research-freeze-v5` tag.

## 5. Tests

New file `tests/repeated-scan-attempt-policy.test.ts` (7 tests, real repository/storage-provider
stack, no mocking):

| Test | Result |
|---|---|
| First eligible post-consent scan of a fixture is chosen as `PRIMARY` | PASS |
| Two later valid post-consent scans of the same fixture are retained as `SECONDARY`, not counted as additional primary observations | PASS |
| A different fixture for the same participant gets its own independent `PRIMARY` (not one `PRIMARY` per participant overall) | PASS |
| Pre-consent scans remain excluded entirely — never appear as `PRIMARY` or `SECONDARY` | PASS |
| Repeat scans never overwrite or delete the first attempt's raw `scan_reports` row (append-only, verified directly against the storage provider) | PASS |
| `REVOKED` participant contributes zero rows of any `attemptType`, even with repeated post-consent-era scans | PASS |
| `ASSIGNED`-only (QA/protocol) participant contributes zero rows of any `attemptType`, even with repeated scans | PASS |

Pre-existing tests re-run to confirm no regression: `tests/research-dataset-consent-gate.test.ts`
(4 tests) and `tests/human-study-readiness.test.ts` (8 tests) — both still 100% passing; neither
does an exact-shape/deep-equality assertion on a `ResearchDatasetScanRow`, so the new
`attemptType` field required no change to either file.

## 6. Gates

```
npx tsc --noEmit                    -> PASS (0 errors)
Targeted (this stage's new file)    -> 7/7 PASS
Full test suite (npm test)          -> PASS, 1499/1499, 0 fail, 0 cancelled, 0 skipped
npm run build (rm -rf .next first)  -> PASS, clean
```

---

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BTxjxSo2MumPZ9pw28vgEA
