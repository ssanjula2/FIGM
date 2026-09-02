import { NextResponse } from 'next/server';
import { AuditLogger } from '../../../../src/auth/audit-logger';
import { signResearchParticipantToken, verifyResearchParticipantToken } from '../../../../src/auth/auth-service';
import { checkRateLimit, getClientIp } from '../../../../src/auth/rate-limiter';
import { CONSENT_PROTOCOL_VERSION } from '../../../../src/research/research-config';
import { STUDY_COOKIE } from '../../../../src/auth/study-session';

export const dynamic = 'force-dynamic';

/**
 * Records consent for the CURRENT research-participant session and only that session -- consent
 * is bound to the same anonymous, signed, httpOnly cookie GET /api/user-study/log-scan issues, not
 * to any newly-collected name/email/identity. A caller must already hold a valid (but
 * not-yet-consented) session token; this re-signs it with consentGiven=true, consentVersion, and
 * a server-set timestamp, and re-sets the cookie. POST /api/user-study/log-scan then refuses to
 * log any study interaction for a session whose token does not carry consentGiven=true -- see
 * that route's consent-gate comment for the full rationale.
 *
 * This endpoint does NOT itself re-verify institutional ethics/consent approval for the study --
 * that is recorded separately (see research/CONSENT_FORM.md's `ETHICS_APPROVAL_STATUS` field,
 * confirmed `CONFIRMED_BY_RESEARCHER` as of 2026-09-03; docs/research/PARTICIPANT_TARGET_DECISION.md).
 * This endpoint only enforces that no study-interaction data is logged for a session that has not
 * clicked through the consent text.
 */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const rateLimitError = await checkRateLimit(ip, 30, 60000);
    if (rateLimitError) return rateLimitError;

    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`${STUDY_COOKIE}=([^;]+)`));
    const sessionToken = match ? decodeURIComponent(match[1]) : undefined;
    const verified = sessionToken ? verifyResearchParticipantToken(sessionToken) : null;

    if (!verified) {
      return NextResponse.json(
        { error: 'A research participant session is required before consent can be recorded. Reload the page to start one.' },
        { status: 401 }
      );
    }

    const consentTimestamp = new Date().toISOString();
    const newToken = signResearchParticipantToken(verified.participantCode, 604800, {
      given: true,
      version: CONSENT_PROTOCOL_VERSION,
      timestamp: consentTimestamp,
    });

    await AuditLogger.logEvent('RESEARCH_PARTICIPANT_ASSIGNED', {
      email: `${verified.participantCode.toLowerCase()}@user-study.figm.local`,
      ipAddress: ip,
      userAgent,
      status: 'SUCCESS',
      details: `Consent recorded for research participant session ${verified.participantCode} (protocol version ${CONSENT_PROTOCOL_VERSION}).`,
    });

    const response = NextResponse.json({
      consentGiven: true,
      consentVersion: CONSENT_PROTOCOL_VERSION,
      consentTimestamp,
    });
    response.cookies.set(STUDY_COOKIE, newToken, {
      httpOnly: true,
      path: '/',
      maxAge: 604800,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });
    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unable to record consent right now.' }, { status: 503 });
  }
}
