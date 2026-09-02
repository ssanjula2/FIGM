import test from 'node:test';
import assert from 'node:assert/strict';
import { doubleValue } from '../src/engine/sandbox-test-stage-fixture.js';

/** See src/engine/sandbox-test-stage-fixture.ts — dedicated fixture pair for
 *  tests/sandbox-validation-pipeline.test.ts's TEST-stage PASS/FAIL proof. */
test('sandbox test-stage fixture: doubleValue doubles its input', () => {
  assert.equal(doubleValue(2), 4);
  assert.equal(doubleValue(0), 0);
  assert.equal(doubleValue(-3), -6);
});
