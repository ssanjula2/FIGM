import { NextResponse } from 'next/server';
import { DissertationExporter } from '../../../src/docs/dissertation-exporter';

export async function GET() {
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
