import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SourceParser } from '../src/parser/source-parser.js';

/**
 * Closure of the forensic-audit Section 12 MEDIUM finding: the React/generic framework-detection
 * hint used unguarded bare substring matching (`.includes('usestate')`, `'jsx'`, `'reactdom'`,
 * `'usecallback'`, `'usememo'`, `'useeffect'`) with no identifier-boundary or call-syntax check --
 * empirically reproduced 6/6 false positives on plain vanilla `.ts` files whose only "React-like"
 * content was an identifier name that happened to contain one of these substrings. Same bug class
 * already fixed for the Angular hint in the same function; this closes it for React/generic too.
 * All fixtures below use a `.ts` extension deliberately, so the framework MUST be decided by the
 * content hint under test, not by a `.jsx`/`.tsx` extension shortcut.
 */
describe('Framework detection: React/generic hint hardening (audit Section 12)', () => {
  describe('false positives that must be closed', () => {
    const falsePositiveFixtures: Array<{ label: string; code: string }> = [
      { label: 'myUseStateHelper(x) -- contains "usestate" mid-identifier', code: 'function myUseStateHelper(x: number) { return x + 1; }' },
      { label: 'enableJsxLikeSyntax(flag) -- contains "jsx" mid-identifier', code: 'function enableJsxLikeSyntax(flag: boolean) { return flag; }' },
      { label: 'class ReactDomLikeRenderer -- contains "reactdom" at the start of an identifier', code: 'class ReactDomLikeRenderer { render() { return 1; } }' },
      { label: 'useCallbackWhenDone(cb) -- contains "usecallback" as a prefix, not a call', code: 'function useCallbackWhenDone(cb: () => void) { cb(); }' },
      { label: 'abusememoryleakDetector() -- contains "usememo" mid-identifier', code: 'function abusememoryleakDetector() { return true; }' },
      { label: 'useEffectiveRate(base) -- contains "useeffect" as a prefix, not a call', code: 'function useEffectiveRate(base: number) { return base * 1.1; }' },
    ];

    for (const { label, code } of falsePositiveFixtures) {
      it(`does NOT classify "${label}" as REACT_JSX`, () => {
        const res = SourceParser.parseSource(code, 'src/plain-utility.ts');
        assert.notEqual(res.framework, 'REACT_JSX', `expected NOT REACT_JSX for: ${label}`);
        assert.equal(res.framework, 'GENERIC_ESTREE');
      });
    }
  });

  describe('genuine React signals must still be detected (no regression)', () => {
    it('detects `import React from "react"` on a .ts file with no JSX', () => {
      const code = `import React from 'react';\nexport const noop = () => React;`;
      const res = SourceParser.parseSource(code, 'src/no-jsx-import.ts');
      assert.equal(res.framework, 'REACT_JSX');
    });

    it('detects a real useState(...) call', () => {
      const code = `import { useState } from 'react';\nfunction useCounter() { const [n, setN] = useState(0); return n; }`;
      const res = SourceParser.parseSource(code, 'src/use-counter.ts');
      assert.equal(res.framework, 'REACT_JSX');
    });

    it('detects a real useEffect(...) call', () => {
      const code = `import { useEffect } from 'react';\nfunction sync() { useEffect(() => {}, []); }`;
      const res = SourceParser.parseSource(code, 'src/sync.ts');
      assert.equal(res.framework, 'REACT_JSX');
    });

    it('detects `require("react-dom")`', () => {
      const code = `const ReactDOM = require('react-dom');\nReactDOM.render(null, null);`;
      const res = SourceParser.parseSource(code, 'src/legacy-render.ts');
      assert.equal(res.framework, 'REACT_JSX');
    });

    it('detects a real ReactDOM.render(...) member-call shape', () => {
      const code = `import ReactDOM from 'react-dom';\nfunction mount() { ReactDOM.render(null, document.body); }`;
      const res = SourceParser.parseSource(code, 'src/mount.ts');
      assert.equal(res.framework, 'REACT_JSX');
    });

    it('.jsx extension alone is still sufficient regardless of content', () => {
      const code = `export function Empty() { return null; }`;
      const res = SourceParser.parseSource(code, 'src/Empty.jsx');
      assert.equal(res.framework, 'REACT_JSX');
    });
  });
});
