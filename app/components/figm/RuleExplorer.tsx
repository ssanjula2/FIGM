"use client";

import { useMemo, useState } from 'react';
import { Section, SectionHeading, Reveal, Tag } from './primitives';
import { cn } from '../../lib/utils';

type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type Rule = {
  id: string;
  title: string;
  category: 'PERFORMANCE' | 'ACCESSIBILITY' | 'REACT' | 'NEXT.JS' | 'ANGULAR';
  severity: Severity;
  concern: string;
  alp: string;
};

const RULES: Rule[] = [
  { id: 'FIGM-PERF-01', title: 'Avoid invariant allocations inside render loops', category: 'PERFORMANCE', severity: 'MEDIUM', concern: 'Invariant Allocations', alp: 'ALP-LOOP-ALLOC' },
  { id: 'FIGM-PERF-02', title: 'Provide explicit image width and height', category: 'PERFORMANCE', severity: 'HIGH', concern: 'Layout Instability', alp: 'ALP-MEDIA-DIM' },
  { id: 'FIGM-PERF-03', title: 'Defer non-critical third-party scripts', category: 'PERFORMANCE', severity: 'MEDIUM', concern: 'Main Thread Contention', alp: 'ALP-SCRIPT-BLOCK' },
  { id: 'FIGM-PERF-04', title: 'Memoize expensive derived values', category: 'PERFORMANCE', severity: 'LOW', concern: 'Redundant Computation', alp: 'ALP-DERIVED-COMPUTE' },
  { id: 'FIGM-PERF-05', title: 'Avoid inline callbacks in hot subtrees', category: 'PERFORMANCE', severity: 'MEDIUM', concern: 'Reference Instability', alp: 'ALP-INLINE-CALLBACK' },
  { id: 'FIGM-PERF-06', title: 'Virtualize unbounded list rendering', category: 'PERFORMANCE', severity: 'HIGH', concern: 'Render Volume', alp: 'ALP-LIST-UNBOUNDED' },
  { id: 'FIGM-PERF-07', title: 'Avoid layout-thrashing style reads', category: 'PERFORMANCE', severity: 'MEDIUM', concern: 'Layout Instability', alp: 'ALP-LAYOUT-READ' },
  { id: 'FIGM-A11Y-01', title: 'Clickable element lacks keyboard interaction', category: 'ACCESSIBILITY', severity: 'HIGH', concern: 'Operability', alp: 'ALP-EVENT-KEYBOARD' },
  { id: 'FIGM-A11Y-02', title: 'Interactive control requires accessible name', category: 'ACCESSIBILITY', severity: 'HIGH', concern: 'Name, Role, Value', alp: 'ALP-CONTROL-LABEL' },
  { id: 'FIGM-A11Y-03', title: 'Images require meaningful alternative text', category: 'ACCESSIBILITY', severity: 'MEDIUM', concern: 'Text Alternatives', alp: 'ALP-MEDIA-ALT' },
  { id: 'FIGM-A11Y-04', title: 'Preserve logical heading hierarchy', category: 'ACCESSIBILITY', severity: 'LOW', concern: 'Document Structure', alp: 'ALP-HEADING-ORDER' },
  { id: 'FIGM-A11Y-05', title: 'Custom widgets must expose ARIA roles', category: 'ACCESSIBILITY', severity: 'MEDIUM', concern: 'Name, Role, Value', alp: 'ALP-ROLE-MISSING' },
  { id: 'FIGM-A11Y-06', title: 'Focus must remain visible for all controls', category: 'ACCESSIBILITY', severity: 'HIGH', concern: 'Operability', alp: 'ALP-FOCUS-VISIBLE' },
  { id: 'FIGM-REACT-01', title: 'Avoid unstable component definitions in render', category: 'REACT', severity: 'HIGH', concern: 'Component Identity', alp: 'ALP-NESTED-COMPONENT' },
  { id: 'FIGM-REACT-02', title: 'Avoid array index as stable key', category: 'REACT', severity: 'MEDIUM', concern: 'Component Identity', alp: 'ALP-LOOP-ALLOC' },
  { id: 'FIGM-REACT-03', title: 'Declare complete effect dependencies', category: 'REACT', severity: 'HIGH', concern: 'State Correctness', alp: 'ALP-EFFECT-DEPS' },
  { id: 'FIGM-REACT-04', title: 'Avoid state derivation duplicated in effects', category: 'REACT', severity: 'MEDIUM', concern: 'State Correctness', alp: 'ALP-EFFECT-DERIVE' },
  { id: 'FIGM-REACT-05', title: 'Avoid prop drilling beyond three levels', category: 'REACT', severity: 'LOW', concern: 'Composition Depth', alp: 'ALP-PROP-DEPTH' },
  { id: 'FIGM-NEXT-01', title: 'Prefer the framework image primitive', category: 'NEXT.JS', severity: 'MEDIUM', concern: 'Asset Delivery', alp: 'ALP-MEDIA-DIM' },
  { id: 'FIGM-NEXT-02', title: 'Avoid client boundaries on static subtrees', category: 'NEXT.JS', severity: 'HIGH', concern: 'Hydration Cost', alp: 'ALP-CLIENT-BOUNDARY' },
  { id: 'FIGM-NEXT-03', title: 'Declare explicit route caching semantics', category: 'NEXT.JS', severity: 'MEDIUM', concern: 'Data Freshness', alp: 'ALP-CACHE-POLICY' },
  { id: 'FIGM-NG-01', title: 'Prefer OnPush change detection', category: 'ANGULAR', severity: 'MEDIUM', concern: 'Change Detection Cost', alp: 'ALP-CD-STRATEGY' },
  { id: 'FIGM-NG-02', title: 'Unsubscribe from long-lived streams', category: 'ANGULAR', severity: 'HIGH', concern: 'Resource Retention', alp: 'ALP-SUB-LEAK' },
];

const FILTERS = ['ALL', 'PERFORMANCE', 'ACCESSIBILITY', 'REACT', 'NEXT.JS', 'ANGULAR'] as const;

const sevTone: Record<Severity, 'success' | 'warning' | 'danger' | 'info'> = {
  LOW: 'info',
  MEDIUM: 'warning',
  HIGH: 'danger',
  CRITICAL: 'danger',
};

export function RuleExplorer() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(
    () => (filter === 'ALL' ? RULES : RULES.filter((r) => r.category === filter)),
    [filter],
  );
  const visible = expanded ? filtered : filtered.slice(0, 6);

  return (
    <Section id="rules">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          eyebrow="Rule book"
          title="Rules that understand context."
          subtitle="Each rule binds a quality concern to a normalized primitive, so the same intent can be enforced across different frameworks."
        />
        <Reveal className="mono-label whitespace-nowrap">23 active guidelines</Reveal>
      </div>

      <Reveal className="mt-10">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter rules by category">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => {
                setFilter(f);
                setExpanded(false);
              }}
              className={cn(
                'rounded-md border px-3 py-1.5 font-mono text-[11px] tracking-[0.12em] uppercase transition-colors',
                filter === f
                  ? 'border-primary/40 bg-primary/12 text-primary'
                  : 'border-border bg-surface text-muted-foreground hover:text-foreground',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </Reveal>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((r, i) => (
          <Reveal
            as="li"
            key={r.id}
            delay={Math.min(i, 6) * 50}
            className="panel flex flex-col p-4 transition-colors duration-300 hover:border-primary/35"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11.5px] text-primary">{r.id}</span>
              <Tag tone={sevTone[r.severity]}>{r.severity}</Tag>
            </div>
            <h3 className="mt-2 text-[14px] leading-snug font-medium text-foreground">{r.title}</h3>
            <dl className="mt-4 space-y-1.5 border-t border-border pt-3 font-mono text-[11px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Concern</dt>
                <dd className="truncate text-subtle">{r.concern}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">ALP</dt>
                <dd className="truncate text-info">{r.alp}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Scope</dt>
                <dd className="text-subtle">{r.category}</dd>
              </div>
            </dl>
          </Reveal>
        ))}
      </ul>

      {filtered.length > 6 ? (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-md border border-border bg-surface px-4 py-2 font-mono text-[11.5px] tracking-[0.12em] text-subtle uppercase transition-colors hover:bg-secondary hover:text-foreground"
          >
            {expanded ? 'Collapse' : `Show all ${filtered.length} rules`}
          </button>
        </div>
      ) : null}
    </Section>
  );
}