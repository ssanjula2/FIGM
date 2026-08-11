/**
 * Framework-Independent Guideline Model (FIGM)
 * TypeScript Compiler Diagnostic Service
 */

import * as ts from 'typescript';
import { DiagnosticReport, SourceRange } from '../types/ast-spec.js';

export interface TypeCheckResult {
  hasTypeErrors: boolean;
  diagnostics: DiagnosticReport[];
  disclaimer?: string;
}

export class TypeCheckerService {
  /**
   * Run in-memory TypeScript compiler diagnostic checks on a standalone code snippet
   */
  public static checkCode(code: string, filePath: string): TypeCheckResult {
    const isTS = filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.vue');
    if (!isTS && !code.includes(': ') && !code.includes('interface ') && !code.includes('type ')) {
      return {
        hasTypeErrors: false,
        diagnostics: [],
      };
    }

    const fileName = filePath.endsWith('.tsx') || filePath.endsWith('.jsx') ? 'sample.tsx' : 'sample.ts';

    // Create an in-memory Compiler Host and Program
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      noEmit: true,
      strict: false,
      allowJs: true,
      skipLibCheck: true,
    };

    const sourceFile = ts.createSourceFile(fileName, code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);

    const host: ts.CompilerHost = {
      getSourceFile: (name) => (name === fileName ? sourceFile : undefined),
      getDefaultLibFileName: () => 'lib.d.ts',
      writeFile: () => {},
      getCurrentDirectory: () => '/',
      getDirectories: () => [],
      getCanonicalFileName: (f) => f,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
      fileExists: (f) => f === fileName,
      readFile: (f) => (f === fileName ? code : undefined),
    };

    const program = ts.createProgram([fileName], compilerOptions, host);
    const tsDiagnostics = ts.getPreEmitDiagnostics(program);

    const reports: DiagnosticReport[] = [];

    for (const diag of tsDiagnostics) {
      if (!diag.file) continue;

      const codeStr = diag.file.text;
      const startPos = diag.start ?? 0;
      const { line, character } = diag.file.getLineAndCharacterOfPosition(startPos);
      const lineNum = line + 1;
      const colNum = character + 1;

      const lines = codeStr.split('\n');
      const snippet = lines[line] ?? codeStr.substring(startPos, startPos + 40);

      const messageText = typeof diag.messageText === 'string' ? diag.messageText : diag.messageText.messageText;

      const location: SourceRange = {
        start: { line: lineNum, column: colNum },
        end: { line: lineNum, column: colNum + (diag.length ?? 1) },
      };

      reports.push({
        ruleId: `TYPE-TS-${diag.code}`,
        ruleName: `TypeScript Compiler Error TS${diag.code}`,
        category: 'TYPE_COMPILE_ERROR',
        domain: 'PERFORMANCE',
        concern: 'RESOURCE_UTILIZATION',
        severity: 'HIGH',
        filePath,
        location,
        line: lineNum,
        column: colNum,
        offendingCodeSnippet: snippet.trim(),
        sourceSnippet: snippet.trim(),
        message: messageText,
        remediation: `Fix the type mismatch or missing declaration near line ${lineNum}, column ${colNum}.`,
        recommendation: `Ensure correct type declarations match the expected variable or parameter assignment.`,
        standardReference: `TypeScript Language Specification (TS${diag.code})`,
        confidenceScore: 0.95,
        fixAvailable: false,
      });
    }

    return {
      hasTypeErrors: reports.length > 0,
      diagnostics: reports,
      disclaimer: 'Project context unavailable — type checking is limited to the supplied file.',
    };
  }
}
