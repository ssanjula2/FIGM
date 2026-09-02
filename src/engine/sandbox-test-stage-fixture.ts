/**
 * Framework-Independent Guideline Model (FIGM)
 * Fixture ONLY for tests/sandbox-validation-pipeline.test.ts's TEST-stage PASS/FAIL proof.
 *
 * SandboxValidationPipeline's TEST stage runs a real project file's real co-located test as a real
 * subprocess when both exist — this pair (this file + tests/sandbox-test-stage-fixture.test.ts) is
 * a small, dedicated, harmless target for that, so the mechanism itself is proven against a real
 * file+test on disk instead of only against its NOT_APPLICABLE branches. Not used by any FIGM rule
 * engine, detector, or fixer.
 */
export function doubleValue(n: number): number {
  return n * 2;
}
