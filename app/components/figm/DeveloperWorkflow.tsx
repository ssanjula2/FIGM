import { Section, SectionHeading, Reveal, Tag } from './primitives';

export function DeveloperWorkflow() {
  return (
    <Section id="developers">
      <SectionHeading
        eyebrow="Workflow"
        title="Meet developers where they already work."
        subtitle="The same rule engine runs in the terminal, in the editor, and in the pipeline — one score, three surfaces."
      />

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        <Reveal className="panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <span className="mono-label">CLI</span>
            <Tag tone="info">terminal</Tag>
          </div>
          <div className="overflow-x-auto p-4">
            <pre className="font-mono text-[11.5px] leading-6 text-subtle">
{`$ npm run analyze \
    -- --path ./src \
    --framework react \
    --threshold 80`}
            </pre>
            <pre className="mt-4 font-mono text-[11.5px] leading-6">
              <span className="text-muted-foreground">FIGM ANALYSIS</span>
              {'\n'}
              <span className="text-foreground">Score: 91/100</span>
              {'\n'}
              <span className="text-foreground">Issues: 7</span>
              {'\n\n'}
              <span className="text-success">✓ CI threshold passed</span>
            </pre>
          </div>
        </Reveal>

        <Reveal delay={90} className="panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <span className="mono-label">VS Code</span>
            <Tag tone="primary">inline</Tag>
          </div>
          <div className="overflow-x-auto p-4">
            <pre className="font-mono text-[11.5px] leading-6 text-subtle">
{`38  <button
39    onClick={() => open(id)}`}
              <span className="text-warning">{`
      ~~~~~~~~~~~~~~~~~~~~~~~`}</span>
{`
40  >`}
            </pre>
            <div className="panel-2 mt-3 p-3">
              <p className="font-mono text-[11px] text-warning">FIGM-PERF-05</p>
              <p className="mt-1 text-[13px] text-foreground">Inline callback detected</p>
              <p className="mt-1 font-mono text-[10.5px] text-muted-foreground">
                ALP-INLINE-CALLBACK
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={180} className="panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <span className="mono-label">CI / CD</span>
            <Tag tone="success">gate</Tag>
          </div>
          <div className="p-4">
            <p className="font-mono text-[11.5px] text-muted-foreground">GitHub Actions</p>
            <ul className="mt-3 space-y-1.5 font-mono text-[11.5px] text-subtle">
              {['Install', 'FIGM Scan', 'Quality Gate', 'Build', 'Deploy'].map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <span className="text-success" aria-hidden="true">
                    ✓
                  </span>
                  {s}
                </li>
              ))}
            </ul>
            <pre className="mt-4 border-t border-border pt-3 font-mono text-[11px] leading-5 text-muted-foreground">
{`Code → FIGM → Quality Gate → Deploy`}
            </pre>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}