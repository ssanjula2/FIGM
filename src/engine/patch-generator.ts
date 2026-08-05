/**
 * Framework-Independent Guideline Model (FIGM)
 * Patch Generator Engine - Unified Git Patch & Diff Synthesis
 */

export interface GitPatchResult {
  diff: string;
  explanation: string;
}

export class PatchGenerator {
  /**
   * Generates a git-compatible unified diff snippet and explanation
   */
  public static generateGitDiff(
    filePath: string,
    originalCode: string,
    remediatedCode: string,
    startLine: number = 1,
    explanation: string = 'Applied automated code remediation.'
  ): GitPatchResult {
    if (originalCode === remediatedCode) {
      return {
        diff: '',
        explanation: 'No code changes required.',
      };
    }

    const origLines = originalCode.split('\n');
    const remLines = remediatedCode.split('\n');

    // Find first differing line
    let diffStart = 0;
    while (
      diffStart < origLines.length &&
      diffStart < remLines.length &&
      origLines[diffStart] === remLines[diffStart]
    ) {
      diffStart++;
    }

    const startContext = Math.max(0, diffStart - 1);
    const origChunk = origLines.slice(startContext, diffStart + 3);
    const remChunk = remLines.slice(startContext, diffStart + 4);

    const lineNum = startLine > 1 ? startLine : diffStart + 1;

    let diff = `@@ -${lineNum},${origChunk.length} +${lineNum},${remChunk.length} @@\n`;

    origChunk.forEach((line) => {
      diff += `-${line}\n`;
    });

    remChunk.forEach((line) => {
      diff += `+${line}\n`;
    });

    return {
      diff,
      explanation,
    };
  }
}
