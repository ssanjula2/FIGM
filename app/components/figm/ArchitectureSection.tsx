import { Section, SectionHeading, Reveal, Tag } from './primitives';

export function ArchitectureSection() {
  return (
    <Section id="architecture">
      <SectionHeading
        eyebrow="Architecture"
        title="Engineered as a platform, not a script."
        subtitle="Parsing, normalization, rule execution, profiling, and reporting are separate services with a single traceable data flow."
      />

      <Reveal className="panel mt-12 overflow-x-auto p-6">
        <svg
          viewBox="0 0 720 520"
          className="mx-auto h-auto w-full min-w-[560px] max-w-3xl"
          role="img"
          aria-label="Architecture diagram: user, authentication, source parser, ALP engine, rule engine branching into static analysis and profiler, merging into results, then dashboard, AI fix, export and research."
        >
          <defs>
            <marker id="figm-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0 0 L6 3 L0 6 z" fill="var(--hairline)" />
            </marker>
          </defs>
          {(
            [
              ['USER', 300, 10],
              ['AUTHENTICATION', 280, 70],
              ['SOURCE PARSER', 285, 130],
              ['ALP ENGINE', 290, 190],
              ['RULE ENGINE', 288, 250],
              ['STATIC ANALYSIS', 120, 320],
              ['PROFILER', 460, 320],
              ['RESULTS', 292, 390],
              ['DASHBOARD', 70, 455],
              ['AI FIX', 300, 455],
              ['EXPORT', 520, 455],
            ] as Array<[string, number, number]>
          ).map(([label, x, y]) => (
            <g key={label}>
              <rect
                x={x}
                y={y}
                width={label.length > 12 ? 160 : 140}
                height="36"
                rx="8"
                fill="var(--surface-2)"
                stroke={label === 'ALP ENGINE' || label === 'RULE ENGINE' ? 'var(--primary)' : 'var(--hairline)'}
              />
              <text
                x={x + (label.length > 12 ? 80 : 70)}
                y={y + 22}
                textAnchor="middle"
                fill="var(--foreground)"
                fontSize="11"
                fontFamily="var(--font-mono)"
              >
                {label}
              </text>
            </g>
          ))}

          {[
            'M350 46 V70',
            'M360 106 V130',
            'M355 166 V190',
            'M360 226 V250',
            'M330 286 V300 H200 V320',
            'M370 286 V300 H530 V320',
            'M200 356 V372 H362 V390',
            'M530 356 V372 H362 V390',
            'M362 426 V440 H140 V455',
            'M362 426 V455',
            'M362 426 V440 H590 V455',
            'M140 491 V505',
          ].map((d) => (
            <g key={d}>
              <path d={d} fill="none" stroke="var(--hairline)" strokeWidth="1" markerEnd="url(#figm-arrow)" />
              <path d={d} fill="none" stroke="var(--info)" strokeWidth="1" className="flow-line" opacity="0.55" />
            </g>
          ))}

          <text x="140" y="514" textAnchor="middle" fill="var(--subtle)" fontSize="11" fontFamily="var(--font-mono)">
            RESEARCH
          </text>
          <text x="20" y="20" fill="var(--muted-foreground)" fontSize="10" fontFamily="var(--font-mono)">
            FIGM PLATFORM
          </text>
        </svg>
      </Reveal>
    </Section>
  );
}

const MODULES = [
  {
    title: 'Multi-tenant workspaces',
    body: 'Projects, scan history, archived workspaces and statistics.',
    tags: ['PROJECTS', 'HISTORY'],
  },
  { title: 'RBAC', body: 'Role-scoped access across the platform.', tags: ['ADMIN', 'AUDITOR', 'DEVELOPER'] },
  { title: 'Real-time updates', body: 'Live scan completion and notification events.', tags: ['EVENTS'] },
  { title: 'Reports', body: 'Export findings in the format your process expects.', tags: ['PDF', 'HTML', 'JSON', 'CSV', 'MARKDOWN'] },
  { title: 'Cloud storage', body: 'Supabase-backed report storage.', tags: ['STORAGE'] },
  { title: 'Auditability', body: 'Security logs and traceable inspection history.', tags: ['AUDIT LOG'] },
];

export function EnterpriseFeatures() {
  return (
    <Section id="platform">
      <SectionHeading eyebrow="Platform" title="Designed for teams, too." />
      <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m, i) => (
          <Reveal key={m.title} delay={(i % 3) * 70} className="panel p-5">
            <h3 className="text-[15px] font-medium text-foreground">{m.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-subtle">{m.body}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {m.tags.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

const SECURITY = [
  'JWT Authentication',
  'PBKDF2 Password Hashing',
  'RBAC',
  'Rate Limiting',
  'Audit Logging',
  'Tenant Isolation',
  'Parameterized Queries',
  'RLS',
];

export function SecuritySection() {
  return (
    <Section id="security">
      <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        <SectionHeading
          eyebrow="Security"
          title="Your code deserves controlled access."
          subtitle="Source code is sensitive input. Access, isolation, and traceability are part of the analysis pipeline, not an afterthought."
        />
        <Reveal className="panel relative overflow-hidden p-6">
          <div className="grid-bg pointer-events-none absolute inset-0 opacity-25" />
          <div
            className="relative mx-auto grid w-full max-w-sm grid-cols-2 gap-2"
            style={{ clipPath: 'polygon(50% 0%, 100% 14%, 100% 62%, 50% 100%, 0% 62%, 0% 14%)' }}
          >
            {SECURITY.map((s) => (
              <span
                key={s}
                className="panel-2 flex min-h-14 items-center justify-center px-2 py-3 text-center font-mono text-[10.5px] tracking-[0.1em] text-subtle uppercase"
              >
                {s}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}