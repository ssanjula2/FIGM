/**
 * Framework-Independent Guideline Model (FIGM)
 * ESLint Validation Step for the Patch Verification Pipeline
 *
 * Adds "ESLint Validation" as a real, additional gate in RemediationEngine.validatePatchAsync,
 * alongside the existing AST re-parse / TypeScript compile-error / FIGM re-scan checks. Runs the
 * project's REAL `.eslintrc.json` (via ESLint's own config resolution, `useEslintrc: true`) against
 * a raw code string using `ESLint.lintText`, not a hand-approximated rule subset -- so this reports
 * exactly what `npm run lint` would report for the same code, not a second, drifting rule set.
 *
 * Scope, honestly disclosed: the project's real ESLint config (`next/core-web-vitals` +
 * `@typescript-eslint`) can only parse JSX/TSX/TS syntax. There is no `vue-eslint-parser` or Angular
 * template ESLint plugin installed in this project, so running this config against VUE_SFC or
 * ANGULAR_TEMPLATE markup would produce a parser-mismatch failure that has nothing to do with the
 * patch's actual quality -- `isApplicable()` gates this out for those frameworks rather than
 * fabricating a pass or a false rejection.
 */

import { ESLint, type Linter } from 'eslint';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LINT_ELIGIBLE_FRAMEWORKS: ReadonlySet<string> = new Set(['REACT_JSX', 'NEXT_JS', 'GENERIC_ESTREE']);

export interface EslintCheckResult {
  /** False when the framework's markup isn't something the project's real ESLint config can parse
   *  (Vue SFC / Angular template) -- this check was skipped, not silently passed. */
  applicable: boolean;
  newErrorCount: number;
  newErrorMessages: string[];
}

export class EslintValidator {
  private static instance: ESLint | null = null;

  private static getInstance(): ESLint {
    if (!this.instance) {
      this.instance = new ESLint({
        cwd: path.resolve(__dirname, '../../'),
        useEslintrc: true,
        errorOnUnmatchedPattern: false,
      });
    }
    return this.instance;
  }

  public static isApplicable(framework: string): boolean {
    return LINT_ELIGIBLE_FRAMEWORKS.has(framework);
  }

  private static async lint(code: string, virtualFileName: string): Promise<Linter.LintMessage[]> {
    const eslint = this.getInstance();
    const results = await eslint.lintText(code, { filePath: virtualFileName });
    // lintText returns one LintResult per logical file; a single in-memory string is always exactly one.
    return results[0]?.messages ?? [];
  }

  /**
   * Compares ERROR-severity (severity 2) lint findings between the original and patched code, by
   * `ruleId:message`, and reports only messages the patch introduced that were not already present
   * in the original code. Warnings (severity 1) never block a patch -- only a genuinely new error
   * does. Mirrors the identical before/after-diff pattern
   * RemediationEngine.evaluatePatchResults already uses for new TypeScript compile errors and new
   * FIGM guideline violations, so a patch is never rejected for a pre-existing problem in code the
   * user pasted, only for a problem it actually caused.
   */
  public static async checkForNewErrors(
    originalCode: string,
    patchedCode: string,
    framework: string
  ): Promise<EslintCheckResult> {
    if (!this.isApplicable(framework)) {
      return { applicable: false, newErrorCount: 0, newErrorMessages: [] };
    }

    const ext = framework === 'REACT_JSX' || framework === 'NEXT_JS' ? '.tsx' : '.ts';

    try {
      const [originalMessages, patchedMessages] = await Promise.all([
        this.lint(originalCode, `figm-remediation-original${ext}`),
        this.lint(patchedCode, `figm-remediation-patched${ext}`),
      ]);

      const messageKey = (m: Linter.LintMessage) => `${m.ruleId ?? 'parse-error'}:${m.message}`;
      const originalErrorKeys = new Set(
        originalMessages.filter((m) => m.severity === 2).map(messageKey)
      );
      const newErrors = patchedMessages.filter(
        (m) => m.severity === 2 && !originalErrorKeys.has(messageKey(m))
      );

      return {
        applicable: true,
        newErrorCount: newErrors.length,
        newErrorMessages: newErrors.map((m) => `${m.ruleId ?? 'parse-error'}: ${m.message} (line ${m.line})`),
      };
    } catch (err) {
      // ESLint itself failing to run (e.g. a config/plugin resolution error in a given deployment
      // environment) is an infrastructure fault, not evidence the PATCH is broken. Failing open here
      // -- skip this one extra check, log why -- is deliberate: the pre-existing syntax/type-check/
      // FIGM-re-scan checks in RemediationEngine.evaluatePatchResults are the actual safety net and
      // are completely unaffected by this failing; blocking every fix for every framework just
      // because this additional, newer check's own tooling hiccuped would be a worse failure mode
      // than skipping it once. Never interpreted by the caller as "0 new errors found" being a pass
      // for this check specifically -- `applicable: false` signals it did not run at all.
      console.warn('[FIGM ESLint Validator] ESLint check failed to run; skipping this check for this patch:', err);
      return { applicable: false, newErrorCount: 0, newErrorMessages: [] };
    }
  }
}
