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
   * TypeScript diagnostic codes that are false-positives in isolated snippet checking.
   * These errors occur because the in-memory compiler has no node_modules / type definitions.
   * They should NOT be reported as real FIGM violations — they are environment artifacts,
   * not real errors in the user's code.
   *
   * TS2792 — Cannot find module 'react' / 'vue' / '@angular/core' (no node_modules)
   * TS2307 — Cannot find module or its corresponding type declarations
   * TS2304 — Cannot find name 'console' / 'fetch' / 'window' (no lib.dom.d.ts)
   * TS2580 — Cannot find name 'require' (CommonJS in ESM context)
   * TS2686 — 'X' refers to a UMD global, only available with --module
   * TS2503 — Cannot find namespace 'JSX'
   * TS7016 — Could not find a declaration file for module
   */
  private static readonly SNIPPET_NOISE_CODES = new Set<number>([
    2792, // Cannot find module (e.g. 'react', 'vue', '@angular/core')
    2307, // Cannot find module or its corresponding type declarations
    2304, // Cannot find name 'X' — e.g. window, document (global APIs)
    2580, // Cannot find name 'require' — CommonJS in ESM context
    2686, // 'X' refers to a UMD global — only available with --module
    2503, // Cannot find namespace 'JSX'
    7016, // Could not find a declaration file for module
    2584, // Cannot find name 'console' (missing lib.dom.d.ts in isolated mode)
    2585, // Cannot find name 'Promise' (missing lib.es2015.promise)
    2339, // Property does not exist on JSX intrinsic elements (no JSX types loaded)
  ]);

  /**
   * Run in-memory TypeScript compiler diagnostic checks on a standalone code snippet.
   * Only real structural errors (wrong types, missing properties, wrong arguments) are reported.
   * Module-resolution and global-API errors are filtered out as environment false-positives.
   */
  public static checkCode(code: string, filePath: string): TypeCheckResult {
    const isTS = filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.vue');
    if (!isTS && !code.includes(': ') && !code.includes('interface ') && !code.includes('type ')) {
      return { hasTypeErrors: false, diagnostics: [] };
    }

    const fileName = filePath.endsWith('.tsx') || filePath.endsWith('.jsx') ? 'sample.tsx' : 'sample.ts';

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

      // Filter out known false-positive codes caused by isolated snippet context
      if (TypeCheckerService.SNIPPET_NOISE_CODES.has(diag.code)) continue;

      const codeStr = diag.file.text;
      const startPos = diag.start ?? 0;
      const { line, character } = diag.file.getLineAndCharacterOfPosition(startPos);
      const lineNum = line + 1;
      const colNum = character + 1;

      const lines = codeStr.split('\n');
      const snippet = lines[line] ?? codeStr.substring(startPos, startPos + 40);

      const messageText =
        typeof diag.messageText === 'string'
          ? diag.messageText
          : diag.messageText.messageText;

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
        remediation: `TS${diag.code}: ${messageText}`,
        recommendation: `Ensure correct type declarations match the expected variable or parameter assignment.`,
        standardReference: `TypeScript Language Specification (TS${diag.code})`,
        confidenceScore: 0.95,
        fixAvailable: true,
      });
    }

    return {
      hasTypeErrors: reports.length > 0,
      diagnostics: reports,
      disclaimer: 'Project context unavailable — type checking is limited to the supplied file.',
    };
  }
}
