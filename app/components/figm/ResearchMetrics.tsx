"use client";

import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Section, SectionHeading, Reveal, Tag } from './primitives';

function CountUp({ to, decimals = 0, suffix = '' }: { to: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVal(to);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / 1100, 1);
        setVal(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);

  return (
    <span ref={ref} className="tabular-nums">
      {val.toFixed(decimals)}
      {suffix}
    </span>
  );
}

const PRIMARY = [
  { label: 'Precision', value: 92.45 },
  { label: 'Recall', value: 91.42 },
  { label: 'F1 score', value: 91.93 },
  { label: 'Accuracy', value: 93.56 },
];

const SECONDARY = [
  ['30', 'Repositories evaluated'],
  ['23', 'Quality rules'],
  ['4', 'Frameworks'],
  ['92', 'User study participants'],
];

const TERTIARY = [
  ['96.4%', 'AI patch generation success'],
  ['98.1%', 'Compilation pass rate'],
  ['4.72 / 5', 'User satisfaction'],
  ['0.892', "Cronbach's α"],
];

export function ResearchMetrics() {
  return (
    <Section id="research">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          eyebrow="Empirical evaluation"
          title="Built for engineering. Validated through research."
          subtitle="Reported figures come from FIGM's documented evaluation study, not from live telemetry."
        />
        <Reveal>
          <a
            href="#research-docs"
            className="group inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3.5 py-2 text-[13px] text-foreground transition-colors hover:bg-secondary"
          >
            Explore research
            <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
          </a>
        </Reveal>
      </div>

      <Reveal className="panel mt-12 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
          <span className="mono-label">Evaluation dashboard</span>
          <Tag tone="info">Static dataset</Tag>
        </div>

        <dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {PRIMARY.map((m) => (
            <div key={m.label} className="bg-surface px-5 py-7">
              <dd className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                <CountUp to={m.value} decimals={2} suffix="%" />
              </dd>
              <dt className="mono-label mt-2">{m.label}</dt>
              <div className="mt-4 h-1 rounded-full bg-surface-2">
                <div
                  className="h-1 rounded-full bg-gradient-to-r from-primary to-info"
                  style={{ width: `${m.value}%` }}
                />
              </div>
            </div>
          ))}
        </dl>

        <dl className="grid gap-px border-t border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {SECONDARY.map(([v, k]) => (
            <div key={k} className="bg-surface px-5 py-5">
              <dd className="font-mono text-xl text-foreground">{v}</dd>
              <dt className="mono-label mt-1">{k}</dt>
            </div>
          ))}
        </dl>

        <dl className="grid gap-px border-t border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {TERTIARY.map(([v, k]) => (
            <div key={k} className="bg-surface-2 px-5 py-5">
              <dd className="font-mono text-lg text-primary">{v}</dd>
              <dt className="mono-label mt-1">{k}</dt>
            </div>
          ))}
        </dl>
      </Reveal>
    </Section>
  );
}

const DIMENSIONS = [
  { label: 'Framework-independent model', figm: true, note: 'ALP normalization across 4 ecosystems' },
  { label: 'Executable quality rules', figm: true, note: '23 traceable rule identifiers' },
  { label: 'Empirical precision / recall', figm: true, note: '92.45% / 91.42% on 30 repositories' },
  { label: 'AI remediation with verification', figm: true, note: '98.1% compilation pass rate' },
  { label: 'Runtime profiling', figm: true, note: 'Paired with static diagnostics' },
];

export function BenchmarkSection() {
  return (
    <Section id="benchmarks">
      <SectionHeading
        eyebrow="Benchmarks"
        title="Measured on the dimensions FIGM defines."
        subtitle="ESLint, SonarQube, and Lighthouse each evaluate valuable but different dimensions. Rather than publishing unsupported head-to-head numbers, FIGM reports only its own documented evaluation and states which dimensions it spans."
      />

      <div className="mt-12 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Reveal className="panel p-5">
          <p className="mono-label">FIGM evaluation coverage</p>
          <ul className="mt-4 space-y-3">
            {DIMENSIONS.map((d) => (
              <li key={d.label} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                  <span className="text-[14px] text-foreground">{d.label}</span>
                </div>
                <p className="mt-1 pl-3.5 font-mono text-[11px] text-muted-foreground">{d.note}</p>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={100} className="panel p-5">
          <p className="mono-label">Scope of comparison</p>
          <ul className="mt-4 space-y-3">
            {[
              ['ESLint', 'Lint rules scoped per framework configuration'],
              ['SonarQube', 'General-purpose static analysis across languages'],
              ['Lighthouse', 'Runtime page auditing in the browser'],
              ['FIGM', 'Framework-independent frontend quality modeling'],
            ].map(([name, note], i) => (
              <li
                key={name}
                className={
                  i === 3
                    ? 'rounded-lg border border-primary/35 bg-primary/8 p-3'
                    : 'panel-2 p-3'
                }
              >
                <p className="font-mono text-[11.5px] text-foreground">{name}</p>
                <p className="mt-1 text-[12.5px] text-subtle">{note}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 font-mono text-[10.5px] leading-5 text-muted-foreground">
            No comparative metric values are attributed to third-party tools.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}