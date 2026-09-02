/**
 * Framework-Independent Guideline Model (FIGM)
 * Server-Only Patch Validation (re-scan + ESLint cross-check)
 *
 * Split out of src/engine/remediation-engine.ts (Next.js production-build fix): this file is the
 * ONLY thing in the remediation pipeline that touches real ESLint (`./eslint-validator.js`, which
 * pulls in the actual `eslint` package — Node-only, uses `node:path`/`node:url`/`node:module`
 * internally with no browser equivalent).
 *
 * NOTE on `import 'server-only'`: Next.js's own poisoning mechanism (throws if this module is ever
 * reachable from a Client Component) was evaluated and deliberately NOT added here. It works by
 * resolving to a no-op only under the `react-server` package-export condition, which Next.js's own
 * bundler sets — but this repo's test suite runs via plain `node --import tsx` (no Next.js
 * bundler), which never sets that condition, so `server-only` unconditionally throws
 * "cannot be imported from a Client Component" for every test that touches this file, real Server
 * Component context or not (confirmed by actually running the suite with it added — every test
 * importing this file failed immediately). The `.server.ts` filename plus this file being the ONLY
 * place `EslintValidator` is imported from is the enforced boundary instead; the physical split
 * below (not that marker package) is what actually fixes the client-bundling failure. That failure
 * mode is exactly what motivated this split: app/live-scan/page.tsx's offline fallback dynamically
 * imports RemediationEngine (src/engine/remediation-engine.ts) for its pure, Node-independent
 * `applyQuickFix` — but because `RemediationEngine` used to ALSO define `validatePatch`/
 * `validatePatchAsync` in the very same file (with a static top-level `import { EslintValidator }`
 * at the top), webpack had to resolve and bundle `eslint-validator.ts` for the CLIENT the moment
 * ANY export of that file was reachable from the client graph — even though the client path never
 * actually calls those two methods. Static analysis bundles by FILE, not by which export is used.
 *
 * `applyQuickFix` (the deterministic fix generator — pure string/AST transformation, zero Node-only
 * dependencies) stays in remediation-engine.ts, still safely dynamically-importable from the
 * client. `validatePatch`/`validatePatchAsync` (real re-scan + ESLint verification — needs the
 * Node-only RuleExecutionEngine/DynamicProfiler sandbox AND real ESLint) move here, where nothing
 * in the client bundle can ever reach them. Server-side callers (src/ai/ai-remediation-pipeline.ts,
 * the /api/scan route's dependency graph, benchmarks, and the test suite) import
 * `RemediationValidator` from this file instead — same method names, same behavior, same
 * validation pipeline; only the module boundary changed.
 */

import { DiagnosticReport } from '../types/ast-spec.js';
import { EslintValidator } from './eslint-validator.js';

export interface PatchValidationResult {
  isValid: boolean;
  status: 'FIXED' | 'PATCH_REJECTED' | 'UNRESOLVED' | 'MANUAL_REVIEW_REQUIRED';
  remainingDiagnostics: DiagnosticReport[];
  /** Populated only for an ESLint-caused PATCH_REJECTED (validatePatchAsync's ESLint step) -- the
   *  other rejection paths (syntax/new-type-error/new-guideline-violation) are already self-evident
   *  from `remainingDiagnostics` and were not retrofitted with this field to keep this change
   *  minimal. */
  rejectionReason?: string;
}

export class RemediationValidator {
  /**
   * Re-scan proposed patch in isolated copy to verify if the original issue is resolved and 0 syntax errors exist.
   * `requiresManualReview` short-circuits straight to MANUAL_REVIEW_REQUIRED — a rule whose safe
   * fix depends on information that cannot be reliably inferred (e.g. a useMemo dependency array)
   * must never be reported as FIXED merely because the specific ruleId happens to stop firing on
   * re-scan.
   */
  public static validatePatch(
    originalCode: string,
    remediatedCode: string,
    defect: DiagnosticReport,
    requiresManualReview = false
  ): PatchValidationResult {
    const shortCircuit = RemediationValidator.validatePatchShortCircuit(originalCode, remediatedCode, defect, requiresManualReview);
    if (shortCircuit) return shortCircuit;

    // Import RuleExecutionEngine dynamically to avoid circular dependencies
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { RuleExecutionEngine } = require('./rule-execution-engine.js');
    const originalRes = RuleExecutionEngine.analyzeFile(defect.filePath || 'component.tsx', originalCode);
    const res = RuleExecutionEngine.analyzeFile(defect.filePath || 'component.tsx', remediatedCode);

    return RemediationValidator.evaluatePatchResults(originalRes, res, defect);
  }

  /**
   * Async sibling of `validatePatch`, using RuleExecutionEngine.analyzeFileAsync (non-blocking
   * dynamic-profiling sandbox spawn) instead of the sync `analyzeFile` so a slow/hanging re-scan
   * can never block the Node.js event loop and stall unrelated concurrent requests. Used by
   * src/ai/ai-remediation-pipeline.ts (the live AI-fix and deterministic-fallback request paths on
   * app/api/scan). `validatePatch` (sync) is deliberately left unchanged for its other callers
   * (the test suite), where the blocking behavior was never a problem -- same rationale as
   * RuleExecutionEngine.analyzeFile / analyzeFileAsync.
   */
  public static async validatePatchAsync(
    originalCode: string,
    remediatedCode: string,
    defect: DiagnosticReport,
    requiresManualReview = false
  ): Promise<PatchValidationResult> {
    const shortCircuit = RemediationValidator.validatePatchShortCircuit(originalCode, remediatedCode, defect, requiresManualReview);
    if (shortCircuit) return shortCircuit;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { RuleExecutionEngine } = require('./rule-execution-engine.js');
    const originalRes = await RuleExecutionEngine.analyzeFileAsync(defect.filePath || 'component.tsx', originalCode);
    const res = await RuleExecutionEngine.analyzeFileAsync(defect.filePath || 'component.tsx', remediatedCode);

    const astResult = RemediationValidator.evaluatePatchResults(originalRes, res, defect);
    if (!astResult.isValid) return astResult;

    // ESLint Validation step (only reached once syntax/type/FIGM-guideline checks already pass --
    // no point linting a patch that's already going to be rejected for a more fundamental reason).
    // Framework-gated: see EslintValidator's own header for why Vue/Angular template markup is
    // skipped rather than incorrectly linted with a React/TS-only config.
    const eslintCheck = await EslintValidator.checkForNewErrors(originalCode, remediatedCode, res.framework);
    if (eslintCheck.applicable && eslintCheck.newErrorCount > 0) {
      return {
        isValid: false,
        status: 'PATCH_REJECTED',
        remainingDiagnostics: res.diagnostics,
        rejectionReason: `ESLint: patch introduces ${eslintCheck.newErrorCount} new lint error(s): ${eslintCheck.newErrorMessages.join('; ')}`,
      };
    }

    return astResult;
  }

  private static validatePatchShortCircuit(
    originalCode: string,
    remediatedCode: string,
    defect: DiagnosticReport,
    requiresManualReview: boolean
  ): PatchValidationResult | null {
    if (requiresManualReview) {
      return { isValid: false, status: 'MANUAL_REVIEW_REQUIRED', remainingDiagnostics: [defect] };
    }
    if (originalCode === remediatedCode) {
      return { isValid: false, status: 'UNRESOLVED', remainingDiagnostics: [defect] };
    }
    return null;
  }

  private static evaluatePatchResults(
    originalRes: { diagnostics: DiagnosticReport[] },
    res: { diagnostics: DiagnosticReport[] },
    defect: DiagnosticReport
  ): PatchValidationResult {
    const hasSyntaxError = res.diagnostics.some((d: DiagnosticReport) => d.category === 'SYNTAX_ERROR');
    if (hasSyntaxError) {
      return { isValid: false, status: 'PATCH_REJECTED', remainingDiagnostics: res.diagnostics };
    }

    // Reject patches that introduce NEW real TypeScript compile error CODES (e.g. a dangling reference
    // to a variable the patch itself renamed away) that were not present in the original code. This is
    // what actually catches "the rule stopped firing but the patch is broken" cases -- confirming the
    // specific ruleId is gone is not sufficient on its own (found via live testing, see audit docs).
    // Compared by diagnostic CODE (ruleId, e.g. "TYPE-TS-18004"), not exact message text: the same
    // pre-existing, unrelated TS error (e.g. a JSX style-prop type mismatch, expected since no
    // @types/react is loaded in the isolated checker) can get slightly reworded by an otherwise-benign
    // patch -- e.g. Object.freeze() narrows an object literal's inferred type -- without being a new
    // problem the patch introduced.
    const originalTypeErrorCodes = new Set(
      originalRes.diagnostics.filter((d: DiagnosticReport) => d.category === 'TYPE_COMPILE_ERROR').map((d: DiagnosticReport) => d.ruleId)
    );
    const newTypeErrors = res.diagnostics.filter(
      (d: DiagnosticReport) => d.category === 'TYPE_COMPILE_ERROR' && !originalTypeErrorCodes.has(d.ruleId)
    );
    if (newTypeErrors.length > 0) {
      return { isValid: false, status: 'PATCH_REJECTED', remainingDiagnostics: res.diagnostics };
    }

    // Reject patches that resolve the target defect but introduce a DIFFERENT FIGM guideline
    // violation that wasn't present before (e.g. the FIGM-A11Y-01 keyboard-parity fix wrapping the
    // handler in a fresh inline arrow function, which FIGM-PERF-05 then flags as a new "inline
    // anonymous callback" violation on the very same element -- found via live black-box testing).
    // "The target ruleId is gone" is not sufficient on its own; the patch must not trade one
    // violation for another. Syntax/type-compile diagnostics are excluded here since they're
    // already covered by the checks above with their own comparison semantics.
    const originalRuleIds = new Set(originalRes.diagnostics.map((d: DiagnosticReport) => d.ruleId));
    const newGuidelineViolations = res.diagnostics.filter(
      (d: DiagnosticReport) =>
        d.category !== 'SYNTAX_ERROR' && d.category !== 'TYPE_COMPILE_ERROR' && !originalRuleIds.has(d.ruleId)
    );
    if (newGuidelineViolations.length > 0) {
      return { isValid: false, status: 'PATCH_REJECTED', remainingDiagnostics: res.diagnostics };
    }

    // `defect.relatedDiagnostics` (see general-error-grouping.ts) names sibling diagnostics that a
    // same-line grouping pass judged likely caused by the SAME underlying source defect as this one
    // -- e.g. three separate TypeScript diagnostics all produced by one keyword typo. Requiring
    // every one of them to ALSO be gone (not just `defect.ruleId` itself) is what makes "one
    // remediation target, one verified fix" a real, enforced invariant instead of only a UI
    // convention: a patch that happens to silence the representative diagnostic while a sibling
    // symptom of the exact same defect still lingers is correctly rejected here, never reported
    // FIXED. Absent/empty for every FIGM_RULE diagnostic and every ungrouped GENERAL_CODE_ERROR one
    // (the overwhelming majority), where this is a no-op identical to the original single-ruleId
    // check.
    const relatedRuleIds = defect.relatedDiagnostics?.map((d) => d.ruleId) ?? [];
    const originalStillPresent = res.diagnostics.some((d: DiagnosticReport) => d.ruleId === defect.ruleId || relatedRuleIds.includes(d.ruleId));
    if (originalStillPresent) {
      return { isValid: false, status: 'UNRESOLVED', remainingDiagnostics: res.diagnostics };
    }

    return { isValid: true, status: 'FIXED', remainingDiagnostics: res.diagnostics };
  }
}
