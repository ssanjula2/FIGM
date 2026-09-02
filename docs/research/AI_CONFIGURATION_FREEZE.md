# AI Provider/Model Configuration Freeze Record

Version: 1.0.0 (`src/research/research-config.ts`'s `RESEARCH_ARTIFACT_VERSIONS.aiConfigVersion`)

This document is the frozen, versioned record of which AI provider/model configuration the
FIGM AI-remediation pipeline runs under during the study/evaluation window. It exists so any
future research result involving AI-assisted remediation is traceable to the exact configuration
that produced it (see `research/audits/FIGM_PRE_DATA_COLLECTION_AUDIT.md` Section 21/32).

## Frozen decision

| Field | Value | Evidence |
|---|---|---|
| Primary provider | Claude (Anthropic) | `.env.example`: `AI_PRIMARY_PROVIDER="CLAUDE"` |
| Primary model | `claude-opus-5` | `src/ai/claude-client.server.ts` `DEFAULT_MODEL`, overridable via `ANTHROPIC_MODEL` |
| Fallback provider | Gemini (Google) | `.env.example`: `AI_FALLBACK_PROVIDER="GEMINI"` |
| Fallback model | `gemini-3.6-flash` | `src/ai/providers/gemini-provider.ts` `DEFAULT_MODEL`, overridable via `GEMINI_MODEL` |
| Local/dev-only provider (never in production) | Ollama, local model `qwen2.5-coder:7b` | `src/ai/providers/ollama-provider.ts` `DEFAULT_MODEL`; explicit opt-in only via `OLLAMA_BASE_URL`/`OLLAMA_MODEL` |
| Fallback trigger condition | Availability failure only (timeout, rate-limit, auth/config error) -- never a code-quality rejection | `src/ai/ai-remediation-pipeline.ts` |
| Fallback hop limit | One hop; never loops back to the failed provider | `src/ai/ai-remediation-pipeline.ts` `fallbackUsed` flag |
| Max AI attempts per defect | 3, shared across the provider-fallback switch | `src/ai/ai-remediation-pipeline.ts` `MAX_AI_ATTEMPTS` |
| Claude timeout | Configurable via `ANTHROPIC_TIMEOUT_MS`, default per `resolveTimeoutMs()` | `src/ai/claude-client.server.ts` |
| Gemini timeout | Configurable via `GEMINI_TIMEOUT_MS`, default per `resolveTimeoutMs()` | `src/ai/providers/gemini-provider.ts` |
| Deterministic-first routing | Always attempted before any AI provider is invoked | `src/ai/ai-remediation-router.ts`, `src/ai/remediation-decision.ts` |
| Verification chain | isolation -> syntax -> patch-scope -> framework-structural -> compile-and-rescan -> test; `verified: true` requires the full chain to pass AND the original violation (and any grouped related diagnostic) to be confirmed absent on re-scan AND no new violation introduced | `src/ai/sandbox-validation-pipeline.ts`, `src/engine/remediation-validation.server.ts` |

## Why Claude/Gemini, not Ollama, for the frozen study configuration

- Hosted, reproducible API -- no GPU/VRAM dependency, runs identically on any machine executing
  the study or the real-world benchmark, unlike a local Ollama model.
- Already the shipped `.env.example` default -- the path most exercised during this project's own
  development and testing.
- Ollama is explicitly documented (`tests/ollama-integration.test.ts`) as capable of reproducing
  real hardware failures (insufficient GPU memory) -- unsuitable as the sole or primary provider
  for a reproducible, timed research experiment. It remains available as a dev-only, explicit
  opt-in option, never auto-enabled in production.

## Environment variables (names only -- no values recorded here)

`AI_PRIMARY_PROVIDER`, `AI_FALLBACK_PROVIDER`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`,
`ANTHROPIC_TIMEOUT_MS`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TIMEOUT_MS`,
`OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_MS` (dev-only).

## What changing this configuration mid-study would require

Per the "what must remain frozen during real data collection" rule (audit Section 18): if a
critical bug requires changing the primary provider, model, or verification-chain behavior after
real participant/benchmark data collection has begun, collection must STOP, and the change must be
documented with: the old version, the bug, its impact, the new version, which participants/repo
runs are affected, and an explicit decision on exclusion vs. restart -- then collection resumes
only under a documented protocol, with `aiConfigVersion` bumped in
`src/research/research-config.ts`.

## Status

**FROZEN** as of this document's creation, pending the overall experiment freeze commit/tag
described in `research/audits/FIGM_PRE_DATA_COLLECTION_AUDIT.md` Section 21. This is a
configuration recommendation matching what is already shipped as the default -- no code change to
the provider selection logic was required or made to produce this record.
