import { Section, SectionHeading, Reveal, Tag } from './primitives';

const FRAMEWORKS = [
  { name: 'React', syntax: 'JSX / TSX', rules: 18, glyph: '()' },
  { name: 'Next.js', syntax: 'App Router', rules: 12, glyph: '▲' },
  { name: 'Angular', syntax: 'Components', rules: 9, glyph: '◆' },
  { name: 'Vue', syntax: 'SFC', rules: 9, glyph: '▽' },
];

export function FrameworkCoverage() {
  return (
    <Section id="frameworks">
      <SectionHeading
        eyebrow="Coverage"
        title="One model. Multiple frontend ecosystems."
        subtitle="Every ecosystem is parsed with a framework-aware front end and evaluated against the same normalized quality model."
      />

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FRAMEWORKS.map((f, i) => (
          <Reveal
            key={f.name}
            delay={i * 80}
            className="panel group relative overflow-hidden p-5 transition-colors duration-300 hover:border-primary/40"
          >
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div className="radial-glow absolute inset-0" />
            </div>
            <div className="relative">
              <div className="flex items-start justify-between">
                <span className="flex size-9 items-center justify-center rounded-md border border-border bg-surface-2 font-mono text-sm text-primary">
                  {f.glyph}
                </span>
                <Tag tone="success">Supported</Tag>
              </div>
              <h3 className="mt-4 font-mono text-[13px] tracking-[0.16em] text-foreground uppercase">
                {f.name}
              </h3>
              <p className="mt-1 text-[13px] text-subtle">{f.syntax}</p>
              <p className="mt-4 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
                {f.rules} applicable rules
              </p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal className="panel mt-4 grid place-items-center overflow-hidden p-8">
        <svg
          viewBox="0 0 640 180"
          className="h-auto w-full max-w-3xl"
          role="img"
          aria-label="Diagram: React, Next.js, Angular and Vue all connect into a central FIGM node"
        >
          {[30, 70, 110, 150].map((y, i) => (
            <g key={y}>
              <text x="8" y={y + 4} fill="var(--subtle)" fontSize="11" fontFamily="var(--font-mono)">
                {['React', 'Next.js', 'Angular', 'Vue'][i]}
              </text>
              <path
                d={`M90 ${y} H210 Q250 ${y} 250 90 H290`}
                fill="none"
                stroke="var(--hairline)"
                strokeWidth="1"
              />
              <path
                d={`M90 ${y} H210 Q250 ${y} 250 90 H290`}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="1.2"
                className="flow-line"
                opacity="0.8"
              />
            </g>
          ))}
          <rect
            x="292"
            y="72"
            width="76"
            height="36"
            rx="8"
            fill="var(--surface-2)"
            stroke="var(--primary)"
          />
          <text
            x="330"
            y="94"
            textAnchor="middle"
            fill="var(--foreground)"
            fontSize="12"
            fontFamily="var(--font-mono)"
          >
            FIGM
          </text>
          <path d="M368 90 H430" stroke="var(--hairline)" strokeWidth="1" />
          <path
            d="M368 90 H430"
            stroke="var(--info)"
            strokeWidth="1.2"
            className="flow-line"
          />
          <text x="440" y="86" fill="var(--subtle)" fontSize="11" fontFamily="var(--font-mono)">
            ALP → RULES
          </text>
          <text x="440" y="102" fill="var(--muted-foreground)" fontSize="10" fontFamily="var(--font-mono)">
            DIAGNOSTICS
          </text>
        </svg>
      </Reveal>
    </Section>
  );
}