import { Fragment } from 'react';
import { Section, SectionHeading, Reveal, Tag } from './primitives';

const COLUMNS = [
  {
    label: 'Source',
    caption: 'React JSX',
    tone: 'info' as const,
    items: ['ProductList.tsx', '<ProductCard key={index} />', 'onSelect={() => …}'],
  },
  {
    label: 'ALP Model',
    caption: 'Normalized primitives',
    tone: 'primary' as const,
    items: ['ALP-INLINE-CALLBACK', 'ALP-LOOP-ALLOC', 'ALP-EVENT-KEYBOARD'],
  },
  {
    label: 'Rule Engine',
    caption: 'Executable guidelines',
    tone: 'warning' as const,
    items: ['FIGM-PERF-05', 'FIGM-PERF-01', 'FIGM-A11Y-01'],
  },
];

function Connector() {
  return (
    <div className="hidden items-center justify-center lg:flex" aria-hidden="true">
      <svg width="56" height="120" viewBox="0 0 56 120" fill="none">
        {[30, 60, 90].map((y) => (
          <line
            key={y}
            x1="2"
            y1={y}
            x2="54"
            y2={y}
            stroke="var(--primary)"
            strokeWidth="1.2"
            className="flow-line"
            opacity="0.7"
          />
        ))}
      </svg>
    </div>
  );
}

export function InspectionPipeline() {
  return (
    <Section id="product">
      <SectionHeading
        eyebrow="Inspection model"
        title="From source code to actionable intelligence."
        subtitle="FIGM does more than pattern matching. It normalizes framework-specific syntax into a common analytical model before executing quality rules."
      />

      <div className="mt-12 grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-center">
        {COLUMNS.map((col, i) => (
          <Fragment key={col.label}>
            <Reveal delay={i * 90} className="panel p-5">
              <div className="flex items-center justify-between">
                <p className="mono-label">{col.label}</p>
                <Tag tone={col.tone}>0{i + 1}</Tag>
              </div>
              <p className="mt-2 text-[13px] text-subtle">{col.caption}</p>
              <ul className="mt-4 space-y-2">
                {col.items.map((it) => (
                  <li
                    key={it}
                    className="panel-2 truncate px-3 py-2 font-mono text-[11.5px] text-foreground"
                  >
                    {it}
                  </li>
                ))}
              </ul>
            </Reveal>
            {i < COLUMNS.length - 1 ? <Connector /> : null}
          </Fragment>
        ))}
      </div>
    </Section>
  );
}