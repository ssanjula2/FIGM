/**
 * Framework-Independent Guideline Model (FIGM)
 * Lexical Typo Fix Engine -- a narrow, instance-level deterministic fixer for GENERAL_CODE_ERROR
 * diagnostics (TypeCheckerService's TYPE-TS-<code>, SourceParser's SYNTAX-PARSE-ERROR) caused by a
 * single mistyped keyword or identifier, e.g. `funtion` for `function`.
 *
 * Deliberately NOT a "huge generic autocorrect dictionary": this engine never guesses a correction
 * on its own. It only ever trusts a replacement that the REAL TypeScript compiler itself already
 * proposed via a "Did you mean 'X'?" diagnostic message -- the exact same signal `tsc` shows a
 * developer at the command line. The only "dictionary" involved is the closed, stable, spec-defined
 * set of ECMAScript/TypeScript reserved keywords (JS_TS_RESERVED_KEYWORDS below), used purely as a
 * tiebreak when the compiler's own diagnostics disagree with each other (see below) -- never as a
 * source of corrections on its own.
 *
 * Reproduced live: `export async funtion GET() {` produces three real diagnostics at/near the same
 * token -- TS1434 ("Unexpected keyword or identifier", no suggestion), TS1435 ("Unknown keyword or
 * identifier. Did you mean 'function'?" -- the PARSER's own keyword-near-miss suggestion) and TS2552
 * ("Cannot find name 'funtion'. Did you mean 'Function'?" -- the type checker's post-recovery
 * identifier-lookup suggestion, genuinely WRONG here: it Levenshtein-matched the built-in `Function`
 * constructor). Trusting either suggestion blindly is unsafe; trusting BOTH indiscriminately is
 * actively wrong here. This engine requires every "Did you mean" suggestion for the SAME source
 * token to agree before treating a correction as safe -- when they disagree, it prefers a
 * suggestion that is itself a real reserved keyword (TS1435's 'function' qualifies; TS2552's
 * 'Function' does not, since 'Function' is a builtin identifier, not a keyword) as a principled,
 * spec-grounded tiebreak; if even that is inconclusive, it declines outright rather than guess --
 * declining always falls through to the existing AI-assisted remediation path, never to a worse
 * deterministic guess.
 *
 * Every produced patch is, like every other deterministic engine in this codebase, still required
 * to pass the full syntax -> compile -> PATCH_SCOPE -> FIGM re-scan pipeline before being reported
 * as fixed (see src/ai/ai-remediation-pipeline.ts's Path 1) -- this engine is never trusted blindly.
 *
 * KNOWN, SAFE LIMITATION: because general-error-grouping.ts's grouping key is deliberately coarse
 * (same file + same line -- see that module's own header), a `defect` whose OWN location carries no
 * usable "Did you mean" signal can end up borrowing a correction from a *sibling* diagnostic that
 * turns out to describe a genuinely different, merely line-coincidental defect (reproduced by a
 * fixture combining an unrelated type mismatch with a keyword typo on one line). This engine cannot
 * distinguish that case from the real one (three diagnostics that are legitimately the SAME defect,
 * reported at slightly different columns by the parser's own error recovery) using location data
 * alone. This is never a SAFETY problem: RemediationValidator (see remediation-validation.server.ts)
 * still requires `defect.ruleId` itself to be gone post-fix, so a patch that "fixes" an unrelated
 * sibling while leaving the actual reported defect in place is reliably rejected on re-scan and
 * falls through to AI-assisted remediation -- at most one harmless wasted deterministic attempt,
 * never a false "fixed."
 */

import { DiagnosticReport, SourceRange } from '../types/ast-spec.js';

export interface LexicalTypoFixOutcome {
  success: boolean;
  patchedCode: string;
  description: string;
}

/** The closed, spec-defined ECMAScript/TypeScript reserved-word set -- used ONLY to break a tie
 *  between two disagreeing compiler-proposed suggestions for the same token (see file header), and
 *  intentionally NEVER used to invent a suggestion that the compiler itself didn't already propose. */
const JS_TS_RESERVED_KEYWORDS: ReadonlySet<string> = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
  'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof',
  'new', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while',
  'with', 'yield', 'let', 'static', 'async', 'await', 'of', 'get', 'set', 'enum', 'implements',
  'interface', 'package', 'private', 'protected', 'public', 'null', 'true', 'false', 'undefined',
]);

interface DidYouMeanSuggestion {
  original: string;
  replacement: string;
  location: SourceRange;
}

function extractDidYouMean(message: string): string | undefined {
  const m = message.match(/Did you mean ['"]([A-Za-z_$][A-Za-z0-9_$]*)['"]\??/);
  return m?.[1];
}

/** Extracts the exact source text the diagnostic's own location brackets, directly from the real
 *  source line -- never parsed out of the message text, which does not always quote the original
 *  token (TS1435 above never does). */
function extractSourceToken(lineText: string, location: SourceRange): string | undefined {
  const startCol = (location.start.column ?? 0) - 1;
  const endCol = location.end?.column !== undefined ? location.end.column - 1 : startCol + 1;
  if (startCol < 0 || endCol > lineText.length || endCol <= startCol) return undefined;
  return lineText.slice(startCol, endCol);
}

export class LexicalTypoFixEngine {
  /** GENERAL_CODE_ERROR diagnostics only -- never a FIGM rule violation, which always carries a
   *  domain-specific category (or none of TYPE_COMPILE_ERROR/SYNTAX_ERROR). */
  public static isEligible(defect: DiagnosticReport): boolean {
    return defect.category === 'TYPE_COMPILE_ERROR' || defect.category === 'SYNTAX_ERROR';
  }

  /**
   * Attempts a single-token deterministic correction for `defect` (and, when present,
   * `defect.relatedDiagnostics` -- see general-error-grouping.ts). Never throws; declines
   * (success: false, patchedCode unchanged) whenever no compiler-proposed suggestion exists, or
   * when the diagnostics disagree in a way that cannot be safely resolved -- callers (see
   * remediation-decision.ts) are expected to fall through to AI-assisted remediation on decline.
   */
  public static tryFix(code: string, defect: DiagnosticReport): LexicalTypoFixOutcome {
    if (!LexicalTypoFixEngine.isEligible(defect)) {
      return { success: false, patchedCode: code, description: 'Not a general compile/syntax error diagnostic — this engine only handles TYPE_COMPILE_ERROR/SYNTAX_ERROR.' };
    }

    const candidates: Array<{ ruleId: string; message: string; location?: SourceRange }> = [
      { ruleId: defect.ruleId, message: defect.message, location: defect.location },
      ...(defect.relatedDiagnostics ?? []),
    ];

    const lines = code.split('\n');
    const suggestions: DidYouMeanSuggestion[] = [];
    for (const c of candidates) {
      const replacement = extractDidYouMean(c.message);
      if (!replacement || !c.location) continue;
      const lineIdx = (c.location.start.line ?? 0) - 1;
      const lineText = lines[lineIdx];
      if (lineText === undefined) continue;
      const original = extractSourceToken(lineText, c.location);
      if (!original || original === replacement || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(original)) continue;
      suggestions.push({ original, replacement, location: c.location });
    }

    if (suggestions.length === 0) {
      return {
        success: false,
        patchedCode: code,
        description: 'No "Did you mean" correction from the TypeScript compiler was found among this diagnostic and its related diagnostics.',
      };
    }

    let chosen: DidYouMeanSuggestion;
    const distinctPairs = new Map<string, DidYouMeanSuggestion>();
    for (const s of suggestions) distinctPairs.set(`${s.original}=>${s.replacement}`, s);

    if (distinctPairs.size === 1) {
      chosen = [...distinctPairs.values()][0];
    } else {
      // Disagreeing suggestions for what location-wise is the same defect. Prefer one whose
      // replacement is a real reserved keyword (a principled, spec-grounded tiebreak — see file
      // header) ONLY if exactly one distinct replacement value qualifies; otherwise this is
      // genuinely ambiguous and this engine declines rather than guess.
      const keywordReplacements = new Set([...distinctPairs.values()].filter((s) => JS_TS_RESERVED_KEYWORDS.has(s.replacement)).map((s) => s.replacement));
      if (keywordReplacements.size !== 1) {
        return {
          success: false,
          patchedCode: code,
          description: `Multiple disagreeing "Did you mean" suggestions were found (${[...distinctPairs.keys()].join(', ')}) — ambiguous, declining rather than guessing. Falls through to AI-assisted remediation.`,
        };
      }
      const onlyKeyword = [...keywordReplacements][0];
      chosen = [...distinctPairs.values()].find((s) => s.replacement === onlyKeyword)!;
    }

    const lineIdx = (chosen.location.start.line ?? 1) - 1;
    const lineText = lines[lineIdx];
    const startCol = (chosen.location.start.column ?? 1) - 1;
    const endCol = chosen.location.end?.column !== undefined ? chosen.location.end.column - 1 : startCol + chosen.original.length;
    const newLineText = lineText.slice(0, startCol) + chosen.replacement + lineText.slice(endCol);
    const newLines = [...lines];
    newLines[lineIdx] = newLineText;

    return {
      success: true,
      patchedCode: newLines.join('\n'),
      description: `Corrected "${chosen.original}" to "${chosen.replacement}" at line ${chosen.location.start.line}, based on the TypeScript compiler's own "Did you mean" suggestion.`,
    };
  }
}
