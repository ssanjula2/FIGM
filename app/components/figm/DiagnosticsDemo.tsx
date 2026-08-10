"use client";

import { useState } from 'react';
import { Section, SectionHeading, Reveal, Tag } from './primitives';
import { cn } from '../../lib/utils';

const BUCKETS = [
  { label: 'All', count: 12 },
  { label: 'Critical', count: 1 },
  { label: 'High', count: 4 },
  { label: 'Medium', count: 5 },
  { label: 'Low', count: 2 },
];

export function DiagnosticsDemo() {
  const [active, setActive] = useState('All');

  return (
    <Section id="diagnostics">
      <SectionHeading
        eyebrow="Diagnostics"
        title="Find the problem. Understand the problem. Fix the problem."
        subtitle="Every finding carries its domain, concern, primitive, and location — so a diagnostic is an explanation, not just a warning."
      />

      <Reveal className="panel mt-12 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
          <span className="mono-label">Inspector</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            workspace/storefront · scan #418
          </span>
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-success">
            <span className="size-1.5 rounded-full bg-success pulse-dot" aria-hidden="true" />
            Analysis ready
          </span>
        </div>

        <div className="grid lg:grid-cols-[220px_1fr]">
          <nav aria-label="Diagnostic severity" className="border-b border-border p-3 lg:border-r lg:border-b-0">
            <p className="mono-label px-2 pb-2">Diagnostics</p>
            <ul className="space-y-1">
              {BUCKETS.map((b) => (
                <li key={b.label}>
                  <button
                    type="button"
                    aria-current={active === b.label ? 'true' : undefined}
                    onClick={() => setActive(b.label)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-2 py-1.5 font-mono text-[12px] transition-colors',
                      active === b.label
                        ? 'bg-primary/12 text-primary'
                        : 'text-subtle hover:bg-secondary hover:text-foreground',
                    )}
                  >
                    <span>{b.label}</span>
                    <span className="text-muted-foreground">{b.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[12.5px] text-primary">FIGM-PERF-02</span>
              <Tag tone="danger">High</Tag>
            </div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">
              Provide explicit image width and height
            </h3>
            <p className="mt-1 font-mono text-[11.5px] text-muted-foreground">
              components/Hero.tsx:42
            </p>

            <dl className="mt-5 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
              {[
                ['Severity', 'HIGH'],
                ['Domain', 'Performance Efficiency'],
                ['Concern', 'Layout Instability'],
              ].map(([k, v]) => (
                <div key={k} className="bg-surface-2 px-4 py-3">
                  <dt className="mono-label">{k}</dt>
                  <dd className="mt-1 font-mono text-[12px] text-foreground">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 space-y-4 text-[14px] leading-relaxed">
              <div>
                <p className="mono-label">Explanation</p>
                <p className="mt-1 text-subtle">
                  Undimensioned media can cause layout instability during page rendering.
                </p>
              </div>
              <div>
                <p className="mono-label">Suggested remediation</p>
                <p className="mt-1 text-subtle">Add explicit width and height constraints.</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-[13px] text-foreground transition-colors hover:bg-secondary"
              >
                View source
              </button>
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Apply fix
              </button>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Ignore rule
              </button>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}