import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SourceParser } from '../src/parser/source-parser.js';

/**
 * Phase 2 — Framework detection audit.
 *
 * NOTE ON SCOPE: SourceParser.detectFramework() has no `UNKNOWN` FrameworkType (the type union is
 * 'GENERIC_ESTREE' | 'REACT_JSX' | 'NEXT_JS' | 'VUE_SFC' | 'ANGULAR_TEMPLATE' | 'SVELTE' — confirmed
 * in src/types/ast-spec.ts). Ambiguous/insufficient-evidence cases are expected to fall through to
 * 'GENERIC_ESTREE' rather than a dedicated unknown bucket; this is a known, documented design
 * limitation (see docs/audit/INITIAL_REPOSITORY_FORENSIC_AUDIT.md §3), not something these tests
 * pretend is fixed. What these tests DO verify is the more important property: an ambiguous file
 * must not be forced into a WRONG specific framework classification.
 */
describe('Phase 2: Framework Detection Audit', () => {
  describe('React', () => {
    it('detects a functional component using hooks + explicit React import as REACT_JSX', () => {
      const code = `
import React, { useState, useEffect } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    document.title = \`Count: \${count}\`;
  }, [count]);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
`;
      const res = SourceParser.parseSource(code, 'src/Counter.jsx');
      assert.equal(res.framework, 'REACT_JSX');
    });

    it('detects a .tsx file with typed props as REACT_JSX purely from extension', () => {
      const code = `
interface Props { label: string; }
export function Label({ label }: Props) {
  return <span>{label}</span>;
}
`;
      const res = SourceParser.parseSource(code, 'src/components/Label.tsx');
      assert.equal(res.framework, 'REACT_JSX');
    });
  });

  describe('Next.js', () => {
    it('detects an App Router page.tsx file as NEXT_JS', () => {
      const code = `
export const metadata = { title: 'Dashboard' };
export default function DashboardPage() {
  return <div>Dashboard</div>;
}
`;
      const res = SourceParser.parseSource(code, 'app/dashboard/page.tsx');
      assert.equal(res.framework, 'NEXT_JS');
    });

    it('detects a Server Component (no "use client", uses next/navigation) as NEXT_JS', () => {
      const code = `
import { redirect } from 'next/navigation';

export default async function ServerOnly({ params }: { params: { id: string } }) {
  if (!params.id) redirect('/');
  return <div>Server rendered {params.id}</div>;
}
`;
      const res = SourceParser.parseSource(code, 'app/items/[id]/ServerOnly.tsx');
      assert.equal(res.framework, 'NEXT_JS');
    });

    it('detects a "use client" component with next/link import as NEXT_JS', () => {
      const code = `
'use client';
import Link from 'next/link';
import { useState } from 'react';

export default function Nav() {
  const [open, setOpen] = useState(false);
  return <nav><Link href="/">Home</Link></nav>;
}
`;
      const res = SourceParser.parseSource(code, 'app/components/Nav.tsx');
      assert.equal(res.framework, 'NEXT_JS');
    });

    it('detects getServerSideProps usage (Pages Router) as NEXT_JS even outside a page.tsx filename', () => {
      const code = `
export async function getServerSideProps() {
  return { props: {} };
}
export default function Home() {
  return <div>Home</div>;
}
`;
      const res = SourceParser.parseSource(code, 'pages/index.tsx');
      assert.equal(res.framework, 'NEXT_JS');
    });
  });

  describe('Angular', () => {
    it('detects a @Component-decorated class as ANGULAR_TEMPLATE', () => {
      const code = `
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-widget',
  template: '<div>{{ title }}</div>',
})
export class WidgetComponent implements OnInit {
  title = 'Widget';
  ngOnInit(): void {
    this.title = 'Loaded';
  }
}
`;
      const res = SourceParser.parseSource(code, 'src/app/widget/widget.component.ts');
      assert.equal(res.framework, 'ANGULAR_TEMPLATE');
    });

    it('detects an Angular component via *.component.ts filename convention alone', () => {
      const code = `
export class PlainHelper {
  compute(a: number, b: number): number {
    return a + b;
  }
}
`;
      const res = SourceParser.parseSource(code, 'src/app/helper/helper.component.ts');
      assert.equal(res.framework, 'ANGULAR_TEMPLATE');
    });
  });

  describe('Vue', () => {
    it('detects a .vue SFC with <template> + <script setup> as VUE_SFC', () => {
      const code = `
<template>
  <div class="banner">{{ message }}</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
const message = ref('Hello Vue');
</script>
`;
      const res = SourceParser.parseSource(code, 'src/components/Banner.vue');
      assert.equal(res.framework, 'VUE_SFC');
    });

    it('detects a .vue SFC purely from file extension even with minimal content', () => {
      const code = `<template><p>Empty</p></template>`;
      const res = SourceParser.parseSource(code, 'src/components/Empty.vue');
      assert.equal(res.framework, 'VUE_SFC');
    });
  });

  describe('Ambiguous / insufficient-evidence cases', () => {
    it('a plain vanilla TS utility file with zero framework signals falls to GENERIC_ESTREE, not a specific framework', () => {
      const code = `
export function sum(a: number, b: number): number {
  return a + b;
}
export function average(nums: number[]): number {
  return nums.reduce((acc, n) => acc + n, 0) / nums.length;
}
`;
      const res = SourceParser.parseSource(code, 'src/lib/math.ts');
      assert.equal(res.framework, 'GENERIC_ESTREE');
    });

    it('a file merely living under an app/ path segment, with no Next.js content evidence, is NOT force-classified as NEXT_JS', () => {
      // Regression guard for the path-substring-only false positive documented in earlier audits.
      const code = `
export function formatCurrency(value: number): string {
  return \`$\${value.toFixed(2)}\`;
}
`;
      const res = SourceParser.parseSource(code, 'app/utils/formatCurrency.ts');
      assert.notEqual(res.framework, 'NEXT_JS');
    });

    it('a comment mentioning "@Component" (Angular jargon) without real Angular code is NOT force-classified as Angular', () => {
      // FIXED: detectFramework() now runs against comment/string-stripped code
      // (stripCommentsAndStrings in source-parser.ts), so a comment containing Angular jargon
      // can no longer force a plain .ts file to misclassify as Angular. Previously pinned as a
      // "KNOWN LIMITATION" active-failure marker; see docs/audit/ADVERSARIAL_DETECTION_AUDIT.md
      // finding #1 for the original false-positive evidence.
      const code = `
// NOTE: see @Component usage in the Angular docs for a similar pattern to this plain function.
export function plainReactLikeHelper() {
  return 42;
}
`;
      const res = SourceParser.parseSource(code, 'src/helpers/plainHelper.ts');
      assert.equal(res.framework, 'GENERIC_ESTREE', 'a comment mentioning Angular jargon in a plain .ts file must not itself trigger Angular classification');
    });

    it('a file with no extension-based or content-based signal at all (empty) still returns a valid FrameworkType, never crashes', () => {
      const res = SourceParser.parseSource('', 'src/unknown/mystery.txt');
      assert.ok(['GENERIC_ESTREE', 'REACT_JSX', 'NEXT_JS', 'VUE_SFC', 'ANGULAR_TEMPLATE', 'SVELTE'].includes(res.framework));
    });
  });
});
