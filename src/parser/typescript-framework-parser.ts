/**
 * Framework-Independent Guideline Model (FIGM)
 * TypeScript-Compiler-API-Backed FrameworkParser (AST Migration Phase 2)
 *
 * Wraps `ts.createSourceFile` behind the `FrameworkParser` contract. Covers every syntax family
 * that is genuinely valid TypeScript/JSX source: React (REACT_JSX), Next.js (NEXT_JS), plain
 * JS/TS (GENERIC_ESTREE), and the TypeScript class-body portion of Angular components
 * (ANGULAR_TEMPLATE files are real .ts source with decorators; only the *template markup* inside
 * them is not). It is intentionally NOT used for VUE_SFC (a raw .vue file is not TypeScript) or
 * for Angular template markup embedded in a string literal (see docs/architecture/AST_MIGRATION_MAP.md §5).
 *
 * Always parses with `ts.ScriptKind.TSX`, matching the precedent already established in
 * src/analysis/react-ast-rules.ts: TSX is a strict syntactic superset (it accepts JSX AND plain
 * TS/JS), so a single script kind avoids extension-sniffing edge cases (a .js file containing
 * JSX, a .ts file with no JSX at all) while never rejecting anything a narrower script kind would
 * have accepted.
 */

import * as ts from 'typescript';
import type { FrameworkParser, ParserDiagnostic, SourceRange } from './framework-parser.js';

export class TypeScriptFrameworkParser implements FrameworkParser<ts.Node> {
  public readonly kind = 'REAL_AST' as const;

  private sourceFile: ts.SourceFile | null = null;
  private diagnostics: ParserDiagnostic[] = [];

  public parse(code: string, filePath: string): void {
    this.diagnostics = [];
    try {
      this.sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.ES2022, /* setParentNodes */ true, ts.ScriptKind.TSX);

      // ts.createSourceFile is error-tolerant by design (it always returns a best-effort tree),
      // but it still records syntax errors on the resulting SourceFile -- surface them as
      // structured diagnostics rather than silently discarding them, matching the ParseResult
      // contract the rest of the pipeline already expects (see SourceParser.parseSource).
      const anySourceFile = this.sourceFile as unknown as { parseDiagnostics?: ts.DiagnosticWithLocation[] };
      for (const diag of anySourceFile.parseDiagnostics ?? []) {
        if (diag.file && typeof diag.start === 'number') {
          const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start);
          this.diagnostics.push({
            severity: 'error',
            message: ts.flattenDiagnosticMessageText(diag.messageText, ' '),
            line: line + 1,
            column: character,
          });
        }
      }
    } catch (err) {
      // Belt-and-braces: even though ts.createSourceFile does not throw for syntax errors, guard
      // against any unexpected internal exception so a pathological input can never crash the
      // caller. Degrades to "no usable tree" -- callers fall back to a legacy detector.
      this.sourceFile = null;
      this.diagnostics.push({
        severity: 'error',
        message: err instanceof Error ? err.message : 'Unknown TypeScript parser error',
        line: 1,
        column: 0,
      });
    }
  }

  public getRoot(): ts.Node | null {
    return this.sourceFile;
  }

  public getDiagnostics(): ParserDiagnostic[] {
    return this.diagnostics;
  }

  public getSourceRange(node: ts.Node): SourceRange {
    if (!this.sourceFile) {
      return { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } };
    }
    const start = this.sourceFile.getLineAndCharacterOfPosition(node.getStart(this.sourceFile));
    const end = this.sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    return {
      start: { line: start.line + 1, column: start.character },
      end: { line: end.line + 1, column: end.character },
    };
  }

  public visit(callback: (node: ts.Node, range: SourceRange) => void): void {
    if (!this.sourceFile) return;
    const sourceFile = this.sourceFile;
    const walk = (node: ts.Node) => {
      callback(node, this.getSourceRange(node));
      ts.forEachChild(node, walk);
    };
    walk(sourceFile);
  }

  /** Convenience accessor for code that needs the underlying source text (e.g. to slice a
   *  line for an evidence snippet) without re-splitting `code` itself. */
  public getSourceText(): string {
    return this.sourceFile?.text ?? '';
  }
}
