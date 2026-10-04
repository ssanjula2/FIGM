import Link from 'next/link';
import ResearchOverview from '../components/landing/ResearchOverview';
import BenchmarkSection from '../components/landing/BenchmarkSection';

// Public methodology page (see middleware.ts's isPublicPath). Stage 7C visual-polish pass
// (Section 2/9/10): the public landing page (/about) previously carried the full DSRM
// methodology discussion and controlled-benchmark write-up inline, which made it read like a
// dissertation chapter rather than a product page. That content -- unmodified, still real and
// verified -- moved here so it stays reachable (linked from the landing page's compact
// "Research-backed evaluation" section and the footer's "Methodology" link) without occupying
// the main product page.
export default function MethodologyPage() {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px 0 24px', width: '100%' }}>
        <Link href="/about" style={{ fontSize: '13px', color: '#1d4ed8', textDecoration: 'none' }}>
          ← Back to FIGM Code Inspector
        </Link>
      </div>
      <ResearchOverview />
      <BenchmarkSection />
    </div>
  );
}
