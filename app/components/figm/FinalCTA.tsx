import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Reveal } from './primitives';

export function FinalCTA() {
  return (
    <section id="launch" className="relative overflow-hidden px-5 py-28 sm:px-8 sm:py-36">
      <div className="radial-glow pointer-events-none absolute inset-0 opacity-70" />
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-20 [mask-image:radial-gradient(60%_60%_at_50%_50%,black,transparent)]" />
      <Reveal className="relative mx-auto max-w-3xl text-center">
        <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Make code quality measurable.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-subtle">
          Inspect your frontend architecture through a framework-independent quality model.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <a
            href="#launch"
            className="group inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-200 hover:-translate-y-px hover:shadow-[0_18px_44px_-18px_var(--primary)]"
          >
            Launch FIGM Inspector
            <ArrowRight size={15} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href="#docs"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Read the documentation
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
        <p className="mono-label mt-7">Open source • MIT License • Developer-first</p>
      </Reveal>
    </section>
  );
}

const COLUMNS: Array<{ title: string; links: string[] }> = [
  { title: 'Product', links: ['Inspector', 'Diagnostics', 'AI Remediation', 'Rules', 'Analytics'] },
  { title: 'Developers', links: ['CLI', 'VS Code Extension', 'API', 'Documentation', 'GitHub'] },
  { title: 'Research', links: ['Methodology', 'Benchmarks', 'Evaluation', 'Dissertation', 'Evidence'] },
  { title: 'Platform', links: ['Security', 'Architecture', 'Changelog', 'Status'] },
];

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.2fr_2.4fr]">
        <div>
          <p className="font-mono text-[15px] font-semibold tracking-[0.18em]">FIGM</p>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-subtle">
            Framework-independent code quality intelligence.
          </p>
          <p className="mono-label mt-6">FIGM v3.0.0 · MODEL v2.0.0 · 23 RULES</p>
        </div>
        <div className="grid gap-8 sm:grid-cols-4">
          {COLUMNS.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <p className="mono-label">{c.title}</p>
              <ul className="mt-3 space-y-2">
                {c.links.map((l) => (
                  <li key={l}>
                    <a href="#top" className="text-[13px] text-subtle transition-colors hover:text-foreground">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-5 font-mono text-[11px] text-muted-foreground sm:px-8">
          <span>© 2026 FIGM Code Inspector</span>
          <span>MIT License</span>
        </div>
      </div>
    </footer>
  );
}