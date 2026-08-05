import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../src/auth/auth-middleware';
import { UserDB } from '../../../src/auth/user-db';
import { RuleExecutionEngine } from '../../../src/engine/rule-execution-engine';

export async function GET(request: Request) {
  const { user, errorResponse } = authenticateUser(request);
  if (errorResponse || !user) {
    return errorResponse;
  }

  // Fetch only submissions owned by authenticated userId
  const submissions = UserDB.getSubmissionsByUserId(user.userId);
  return NextResponse.json({
    user: user,
    submissions: submissions,
  });
}

export async function POST(request: Request) {
  const { user, errorResponse } = authenticateUser(request);
  if (errorResponse || !user) {
    return errorResponse;
  }

  try {
    const body = await request.json();
    const { code, fileName } = body;

    if (!code) {
      return NextResponse.json({ error: 'Code content is required' }, { status: 400 });
    }

    const name = fileName || 'submission.tsx';

    // Run Static & Dynamic Analysis Engine
    const result = RuleExecutionEngine.analyzeFile(name, code);

    // Save submission scoped strictly to user.userId
    const submission = UserDB.createSubmission({
      userId: user.userId,
      fileName: name,
      framework: result.framework,
      codeContent: code,
      executionTimeMs: result.profile.executionTimeMs,
      qualityScore: Math.max(0, 100 - result.totalErrors * 15 - result.totalWarnings * 5),
      diagnosticsCount: result.diagnostics.length,
    });

    return NextResponse.json({
      message: 'Submission analyzed and saved to user profile',
      submission,
      scanResult: result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
