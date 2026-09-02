// Public research/showcase page. Previously this content (and a client-side LANDING/DASHBOARD
// toggle) lived at `/` itself, shown to every visitor -- including unauthenticated ones -- before
// the app's own dashboard. The product requirement is now "login/register first": `/` is gated by
// middleware.ts and always renders the authenticated dashboard once a visitor reaches it. This
// page preserves the original research-showcase content (unauthenticated, public by design -- see
// middleware.ts's isPublicPath) at its own URL instead of deleting it.
import HeroSection from '../components/landing/HeroSection';
import ResearchOverview from '../components/landing/ResearchOverview';
import FIGMModelSection from '../components/landing/FIGMModelSection';
import FeaturesGrid from '../components/landing/FeaturesGrid';
import ArchitecturePipeline from '../components/landing/ArchitecturePipeline';
import BenchmarkSection from '../components/landing/BenchmarkSection';
import LandingFooter from '../components/landing/LandingFooter';
import ReferencesSection from '../components/landing/ReferencesSection';

export default function AboutPage() {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <HeroSection />
      <ResearchOverview />
      <FIGMModelSection />
      <FeaturesGrid />
      <ArchitecturePipeline />
      <BenchmarkSection />
      <ReferencesSection />
      <LandingFooter />
    </div>
  );
}
