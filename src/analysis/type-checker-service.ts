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
   * Cache of parsed lib.*.d.ts SourceFiles, shared across all checkCode() calls in this process.
   * Without this, ts.createCompilerHost's default getSourceFile re-reads and re-parses every lib
   * file from disk on every single call, which is fine for one file but far too slow when scanning
   * hundreds of files in one process (e.g. `npm run ci:scan`).
   */
  private static readonly libFileCache = new Map<string, ts.SourceFile | undefined>();

  /**
   * Previous Program, passed as `oldProgram` to ts.createProgram so the lib bindings/checker state
   * are structurally reused across calls (TypeScript's own incremental-compilation mechanism) instead
   * of being rebuilt from scratch for every single file scanned in a process.
   */
  private static lastProgram: ts.Program | undefined;

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
    1003, 1005, 1109, 1127, 1128, 1135, 1136, 1381, 1382, 17002, 2657, // HTML template noise in Angular/Vue
  ]);

  /**
   * Run in-memory TypeScript compiler diagnostic checks on a standalone code snippet.
   * Only real structural errors (wrong types, missing properties, wrong arguments) are reported.
   * Module-resolution, template HTML strings, and global-API errors are filtered out.
   */
  public static checkCode(code: string, filePath: string): TypeCheckResult {
    // If Vue SFC, extract script portion for TS checking
    let codeToTypeCheck = code;
    if (filePath.endsWith('.vue')) {
      const scriptMatch = code.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/i);
      if (scriptMatch && scriptMatch[1]) {
        codeToTypeCheck = scriptMatch[1];
      } else {
        return { hasTypeErrors: false, diagnostics: [] };
      }
    }

    const isTS = filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.vue');
    if (!isTS && !codeToTypeCheck.includes(': ') && !codeToTypeCheck.includes('interface ') && !codeToTypeCheck.includes('type ')) {
      return { hasTypeErrors: false, diagnostics: [] };
    }

    const fileName = filePath.endsWith('.tsx') || filePath.endsWith('.jsx') ? 'sample.tsx' : 'sample.ts';


    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
      noEmit: true,
      strict: false,
      allowJs: true,
      skipLibCheck: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    };

    const sourceFile = ts.createSourceFile(fileName, codeToTypeCheck, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);

    // Base host reads real lib.*.d.ts files from the installed `typescript` package on disk, so
    // global built-ins (Promise, Map, Set, URL, console, ...) resolve exactly as they do for a real
    // tsc invocation. Only the virtual in-memory snippet file is intercepted and served from memory.
    const defaultHost = ts.createCompilerHost(compilerOptions, true);
    const host: ts.CompilerHost = {
      ...defaultHost,
      getSourceFile: (name, languageVersionOrOptions, onError, shouldCreateNewSourceFile) => {
        if (name === fileName) return sourceFile;
        if (TypeCheckerService.libFileCache.has(name)) {
          return TypeCheckerService.libFileCache.get(name);
        }
        const libSourceFile = defaultHost.getSourceFile(name, languageVersionOrOptions, onError, shouldCreateNewSourceFile);
        TypeCheckerService.libFileCache.set(name, libSourceFile);
        return libSourceFile;
      },
      fileExists: (f) => f === fileName || defaultHost.fileExists(f),
      readFile: (f) => (f === fileName ? codeToTypeCheck : defaultHost.readFile(f)),
    };

    const program = ts.createProgram([fileName], compilerOptions, host, TypeCheckerService.lastProgram);
    TypeCheckerService.lastProgram = program;
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
