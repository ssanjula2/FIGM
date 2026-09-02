/**
 * Framework-Independent Guideline Model (FIGM)
 * General Code Error Grouping -- deduplicates GENERAL_CODE_ERROR diagnostics (TypeCheckerService's
 * TYPE-TS-<code> entries, SourceParser's SYNTAX-PARSE-ERROR) that are almost certainly symptoms of
 * ONE underlying source defect, so the remediation pipeline attempts ONE fix, not several.
 *
 * Reproduced live: `export async funtion GET() {` produces THREE separate TypeScript diagnostics
 * (TS1434 "Unexpected keyword or identifier", TS1435 "Unknown keyword or identifier. Did you mean
 * 'function'?", TS2552 "Cannot find name 'funtion'. Did you mean 'Function'?") -- all on the same
 * source line, all caused by the single typo'd token "funtion". Treating each as an independent
 * remediation target would mean three separate AI/deterministic attempts (and three separate
 * "Fix" actions in the UI) for what a developer experiences as ONE mistake.
 *
 * Grouping key is deliberately coarse and honest about its own limits: SAME FILE + SAME START LINE.
 * This is not a semantic root-cause analysis -- it cannot tell "these three diagnostics share a
 * root cause" from "these three diagnostics coincidentally sit on one long line" with certainty.
 * What makes this safe regardless: grouping only ever affects (a) what CONTEXT the AI/deterministic
 * fixer is shown, and (b) what set of ruleIds the post-fix re-scan must confirm are gone -- it never
 * widens what a patch is ALLOWED to change (PATCH_SCOPE, syntax, and compile validation are
 * completely unaffected by grouping) and never grants a fix a pass it wouldn't otherwise earn.
 *
 * FIGM_RULE diagnostics are NEVER grouped (each is always returned as its own singleton group) --
 * this module only ever groups GENERAL_CODE_ERROR diagnostics, matching
 * src/engine/diagnostic-classifier.ts's own FIGM_RULE / GENERAL_CODE_ERROR separation. A FIGM
 * violation and a compiler error that happen to sit on the same line are never merged into one
 * group; grouping never crosses that boundary.
 */

import { DiagnosticReport } from '../types/ast-spec.js';
import { classifyDiagnosticKind } from './diagnostic-classifier.js';

/** Groups `diagnostics` into arrays where every GENERAL_CODE_ERROR diagnostic sharing the same
 *  `filePath` + `location.start.line` as another ends up in the same group (order-preserving: the
 *  first diagnostic seen at a given file+line anchors that group). Every FIGM_RULE diagnostic, and
 *  every GENERAL_CODE_ERROR diagnostic whose line is unique among its file, comes back as a
 *  singleton group of its own. */
export function groupGeneralCodeErrorDiagnostics(diagnostics: DiagnosticReport[]): DiagnosticReport[][] {
  const groups: DiagnosticReport[][] = [];
  const groupIndexByKey = new Map<string, number>();

  for (const diag of diagnostics) {
    const line = diag.location?.start?.line;
    if (classifyDiagnosticKind(diag.ruleId) !== 'GENERAL_CODE_ERROR' || line === undefined) {
      groups.push([diag]);
      continue;
    }
    const key = `${diag.filePath}::${line}`;
    const existingIndex = groupIndexByKey.get(key);
    if (existingIndex === undefined) {
      groupIndexByKey.set(key, groups.length);
      groups.push([diag]);
    } else {
      groups[existingIndex].push(diag);
    }
  }

  return groups;
}

/**
 * Finds the group containing a diagnostic matching `target` (by ruleId + exact start line/column --
 * precise enough to disambiguate multiple GENERAL_CODE_ERROR diagnostics that happen to share a
 * ruleId, e.g. two separate TS2304 errors on different lines) and returns ONE representative
 * DiagnosticReport for that group: `target` itself, unchanged, except for `relatedDiagnostics`
 * populated with every OTHER member's {ruleId, message} (empty/undefined when the group has no
 * other members -- the common case). Returns `target` completely unmodified when no matching group
 * is found (e.g. `allDiagnostics` is stale or doesn't actually contain `target`) -- never invents
 * relatedDiagnostics from a guess.
 */
export function buildRepresentativeDiagnostic(target: DiagnosticReport, allDiagnostics: DiagnosticReport[]): DiagnosticReport {
  const groups = groupGeneralCodeErrorDiagnostics(allDiagnostics);
  const ownGroup = groups.find((g) =>
    g.some(
      (d) =>
        d.ruleId === target.ruleId &&
        d.filePath === target.filePath &&
        d.location?.start?.line === target.location?.start?.line &&
        d.location?.start?.column === target.location?.start?.column
    )
  );
  if (!ownGroup || ownGroup.length <= 1) {
    return target;
  }
  const related = ownGroup
    .filter(
      (d) =>
        !(
          d.ruleId === target.ruleId &&
          d.location?.start?.line === target.location?.start?.line &&
          d.location?.start?.column === target.location?.start?.column
        )
    )
    .map((d) => ({ ruleId: d.ruleId, message: d.message, location: d.location }));
  if (related.length === 0) {
    return target;
  }
  return { ...target, relatedDiagnostics: related };
}
