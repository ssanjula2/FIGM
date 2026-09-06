import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../../src/auth/auth-middleware';
import { ParticipantRepository } from '../../../../src/engine/participant-repository';
import { AuditLogger } from '../../../../src/auth/audit-logger';
import { checkRateLimit, getClientIp } from '../../../../src/auth/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * Study-enrollment endpoint for the normal-login -> Live Scan research integration (see
 * docs/audit/NORMAL_LIVE_SCAN_RESEARCH_INTEGRATION.md). Authenticates ONLY via the normal product
 * session (figm_token / Authorization header, the same authenticateUser() every other product
 * route uses) -- deliberately NOT the anonymous STUDY_COOKIE the old /user-study page flow uses,
 * which remains untouched for whatever QA/back-compat purposes still need it.
 *
 * Links participant identity onto the CALLER'S OWN already-authenticated User row via
 * ParticipantRepository.enrollAuthenticatedUserAsParticipant() -- no second shadow account is ever
 * created for this human. Never assigns a code to a user who didn't explicitly request it here.
 *
 * This endpoint does NOT and must NEVER set researchStatus to CONSENT_VERIFIED -- that remains
 * exclusively an ADMIN action via PATCH /api/admin/participants/[participantId], reconciled
 * against a real external consent-form submission. POST here only records (a) the participant-code
 * assignment and (b) an audit trail of the participant's own session-level informed-consent
 * confirmation -- a distinct fact from admin verification, and one that gates nothing by itself.
 */
export async function GET(request: Request) {
  const auth = await authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const status = await ParticipantRepository.getOwnParticipantStatus(auth.user.userId);
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimitError = await checkRateLimit(ip, 10, 60000);
  if (rateLimitError) return rateLimitError;

  const auth = await authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // Empty/missing body is fine -- consentConfirmed just defaults to falsy below.
  }

  if (body?.consentConfirmed !== true) {
    return NextResponse.json(
      { error: 'You must confirm informed consent before joining the study.', code: 'CONSENT_REQUIRED' },
      { status: 400 }
    );
  }

  try {
    const result = await ParticipantRepository.enrollAuthenticatedUserAsParticipant(auth.user.userId);

    await AuditLogger.logEvent('RESEARCH_PARTICIPANT_ASSIGNED', {
      userId: auth.user.userId,
      email: auth.user.email,
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') || 'unknown',
      status: 'SUCCESS',
      details: result.alreadyEnrolled
        ? `Authenticated user resumed existing study enrollment as ${result.participantCode}`
        : `Authenticated user ${auth.user.email} joined the study as ${result.participantCode}; participant self-confirmed informed consent at ${new Date().toISOString()} (session-level -- admin verification still required before any scan becomes research-eligible)`,
    });

    return NextResponse.json({
      participantCode: result.participantCode,
      alreadyEnrolled: result.alreadyEnrolled,
    });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Unable to join the study right now.';
    // "study full" is the one expected, user-facing failure mode -- everything else is unexpected.
    const status = /reached its target/.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
