/**
 * FIGM System Adversarial User Code Detection Test Suite
 * Phase 2 & Phase 14 Forensic Verification
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine.js';
import { RemediationEngine } from '../src/engine/remediation-engine.js';
import { ComplexityEngine } from '../src/analysis/complexity/complexity-engine.js';

describe('Adversarial User Code Detection Suite', () => {
  // A. SYNTAX ERRORS
  describe('A. Syntax Error Detection', () => {
    test('must produce SYNTAX_ERROR diagnostic when given unclosed assignment const x = ;', () => {
      const code = `const x = ;`;
      const res = RuleExecutionEngine.analyzeFile('broken.tsx', code);
      assert.ok(res.diagnostics.length > 0);
      const syntaxDiag = res.diagnostics.find((d) => d.category === 'SYNTAX_ERROR' || d.ruleId === 'SYNTAX-PARSE-ERROR');
      assert.ok(syntaxDiag);
      assert.equal(syntaxDiag?.line, 1);
    });

    test('must produce SYNTAX_ERROR diagnostic for unclosed function body', () => {
      const code = `function broken( {`;
      const res = RuleExecutionEngine.analyzeFile('broken_func.ts', code);
      assert.ok(res.diagnostics.length > 0);
      const syntaxDiag = res.diagnostics.find((d) => d.category === 'SYNTAX_ERROR');
      assert.ok(syntaxDiag);
    });

    test('must produce SYNTAX_ERROR diagnostic for unclosed object literal', () => {
      const code = `const data = {`;
      const res = RuleExecutionEngine.analyzeFile('broken_obj.ts', code);
      assert.ok(res.diagnostics.length > 0);
      const syntaxDiag = res.diagnostics.find((d) => d.category === 'SYNTAX_ERROR');
      assert.ok(syntaxDiag);
    });
  });

  // B. TYPESCRIPT TYPE ERRORS
  describe('B. TypeScript Compiler Diagnostics', () => {
    test('must produce TYPE_COMPILE_ERROR for string assignment to number type', () => {
      const code = `const age: number = "twenty";`;
      const res = RuleExecutionEngine.analyzeFile('type_mismatch.ts', code);
      const typeDiag = res.diagnostics.find((d) => d.category === 'TYPE_COMPILE_ERROR');
      assert.ok(typeDiag);
      assert.ok(typeDiag?.ruleId.includes('TYPE-TS-'));
    });

    test('must provide project context disclaimer for standalone file type checking', () => {
      const code = `const age: number = "twenty";`;
      const res = RuleExecutionEngine.analyzeFile('type_mismatch.ts', code);
      assert.ok(res.typeCheckDisclaimer?.includes('Project context unavailable'));
    });
  });

  // C. REACT VIOLATIONS
  describe('C. React Guideline Violations', () => {
    test('must detect direct state mutation (FIGM-REACT-03)', () => {
      // Includes a real useState binding for `user` -- the fix that closed FIGM-REACT-03's
      // over-broad property-assignment false positives (confirmed live on real-world code:
      // Button.defaultProps=, module.exports=, ctx.fillStyle=, none of them React state) now
      // requires positive evidence the mutated identifier is actually state before firing, so a
      // bare `user.profile.active = true` with no useState/setter/this.state anywhere in the file
      // is (correctly) no longer flagged. This fixture is updated to test the rule's real intent:
      // a genuine React state variable mutated directly instead of via its setter.
      const code = `
        import { useState } from 'react';
        function UserProfile({ initialUser }) {
          const [user, setUser] = useState(initialUser);
          const handleClick = () => {
            user.profile.active = true;
          };
          return <button onClick={handleClick}>Update</button>;
        }
      `;
      const res = RuleExecutionEngine.analyzeFile('Component.tsx', code);
      const mutationDiag = res.diagnostics.find((d) => d.ruleId === 'FIGM-REACT-03');
      assert.ok(mutationDiag);
    });

    test('must detect invariant object allocation inside loops (FIGM-PERF-01)', () => {
      const code = `
        function List({ items }) {
          return (
            <div>
              {items.map(item => {
                const config = { theme: 'dark', padding: 12 };
                return <span style={config} key={item.id}>{item.name}</span>;
              })}
            </div>
          );
        }
      `;
      const res = RuleExecutionEngine.analyzeFile('List.tsx', code);
      const perfDiag = res.diagnostics.find((d) => d.ruleId === 'FIGM-PERF-01');
      assert.ok(perfDiag);
    });
  });

  // D. NEXT.JS VIOLATIONS
  describe('D. Next.js Guidelines', () => {
    test('must detect un-dimensioned img tags (FIGM-PERF-02)', () => {
      const code = `
        export default function Page() {
          return <img src="/banner.jpg" alt="Banner" />;
        }
      `;
      const res = RuleExecutionEngine.analyzeFile('page.tsx', code);
      const imgDiag = res.diagnostics.find((d) => d.ruleId === 'FIGM-PERF-02');
      assert.ok(imgDiag);
    });
  });

  // E. VUE SUPPORT
  describe('E. Vue SFC Support', () => {
    test('must detect framework as VUE_SFC and parse Vue component', () => {
      const code = `
        <template>
          <div @click="handleClick">Open</div>
        </template>
        <script>
        export default {
          methods: {
            handleClick() {}
          }
        }
        </script>
      `;
      const res = RuleExecutionEngine.analyzeFile('Card.vue', code);
      assert.equal(res.framework, 'VUE_SFC');
    });
  });

  // F. ACCESSIBILITY
  describe('F. Web Accessibility Rules (WCAG 2.2)', () => {
    test('must detect non-interactive click handler without keyboard listener (FIGM-A11Y-01)', () => {
      const code = `
        export function Nav() {
          return <div onClick={() => alert('open')}>Open Menu</div>;
        }
      `;
      const res = RuleExecutionEngine.analyzeFile('Nav.tsx', code);
      const a11yDiag = res.diagnostics.find((d) => d.ruleId === 'FIGM-A11Y-01');
      assert.ok(a11yDiag);
    });
  });

  // G. COMPLEXITY ENGINE
  describe('G. Dynamic Code Complexity Engine', () => {
    test('must calculate cyclomatic complexity and nesting depth for complex control flow', () => {
      const code = `
        function evaluate(a, b, c) {
          if (a > 0) {
            for (let i = 0; i < 10; i++) {
              if (b && c) {
                while (c > 0) {
                  c--;
                }
              }
            }
          } else {
            switch(b) {
              case 1: break;
              case 2: break;
            }
          }
          return a + b;
        }
      `;
      const res = RuleExecutionEngine.analyzeFile('evaluate.ts', code);
      assert.ok(res.complexity.cyclomaticComplexity > 3);
    });
  });

  // H. AI PATCH REMEDIATION VALIDATION
  describe('H. AI Patch Remediation & Validation Loop', () => {
    test('must validate proposed quick-fix patch and set status to FIXED', () => {
      const code = `
        export function List({ items }) {
          return (
            <div>
              {items.map(item => {
                const config = { theme: 'dark' };
                return <span style={config}>{item.name}</span>;
              })}
            </div>
          );
        }
      `;
      const res = RuleExecutionEngine.analyzeFile('List.tsx', code);
      const perfDiag = res.diagnostics.find((d) => d.ruleId === 'FIGM-PERF-01');
      assert.ok(perfDiag);

      if (perfDiag) {
        const patchRes = RemediationEngine.applyQuickFix(code, perfDiag);
        const valRes = RemediationEngine.validatePatch(code, patchRes.remediatedCode, perfDiag);
        assert.equal(valRes.isValid, true);
        assert.equal(valRes.status, 'FIXED');
      }
    });
  });
});
