'use client';

import React, { useState } from 'react';

// Import Modular Landing Page Components
import HeroSection from './components/landing/HeroSection';
import ResearchOverview from './components/landing/ResearchOverview';
import FIGMModelSection from './components/landing/FIGMModelSection';
import FeaturesGrid from './components/landing/FeaturesGrid';
import ArchitecturePipeline from './components/landing/ArchitecturePipeline';
import BenchmarkSection from './components/landing/BenchmarkSection';
import LandingFooter from './components/landing/LandingFooter';
import ReferencesSection from './components/landing/ReferencesSection';

// Import Live Dashboard Analytics Component
import LiveDashboardContent from './components/dashboard/LiveDashboardContent';

export default function OverviewPage() {
  const [viewMode, setViewMode] = useState<'LANDING' | 'DASHBOARD'>('LANDING');

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top View Mode Switcher Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          borderRadius: '14px',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px' }}>🛡️</span>
          <span style={{ color: '#f8fafc', fontSize: '14px', fontWeight: 800 }}>
            FIGM Code Inspector Portal
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.15)',
              padding: '2px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            Research & Developer Tool
          </span>
        </div>

        {/* View Switcher Controls */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(30, 41, 59, 0.6)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            onClick={() => setViewMode('LANDING')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: viewMode === 'LANDING' ? 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)' : 'transparent',
              color: viewMode === 'LANDING' ? '#0f172a' : '#94a3b8',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            🚀 Research Showcase
          </button>
          <button
            onClick={() => setViewMode('DASHBOARD')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: viewMode === 'DASHBOARD' ? 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)' : 'transparent',
              color: viewMode === 'DASHBOARD' ? '#0f172a' : '#94a3b8',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            📊 Live Analytics Dashboard
          </button>
        </div>
      </div>

      {/* Render Selected View */}
      {viewMode === 'LANDING' ? (
        <div>
          <HeroSection />
          <ResearchOverview />
          <FIGMModelSection />
          <FeaturesGrid />
          <ArchitecturePipeline />
          <BenchmarkSection />
          <ReferencesSection />
          <LandingFooter />
        </div>
      ) : (
        /* DASHBOARD MODE: Live Analytics Dashboard powered by Real Persistence */
        <LiveDashboardContent />
      )}
    </div>
  );
}
