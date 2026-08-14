/**
 * Framework-Independent Guideline Model (FIGM)
 * Parser Abstraction (AST Migration Phase 2)
 *
 * See docs/architecture/AST_MIGRATION_MAP.md for the full rationale. This interface is
 * deliberately narrow: it does not try to make a Vue SFC parser and a TypeScript parser look
 * identical (Phase 3's "avoid pretending different framework ASTs are identical") — it only
 * standardizes the shape every real parser implementation in this codebase exposes to its caller
 * (parse, get the root, get diagnostics, get a node's source range, visit nodes), while leaving
 * `TNode` as whatever that parser's own real node type is.
 */

export interface ParserDiagnostic {
  severity: 'error' | 'warning';
  message: string;
  line: number;
  column: number;
}

export interface SourceLocation {
  line: number;
  column: number;
}

export interface SourceRange {
  start: SourceLocation;
  end: SourceLocation;
}

/**
 * A parser implementation must never throw out of `parse()`. Any failure (syntax error, internal
 * exception) is reported through `getDiagnostics()` instead, and `getRoot()` returns `null` when
 * no usable tree could be produced at all -- callers fall back to a legacy detector for that file
 * rather than being handed a partial tree that looks complete.
 */
export interface FrameworkParser<TNode = unknown> {
  /** Distinguishes a genuine parser-backed implementation from a text-heuristic fallback that
   *  happens to share this interface's shape -- never label the latter 'REAL_AST'. */
  readonly kind: 'REAL_AST' | 'LEGACY_TEXT_HEURISTIC';

  parse(code: string, filePath: string): void;

  /** The parsed tree's root node, or `null` if parsing produced nothing usable. */
  getRoot(): TNode | null;

  /** Structured, never-thrown diagnostics collected during the most recent `parse()` call. */
  getDiagnostics(): ParserDiagnostic[];

  /** Resolves any node produced by this parser to a 1-based line / 0-based column source range. */
  getSourceRange(node: TNode): SourceRange;

  /** Visits every node reachable from the root, depth-first. No-op if `getRoot()` is `null`. */
  visit(callback: (node: TNode, range: SourceRange) => void): void;
}
