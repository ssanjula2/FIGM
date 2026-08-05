import { NextResponse } from 'next/server';
import { RuleExecutionEngine } from '../../../src/engine/rule-execution-engine';
import { AIRemediationPipeline } from '../../../src/ai/ai-remediation-pipeline';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, fileName, action, defect } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code string is required' }, { status: 400 });
    }

    const targetFile = fileName || 'Component.tsx';

    // Handle AI Fix Request
    if (action === 'ai-fix' && defect) {
      const aiResult = await AIRemediationPipeline.remediateDefect(code, defect, 'REACT_JSX');
      return NextResponse.json(aiResult);
    }

    // Standard Scan Request
    const scanResult = RuleExecutionEngine.analyzeFile(targetFile, code);
    return NextResponse.json(scanResult);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Scan execution failed' }, { status: 500 });
  }
}
