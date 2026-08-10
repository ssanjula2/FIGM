import { Fragment } from 'react';
import { Section, SectionHeading, Reveal, Tag } from './primitives';

const STAGES = [
  {
    id: '01',
    title: 'Parse',
    body: 'Framework-specific source becomes an AST.',
    from: 'Source',
    to: 'AST',
  },
  {
    id: '02',
    title: 'Normalize',
    body: 'AST structures become Abstract Language Primitives.',
    from: 'AST',
    to: 'ALP',
  },
  {
    id: '03',
    title: 'Execute',
    body: 'ALPs are evaluated against executable FIGM rules.',
    from: 'ALP',
    to: 'Diagnostics',
  },
];

const LAYERS = [
  { label: 'Domain', value: 'Performance Efficiency', tone: 'info' as const },
  { label: 'Concern', value: 'Invariant Allocations', tone: 'primary' as const },
  { label: 'ALP', value: 'ALP-LOOP-ALLOC', tone: 'warning' as const },
  { label: 'Rule', value: 'FIGM-PERF-01', tone: 'success' as const },
];

export function HowItWorks() {
  return (
    <>
      <Section id="how-it-works">
        <SectionHeading
          eyebrow="Pipeline"
          title="Three stages. One normalized analysis pipeline."
          subtitle="Framework front ends differ. Everything downstream of normalization is shared, deterministic, and reproducible."
        />

        <ol className="mt-12 grid gap-4 lg:grid-cols-3">
          {STAGES.map((s, i) => (
            <Reveal as="li" key={s.id} delay={i * 90} className="panel relative p-6">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] text-primary">{s.id}</span>
                <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
              </div>
              <p className="mt-3 text-[14px] leading-relaxed text-subtle">{s.body}</p>
              <div className="mt-6 flex items-center gap-3 font-mono text-[11px]">
                <span className="rounded-md border border-border bg-surface-2 px-2 py-1 text-muted-foreground">
                  {s.from}
                </span>
                <span className="h-px flex-1 bg-gradient-to-r from-primary/60 to-info/60" />
                <span className="rounded-md border border-primary/35 bg-primary/10 px-2 py-1 text-primary">
                  {s.to}
                </span>
              </div>
            </Reveal>
          ))}
        </ol>

        <Reveal className="panel mt-4 overflow-x-auto p-6">
          <pre className="min-w-[560px] font-mono text-[12px] leading-6 text-subtle">
{`React JSX  ─────┐
Next.js    ─────┤
Angular    ─────┼──→  ALP  ──→  FIGM RULES  ──→  DIAGNOSTICS
Vue SFC    ─────┘`}
          </pre>
        </Reveal>
      </Section>

      <Section id="meta-model">
        <SectionHeading
          eyebrow="Meta-model"
          title="A quality model designed to outlive frameworks."
          subtitle="Four layers separate what quality means from how a framework happens to express it."
        />

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <Reveal className="relative">
            <div className="radial-glow pointer-events-none absolute -inset-8 opacity-50" />
            <ol className="relative space-y-3">
              {LAYERS.map((l, i) => (
                <li
                  key={l.label}
                  className="panel flex items-center gap-4 p-4 transition-transform duration-300 hover:translate-x-1"
                  style={{ marginInlineStart: `${i * 14}px` }}
                >
                  <Tag tone={l.tone}>{l.label}</Tag>
                  <span className="font-mono text-[12.5px] text-foreground">{l.value}</span>
                  {i < LAYERS.length - 1 ? (
                    <span className="ml-auto font-mono text-[11px] text-muted-foreground" aria-hidden="true">
                      ↓
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal delay={120}>
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              Framework syntax changes. Quality concerns don&apos;t.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-subtle">
              A domain describes a quality dimension. A concern narrows it to a recurring
              architectural problem. An Abstract Language Primitive captures the structural signal
              in normalized form. A rule binds that primitive to an executable, framework-aware
              check with a stable identifier.
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
              {[
                ['Model', 'v2.0.0'],
                ['Layers', '4'],
                ['Primitives', 'Normalized'],
                ['Rule IDs', 'Traceable'],
              ].map(([k, v]) => (
                <div key={k} className="bg-surface px-4 py-3">
                  <dt className="mono-label">{k}</dt>
                  <dd className="mt-1 font-mono text-[12.5px] text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </Section>
    </>
  );
}