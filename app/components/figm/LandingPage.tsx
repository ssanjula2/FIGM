import { Navbar } from './Navbar';
import { HeroSection } from './HeroSection';
import { InspectionPipeline } from './InspectionPipeline';
import { FrameworkCoverage } from './FrameworkCoverage';
import { HowItWorks } from './HowItWorks';
import { RuleExplorer } from './RuleExplorer';
import { DiagnosticsDemo } from './DiagnosticsDemo';
import { AIRemediation } from './AIRemediation';
import { DeveloperWorkflow } from './DeveloperWorkflow';
import { ResearchMetrics, BenchmarkSection } from './ResearchMetrics';
import { ArchitectureSection, EnterpriseFeatures, SecuritySection } from './ArchitectureSection';
import { FinalCTA, Footer } from './FinalCTA';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main">
        <HeroSection />
        <InspectionPipeline />
        <FrameworkCoverage />
        <HowItWorks />
        <RuleExplorer />
        <DiagnosticsDemo />
        <AIRemediation />
        <DeveloperWorkflow />
        <ResearchMetrics />
        <BenchmarkSection />
        <ArchitectureSection />
        <EnterpriseFeatures />
        <SecuritySection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}