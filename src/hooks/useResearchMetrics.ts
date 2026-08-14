/**
 * useResearchMetrics — React hook
 *
 * Fetches live research metrics from /api/research-metrics at runtime.
 * Components use this hook instead of hardcoding any numbers.
 */
'use client';

import { useState, useEffect } from 'react';

export interface BenchmarkOverall {
  precision: number;
  recall: number;
  f1Score: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
}

export interface UserStudyMetrics {
  susMean: number;
  susMedian: number;
  susStdDev: number;
  susMin: number;
  susMax: number;
  cronbachAlpha: number;
  taskCompletionRatePercent: number;
  taskConfidenceMean: number;
  taskDifficultyMean: number;
  usefulnessMean: number;
  ruleIdentificationDistribution: Record<string, number>;
}

export interface UserStudyProvenance {
  datasetId: string;
  datasetType: 'REAL_HUMAN_DATA' | 'SYNTHETIC';
  isRealHumanData: boolean;
  collectionStatus: 'COLLECTED' | 'NOT_COLLECTED';
  targetSampleSize: number;
  validParticipantCount: number;
  targetReached: boolean;
  anonymizedParticipantIds: string[];
  totalResponsesIngested: number;
  excludedResponsesCount: number;
  processedAt: string;
}

export interface UserStudyStatus {
  targetParticipants: number;
  collectedParticipants: number;
  /** Matches scripts/import-user-study.ts's ProcessedUsabilityReport.provenance.collectionStatus
   *  verbatim -- this is the canonical real-study data flow's own status, not a re-derived one. */
  collectionStatus: 'COLLECTED' | 'NOT_COLLECTED';
  /** True only once a real CSV import has produced at least one valid participant. Never true for
   *  synthetic/formula-verification data -- see src/eval/user-study-evaluator.ts, which this field
   *  is never sourced from. */
  isRealHumanData: boolean;
  note: string;
  reliabilityMeasure: string;
  /** null until isRealHumanData is true -- never a synthetic/placeholder metrics object. */
  metrics: UserStudyMetrics | null;
  provenance: UserStudyProvenance;
}

export interface ResearchMetricsPayload {
  _meta: {
    generatedAt: string;
    benchmarkError: string | null;
  };
  dissertation: {
    candidate: string;
    studentId: string;
    institution: string;
    module: string;
    title: string;
    researchApproach: string;
    scope: string;
  };
  benchmarkMetrics: {
    timestamp: string;
    precision: number;
    recall: number;
    f1Score: number;
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
  } | null;
  systemCapabilities: {
    totalGuidelineRules: number;
    totalASTPredicates: number;
    supportedFrameworks: string[];
    aiRemediationModel: string;
    evaluationDataset: {
      description: string;
      sizeTarget: string;
    };
  };
  userStudy: UserStudyStatus;
  references: Array<{
    id: string;
    authors: string;
    year: number;
    title: string;
    venue: string;
    pages?: string | null;
    volume?: string;
    url?: string;
    doi?: string | null;
  }>;
  researchQuestions: Array<{ id: string; text: string }>;
  researchObjectives: Array<{ id: string; text: string }>;
  researchGaps: Array<{ id: string; title: string; desc: string }>;
}

interface UseResearchMetricsResult {
  data: ResearchMetricsPayload | null;
  loading: boolean;
  error: string | null;
}

export function useResearchMetrics(): UseResearchMetricsResult {
  const [data, setData] = useState<ResearchMetricsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchMetrics() {
      try {
        const res = await fetch('/api/research-metrics', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ResearchMetricsPayload = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMetrics();
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}
