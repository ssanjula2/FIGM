import { NextResponse } from 'next/server';
import { DissertationExporter } from '../../../src/docs/dissertation-exporter';
import { authenticateUser } from '../../../src/auth/auth-middleware';

export async function GET(request: Request) {
  // The exported content itself isn't sensitive (static dissertation chapter text), but this
  // triggers real server-side disk writes as a side effect of a GET request with no rate
  // limiting -- reachable by anyone. Requiring authentication is enough to stop anonymous
  // internet-wide abuse without needing to restrict it to ADMIN only.
  const auth = authenticateUser(request);
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
