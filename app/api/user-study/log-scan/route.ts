import { NextResponse } from 'next/server';
import { RepositoryFactory } from '../../../../src/storage/repository-factory';
import { AuditLogger } from '../../../../src/auth/audit-logger';
import { RuleExecutionEngine } from '../../../../src/engine/rule-execution-engine';
import { ParticipantRepository, PARTICIPANT_ID_PATTERN } from '../../../../src/engine/participant-repository';
import { signResearchParticipantToken, verifyResearchParticipantToken } from '../../../../src/auth/auth-service';
import { checkRateLimit, getClientIp } from '../../../../src/auth/rate-limiter';
import { STUDY_COOKIE } from '../../../../src/auth/study-session';

const MAX_CODE_LENGTH = 500_000;

// GET() never reads `request`, so Next.js treats this as static-eligible and executes it once at
// `next build` time otherwise -- see the original CRIT finding this comment used to document.
// Now genuinely dynamic per-request regardless (it reads/writes a cookie), but kept explicit.
export const dynamic = 'force-dynamic';

/**
 * Issues or resumes a signed, cookie-bound research-participant session.
 *
 * SECURITY (closes the audit finding that POST previously accepted ANY caller-chosen
 * `participantId` with no session binding at all -- a live-reproduced exploit successfully wrote a
 * fabricated scan onto an already-existing real participant id): the participant code a caller is
 * allowed to submit scans for is now determined ENTIRELY server-side, by this endpoint, and handed
 * back only inside an httpOnly, signed, single-participant-scoped cookie the browser cannot read or
 * forge. `POST` below trusts only that cookie, never a client-supplied `participantId`.
 *
 * `?fresh=1` forces a new assignment even if a valid session cookie already exists -- this is what
 * the "New Participant" button in app/user-study/page.tsx uses to start a fresh study session on
 * the same browser (e.g. a shared lab machine).
 */
export async function GET(request: Request) {
  try {
    const provider = RepositoryFactory.getStorageProvider();
    const url = new URL(request.url);
    const forceNew = url.searchParams.get('fresh') === '1';

    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`${STUDY_COOKIE}=([^;]+)`));
    const existingToken = match ? decodeURIComponent(match[1]) : undefined;

    const totalParticipants = await ParticipantRepository.countAssigned();

    if (!forceNew && existingToken) {
      const verified = verifyResearchParticipantToken(existingToken);
      if (verified) {
        return NextResponse.json({ participantId: verified.participantCode, totalParticipants, resumed: true });
      }
      // Invalid/expired cookie -- fall through and assign a fresh session instead of erroring.
    }

    const { participantCode } = await ParticipantRepository.assignNewParticipant();

    await AuditLogger.logEvent('RESEARCH_PARTICIPANT_ASSIGNED', {
      email: `${participantCode.toLowerCase()}@user-study.figm.local`,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      status: 'SUCCESS',
      details: `New research participant session assigned: ${participantCode}`,
    });

    const token = signResearchParticipantToken(participantCode);
    const response = NextResponse.json({
      participantId: participantCode,
      totalParticipants: totalParticipants + 1,
      resumed: false,
    });
    response.cookies.set(STUDY_COOKIE, token, {
      httpOnly: true,
      path: '/',
      maxAge: 604800, // 7 days -- matches signResearchParticipantToken's default expiry
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });
    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unable to start a research session right now.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const provider = RepositoryFactory.getStorageProvider();
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const rateLimitError = await checkRateLimit(ip, 30, 60000);
    if (rateLimitError) return rateLimitError;

    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`${STUDY_COOKIE}=([^;]+)`));
    const sessionToken = match ? decodeURIComponent(match[1]) : undefined;
    const verified = sessionToken ? verifyResearchParticipantToken(sessionToken) : null;

    // Anonymous / missing / expired / tampered session -> 401. This is the core fix: no caller can
    // reach the rest of this handler, let alone choose a participant identity, without first
    // holding a session token this server itself issued via GET above.
    if (!verified) {
      await AuditLogger.logEvent('SCAN_RUN', {
        ipAddress: ip,
        userAgent,
        status: 'FAILURE',
        details: 'Research scan rejected: no valid participant session (anonymous, missing, or expired token).',
      });
      return NextResponse.json(
        { error: 'A research participant session is required. Reload the page to start one.' },
        { status: 401 }
      );
    }

    // Consent gate: a session exists and is genuine, but study-interaction logging is refused
    // until this exact session has recorded consent via POST /api/user-study/consent -- consent
    // enforced by page order alone (a checkbox the UI merely displays before this fetch fires)
    // is not a server-verifiable guarantee. See src/auth/auth-service.ts's
    // ResearchParticipantConsent doc comment for why this lives in the session token rather than
    // a new database column.
    if (!verified.consentGiven) {
      await AuditLogger.logEvent('SCAN_RUN', {
        ipAddress: ip,
        userAgent,
        status: 'FAILURE',
        details: `Research scan rejected: participant ${verified.participantCode} has not recorded consent for this session.`,
      });
      return NextResponse.json(
        { error: 'Consent is required before study interactions can be logged. Please confirm consent first.' },
        { status: 403 }
      );
    }

    const participantId = verified.participantCode;
    const body = await request.json();
    const { framework, fileName, code, participantId: claimedParticipantId } = body;

    // A session is scoped to exactly the participant it was issued for. A mismatch here means the
    // caller is attempting to attribute a scan to a DIFFERENT participant than their own verified
    // session -- reject outright rather than silently using the session's (correct) identity, so
    // the caller gets an unambiguous signal something is wrong on their end.
    if (
      claimedParticipantId &&
      typeof claimedParticipantId === 'string' &&
      claimedParticipantId !== participantId
    ) {
      await AuditLogger.logEvent('SCAN_RUN', {
        email: `${participantId.toLowerCase()}@user-study.figm.local`,
        ipAddress: ip,
        userAgent,
        status: 'FAILURE',
        details: `Research scan rejected: session bound to ${participantId} attempted to submit as ${claimedParticipantId}.`,
      });
      return NextResponse.json(
        { error: 'This session is not authorized for the requested participant id.' },
        { status: 403 }
      );
    }
    if (claimedParticipantId && !PARTICIPANT_ID_PATTERN.test(claimedParticipantId)) {
      return NextResponse.json({ error: 'Invalid participantId format' }, { status: 400 });
    }

    // This endpoint exists to record a REAL measurement of what FIGM found for a real
    // participant's benchmark task -- never trust a client-supplied score/count for that (a
    // previous version accepted qualityScore/diagnosticsCount straight from the request body,
    // and the caller sent hardcoded values for every single participant regardless of actual
    // results). The only thing worth persisting is derived from re-running the real analysis
    // engine here, server-side, on the actual submitted source.
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'code is required to log a real scan result' }, { status: 400 });
    }
    if (code.length > MAX_CODE_LENGTH) {
      return NextResponse.json({ error: 'code exceeds the maximum allowed size' }, { status: 400 });
    }

    const user = await provider.findUserByParticipantCode(participantId);
    if (!user) {
      // The signed token outlived its backing row (should not normally happen). Treat this as an
      // invalid session rather than silently (re)creating an identity for a code the token merely
      // claims -- that would reopen exactly the "attacker picks the identity" hole being closed.
      return NextResponse.json(
        { error: 'Invalid participant assignment. Reload the page to start a new session.' },
        { status: 401 }
      );
    }

    if (user.researchStatus === 'REVOKED') {
      await AuditLogger.logEvent('SCAN_RUN', {
        userId: user.id,
        email: user.email,
        ipAddress: ip,
        userAgent,
        status: 'FAILURE',
        details: `Research scan rejected: participant ${participantId} assignment is revoked.`,
      });
      // Deliberately generic -- never confirms/denies whether a DIFFERENT participant id exists or
      // is revoked, only that this caller's own session can't write right now.
      return NextResponse.json({ error: 'This participant assignment is no longer active.' }, { status: 403 });
    }

    // Async variant: this route serves concurrent multi-user traffic -- see
    // RuleExecutionEngine.analyzeFileAsync's doc comment.
    const analysis = await RuleExecutionEngine.analyzeFileAsync(fileName || 'BenchmarkFixture.tsx', code);
    const dynamicDiagnostics = (analysis.diagnostics || []).map((d) => ({
      ruleId: d.ruleId,
      ruleName: d.ruleName,
      domain: d.domain,
      concern: d.concern,
      severity: d.severity,
      filePath: fileName || 'BenchmarkFixture.tsx',
      location: d.location,
      offendingCodeSnippet: d.offendingCodeSnippet,
      remediation: d.remediation,
      standardReference: d.standardReference,
    }));
    const ruleCount = dynamicDiagnostics.length;

    // 1. Audit Log event for Admin Visibility
    await AuditLogger.logEvent('SCAN_RUN', {
      userId: user.id,
      email: user.email,
      ipAddress: ip,
      userAgent,
      status: 'SUCCESS',
      details: `User Study (${participantId}) benchmark scan executed on ${framework} (${fileName}) - ${ruleCount} issues detected`,
    });

    // 2. Persist scan record for Admin / History view (via the real storage provider). userId is
    // the participant's REAL User.id (a normal random id, distinct from the displayed
    // participantCode for every row assigned via ParticipantRepository.assignNewParticipant) --
    // never the code itself, which is no longer guaranteed to equal any row's primary key.
    const newRecord = await provider.createScanRecord({
      userId: user.id,
      fileName: fileName || 'BenchmarkFixture.tsx',
      framework: framework || analysis.framework || 'React',
      qualityScore: analysis.qualityScore ?? 0,
      scanTimeMs: analysis.profile.executionTimeMs,
      memoryUsageMb: analysis.profile.peakMemoryMb,
      ruleCount,
      aiFixCount: 0,
      isFavorite: false,
      diagnostics: dynamicDiagnostics,
    });

    return NextResponse.json({ success: true, recordId: newRecord.id, participantId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to log study scan' }, { status: 500 });
  }
}
