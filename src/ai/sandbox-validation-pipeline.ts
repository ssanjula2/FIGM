/**
 * Framework-Independent Guideline Model (FIGM)
 * Sandbox Validation Pipeline — Layer 2 AI patch gatekeeper
 *
 * AI-generated code is NEVER accepted directly. Every candidate patch from src/ai/claude-client.server.ts
 * must pass through here first:
 *
 *   create isolated copy → syntax check → patch-scope check → framework structural check →
 *   compile + FIGM re-scan → associated test (if one exists) → accept only if every stage passes
 *
 * Framework structural check runs BEFORE compile+rescan (not after) so that for Vue SFC/Angular
 * inline-template patches, the dedicated structural parser (@vue/compiler-sfc / angular-html-parser)
 * is the stage that actually catches and explains a malformed template, rather than an earlier,
 * more generic re-scan rejecting it first for an unrelated/opaque reason and leaving this stage
 * unreached. For React/Next.js/generic JS/TS this stage is NOT_APPLICABLE (the compile check next
 * door already covers structural validity there), so the reordering has no effect on those.
 *
 * "Isolated copy" is a REAL file written under the OS temp directory (fs.mkdtempSync), not just an
 * in-memory string — the patch is validated against what would actually be written to disk,
 * cleaned up unconditionally afterward. Rejects on the first failing stage; a rejected patch is
 * never written back to the caller's file.
 *
 * Honest scope on two of the requested stages, stated plainly rather than faked:
 *
 *   - "Framework build": FIGM validates individual files/snippets, not whole scaffolded projects —
 *     there is no `next build`/`ng build`/`vue-cli-service build` to run against an arbitrary
 *     pasted component with no surrounding project. What this stage actually runs is each
 *     framework's real structural parser: @vue/compiler-sfc for Vue SFCs, angular-html-parser for
 *     an Angular component's inline template, and (for React/Next.js/generic JS/TS) the
 *     TypeScript compile check already performed in the previous stage — that check IS this
 *     framework's structural validation for a single file, not an omitted step.
 *   - "Tests": there is no way to know what tests apply to an arbitrary pasted snippet (the common
 *     live-scan/API case) — this stage is NOT_APPLICABLE there, not silently skipped-and-claimed-
 *     passing. When `defect.filePath` names a REAL file in this repository that has a co-located
 *     `tests/<name>.test.ts`, that file is actually executed (via `node --import tsx --test`) in a
 *     subprocess against the patched source, and its real exit code decides PASS/FAIL.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ts from 'typescript';
import { spawnSync } from 'child_process';
import { parse as parseVueSfc } from '@vue/compiler-sfc';
import { parseHtml } from 'angular-html-parser';
import { DiagnosticReport } from '../types/ast-spec.js';
import { RemediationValidator, PatchValidationResult } from '../engine/remediation-validation.server.js';

export type SandboxStageName = 'ISOLATION' | 'SYNTAX' | 'PATCH_SCOPE' | 'COMPILE_AND_RESCAN' | 'FRAMEWORK_STRUCTURAL' | 'TEST';

export interface SandboxStageResult {
  stage: SandboxStageName;
  status: 'PASS' | 'FAIL' | 'NOT_APPLICABLE';
  detail: string;
}

export interface SandboxValidationResult {
  accepted: boolean;
  stages: SandboxStageResult[];
  rejectionReason?: string;
  /** The underlying compile/re-scan result, when that stage ran — carries the same
   *  FIXED/PATCH_REJECTED/UNRESOLVED/MANUAL_REVIEW_REQUIRED status the rest of the pipeline uses. */
  patchValidation?: PatchValidationResult;
}

export class SandboxValidationPipeline {
  /**
   * Runs an AI-generated patch through every gate above. Never throws: any unexpected internal
   * failure is caught and reported as a FAILed stage, so a pathological patch degrades to
   * "rejected," never a crashed request — matching this codebase's resilience contract for every
   * other real-AST/validation module.
   */
  public static async validate(
    originalCode: string,
    patchedCode: string,
    defect: DiagnosticReport,
    framework: string
  ): Promise<SandboxValidationResult> {
    const stages: SandboxStageResult[] = [];
    let tmpDir: string | undefined;

    try {
      // Stage 1 — create a REAL isolated copy on disk, not just an in-memory string.
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'figm-sandbox-'));
      const ext = path.extname(defect.filePath || '') || '.tsx';
      const sandboxFilePath = path.join(tmpDir, `patched${ext}`);
      fs.writeFileSync(sandboxFilePath, patchedCode, 'utf8');
      stages.push({ stage: 'ISOLATION', status: 'PASS', detail: `Patched code written to an isolated temp file (${sandboxFilePath}) for out-of-process validation.` });

      // Stage 2 — syntax: reparse the ON-DISK sandbox file (round-tripped through the filesystem,
      // not the original in-memory string) as TSX. Framework-agnostic first pass; Vue/.vue text
      // parsed as TSX will fail here harmlessly (SFC tags aren't valid TS) and fall through to the
      // Vue-specific structural stage below to actually validate it.
      if (framework !== 'VUE_SFC') {
        const sandboxText = fs.readFileSync(sandboxFilePath, 'utf8');
        const sf = ts.createSourceFile(sandboxFilePath, sandboxText, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
        const parseDiagnostics = (sf as unknown as { parseDiagnostics?: ts.DiagnosticWithLocation[] }).parseDiagnostics ?? [];
        if (parseDiagnostics.length > 0) {
          // Diagnostic objects hold a circular reference back to their SourceFile (via `.file` /
          // `.file.statements[...].parent`) -- JSON.stringify-ing one directly throws
          // "Converting circular structure to JSON" rather than reporting the real syntax error,
          // silently turning a genuine SYNTAX rejection into a confusing internal-error rejection.
          // Extracting just the flattened message text avoids the cycle entirely.
          const messages = parseDiagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '));
          stages.push({ stage: 'SYNTAX', status: 'FAIL', detail: `Patched code has ${parseDiagnostics.length} syntax error(s): ${messages.join('; ').slice(0, 300)}` });
          return { accepted: false, stages, rejectionReason: 'Syntax error in AI-generated patch.' };
        }
        stages.push({ stage: 'SYNTAX', status: 'PASS', detail: 'Patched sandbox file parses as valid TypeScript/TSX with zero syntax errors.' });
      } else {
        stages.push({ stage: 'SYNTAX', status: 'NOT_APPLICABLE', detail: 'Vue SFC syntax is validated by the FRAMEWORK_STRUCTURAL stage (@vue/compiler-sfc), not a plain TS reparse.' });
      }

      // Stage 3 — patch scope: reject a patch that rewrites large, unrelated portions of the file
      // instead of the smallest change that resolves the violation (see class doc comment's
      // honest-heuristic disclosure below).
      const scope = SandboxValidationPipeline.checkPatchScope(originalCode, patchedCode);
      stages.push(scope);
      if (scope.status === 'FAIL') {
        return { accepted: false, stages, rejectionReason: `Patch scope check failed: ${scope.detail}` };
      }

      // Stage 4 — framework structural check (see class doc comment for exact, honest scope).
      // Runs BEFORE the generic compile+rescan stage so it is the authoritative gate for
      // frameworks (Vue SFC, Angular inline template) whose real structural parser it calls --
      // for React/Next.js/generic JS/TS it is NOT_APPLICABLE here (the compile check next door
      // already covers structural validity for those), so this reordering is a no-op for them.
      // Previously this ran AFTER compile+rescan, which meant a malformed Vue/Angular patch was
      // usually rejected first by the generic re-scan (a real but non-specific PATCH_REJECTED),
      // and this dedicated structural stage — the one actually built to explain *why* the
      // template itself doesn't parse — never got to run, making it effectively dead code for the
      // exact malformed-template case it exists to catch.
      const structural = SandboxValidationPipeline.frameworkStructuralCheck(patchedCode, framework);
      stages.push(structural);
      if (structural.status === 'FAIL') {
        return { accepted: false, stages, rejectionReason: `Framework structural validation failed: ${structural.detail}` };
      }

      // Stage 5 — real compile check + FIGM re-scan (reuses RemediationValidator: isolated
      // TypeCheckerService compile diagnostics, RuleExecutionEngine re-scan, ESLint cross-check).
      // This is the same authoritative validator every deterministic Layer-1 engine's own patches
      // go through — AI patches get no lighter a check.
      const patchValidation = await RemediationValidator.validatePatchAsync(originalCode, patchedCode, defect);
      if (!patchValidation.isValid) {
        stages.push({
          stage: 'COMPILE_AND_RESCAN',
          status: 'FAIL',
          detail: `status=${patchValidation.status}${patchValidation.rejectionReason ? `: ${patchValidation.rejectionReason}` : ''}`,
        });
        return { accepted: false, stages, rejectionReason: `Compile/type-check or FIGM re-scan rejected the patch (${patchValidation.status}).`, patchValidation };
      }
      stages.push({
        stage: 'COMPILE_AND_RESCAN',
        status: 'PASS',
        detail: 'TypeScript compile check + FIGM re-scan confirm the original violation is resolved with no new syntax, type, or guideline violations.',
      });

      // Stage 6 — associated test file, only when `defect.filePath` names a real file in this
      // repository with a real co-located test (see class doc comment).
      const testStage = SandboxValidationPipeline.runAssociatedTestIfPresent(defect.filePath, patchedCode);
      stages.push(testStage);
      if (testStage.status === 'FAIL') {
        return { accepted: false, stages, rejectionReason: `The associated test file failed against the patched code: ${testStage.detail}`, patchValidation };
      }

      return { accepted: true, stages, patchValidation };
    } catch (err) {
      // A catch-all for a genuinely unexpected internal failure at any stage (not specifically
      // isolation setup) — tagged ISOLATION only because SandboxStageName has no generic/unknown
      // member; the detail text is what actually says what happened.
      stages.push({ stage: 'ISOLATION', status: 'FAIL', detail: `Sandbox validation threw unexpectedly: ${err instanceof Error ? err.message : String(err)}` });
      return { accepted: false, stages, rejectionReason: 'Sandbox validation failed unexpectedly — rejecting rather than risking an unverified patch.' };
    } finally {
      if (tmpDir) {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
          // Best-effort cleanup only; a leftover temp dir is not a correctness issue.
        }
      }
    }
  }

  /**
   * Heuristic "minimal patch" guard: rejects a patch that changes an implausibly large fraction of
   * the file's lines, the observable symptom of a full-file rewrite rather than a scoped fix. This
   * is a real, honestly-bounded heuristic, not a semantic diff — it cannot tell a genuinely large
   * *necessary* change from an unnecessary one, only flag patches whose sheer SIZE looks like a
   * rewrite. Skipped (NOT_APPLICABLE) for files too small for a ratio to be meaningful, or too
   * large for the O(n·m) LCS computation below to be worth it.
   */
  private static checkPatchScope(originalCode: string, patchedCode: string): SandboxStageResult {
    // Strip at most ONE trailing newline from each side before splitting — a real, reproduced
    // measurement bug, not a threshold change: response-parser.ts's stripMarkdownFences() always
    // .trim()s the model's returned patch (so it never carries a trailing newline), while
    // `originalCode` is the caller's raw source, almost always trailing-newline-terminated as any
    // normal file is. Splitting both as-is therefore compares an original array with one extra
    // trailing "" element against a patched array without one — a difference in whether the file
    // happens to end with a newline, not in its actual content — which this LCS diff then counts as
    // a changed/removed line on BOTH the removed-from-original and total-line-count sides. On a
    // small file this alone can be the deciding vote: reproduced live (FIGM-A11Y-01, an 8-line
    // fixture) where a genuinely minimal, 2-line-different fix measured as "5 of 8 lines (63%)" —
    // over the 60% ceiling — purely from this artifact; renormalized, the SAME patch measures 4 of 7
    // (57%), correctly within it. This never changes MAX_CHANGED_RATIO and never affects a patch
    // whose original/patched trailing-newline presence already agreed (the overwhelmingly common
    // case), since removing an absent trailing newline is a no-op.
    const originalLines = originalCode.replace(/\n$/, '').split('\n');
    const patchedLines = patchedCode.replace(/\n$/, '').split('\n');
    const totalLines = Math.max(originalLines.length, patchedLines.length);

    const MIN_LINES_TO_CHECK = 6;
    const MAX_LINES_FOR_LCS = 2000;
    const MAX_CHANGED_RATIO = 0.6;

    if (totalLines < MIN_LINES_TO_CHECK) {
      return { stage: 'PATCH_SCOPE', status: 'NOT_APPLICABLE', detail: `File has only ${totalLines} line(s) — too small for a meaningful change-ratio check.` };
    }
    if (originalLines.length > MAX_LINES_FOR_LCS || patchedLines.length > MAX_LINES_FOR_LCS) {
      return { stage: 'PATCH_SCOPE', status: 'NOT_APPLICABLE', detail: `File exceeds ${MAX_LINES_FOR_LCS} lines — skipped to avoid an expensive full diff.` };
    }

    const commonLines = SandboxValidationPipeline.longestCommonSubsequenceLength(originalLines, patchedLines);
    const changedLines = originalLines.length - commonLines + (patchedLines.length - commonLines);
    const changedRatio = changedLines / totalLines;

    if (changedRatio > MAX_CHANGED_RATIO) {
      return {
        stage: 'PATCH_SCOPE',
        status: 'FAIL',
        detail: `Patch changed/added/removed ${changedLines} of ${totalLines} lines (${Math.round(changedRatio * 100)}%), exceeding the ${Math.round(MAX_CHANGED_RATIO * 100)}% minimal-patch threshold — looks like a broader rewrite rather than a scoped fix for one violation.`,
      };
    }
    return {
      stage: 'PATCH_SCOPE',
      status: 'PASS',
      detail: `Patch changed/added/removed ${changedLines} of ${totalLines} lines (${Math.round(changedRatio * 100)}%), within the ${Math.round(MAX_CHANGED_RATIO * 100)}% minimal-patch threshold.`,
    };
  }

  /** Standard O(n·m) dynamic-programming LCS length over lines — used only to size how much of the
   *  file actually changed, not to compute or apply a diff. */
  private static longestCommonSubsequenceLength(a: string[], b: string[]): number {
    const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp[a.length][b.length];
  }

  private static frameworkStructuralCheck(patchedCode: string, framework: string): SandboxStageResult {
    if (framework === 'VUE_SFC') {
      try {
        const { errors } = parseVueSfc(patchedCode, { filename: 'sandbox.vue' });
        if (errors.length > 0) {
          return { stage: 'FRAMEWORK_STRUCTURAL', status: 'FAIL', detail: `@vue/compiler-sfc reported ${errors.length} error(s): ${errors.map((e) => String(e)).join('; ').slice(0, 300)}` };
        }
        return { stage: 'FRAMEWORK_STRUCTURAL', status: 'PASS', detail: 'Patched Vue SFC parses cleanly via @vue/compiler-sfc (template + script block structure intact).' };
      } catch (err) {
        return { stage: 'FRAMEWORK_STRUCTURAL', status: 'FAIL', detail: `@vue/compiler-sfc threw: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    if (framework === 'ANGULAR_TEMPLATE') {
      const inlineTemplate = SandboxValidationPipeline.extractInlineAngularTemplate(patchedCode);
      if (!inlineTemplate) {
        return { stage: 'FRAMEWORK_STRUCTURAL', status: 'NOT_APPLICABLE', detail: 'No inline `template: `...`` block found — nothing beyond the TypeScript class body (already compile-checked) to structurally validate.' };
      }
      try {
        const { errors } = parseHtml(inlineTemplate, { tokenizeAngularBlocks: true });
        if (errors.length > 0) {
          return { stage: 'FRAMEWORK_STRUCTURAL', status: 'FAIL', detail: `angular-html-parser reported ${errors.length} template error(s): ${errors.map((e) => String(e)).join('; ').slice(0, 300)}` };
        }
        return { stage: 'FRAMEWORK_STRUCTURAL', status: 'PASS', detail: 'Patched inline Angular template parses cleanly via angular-html-parser.' };
      } catch (err) {
        return { stage: 'FRAMEWORK_STRUCTURAL', status: 'FAIL', detail: `angular-html-parser threw: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    // REACT_JSX / NEXT_JS / GENERIC_ESTREE: the TypeScript compile check in the previous stage
    // already IS this framework's structural validation for a single file — there is no separate
    // webpack/Next build to run against an arbitrary snippet with no project scaffold.
    return { stage: 'FRAMEWORK_STRUCTURAL', status: 'NOT_APPLICABLE', detail: 'For this framework, the TypeScript compile check (previous stage) is the structural validation — no separate whole-project build applies to a single patched file.' };
  }

  /** Real AST extraction (TypeScript compiler, walking for a @Component decorator's `template`
   *  property) — never a regex over the whole file. Mirrors the identical technique in
   *  src/engine/angular-template-fix-engine.ts's locateTemplateAnchor, kept as its own small local
   *  copy so this module has no dependency on that engine's internals. */
  private static extractInlineAngularTemplate(code: string): string | undefined {
    let sourceFile: ts.SourceFile;
    try {
      sourceFile = ts.createSourceFile('sandbox.component.ts', code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
    } catch {
      return undefined;
    }

    let found: string | undefined;
    const visit = (node: ts.Node) => {
      if (found) return;
      if (ts.isClassDeclaration(node)) {
        const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) : undefined;
        for (const dec of decorators ?? []) {
          if (!ts.isCallExpression(dec.expression) || !ts.isIdentifier(dec.expression.expression) || dec.expression.expression.text !== 'Component') continue;
          const arg = dec.expression.arguments[0];
          if (!arg || !ts.isObjectLiteralExpression(arg)) continue;
          for (const prop of arg.properties) {
            if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'template' && ts.isNoSubstitutionTemplateLiteral(prop.initializer)) {
              found = prop.initializer.text;
            }
          }
        }
      }
      node.forEachChild(visit);
    };
    visit(sourceFile);
    return found;
  }

  /**
   * Runs the real, existing test file for `filePath` against the patched source, ONLY when
   * `filePath` names an actual file inside this project (not a synthetic live-scan/API path like
   * "component.tsx") that has a real co-located `tests/<name>.test.ts`.
   *
   * A test file commonly imports sibling project modules by relative path (`../src/...`), which
   * only resolve correctly if the mirrored layout matches this repo's own `src/`/`tests/` relative
   * structure — so rather than ever mutating the real on-disk project file (a prior version of this
   * method did exactly that: write-in-place, then restore in `finally` — real but genuinely
   * dangerous, since a process kill between the write and the restore would leave a real project
   * file corrupted on disk), this mirrors `src/` and `tests/` into a throwaway overlay directory,
   * applies the patched content ONLY inside that overlay, and runs the test there. `node_modules` is
   * symlinked rather than copied (fast, no package duplication); `package.json`/`tsconfig.json` are
   * copied so `tsx`'s module resolution behaves identically to the real project. The real project
   * tree is never written to at any point in this method.
   */
  private static runAssociatedTestIfPresent(filePath: string | undefined, patchedCode: string): SandboxStageResult {
    if (!filePath) {
      return { stage: 'TEST', status: 'NOT_APPLICABLE', detail: 'No file path associated with this diagnostic.' };
    }
    const projectRoot = process.cwd();
    const absoluteSourcePath = path.resolve(projectRoot, filePath);
    const relativeToRoot = path.relative(projectRoot, absoluteSourcePath);
    if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
      return { stage: 'TEST', status: 'NOT_APPLICABLE', detail: 'File path resolves outside the project root — refusing to touch it.' };
    }
    if (!fs.existsSync(absoluteSourcePath)) {
      return { stage: 'TEST', status: 'NOT_APPLICABLE', detail: `"${filePath}" is not a real file in this project (typical for a pasted/live-scan snippet) — no test suite exists to run.` };
    }

    const baseName = path.basename(filePath).replace(/\.[^.]+$/, '');
    const candidateTestPath = path.join(projectRoot, 'tests', `${baseName}.test.ts`);
    if (!fs.existsSync(candidateTestPath)) {
      return { stage: 'TEST', status: 'NOT_APPLICABLE', detail: `No co-located test file found at tests/${baseName}.test.ts for this real project file.` };
    }

    let overlayDir: string | undefined;
    try {
      overlayDir = fs.mkdtempSync(path.join(os.tmpdir(), 'figm-sandbox-test-'));
      fs.cpSync(path.join(projectRoot, 'src'), path.join(overlayDir, 'src'), { recursive: true });
      fs.cpSync(path.join(projectRoot, 'tests'), path.join(overlayDir, 'tests'), { recursive: true });
      for (const configFile of ['package.json', 'tsconfig.json']) {
        const configSourcePath = path.join(projectRoot, configFile);
        if (fs.existsSync(configSourcePath)) {
          fs.copyFileSync(configSourcePath, path.join(overlayDir, configFile));
        }
      }
      // Directory JUNCTION (not a symlink) — the only kind of directory link Windows allows
      // without elevated/Developer Mode privileges; a no-op distinction on POSIX, where this
      // still creates a plain symlink.
      fs.symlinkSync(path.join(projectRoot, 'node_modules'), path.join(overlayDir, 'node_modules'), 'junction');

      fs.writeFileSync(path.join(overlayDir, relativeToRoot), patchedCode, 'utf8');
      const overlayTestPath = path.join(overlayDir, 'tests', `${baseName}.test.ts`);

      // NODE_TEST_CONTEXT (set by `node --test` on the CURRENT process, e.g. when this pipeline
      // itself runs under this project's own test suite) is inherited by spawnSync's default
      // env — and Node's own test runner then treats the child as a "recursive node:test call"
      // and silently SKIPS running the file entirely, exiting 0 with no tests actually run. That
      // is not a hypothetical: it is exactly what reproduced here (child stderr: "node:test run()
      // is being called recursively within a test file. skipping running files."), which would
      // silently report every patch as passing its test. Stripped explicitly so the nested test
      // process always genuinely runs, regardless of whether this method is itself invoked from
      // inside `node --test`.
      const { NODE_TEST_CONTEXT: _omit, ...childEnv } = process.env;
      const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', overlayTestPath], {
        cwd: overlayDir,
        timeout: 30000,
        encoding: 'utf8',
        env: childEnv,
      });
      if (result.status === 0) {
        return { stage: 'TEST', status: 'PASS', detail: `tests/${baseName}.test.ts passed against the patched source (run against an isolated overlay copy — the real project file was never modified).` };
      }
      return {
        stage: 'TEST',
        status: 'FAIL',
        detail: `tests/${baseName}.test.ts failed against the patched source (exit code ${result.status}): ${(result.stdout || result.stderr || '').slice(-500)}`,
      };
    } catch (err) {
      return { stage: 'TEST', status: 'FAIL', detail: `Could not run the associated test: ${err instanceof Error ? err.message : String(err)}` };
    } finally {
      if (overlayDir) {
        try {
          fs.rmSync(overlayDir, { recursive: true, force: true });
        } catch {
          // Best-effort cleanup only; a leftover temp dir is not a correctness issue.
        }
      }
    }
  }
}
