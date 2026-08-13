import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine.js';
import { SourceParser } from '../src/parser/source-parser.js';

/**
 * Phase 4/5 — Hostile-examiner adversarial detection audit.
 *
 * HISTORY: the underlying rule engine originally decided every rule by `String.includes()` on raw
 * trimmed source lines, with no awareness of comments or string literals. This suite (see
 * docs/audit/ADVERSARIAL_DETECTION_AUDIT.md for the full findings writeup) originally caught 7
 * confirmed false positives (comment/string text containing a trigger substring) and 1 confirmed
 * false negative (a real accessibility violation missed because it spanned multiple lines), and
 * pinned each as a "KNOWN LIMITATION" so the bugs were visible rather than silently worked around.
 *
 * All 8 were subsequently root-caused and fixed in src/parser/source-parser.ts:
 *   - A character-level lexer (`stripCommentsAndStrings`) now blanks comment text and non-attribute
 *     string-literal content before any rule trigger is evaluated, while deliberately preserving
 *     real JSX-attribute-value strings (the `identifier="value"` shape) so legitimate attribute
 *     reads are unaffected. This is a structural fix, not a blacklist of specific substrings.
 *   - A brace-depth-aware multi-line tag scan (`scanJsxOpenTagAttrs`) replaced the single-physical-
 *     line check for FIGM-A11Y-01/06, so an element's opening tag and its onClick prop are matched
 *     even when a formatter (e.g. Prettier) puts them on separate lines.
 * This suite now asserts the CORRECTED behavior for every one of those 8 cases (previously-skipped
 * "KNOWN LIMITATION" labels removed), so a regression back to the old behavior fails the suite.
 */
describe('Phase 4/5: Adversarial Hostile-Examiner Detection Audit', () => {
  function ruleIds(code: string, fileName = 'Adversarial.tsx') {
    return RuleExecutionEngine.analyzeFile(fileName, code).diagnostics.map((d) => d.ruleId);
  }

  describe('A. Comments containing suspicious patterns (should NOT trigger rules)', () => {
    it('a comment mentioning onClick does NOT trigger FIGM-A11Y-01 — CORRECT (no <div/<span present on that line)', () => {
      const code = `
// This component previously used onClick={() => handleClick()} before we refactored it.
export function Widget() {
  return <button onClick={() => {}}>Click</button>;
}
`;
      const ids = ruleIds(code);
      assert.ok(!ids.includes('FIGM-A11Y-01'), 'a <button> is a real interactive element and the comment should not itself trigger A11Y-01');
    });

    it('a comment containing "<img" text does NOT trigger FIGM-PERF-02 — FIXED (was a confirmed false positive)', () => {
      const code = `
// TODO: replace this placeholder, e.g. <img src="x.png" /> needs width/height once design is final.
export function Placeholder() {
  return <div>Coming soon</div>;
}
`;
      const ids = ruleIds(code);
      assert.ok(!ids.includes('FIGM-PERF-02'), 'comment text containing "<img" must not be matched by the real-code detector; there is no real <img> element in this file');
    });

    it('a comment containing "addEventListener" does NOT trigger FIGM-PERF-03 — FIXED (was a confirmed false positive)', () => {
      const code = `
// Historically we called element.addEventListener('click', handler) directly here.
export function Clean() {
  return <div>OK</div>;
}
`;
      const ids = ruleIds(code);
      assert.ok(!ids.includes('FIGM-PERF-03'), 'comment text containing "addEventListener(" must not trigger PERF-03; there is no real listener registration in this file');
    });

    it('a comment containing "localStorage." does NOT trigger FIGM-PERF-06 inside a loop-scope comment — FIXED (was a confirmed false positive)', () => {
      const code = `
function loadAll(ids) {
  return ids.map((id) => {
    // avoid calling localStorage.getItem(id) here directly, use the cached lookup instead
    return cache.get(id);
  });
}
`;
      const ids = ruleIds(code);
      assert.ok(!ids.includes('FIGM-PERF-06'), 'comment text containing "localStorage." inside a loop scope must not trigger PERF-06; there is no real storage access');
    });

    it('a comment containing "key={index}" does NOT trigger FIGM-REACT-02 — FIXED (was a confirmed false positive)', () => {
      const code = `
// Anti-pattern reminder: never write key={index} in a real list, prefer a stable id.
export function List({ items }) {
  return <ul>{items.map((i) => <li key={i.id}>{i.name}</li>)}</ul>;
}
`;
      const ids = ruleIds(code);
      assert.ok(!ids.includes('FIGM-REACT-02'), 'comment text containing "key={index}" must not trigger REACT-02; the real code correctly uses a stable key');
    });

    it('a comment mentioning "@Component" in a plain .ts file does NOT misclassify the framework as Angular — FIXED (was a confirmed false positive)', () => {
      const code = `
// Angular @Component example, ng-template, and trackBy are just documentation prose here.
export function plainTsFunction(x: number): number {
  return x * 2;
}
`;
      const result = SourceParser.parseSource(code, 'plain.ts');
      assert.equal(result.framework, 'GENERIC_ESTREE', 'a comment mentioning Angular jargon in a plain .ts file must not itself trigger Angular classification');
    });
  });

  describe('B. String literals containing suspicious patterns (should NOT trigger rules)', () => {
    it('a string literal containing "onClick={() =>" does NOT trigger FIGM-A11Y-01 via a <div> on the same line — FIXED (was a confirmed false positive)', () => {
      const code = `
export function CodeSample() {
  const snippet = "<div onClick={() => doThing()}>example</div>";
  return <pre>{snippet}</pre>;
}
`;
      const ids = ruleIds(code);
      assert.ok(!ids.includes('FIGM-A11Y-01'), 'a string literal containing example JSX-like markup must not trigger A11Y-01; it is display text, not real markup');
    });

    it('a string literal containing "*ngFor=" without trackBy does NOT trigger FIGM-ANG-03 — FIXED (was a confirmed false positive)', () => {
      const code = `
export function DocsSnippet() {
  const example = '<li *ngFor="let item of items">{{item}}</li>';
  return <code>{example}</code>;
}
`;
      const ids = ruleIds(code, 'DocsSnippet.component.ts');
      assert.ok(!ids.includes('FIGM-ANG-03'), 'a string literal containing example Angular template syntax must not trigger ANG-03; there is no real *ngFor directive in this file');
    });
  });

  describe('C. Renamed / aliased identifiers still detected correctly (true positives preserved)', () => {
    it('a directly-mutated state variable is still caught after import aliasing (const { useState: useLocalState })', () => {
      const code = `
import { useState as useLocalState } from 'react';
export function Counter() {
  const [items, setItems] = useLocalState([]);
  items.push(1);
  return <div>{items.length}</div>;
}
`;
      const ids = ruleIds(code);
      assert.ok(ids.includes('FIGM-REACT-03'), 'a renamed useState import should not hide a real direct-mutation violation');
    });

    it('an invariant object allocation inside a renamed loop variable is still caught', () => {
      const code = `
function render(collection) {
  return collection.map((entry) => {
    const style = { color: 'red' };
    return { ...entry, style };
  });
}
`;
      const ids = ruleIds(code);
      assert.ok(ids.includes('FIGM-PERF-01'), 'renaming the loop callback parameter should not hide the real invariant allocation');
    });
  });

  describe('D. Complex real-world syntax should not crash the pipeline and real violations still resolve', () => {
    it('destructuring + optional chaining + nested arrow functions does not crash and detects the real violation present', () => {
      const code = `
export function Panel({ data }: { data?: { items?: Array<{ id: string; active?: boolean }> } }) {
  const active = data?.items?.filter((item) => item?.active) ?? [];
  return (
    <div>
      {active.map((item) => {
        const config = { highlighted: true };
        return <span key={item.id} style={config}>{item.id}</span>;
      })}
    </div>
  );
}
`;
      assert.doesNotThrow(() => RuleExecutionEngine.analyzeFile('Panel.tsx', code));
      const ids = ruleIds(code, 'Panel.tsx');
      assert.ok(ids.includes('FIGM-PERF-01'), 'the real invariant object allocation inside the nested arrow function must still be detected through the optional chaining/destructuring noise');
    });

    it('async function with TypeScript generics and nested try/catch does not crash the pipeline', () => {
      const code = `
async function fetchAll<T extends { id: string }>(urls: string[]): Promise<T[]> {
  const results: T[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      const json: T = await res.json();
      results.push(json);
    } catch (err) {
      console.error('failed', url, err);
    }
  }
  return results;
}
`;
      assert.doesNotThrow(() => RuleExecutionEngine.analyzeFile('fetchAll.ts', code));
    });

    it('multiline JSX with the tag and onClick on separate lines IS now detected by FIGM-A11Y-01 — FIXED (was a confirmed false negative)', () => {
      // A11Y-01's trigger condition originally required BOTH the element tag ("<div") AND "onClick"
      // to appear on the SAME trimmed source line. Real formatted JSX routinely puts the opening tag
      // and its onClick prop on separate lines (as any code formatter / Prettier output would), which
      // that single-line substring check structurally could not see across — a genuine false negative.
      // Fixed via a brace-depth-aware multi-line scan (scanJsxOpenTagAttrs in source-parser.ts) that
      // reads an element's full attribute text across lines up to its real tag-closing ">".
      const code = `
export function Form() {
  return (
    <form>
      <div
        onClick={() => {
          console.log('clicked');
        }}
      >
        Click area
      </div>
    </form>
  );
}
`;
      const ids = ruleIds(code);
      assert.ok(ids.includes('FIGM-A11Y-01'), 'this is a real accessibility violation (non-interactive <div> with onClick, no keyboard handler) spanning multiple lines and must now be detected');
    });

    it('mixed framework-like code (Vue directive syntax inside a .tsx React file) does not crash and does not force-misclassify the framework', () => {
      const code = `
// Some comments here mention v-on:click and v-if just as documentation text for a migration guide.
export function ReactComponent() {
  return <button onClick={() => {}}>Real React button</button>;
}
`;
      assert.doesNotThrow(() => RuleExecutionEngine.analyzeFile('ReactComponent.tsx', code));
      const result = RuleExecutionEngine.analyzeFile('ReactComponent.tsx', code);
      assert.equal(result.framework, 'REACT_JSX', 'a .tsx file with Vue-jargon-only comments should remain classified as REACT_JSX, not be confused into a Vue framework');
    });

    it('a genuinely malformed/truncated source file does not crash and produces a syntax diagnostic instead', () => {
      const code = `export function Broken( {`;
      assert.doesNotThrow(() => RuleExecutionEngine.analyzeFile('Broken.tsx', code));
      const result = RuleExecutionEngine.analyzeFile('Broken.tsx', code);
      assert.ok(result.diagnostics.some((d) => d.category === 'SYNTAX_ERROR'), 'malformed source should surface a SYNTAX_ERROR diagnostic, not silently produce zero diagnostics or throw');
    });
  });

  describe('E. Unrelated, clean code produces zero FIGM violations (no unrelated-code false positives)', () => {
    it('a plain utility module with no framework code and no violations triggers nothing', () => {
      const code = `
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return \`\${value.toFixed(1)} \${units[unitIndex]}\`;
}
`;
      const ids = ruleIds(code, 'utils.ts');
      assert.deepEqual(ids.filter((id) => id.startsWith('FIGM-')), [], 'a clean, framework-agnostic utility file should produce zero FIGM rule violations');
    });
  });
});
