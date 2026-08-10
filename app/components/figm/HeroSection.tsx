"use client";

import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, CircleDot } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Tag } from './primitives';

const CODE: Array<{ n: number; text: string; flag?: 'warn' | 'danger' }> = [
  { n: 1, text: 'function ProductList({ products }) {' },
  { n: 2, text: '  return (' },
  { n: 3, text: '    <div>' },
  { n: 4, text: '      {products.map((product, index) => (' },
  { n: 5, text: '        <ProductCard', flag: 'warn' },
  { n: 6, text: '          key={index}', flag: 'warn' },
  { n: 7, text: '          product={product}' },
  { n: 8, text: '          onSelect={() => select(product)}', flag: 'danger' },
  { n: 9, text: '        />' },
  { n: 10, text: '      ))}' },
  { n: 11, text: '    </div>' },
  { n: 12, text: '  )' },
  { n: 13, text: '}' },
];

const STEPS = ['Parsing source', 'AST generated', 'ALP extraction complete', '23 rules evaluated', 'Analysis complete'];

function useAnalysisLoop() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setStep(STEPS.length);
      return;
    }
    const id = window.setInterval(() => {
      setStep((s) => (s >= STEPS.length + 2 ? 0 : s + 1));
    }, 900);
    return () => window.clearInterval(id);
  }, []);
  return step;
}

function CodeInspectorDemo() {
  const step = useAnalysisLoop();
  const done = step >= STEPS.length;

  return (
    <div className="panel relative overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="size-2 rounded-full bg-danger/70" />
        <span className="size-2 rounded-full bg-warning/70" />
        <span className="size-2 rounded-full bg-success/70" />
        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
          components/ProductList.tsx
        </span>
        <span className="ml-auto mono-label">FIGM v3.0.0</span>
      </div>

      <div className="grid lg:grid-cols-[1.25fr_1fr]">
        <div className="scanline relative min-w-0 overflow-x-auto border-b border-border p-4 lg:border-r lg:border-b-0">
          <pre className="font-mono text-[12.5px] leading-6">
            <code>
              {CODE.map((line) => (
                <span
                  key={line.n}
                  className={cn(
                    'grid grid-cols-[2rem_1fr] rounded-sm transition-colors duration-500',
                    done && line.flag === 'warn' && 'bg-warning/10',
                    done && line.flag === 'danger' && 'bg-danger/10',
                  )}
                >
                  <span className="select-none text-muted-foreground/60">{line.n}</span>
                  <span
                    className={cn(
                      'whitespace-pre text-subtle',
                      done && line.flag === 'warn' && 'text-warning',
                      done && line.flag === 'danger' && 'text-danger',
                    )}
                  >
                    {line.text}
                  </span>
                </span>
              ))}
            </code>
          </pre>
        </div>

        <div className="min-w-0 p-4">
          <div className="flex items-center justify-between">
            <p className="mono-label">FIGM Analysis</p>
            <Tag tone={done ? 'danger' : 'info'}>{done ? '2 issues' : 'running'}</Tag>
          </div>

          <ul className="mt-3 space-y-1.5" aria-live="polite">
            {STEPS.map((s, i) => {
              const active = step === i;
              const complete = step > i;
              return (
                <li
                  key={s}
                  className={cn(
                    'flex items-center gap-2 font-mono text-[11.5px] transition-opacity',
                    complete || active ? 'opacity-100' : 'opacity-30',
                  )}
                >
                  {complete ? (
                    <Check size={12} className="text-success" aria-hidden="true" />
                  ) : (
                    <CircleDot
                      size={12}
                      className={cn('text-info', active && 'pulse-dot')}
                      aria-hidden="true"
                    />
                  )}
                  <span className={complete ? 'text-subtle' : 'text-muted-foreground'}>{s}</span>
                </li>
              );
            })}
          </ul>

          <div
            className={cn(
              'mt-4 space-y-2 transition-all duration-500',
              done ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
            )}
          >
            <article className="panel-2 p-3">
              <div className="flex items-center gap-2">
                <Tag tone="warning">Performance</Tag>
                <span className="ml-auto font-mono text-[10px] text-warning">MEDIUM</span>
              </div>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">FIGM-REACT-02</p>
              <p className="text-[13px] text-foreground">Avoid array index as stable key</p>
            </article>
            <article className="panel-2 p-3">
              <div className="flex items-center gap-2">
                <Tag tone="info">Accessibility</Tag>
                <span className="ml-auto font-mono text-[10px] text-danger">HIGH</span>
              </div>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">FIGM-A11Y-01</p>
              <p className="text-[13px] text-foreground">Clickable element lacks keyboard interaction</p>
            </article>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4">
        {[
          ['Status', done ? 'COMPLETE' : 'RUNNING'],
          ['Score', '82 / 100'],
          ['Issues', '2'],
          ['Duration', '142ms'],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface px-4 py-3">
            <dt className="mono-label">{k}</dt>
            <dd className="mt-1 font-mono text-[13px] text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function HeroSection() {
  return (
    <section id="top" className="relative overflow-hidden pt-28 pb-16 sm:pt-36 sm:pb-24">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(70%_55%_at_50%_0%,black,transparent)]" />
      <div className="radial-glow pointer-events-none absolute inset-x-0 -top-40 h-[520px] opacity-60" />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <p className="mono-label">Framework-independent code intelligence</p>
          <h1 className="mt-5 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
            Understand the quality of your frontend code.
            <span className="text-gradient mt-2 block text-2xl sm:text-4xl">
              Across frameworks. Across rules. Across your entire codebase.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-subtle">
            FIGM transforms React, Next.js, Angular, and Vue source code into a normalized quality
            model, detects architectural violations, and turns findings into actionable remediation.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#launch"
              className="group inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-200 hover:-translate-y-px hover:shadow-[0_16px_40px_-18px_var(--primary)]"
            >
              Launch Inspector
              <ArrowRight size={15} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="#github"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              View on GitHub
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-muted-foreground">
            {['React', 'Next.js', 'Angular', 'Vue'].map((f) => (
              <span key={f} className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-success/80" aria-hidden="true" />
                {f}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-12 sm:mt-16">
          <CodeInspectorDemo />
        </div>

        <ul className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
          {[
            ['23', 'Quality rules'],
            ['4', 'Frameworks'],
            ['4-layer', 'Meta-model'],
            ['AI', 'Remediation'],
          ].map(([v, k]) => (
            <li key={k} className="bg-surface px-4 py-4">
              <p className="font-mono text-lg text-foreground">{v}</p>
              <p className="mono-label mt-1">{k}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}