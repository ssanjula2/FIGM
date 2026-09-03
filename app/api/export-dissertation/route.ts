import { NextResponse } from 'next/server';
import { DissertationExporter } from '../../../src/docs/dissertation-exporter';
import { authenticateUser } from '../../../src/auth/auth-middleware';
import { checkRateLimit, getClientIp } from '../../../src/auth/rate-limiter';

export async function GET(request: Request) {
  // The exported content itself isn't sensitive (static dissertation chapter text), but this
  // triggers real server-side disk writes as a side effect of a GET request -- reachable by any
  // authenticated account. Authentication alone stops anonymous internet-wide abuse but not a
  // single compromised/malicious account hammering this endpoint to force unlimited disk writes;
  // rate limiting closes that gap the same way every other write-triggering auth route does.
  const ip = getClientIp(request);
  const rateLimitError = await checkRateLimit(ip, 5, 60000);
  if (rateLimitError) return rateLimitError;

  const auth = await authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const exportedFiles = DissertationExporter.exportAllArtifacts();
    return NextResponse.json({
      success: true,
      message: 'Dissertation LaTeX artifacts successfully exported.',
      exportedFiles,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
