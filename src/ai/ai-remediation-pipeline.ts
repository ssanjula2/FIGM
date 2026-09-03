/**
 * Framework-Independent Guideline Model (FIGM)
 * Unified AI Code Remediation Orchestrator
 *
 * Architecture: Violation -> RemediationDecision (src/ai/remediation-decision.ts, the ONE
 * authoritative typed decision for this specific instance) -> exactly one path:
 *   - a deterministic engine already produced an accepted patch for this instance  -> verify, accept
 *   - MANUAL_REVIEW_ONLY (rule-level; see AIRemediationRouter)                     -> human review, no patch generated
 *   - otherwise (AI_ASSISTED, including a declined deterministic instance)         -> AI provider, sandboxed, bounded retry
 *
 * There is deliberately NO fourth path. "AI provider" is whichever AIRemediationProvider
 * src/ai/ai-provider-selector.ts currently resolves as active (Ollama, Claude, or Gemini — see that
 * module's own doc comment for precedence) — this file never talks to a specific vendor SDK directly. When
 * the active provider is unavailable, declines, or every attempt is rejected by sandbox validation,
 * this pipeline returns an explicit "no automated fix available" result — it never falls back to
 * the legacy regex-based RemediationEngine to manufacture a plausible-looking "fixed" result. See
 * src/engine/remediation-engine.ts's own header for why that module still exists (kept for its
 * narrow, honest, non-automatic uses) and is deliberately never invoked from this file.
 */

import { DiagnosticReport } from '../types/ast-spec.js';
import { RemediationResult } from '../engine/remediation-engine.js';
import { RemediationValidator } from '../engine/remediation-validation.server.js';
import { AIProviderSelector } from './ai-provider-selector.js';
import type { AIProviderName } from './providers/ai-remediation-provider.js';
import { AIPatchValidator } from './patch-validator.js';
import { SandboxValidationPipeline } from './sandbox-validation-pipeline.js';
import { PatchGenerator } from '../engine/patch-generator.js';
import { decideRemediation } from './remediation-decision.js';

/** Bounded retry for Layer 2: an AI attempt that fails validation gets fed the exact failure back
 *  and one more try, never an unbounded loop. 3 total attempts (1 initial + 2 with feedback). */
const MAX_AI_ATTEMPTS = 3;

/**
 * Server-side-only diagnostic trace for every remediation attempt — the single place this
 * information is ever logged, so a future failed remediation can be diagnosed from server logs
 * alone. Deliberately structured (ruleId/filePath/framework/line/column/stage/status), never the
 * API key, never a raw secret, and never the full source code (only line/column + which stage —
 * consistent with claude-client.server.ts / gemini-provider.ts's own logging discipline, which never
 * log complete source in production logs either).
 */
function logRemediationEvent(stage: string, defect: DiagnosticReport, framework: string, detail: Record<string, unknown> = {}): void {
  console.log(
    `[ai-remediation-pipeline] stage=${stage} ruleId=${defect.ruleId} filePath=${defect.filePath || '(none)'} framework=${framework} ` +
      `line=${defect.location?.start?.line ?? '?'} column=${defect.location?.start?.column ?? '?'}` +
      Object.entries(detail)
        .map(([k, v]) => ` ${k}=${String(v)}`)
        .join('')
  );
}

export interface AIRemediationPipelineResult extends RemediationResult {
  /** Which path actually produced (or failed to produce) `remediatedCode`:
   *   AST_DETERMINISTIC_FIX — a real AST engine (TS/Angular-template/Vue) transformation, verified.
   *   AI_ASSISTED_FIX        — an AI-authored patch (see `provider` for which one) that passed full
   *                            sandbox validation. Provider-neutral by design — which AI produced it
   *                            is a separate, explicit field, never encoded into this union.
   *   MANUAL_REVIEW          — this violation is rule-level MANUAL_REVIEW_ONLY; no patch was attempted.
   *   UNAVAILABLE            — no deterministic fixer exists/succeeded for this instance AND the
   *                            active AI provider was unavailable, declined, or every attempt was
   *                            rejected. `code` is returned unchanged — never a fabricated
   *                            regex-templated "fix". */
  engineType: 'AST_DETERMINISTIC_FIX' | 'AI_ASSISTED_FIX' | 'MANUAL_REVIEW' | 'UNAVAILABLE';
  /** Which AI backend actually attempted/produced this result — only meaningful when the AI layer
   *  was reached at all (engineType 'AI_ASSISTED_FIX', or 'UNAVAILABLE' after a real AI attempt).
   *  Undefined for AST_DETERMINISTIC_FIX/MANUAL_REVIEW, which never consult an AI provider. See
   *  src/ai/ai-provider-selector.ts for how the active provider is chosen. */
  provider?: AIProviderName;
  confidenceScore: number;
  fallbackReason?: string;
  /** True only if the patched code was re-scanned and the original violation (defect.ruleId) is confirmed gone. */
  verified: boolean;
  /** UNRESOLVED means a candidate patch WAS generated and sandbox-validated/re-scanned, but the
   *  violation is still present (or the sandbox rejected it) — the UI is entitled to say "a patch
   *  was generated." AI_UNAVAILABLE means no candidate patch was ever produced at all (every AI
   *  attempt errored — malformed/unparseable output, timeout, rate limit — or the provider
   *  consciously declined) — the UI must NOT claim a patch existed. Conflating these two was a real,
   *  reproduced bug: a Qwen response that failed JSON parsing surfaced as UNRESOLVED, so the UI
   *  displayed "a patch was generated, but re-scanning it still detects the same violation" when no
   *  patch had actually been produced. See remediateDefect's terminal fallback below. */
  verificationStatus: 'FIXED' | 'PATCH_REJECTED' | 'UNRESOLVED' | 'MANUAL_REVIEW_REQUIRED' | 'AI_UNAVAILABLE';
}

export class AIRemediationPipeline {
  /**
   * Generates a remediation for `defect` as it actually appears in `code`, following exactly one
   * of the three paths above. Never fabricates success and never silently mutates unrelated code.
   */
  public static async remediateDefect(
    code: string,
    defect: DiagnosticReport,
    framework: string = 'GENERIC'
  ): Promise<AIRemediationPipelineResult> {
    const startLine = defect.location?.start?.line || 1;
    logRemediationEvent('START', defect, framework);

    // Staleness guard — MUST run before decideRemediation touches `code`/`defect` at all.
    // `defect` describes a violation found against SOME earlier snapshot of the source (a
    // completed scan); `code` is whatever the caller is asking to patch NOW, and callers (e.g. the
    // live-scan UI, whose auto-scan is debounced) can genuinely submit a `code` that has already
    // moved on from the snapshot `defect` was computed against. Running remediation on a mismatched
    // pair is actively unsafe, not just wasteful: a deterministic AST fixer locates its target
    // purely from defect.location, so on drifted code it could silently patch a DIFFERENT node that
    // happens to sit at that now-stale line/column — and an AI provider is handed an
    // offendingCodeSnippet that plain doesn't exist in the source it's also shown, which (correctly
    // observed, live) produces a confusing DECLINE rather than a useful one. This is a real bug
    // found via live investigation, not a hypothetical: reproduced by editing code after a scan and
    // immediately clicking Fix on a diagnostic from the old scan.
    //
    // Every caller (FigmFixPipeline, CodeErrorFixPipeline, and anything else that reaches this one
    // method) is covered by this single check — see app/live-scan/page.tsx's applyFix for the
    // client-side mirror of this same guard (defense-in-depth: the client check can't cover every
    // caller, e.g. a direct API request).
    if (defect.offendingCodeSnippet && defect.offendingCodeSnippet.trim().length > 0 && !code.includes(defect.offendingCodeSnippet.trim())) {
      logRemediationEvent('STALE_VIOLATION_CONTEXT', defect, framework, { finalResult: 'REJECTED' });
      return {
        ruleId: defect.ruleId,
        originalCode: code,
        remediatedCode: code,
        appliedFixDescription: 'Automated fix unavailable: this violation was detected against an earlier version of the source. Re-scan the current code before attempting a fix.',
        engineType: 'UNAVAILABLE',
        confidenceScore: 0,
        fallbackReason: 'STALE_VIOLATION_CONTEXT: the violation\'s recorded offending code snippet is no longer present in the submitted source — the code changed since this violation was detected.',
        verified: false,
        verificationStatus: 'UNRESOLVED',
      };
    }

    // The single decision point: which layer owns this rule ID (AIRemediationRouter), actually
    // attempted against this instance's real code/AST shape (see remediation-decision.ts).
    // Everything below branches on decision.strategy/decision.deterministicFixAvailable/
    // decision.requiresManualReview — never re-derives routing from ruleId itself.
    const decision = decideRemediation(code, defect, defect.filePath);
    logRemediationEvent('ROUTED', defect, framework, { strategy: decision.strategy, fixStrategy: decision.deterministicFixAvailable ? 'DETERMINISTIC' : decision.requiresManualReview ? 'MANUAL_REVIEW' : 'AI' });

    // Path 1 — a deterministic engine (TS AST / Angular Template AST / Vue AST) already produced
    // an accepted patch for THIS instance. Verify via the same real re-scan/compile pipeline every
    // other path uses, and accept only if it actually resolves the violation.
    if (decision.deterministicFixAvailable && decision.deterministicOutcome) {
      const outcome = decision.deterministicOutcome;
      logRemediationEvent('DETERMINISTIC_ATTEMPTED', defect, framework, { strategy: decision.strategy });
      const verification = await RemediationValidator.validatePatchAsync(code, outcome.patchedCode, defect);
      if (verification.isValid) {
        const suggestedFix = PatchGenerator.generateGitDiff(
          defect.filePath || 'component.tsx',
          code,
          outcome.patchedCode,
          startLine,
          `[FIGM ${decision.strategy} Fix]: ${outcome.description}`
        );
        logRemediationEvent('DETERMINISTIC_FIX_APPLIED', defect, framework, { verificationStatus: verification.status, finalResult: 'VERIFIED' });
        return {
          ruleId: defect.ruleId,
          originalCode: code,
          remediatedCode: outcome.patchedCode,
          appliedFixDescription: outcome.description,
          suggestedFix,
          engineType: 'AST_DETERMINISTIC_FIX',
          confidenceScore: 99.0,
          verified: true,
          verificationStatus: verification.status,
        };
      }
      // The deterministic engine produced a patch but it didn't verify on re-scan (e.g. it
      // introduced a new violation) — fall through to Claude below rather than reporting a false
      // "fixed", exactly like an instance the engine declined to transform in the first place.
      //
      // Stage 7E: this fallthrough previously had no log line of its own, so a real deterministic
      // rejection (e.g. FIGM-A11Y-01's onKeyDown patch tripping FIGM-PERF-05 — see
      // remediation-validation.server.ts's own comment) was silently invisible between the earlier
      // 'ROUTED' (strategy=AST_DETERMINISTIC, logged before this instance's patch was even
      // generated/verified) and 'AI_PROVIDER_SELECTED' log lines — reading the log in isolation
      // looked contradictory (routed deterministic, then AI ran with no explanation) even though the
      // actual behavior was always correct (never reports a patch that introduces a new violation as
      // "fixed"). This line closes that observability gap without changing any decision logic.
      logRemediationEvent('DETERMINISTIC_REJECTED', defect, framework, {
        verificationStatus: verification.status,
        reason: verification.rejectionReason ?? 'Deterministic patch failed re-scan validation (see remainingDiagnostics).',
        finalResult: 'AI_FALLBACK_SELECTED',
      });
    }

    // Path 2 — rule-level MANUAL_REVIEW_ONLY (FIGM-NEXT-08/09, FIGM-REACT-06 — see
    // AIRemediationRouter's MANUAL_REVIEW_ONLY_RULE_IDS doc comment for exactly why these three).
    // Never modified automatically by ANY layer, including the legacy regex engine: no candidate
    // patch is generated at all, so there is nothing a caller could mistakenly apply.
    if (decision.requiresManualReview) {
      logRemediationEvent('MANUAL_REVIEW_ONLY', defect, framework, { finalResult: 'MANUAL_REVIEW_REQUIRED' });
      return {
        ruleId: defect.ruleId,
        originalCode: code,
        remediatedCode: code,
        appliedFixDescription: `Manual review required: ${decision.reason}`,
        engineType: 'MANUAL_REVIEW',
        confidenceScore: 0,
        verified: false,
        verificationStatus: 'MANUAL_REVIEW_REQUIRED',
      };
    }

    // Path 3 — AI Remediation Assistant. `provider` is whichever AIRemediationProvider
    // src/ai/ai-provider-selector.ts currently resolves as active (see that module's own doc
    // comment for precedence between Ollama, Claude, and Gemini); src/ai/sandbox-validation-pipeline.ts is
    // the one patch gatekeeper regardless of which provider produced the candidate. Reached
    // whenever `decision.aiAllowed` — either the rule has no deterministic fixer at all, or its
    // fixer just declined/failed verification for THIS specific instance.
    //
    // Bounded retry: each attempt that fails validation feeds the model its own previous patch and
    // the EXACT validation failure (stage + detail), never a vague "try again." A conscious model
    // DECLINE, or a permanently-unavailable provider (no credential configured), stops immediately
    // — retrying either would just waste the remaining attempts on a guaranteed-identical outcome.
    // `provider` is deliberately reassignable: on a provider-AVAILABILITY failure (never a
    // code-quality one — see fallbackUsed below and AIProviderSelector's own doc comment for the
    // exact distinction), the loop switches it to AIProviderSelector.getFallbackProvider(...) and
    // continues the SAME bounded attempt loop rather than starting a second, separate one — this is
    // what keeps "Claude 429 → Gemini" from ever costing more than the existing MAX_AI_ATTEMPTS total.
    let provider = AIProviderSelector.getActiveProvider();
    // Stage 7E: explicit, unambiguous marker for whether this AI attempt is the rule's normal route
    // (no deterministic fixer at all) or a fallback after a deterministic patch was generated and
    // then rejected on re-scan above — see the 'DETERMINISTIC_REJECTED' log line for the reason.
    logRemediationEvent('AI_PROVIDER_SELECTED', defect, framework, {
      provider: provider.providerName,
      viaDeterministicFallback: decision.deterministicFixAvailable,
    });
    // True once the loop has switched providers — a fallback provider itself has no further
    // fallback (AIProviderSelector.getFallbackProvider only ever defines ONE hop), and this also
    // guards against ever switching back-and-forth even if a future config made that possible.
    let fallbackUsed = false;
    let previousAttempt: { patch: string; failureStage: string; failureDetail: string; sameStageFailureStreak?: number; patchValidationStatus?: string } | undefined;
    let lastReason = 'AI remediation did not produce an accepted patch.';
    // Consecutive PATCH_SCOPE rejections (see prompt-builder.ts's buildRetryFeedback) — reset to 0
    // the instant any OTHER failure stage occurs, since the escalating "this is your final attempt"
    // wording is only meaningful when the model keeps making the exact same scope mistake in a row.
    let scopeFailureStreak = 0;
    // Consecutive COMPILE_AND_RESCAN failures whose patchValidation.status is specifically
    // 'UNRESOLVED' — the patch compiled but the original violation is still detected. Reproduced
    // live: this is a genuinely different failure mode from PATCH_SCOPE (the model isn't rewriting
    // too much, it's making an ineffective or misdirected edit), so it gets its own streak and its
    // own escalating retry feedback (see prompt-builder.ts's buildRetryFeedback) rather than sharing
    // scopeFailureStreak or falling through to the generic "address this specific failure" message.
    let unresolvedFailureStreak = 0;
    // Distinguishes "a candidate patch was actually produced and rejected/unresolved" from "no
    // usable AI output was ever produced" (see AIRemediationPipelineResult.verificationStatus doc
    // comment above) — set true the moment ANY attempt returns status === 'PATCH', regardless of
    // whether that specific patch later fails pre-filter or sandbox validation.
    let sawAnyPatch = false;

    for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt++) {
      logRemediationEvent('AI_REQUEST_STARTED', defect, framework, { provider: provider.providerName, attempt: `${attempt}/${MAX_AI_ATTEMPTS}` });
      const aiResult = await provider.generateRemediation({ defect, code, framework, previousAttempt });
      logRemediationEvent('AI_RESPONSE_RECEIVED', defect, framework, { provider: provider.providerName, attempt: `${attempt}/${MAX_AI_ATTEMPTS}`, status: aiResult.status });

      if (aiResult.status === 'AI_UNAVAILABLE') {
        lastReason = aiResult.reason;
        // Permanent/configuration-level failures — an invalid/expired ANTHROPIC_API_KEY or
        // GEMINI_API_KEY producing "authentication failed", or an account with its quota exhausted
        // producing "quota exhausted" (HTTP 429 for Gemini — see gemini-provider.ts) — where a
        // same-session retry is guaranteed to fail identically, since nothing about the request
        // changes between attempts. Distinct from a genuinely transient failure (timeout,
        // malformed JSON, network blip, or a rate limit that may clear within seconds), which
        // is still worth retrying below.
        //
        // The three Ollama-specific reasons below are permanent for the same reason: a local
        // server that is down, a model that failed to load (e.g. this deployment's own reproduced
        // CUDA_Host allocation failure on a memory-constrained GPU), or a model that was never
        // pulled will fail identically on every retry — burning up to MAX_AI_ATTEMPTS *
        // OLLAMA_TIMEOUT_MS (default 120s each) waiting on a guaranteed-identical outcome would be
        // actively harmful, not just wasteful.
        const isPermanentFailure =
          aiResult.reason.includes('environment variable is not configured') ||
          aiResult.reason.includes('No AI remediation provider is configured') ||
          aiResult.reason.includes('authentication failed') ||
          // Matched as a regex (not the old exact substring 'billing/quota exhausted') so this also
          // catches Gemini's own honestly-worded reason ("rate limit or quota exhausted" — the
          // Gemini API returns a single 429/RESOURCE_EXHAUSTED for both conditions, with no separate
          // 402, so gemini-provider.ts cannot honestly claim "billing" specifically). Reproduced via
          // this exact mismatch: without this generalization, a real exhausted Gemini key fell
          // through to the transient "continue" branch below and burned its remaining retry budget
          // re-attempting a guaranteed-dead key instead of failing fast.
          /quota exhausted/i.test(aiResult.reason) ||
          aiResult.reason.includes('is unreachable') ||
          aiResult.reason.includes('failed to load model') ||
          aiResult.reason.includes('model not found');
        // Rate-limit/timeout are NOT treated as permanent for the SAME provider (a retry may
        // genuinely succeed seconds later — unchanged from before), but when a fallback provider is
        // actually configured, switching immediately is strictly better than spending a scarce
        // attempt waiting on a provider that just rate-limited or timed out. When no fallback is
        // configured, this falls through to the exact same "continue" (retry same provider) behavior
        // this pipeline has always had — a deployment that never set GEMINI_API_KEY/
        // AI_FALLBACK_PROVIDER sees NO behavior change here.
        const isRateLimitOrTimeout = /rate limit|timed out|timeout/i.test(aiResult.reason);

        if ((isPermanentFailure || isRateLimitOrTimeout) && !fallbackUsed) {
          const fallback = AIProviderSelector.getFallbackProvider(provider.providerName);
          if (fallback) {
            logRemediationEvent('AI_PROVIDER_FALLBACK', defect, framework, {
              fromProvider: provider.providerName,
              toProvider: fallback.providerName,
              reason: aiResult.reason,
            });
            provider = fallback;
            fallbackUsed = true;
            // A fresh provider has produced nothing yet — carrying over the failed provider's own
            // rejected-patch feedback (which describes a patch GEMINI never wrote) would be
            // confusing, not helpful. Also resets both streaks: they are provider-attempt-scoped.
            previousAttempt = undefined;
            scopeFailureStreak = 0;
            unresolvedFailureStreak = 0;
            continue; // still counts against the SAME MAX_AI_ATTEMPTS budget — never a second budget
          }
        }

        if (isPermanentFailure) {
          logRemediationEvent('AI_UNAVAILABLE_PERMANENT', defect, framework, { provider: provider.providerName, finalResult: 'UNAVAILABLE' });
          break; // every attempt would fail identically and instantly, and no fallback was available
        }
        continue; // transient failure (timeout, malformed JSON, rate limit, ...) — worth a retry
      }

      if (aiResult.status === 'DECLINE') {
        lastReason = `${provider.providerName} declined to propose a fix: ${aiResult.reason}`;
        logRemediationEvent('AI_DECLINED', defect, framework, { provider: provider.providerName, finalResult: 'UNAVAILABLE' });
        break; // a conscious decline is a real answer, not something a retry would change
      }
      sawAnyPatch = true;
      logRemediationEvent('PATCH_EXTRACTED', defect, framework, { provider: provider.providerName, attempt: `${attempt}/${MAX_AI_ATTEMPTS}`, patchLength: aiResult.patch.length });

      // status === 'PATCH' — cheap pre-filter (syntax/shape) before spending time on the full
      // sandbox below, catches an empty response, leftover markdown fences, or a no-op patch.
      const preFilter = AIPatchValidator.validatePatch(code, aiResult.patch, defect.filePath);
      if (!preFilter.isValid) {
        scopeFailureStreak = 0; // PRE_FILTER is not a scope failure — breaks any prior scope streak
        previousAttempt = { patch: aiResult.patch, failureStage: 'PRE_FILTER', failureDetail: preFilter.reason || 'Patch failed basic shape validation.' };
        lastReason = `${provider.providerName} patch validation failed: ${preFilter.reason}`;
        logRemediationEvent('SYNTAX_VALIDATION', defect, framework, { provider: provider.providerName, attempt: `${attempt}/${MAX_AI_ATTEMPTS}`, result: 'FAIL', reason: preFilter.reason });
        continue;
      }
      logRemediationEvent('SYNTAX_VALIDATION', defect, framework, { provider: provider.providerName, attempt: `${attempt}/${MAX_AI_ATTEMPTS}`, result: 'PASS' });

      // Sandbox Validation Pipeline (src/ai/sandbox-validation-pipeline.ts): AI output is NEVER
      // accepted directly. Writes the patch to a real isolated temp file, then runs syntax check
      // -> patch-scope check -> TypeScript compile + FIGM re-scan -> framework structural check ->
      // associated test (when one exists) -- rejecting on the first stage that fails. Strictly
      // more scrutiny than a deterministic Layer-1 patch gets, appropriate for AI-authored code.
      const sandboxResult = await SandboxValidationPipeline.validate(code, aiResult.patch, defect, framework);
      // failedStage/patchValidationStatus computed here (not after the accepted-branch below) so
      // the log line right below reports the REAL failing stage instead of a blanket label. This
      // fixes a real, reproduced logging bug: the previous version always logged this event as
      // "TYPE_VALIDATION_AND_RESCAN" with `originalViolationPresent: !sandboxResult.accepted`
      // regardless of which of the sandbox's actual stages failed — so a patch rejected at
      // PATCH_SCOPE (which never reaches the compile/rescan stage at all) was misleadingly logged
      // identically to one that genuinely compiled but still had the violation present, making the
      // two failure modes indistinguishable from the log alone.
      const failedStage = sandboxResult.stages.find((s) => s.status === 'FAIL');
      const stageName = failedStage?.stage ?? (sandboxResult.accepted ? 'NONE' : 'UNKNOWN');
      const patchValidationStatus = sandboxResult.patchValidation?.status;
      logRemediationEvent('TYPE_VALIDATION_AND_RESCAN', defect, framework, {
        provider: provider.providerName,
        attempt: `${attempt}/${MAX_AI_ATTEMPTS}`,
        result: sandboxResult.accepted ? 'PASS' : 'FAIL',
        failedStage: stageName,
        // Only knowable when COMPILE_AND_RESCAN actually ran (sandboxResult.patchValidation is set)
        // — for an earlier-stage rejection (e.g. PATCH_SCOPE), whether the violation is still
        // present was never actually checked, so this must say so rather than default to `true`.
        originalViolationPresent: patchValidationStatus ? patchValidationStatus !== 'FIXED' : 'NOT_REACHED',
      });
      if (sandboxResult.accepted) {
        const verification = sandboxResult.patchValidation!;
        const suggestedFix = PatchGenerator.generateGitDiff(
          defect.filePath || 'component.tsx',
          code,
          aiResult.patch,
          startLine,
          `[${provider.providerName} AI Fix]: ${aiResult.explanation}`
        );
        logRemediationEvent('PATCH_APPLIED', defect, framework, { provider: provider.providerName, attempt: `${attempt}/${MAX_AI_ATTEMPTS}`, verificationStatus: verification.status, finalResult: 'VERIFIED' });
        return {
          ruleId: defect.ruleId,
          originalCode: code,
          remediatedCode: aiResult.patch,
          appliedFixDescription: aiResult.explanation,
          suggestedFix,
          engineType: 'AI_ASSISTED_FIX',
          provider: provider.providerName,
          confidenceScore: aiResult.confidence,
          verified: true,
          verificationStatus: verification.status,
        };
      }

      const isUnresolvedRescan = stageName === 'COMPILE_AND_RESCAN' && patchValidationStatus === 'UNRESOLVED';
      scopeFailureStreak = stageName === 'PATCH_SCOPE' ? scopeFailureStreak + 1 : 0;
      unresolvedFailureStreak = isUnresolvedRescan ? unresolvedFailureStreak + 1 : 0;
      previousAttempt = {
        patch: aiResult.patch,
        failureStage: stageName,
        failureDetail: sandboxResult.rejectionReason ?? 'Sandbox validation rejected the patch.',
        sameStageFailureStreak: stageName === 'PATCH_SCOPE' ? scopeFailureStreak : isUnresolvedRescan ? unresolvedFailureStreak : undefined,
        patchValidationStatus,
      };
      lastReason = `${provider.providerName} patch rejected by sandbox validation (attempt ${attempt}/${MAX_AI_ATTEMPTS}): ${sandboxResult.rejectionReason}`;
    }

    // Every AI attempt was exhausted, declined, or unavailable, and no deterministic fixer
    // exists/succeeded for this instance. This is the terminal "no automated fix available" state
    // — the original code is returned unchanged. Never silently falls back to the legacy
    // regex-based RemediationEngine to manufacture a plausible-looking "fixed" result.
    logRemediationEvent('FINAL_RESULT', defect, framework, { finalResult: 'UNAVAILABLE', rejectReason: lastReason });
    return {
      ruleId: defect.ruleId,
      originalCode: code,
      remediatedCode: code,
      appliedFixDescription: `Automated fix unavailable: ${lastReason}`,
      engineType: 'UNAVAILABLE',
      provider: provider.providerName,
      confidenceScore: 0,
      fallbackReason: lastReason,
      verified: false,
      // AI_UNAVAILABLE when no candidate patch was EVER produced (every attempt errored out or the
      // provider declined) — UNRESOLVED is reserved for when a real patch WAS generated and
      // sandbox-validated/re-scanned but the violation persisted or the sandbox rejected it. See
      // the verificationStatus doc comment on AIRemediationPipelineResult above for why this
      // distinction matters to the UI.
      verificationStatus: sawAnyPatch ? 'UNRESOLVED' : 'AI_UNAVAILABLE',
    };
  }
}
