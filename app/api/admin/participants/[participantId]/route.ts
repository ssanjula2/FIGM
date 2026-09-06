import { NextResponse } from 'next/server';
import { authorizeRole } from '../../../../../src/auth/auth-middleware';
import { ParticipantRepository, PARTICIPANT_ID_PATTERN } from '../../../../../src/engine/participant-repository';
import { AuditLogger } from '../../../../../src/auth/audit-logger';
import { getClientIp } from '../../../../../src/auth/rate-limiter';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ participantId: string }> }) {
  const params = await props.params;
  const auth = await authorizeRole(request, ['ADMIN']);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { participantId } = params;
  if (!PARTICIPANT_ID_PATTERN.test(participantId)) {
    return NextResponse.json({ error: 'Invalid participant id format' }, { status: 400 });
  }

  const detail = await ParticipantRepository.getDetail(participantId);
  if (!detail) {
    return NextResponse.json({ error: 'Invalid participant id format' }, { status: 400 });
  }

  return NextResponse.json({ participant: detail });
}

/**
 * ADMIN-only. Sets a participant's server-verifiable research-eligibility state. This is the ONLY
 * code path that can mark a participant CONSENT_VERIFIED, and it never does so automatically --
 * the study's actual consent capture happens off-platform (an external Google Form, per
 * research/CONSENT_FORM.md), so this action represents a human researcher having reconciled a real
 * form submission against this specific participant code. REVOKED marks a participant assignment
 * (e.g. confirmed QA/test contamination -- see the forensic audit's P0-D finding) as no longer able
 * to accept further research-scan writes, without deleting its existing historical records.
 */
export async function PATCH(request: Request, props: { params: Promise<{ participantId: string }> }) {
  const params = await props.params;
  const auth = await authorizeRole(request, ['ADMIN']);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { participantId } = params;
  if (!PARTICIPANT_ID_PATTERN.test(participantId)) {
    return NextResponse.json({ error: 'Invalid participant id format' }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { status } = body || {};
  if (status !== 'CONSENT_VERIFIED' && status !== 'REVOKED') {
    return NextResponse.json({ error: "status must be 'CONSENT_VERIFIED' or 'REVOKED'" }, { status: 400 });
  }

  const result = await ParticipantRepository.setResearchStatus(participantId, status);
  if (!result) {
    return NextResponse.json({ error: 'No registered participant exists for this id' }, { status: 404 });
  }

  await AuditLogger.logEvent(status === 'CONSENT_VERIFIED' ? 'RESEARCH_CONSENT_VERIFIED' : 'RESEARCH_CONSENT_REVOKED', {
    userId: auth.user.userId,
    email: auth.user.email,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('user-agent') || 'unknown',
    status: 'SUCCESS',
    details: `ADMIN ${auth.user.email} set participant ${participantId} research status to ${status}`,
  });

  const detail = await ParticipantRepository.getDetail(participantId);
  return NextResponse.json({ participant: detail });
}
