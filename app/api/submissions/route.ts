import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../src/auth/auth-middleware';
import { SubmissionRepository } from '../../../src/engine/submission-repository';
import { RuleExecutionEngine } from '../../../src/engine/rule-execution-engine';
import { calculateQualityScore } from '../../../src/engine/quality-score';
import { checkRateLimit, getClientIp } from '../../../src/auth/rate-limiter';

export async function GET(request: Request) {
  const { user, errorResponse } = await authenticateUser(request);
  if (errorResponse || !user) {
    return errorResponse;
  }

  // Scoped strictly to the authenticated caller's own submissions -- SubmissionRepository/the
  // storage provider filters by userId server-side, same as every other list endpoint.
  const submissions = await SubmissionRepository.getByUserId(user.userId);
  return NextResponse.json({
    user: user,
    submissions: submissions,
  });
}

export async function POST(request: Request) {
  const { user, errorResponse } = await authenticateUser(request);
  if (errorResponse || !user) {
    return errorResponse;
  }

  // This calls the exact same RuleExecutionEngine.analyzeFileAsync analysis path as /api/scan on
  // arbitrary client-supplied code, then persists a DB record -- the same compute+write cost
  // profile /api/scan's own rate limit exists to bound, but this route had no limit at all.
  const rateLimitError = await checkRateLimit(getClientIp(request), 15, 60000);
  if (rateLimitError) return rateLimitError;

  try {
    const body = await request.json();
    const { code, fileName } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code content is required' }, { status: 400 });
    }

    const name = fileName || 'submission.tsx';

    // Run the real Static & Dynamic Analysis Engine -- never trust a client-supplied score.
    // Async variant: this route serves concurrent multi-user traffic -- see
    // RuleExecutionEngine.analyzeFileAsync's doc comment.
    const result = await RuleExecutionEngine.analyzeFileAsync(name, code);

    const submission = await SubmissionRepository.create({
      userId: user.userId,
      fileName: name,
      framework: result.framework,
      codeContent: code,
      executionTimeMs: result.profile.executionTimeMs,
      qualityScore: result.qualityScore ?? calculateQualityScore(result.diagnostics),
      diagnosticsCount: result.diagnostics.length,
    });

    return NextResponse.json({
      message: 'Submission analyzed and saved to user profile',
      submission,
      scanResult: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Submission failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await authenticateUser(request);
  if (errorResponse || !user) {
    return errorResponse;
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Submission id is required' }, { status: 400 });
    }

    // Ownership-checked at the storage layer (see SubmissionRepository.delete /
    // IStorageProvider.deleteSubmission) -- a submission id that exists but belongs to another
    // user is treated identically to one that doesn't exist at all.
    const deleted = await SubmissionRepository.delete(id, user.userId);
    if (!deleted) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Submission deleted' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
