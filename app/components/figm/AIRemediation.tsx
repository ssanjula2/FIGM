import { Section, SectionHeading, Reveal, Tag } from './primitives';

export function AIRemediation() {
  return (
    <Section id="remediation">
      <SectionHeading
        eyebrow="Remediation"
        title="Detection is only half the job."
        subtitle="Generate contextual remediation patches without leaving the inspection workflow."
      />

      <div className="mt-12 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Reveal className="panel overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
            <span className="mono-label">Patch diff</span>
            <span className="ml-auto font-mono text-[11px] text-muted-foreground">
              components/Hero.tsx
            </span>
          </div>
          <div className="grid md:grid-cols-2">
            <div className="overflow-x-auto border-b border-border p-4 md:border-r md:border-b-0">
              <p className="mono-label">Before</p>
              <pre className="mt-3 font-mono text-[12px] leading-6 text-danger">
{`- <img src={heroImage} alt="Hero" />`}
              </pre>
            </div>
            <div className="overflow-x-auto p-4">
              <p className="mono-label">After</p>
              <pre className="mt-3 font-mono text-[12px] leading-6 text-success">
{`+ <img
+   src={heroImage}
+   alt="Hero"
+   width={1200}
+   height={640}
+ />`}
              </pre>
            </div>
          </div>
        </Reveal>

        <Reveal delay={100} className="panel p-5">
          <div className="flex items-center justify-between">
            <p className="mono-label">FIGM AI remediation</p>
            <Tag tone="primary">Gemini</Tag>
          </div>
          <dl className="mt-4 divide-y divide-border">
            {[
              ['Rule', 'FIGM-PERF-02'],
              ['Patch', 'Generated'],
              ['Compilation', 'PASS'],
              ['Violation removed', 'YES'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-2.5">
                <dt className="text-[13px] text-subtle">{k}</dt>
                <dd className="font-mono text-[12px] text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
            Patches are proposed against the diagnostic that produced them, re-checked for
            compilation, and re-scanned to confirm the violation is gone before you accept.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}