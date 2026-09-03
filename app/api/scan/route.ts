import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { RuleExecutionEngine } from '../../../src/engine/rule-execution-engine';
import { FigmFixPipeline } from '../../../src/ai/figm-fix-pipeline';
import { CodeErrorFixPipeline } from '../../../src/ai/code-error-fix-pipeline';
import { ScanRepository } from '../../../src/engine/scan-repository';
import { authenticateUser } from '../../../src/auth/auth-middleware';
import { checkRateLimit, getClientIp } from '../../../src/auth/rate-limiter';
import { AuditLogger } from '../../../src/auth/audit-logger';

const MAX_CODE_LENGTH = 500000; // 500KB limit

// Stage 7B Vercel-readiness note: this route does real work beyond a typical request -- AST
// parsing, a disposable child-process sandbox spawn (DynamicProfiler, hard 3s internal timeout),
// and, on the fix/verify path, a real AI-provider network call (Claude/Gemini) that can take
// several seconds. Declared explicitly rather than left to whatever the platform default happens
// to be, so a slow AI provider response fails as a clean timeout instead of silently depending on
// undocumented platform behavior. Not yet verified end-to-end against an actual Vercel preview
// deployment -- see docs/audit/STAGE_7B_PRE_DEPLOYMENT_HARDENING_REPORT.md Section 31.
export const maxDuration = 60;

/**
 * A compact, stable identifier for the calling CLIENT (not the network hop) derived from headers
 * that survive an IP rotation (proxy/VPN switch) but stay consistent for one scripted caller --
 * a SEPARATE dimension from getClientIp, applied only to the fix/AI-cost path below. Per-IP alone
 * is defeated by rotating IPs; per-fingerprint alone is defeated by randomizing these headers per
 * request; requiring an attacker to defeat BOTH simultaneously is strictly harder than either
 * alone. Deliberately excludes the IP itself -- the whole point is an independent signal. Callers
 * with no User-Agent at all (bare scripts) collapse into one shared fingerprint bucket, which
 * correctly rate-limits that class of caller more aggressively, mirroring getClientIp's own
 * 'unknown-client' fallback for a request with no forwarding headers.
 */
function getClientFingerprint(request: Request): string {
  const raw = [
    request.headers.get('user-agent') || '',
    request.headers.get('accept-language') || '',
    request.headers.get('accept-encoding') || '',
  ].join('|');
  return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

/**
 * A third diagnostic domain, distinct from FIGM_RULE and GENERAL_CODE_ERROR: a failure of the
 * scan *service* itself (analysis engine threw, or a persistence dependency is unavailable), not
 * a finding about the submitted source. Deliberately NOT modeled as a DiagnosticReport --
 * DiagnosticReport's `domain`/`concern` fields are hard-typed to the FIGM research taxonomy
 * (PERFORMANCE|ACCESSIBILITY) and an infra failure has no honest value to put there.
 */
export interface ScanServiceStatus {
  status: 'INFRASTRUCTURE_ERROR';
  stage: 'ANALYSIS_ENGINE' | 'PERSISTENCE';
  message: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, fileName, action, defect } = body;

    // A fix action (either pipeline) calls out to the Claude API on arbitrary (including fully
    // anonymous) input -- that's a real cost/abuse vector, so it gets a tighter limit than a plain
    // static scan. Static scans run entirely locally and are the core interactive product feature,
    // so their limit is generous enough not to interfere with normal editor-like usage (e.g. a user
    // re-scanning after every few keystrokes) while still bounding scripted abuse. 'ai-fix' is kept
    // as a legacy alias of 'fix-figm-rule'/'fix-code-error' for any caller that hasn't migrated.
    const isFixAction = action === 'fix-figm-rule' || action === 'fix-code-error' || action === 'ai-fix';
    const ip = getClientIp(request);
    const rateLimitError = await checkRateLimit(ip, isFixAction ? 15 : 60, 60000);
    if (rateLimitError) return rateLimitError;

    // checkRateLimit's DB-backed path counts this IP's rows in the audit_logs table -- if this
    // route never wrote one, the limit above would silently never trigger (every prior request
    // from this IP would be invisible to the counter). Logged fire-and-forget so it can't slow
    // down or fail the actual scan -- but a rejected promise here would otherwise be an unhandled
    // rejection if the audit-log write itself fails (e.g. DB outage), so it must still be caught.
    AuditLogger.logEvent('SCAN_RUN', { ipAddress: ip, status: 'SUCCESS', details: isFixAction ? action : 'scan' }).catch(
      (err) => console.error('[api/scan] audit log write failed:', err instanceof Error ? err.message : err)
    );

    // Second, independent gate for the fix/AI-cost path only (never the plain local scan path):
    // a per-CLIENT-FINGERPRINT limit alongside the per-IP one above -- see getClientFingerprint's
    // own doc comment for why both are needed. This branch runs entirely before authenticateUser
    // is ever called below (an anonymous caller can reach the real AI providers via a fix action),
    // so this is real protection for genuinely unauthenticated traffic, not just an authenticated
    // caller's own limit.
    if (isFixAction) {
      const fingerprint = getClientFingerprint(request);
      const fingerprintRateLimitError = await checkRateLimit(fingerprint, 15, 60000);
      if (fingerprintRateLimitError) return fingerprintRateLimitError;
      AuditLogger.logEvent('SCAN_RUN', { ipAddress: fingerprint, status: 'SUCCESS', details: `${action}:fingerprint` }).catch(
        (err) => console.error('[api/scan] fingerprint audit log write failed:', err instanceof Error ? err.message : err)
      );
    }

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code string is required' }, { status: 400 });
    }

    if (code.length > MAX_CODE_LENGTH) {
      return NextResponse.json({ error: 'Payload exceeds maximum limit of 500KB' }, { status: 413 });
    }

    const targetFile = fileName || 'Component.tsx';
    // Async variant: this route serves concurrent multi-user traffic, so the dynamic-profiling
    // sandbox child must not block the event loop for other requests -- see
    // RuleExecutionEngine.analyzeFileAsync's doc comment.
    //
    // Guarded independently of the outer try/catch: a failure here is a scan-SERVICE failure (the
    // analysis engine itself threw), not a finding about the submitted source, and must never leak
    // err.message/stack to the client (could contain internal file paths or dependency internals).
    // The full error is still logged server-side for diagnosis.
    let scanResult;
    try {
      scanResult = await RuleExecutionEngine.analyzeFileAsync(targetFile, code);
    } catch (err) {
      console.error('[api/scan] analysis engine failure:', err instanceof Error ? err.stack || err.message : err);
      const serviceStatus: ScanServiceStatus = {
        status: 'INFRASTRUCTURE_ERROR',
        stage: 'ANALYSIS_ENGINE',
        message: 'Scan service temporarily unavailable. Please try again.',
      };
      return NextResponse.json({ success: false, serviceStatus }, { status: 503 });
    }

    // Two genuinely separate fix entry points -- see FigmFixPipeline / CodeErrorFixPipeline for
    // why each is its own class rather than one shared "ai-fix" handler that infers scope from the
    // defect. 'ai-fix' (legacy) auto-routes by the defect's real classification for any caller that
    // hasn't migrated to the explicit action names.
    if (defect && (action === 'fix-figm-rule' || action === 'fix-code-error' || action === 'ai-fix')) {
      const pipeline =
        action === 'fix-code-error'
          ? CodeErrorFixPipeline
          : action === 'fix-figm-rule'
          ? FigmFixPipeline
          : defect.kind === 'GENERAL_CODE_ERROR'
          ? CodeErrorFixPipeline
          : FigmFixPipeline;
      // scanResult.diagnostics is a FRESH, server-authoritative re-scan of this exact `code`
      // (computed moments above) -- passed only to CodeErrorFixPipeline (FigmFixPipeline.apply
      // never accepts it, since FIGM violations are never grouped) so a general compile/syntax
      // error that produced multiple related diagnostics (see general-error-grouping.ts) is
      // remediated as one target, not several. Never trusts client-submitted diagnostic data for
      // this.
      const aiResult =
        pipeline === CodeErrorFixPipeline
          ? await CodeErrorFixPipeline.apply(code, defect, scanResult.framework, scanResult.diagnostics)
          : await pipeline.apply(code, defect, scanResult.framework);
      return NextResponse.json(aiResult);
    }

    // Optional Authentication Context
    const auth = await authenticateUser(request);
    const userId = auth.user ? auth.user.userId : 'usr_anonymous_guest';

    // Persist scan record under authenticated user or guest audit log
    let persistenceServiceStatus: ScanServiceStatus | undefined;
    if (auth.user) {
      try {
        // Use the SAME quality score already computed by RuleExecutionEngine and returned in the
        // live response below — a separately-recomputed formula here previously produced a
        // different number (a real, live-observed discrepancy: 74 in the live response vs. 88 in
        // the persisted history record for the same scan) purely because this route independently
        // reimplemented a cruder, differently-weighted formula instead of reusing the real one.
        await ScanRepository.createScanRecord({
          userId,
          fileName: targetFile,
          framework: scanResult.framework,
          qualityScore: scanResult.qualityScore ?? 0,
          // Real values only -- scanResult.profile is always populated by RuleExecutionEngine
          // (never optional), and executionTimeMs is always a real perf.now() delta, never falsy
          // in a way that would need a fallback. `?? 0` (not the previous `|| 0.12`/`|| 0.45`
          // hardcoded-fallback pattern, removed in the Stage 5A audit -- see
          // src/engine/dynamic-profiler.ts's buildProfileMetrics doc comment): the
          // scan_reports.memory_usage_mb column is a non-nullable Float (no schema change is
          // justified here, since a genuinely-unmeasured reading, peakMemoryMb: null, is only
          // theoretically possible on this server-side path -- Node's process.memoryUsage() is
          // always available in this deployment's real runtime) -- 0 here means "not measured this
          // run," never a plausible-looking invented reading like the previous 0.45.
          scanTimeMs: scanResult.profile.executionTimeMs,
          memoryUsageMb: scanResult.profile.peakMemoryMb ?? 0,
          ruleCount: scanResult.diagnostics.length,
          aiFixCount: 0,
          diagnostics: scanResult.diagnostics as any,
          isFavorite: false,
        });
      } catch (err) {
        // Non-fatal: the scan result is still returned to the caller even if persistence fails,
        // but the failure must be visible server-side AND surfaced to the caller as a distinct
        // infra-domain status (not a code diagnostic, not a silent no-op) rather than only logged.
        console.error('[api/scan] Failed to persist scan record:', err instanceof Error ? err.message : err);
        persistenceServiceStatus = {
          status: 'INFRASTRUCTURE_ERROR',
          stage: 'PERSISTENCE',
          message: 'Scan completed, but the result could not be saved to history.',
        };
      }
    }

    return NextResponse.json(
      persistenceServiceStatus ? { ...scanResult, serviceStatus: persistenceServiceStatus } : scanResult
    );
  } catch (err: any) {
    // Last-resort catch-all for anything not already handled above (e.g. malformed request body).
    // Never forward err.message/stack to the client -- it can contain internal paths or dependency
    // details. Full detail stays server-side only.
    console.error('[api/scan] unhandled request failure:', err instanceof Error ? err.stack || err.message : err);
    return NextResponse.json({ error: 'Scan execution failed' }, { status: 500 });
  }
}

