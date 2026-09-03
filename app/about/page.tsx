// Public research/showcase page. Previously this content (and a client-side LANDING/DASHBOARD
// toggle) lived at `/` itself, shown to every visitor -- including unauthenticated ones -- before
// the app's own dashboard. The product requirement is now "login/register first": `/` is gated by
// middleware.ts and always renders the authenticated dashboard once a visitor reaches it. This
// page preserves the original research-showcase content (unauthenticated, public by design -- see
// middleware.ts's isPublicPath) at its own URL instead of deleting it.
import LandingHeader from '../components/landing/LandingHeader';
import HeroSection from '../components/landing/HeroSection';
import FeaturesGrid from '../components/landing/FeaturesGrid';
import ArchitecturePipeline from '../components/landing/ArchitecturePipeline';
import FrameworkScope from '../components/landing/FrameworkScope';
import WhyFigm from '../components/landing/WhyFigm';
import ResearchCredibility from '../components/landing/ResearchCredibility';
import FinalCta from '../components/landing/FinalCta';
import LandingFooter from '../components/landing/LandingFooter';

// Public research/showcase page (see middleware.ts's isPublicPath). Stage 7C visual-polish pass
// (Section 3): product, not dissertation -- the full DSRM methodology, controlled-benchmark
// write-up, and academic reference list moved to /methodology and /references respectively
// (content preserved, unmodified, just relocated -- see those routes and this session's audit
// report). Order: header -> hero + product preview -> three domains -> how it works -> framework
// support -> why FIGM -> compact research credibility -> final CTA -> footer.
export default function AboutPage() {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
      <LandingHeader />
      <HeroSection />
      <FeaturesGrid />
      <ArchitecturePipeline />
      <FrameworkScope />
      <WhyFigm />
      <ResearchCredibility />
      <FinalCta />
      <LandingFooter />
    </div>
  );
}
