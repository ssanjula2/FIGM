/**
 * Index of the RQ1 experiment fixture conditions. Not itself a measured condition -- purely a
 * human-navigable directory. See docs/research/RQ1_EXPERIMENT_PROTOCOL.md.
 */
const CONDITIONS = [
  { href: '/rq1-experiment/csr-local', label: 'CSR / LOCAL state' },
  { href: '/rq1-experiment/csr-global', label: 'CSR / GLOBAL state' },
  { href: '/rq1-experiment/ssr-local', label: 'SSR / LOCAL state' },
  { href: '/rq1-experiment/ssr-global', label: 'SSR / GLOBAL state' },
];

export default function Rq1ExperimentIndexPage() {
  return (
    <div style={{ padding: 24, background: '#030712', color: '#f8fafc', minHeight: '100vh' }}>
      <h1>RQ1 FCP/TTI Experiment Fixtures</h1>
      <p>Research-only fixtures for docs/research/RQ1_EXPERIMENT_PROTOCOL.md. Not part of the FIGM product.</p>
      <ul>
        {CONDITIONS.map((c) => (
          <li key={c.href}><a href={c.href}>{c.label}</a></li>
        ))}
      </ul>
    </div>
  );
}
