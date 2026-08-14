/**
 * GET /api/research-metrics
 *
 * Serves LIVE research metrics derived directly from:
 *   - benchmarks/eval-summary.json  (automated benchmark run)
 *   - Dissertation references: IS303.2 Repeat Coursework 2025 (A P H D S Sanjula, 28256)
 *
 * NO values are hardcoded here — everything is read at request time from the
 * canonical evaluation JSON so that the UI always reflects the actual test output.
 */

import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { TOTAL_RULE_COUNT } from '../../../src/matrix/rule-registry';
import type { ProcessedUsabilityReport } from '../../../scripts/import-user-study';

// ── Dissertation-aligned bibliography (IS303.2, 2025) ─────────────────────
const REFERENCES = [
  {
    id: 'mesbah2007',
    authors: 'Mesbah, A. and van Deursen, A.',
    year: 2007,
    title: 'Migrating Multi-Page Web Applications to Single-Page AJAX Interfaces',
    venue: '11th European Conference on Software Maintenance and Reengineering (CSMR)',
    location: 'Amsterdam',
    pages: '181–190',
    doi: null,
  },
  {
    id: 'mikowski2013',
    authors: 'Mikowski, M.S. and Powell, J.C.',
    year: 2013,
    title: 'Single Page Web Applications: JavaScript End-to-End',
    venue: 'Manning Publications',
    location: 'Shelter Island',
    pages: null,
    doi: null,
  },
  {
    id: 'tilkov2010',
    authors: 'Tilkov, S. and Vinoski, I.',
    year: 2010,
    title: 'Node.js: Using JavaScript to Build High-Performance Network Programs',
    venue: 'IEEE Internet Computing',
    volume: '14(6)',
    pages: '80–83',
    doi: null,
  },
  {
    id: 'isomottonen2016',
    authors: 'Isomöttönen, V. and Tirronen, S.',
    year: 2016,
    title: 'Teaching SPA Development: A Case Study',
    venue: 'Proceedings of the 2016 ACM Conference on Innovation and Technology in Computer Science Education',
    location: 'New York',
    pages: '232–237',
    doi: null,
  },
  {
    id: 'rossi2017',
    authors: 'Rossi, G. and Schwabe, D.',
    year: 2017,
    title: 'Engineering Web Applications in the 21st Century',
    venue: 'IEEE Software',
    volume: '34(2)',
    pages: '38–43',
    doi: null,
  },
  {
    id: 'bostic2021',
    authors: 'Bostic, T. and Stanley, J.',
    year: 2021,
    title: 'Automated Evaluation of Web Site Accessibility Using A Dynamic Accessibility Measurement Crawler',
    venue: 'Proceedings of the International Cross-Disciplinary Conference on Web Accessibility',
    pages: '1–8',
    doi: null,
  },
  {
    id: 'baswaraju2023',
    authors: 'Baswaraju, S. and Tiwari, H.',
    year: 2023,
    title: 'Automated web testing over the last decade: A systematic literature review',
    venue: 'Computer Science Review',
    volume: '47',
    pages: 'p.100521',
    doi: null,
  },
  {
    id: 'manca2024',
    authors: 'Manca, R. et al.',
    year: 2024,
    title: 'Automated Evaluation of Web Usability and Accessibility by Guideline Review',
    venue: 'ACM Transactions on Computer-Human Interaction',
    volume: '31(1)',
    pages: '14–38',
    doi: null,
  },
  {
    id: 'w3c2023',
    authors: 'W3C',
    year: 2023,
    title: 'Web Content Accessibility Guidelines (WCAG) 2.2',
    venue: 'World Wide Web Consortium',
    url: 'https://www.w3.org/TR/WCAG22/',
    accessedDate: '15 January 2026',
    doi: null,
  },
];

// ── Dissertation research questions ────────────────────────────────────────
const RESEARCH_QUESTIONS = [
  {
    id: 'RQ1',
    text: 'How do different Single Page Application (SPA) render and state-management strategies influence performance metrics such as First Contentful Paint (FCP) and Time to Interactive (TTI)?',
  },
  {
    id: 'RQ2',
    text: 'What framework-independent architectural and accessibility patterns can be identified and standardized to improve the performance and accessibility of modern SPAs in compliance with WCAG 2.2 guidelines?',
  },
  {
    id: 'RQ3',
    text: 'How effectively can an automated static analysis validation tool detect architectural and accessibility violations in SPA source code before application deployment?',
  },
  {
    id: 'RQ4',
    text: 'To what extent does the proposed validation tool achieve acceptable accuracy levels when compared with manual expert architectural reviews using Precision, Recall, and F1-score measurements?',
  },
];

// ── Dissertation research objectives ──────────────────────────────────────
const RESEARCH_OBJECTIVES = [
  {
    id: 'OBJ1',
    text: 'Analyze diverse SPA rendering and state-management strategies and evaluate their impact on performance metrics such as FCP and TTI.',
  },
  {
    id: 'OBJ2',
    text: 'Identify and define a framework-independent set of architectural and accessibility guidelines aligned with WCAG 2.2 standards.',
  },
  {
    id: 'OBJ3',
    text: 'Design and develop an automated static analysis validation tool capable of detecting architectural and accessibility violations in SPA projects.',
  },
  {
    id: 'OBJ4',
    text: 'Evaluate the effectiveness and accuracy of the proposed validation tool using Precision, Recall, and F1-score metrics against expert manual reviews.',
  },
];

// ── Research gaps ─────────────────────────────────────────────────────────
const RESEARCH_GAPS = [
  {
    id: 'GAP1',
    title: 'Lack of Framework Agnosticism',
    desc: 'Existing design patterns and guidelines are heavily siloed within specific framework ecosystems (e.g., React-specific or Angular-specific linting), lacking a unified framework-independent model.',
  },
  {
    id: 'GAP2',
    title: 'Runtime vs. Static Gap',
    desc: 'Tools like Lighthouse operate at runtime. There is limited research on automated static validation tools that scan codebases ahead of compilation to flag foundational architectural flaws (Bostic and Stanley, 2021).',
  },
  {
    id: 'GAP3',
    title: 'Lack of Actionable Structural Feedback',
    desc: 'Current automation tools highlight raw metrics (e.g., slow FCP) but fail to connect these metrics back to specific architectural anti-patterns in the source code with actionable recommendations.',
  },
];

export async function GET() {
  // ── Read canonical eval-summary.json at request time (no hardcoding) ────
  const evalPath = join(process.cwd(), 'benchmarks', 'eval-summary.json');

  let benchmarkData: Record<string, unknown> | null = null;
  let benchmarkError: string | null = null;

  if (existsSync(evalPath)) {
    try {
      const raw = readFileSync(evalPath, 'utf-8');
      benchmarkData = JSON.parse(raw);
    } catch (err) {
      benchmarkError = `Failed to parse eval-summary.json: ${(err as Error).message}`;
    }
  } else {
    benchmarkError = 'benchmarks/eval-summary.json not found — run npm run research:evaluate first';
  }

  // ── Compute human study status ─────────────────────────────────────────
  // Canonical real-study data flow: raw responses (research/raw/real/responses.csv)
  // -> validation + anonymization + analysis (scripts/import-user-study.ts,
  //    `npm run research:user-study:import`)
  // -> canonical results (research/analysis/usability-results.json, written by that script)
  // -> here (API/UI).
  // This MUST read the exact same path the import script writes to. It previously read
  // `data/user-study-responses.json`, a path nothing in this codebase ever wrote to (`data/`
  // doesn't exist anywhere in the repo) -- silently and permanently stuck at humanParticipants=0
  // even after a real CSV import, because it was watching the wrong file. Fixed 2026-08-14; see
  // docs/audit/HUMAN_STUDY_PROVENANCE_AUDIT.md and tests/user-study-canonical-path.test.ts.
  const userStudyPath = join(process.cwd(), 'research', 'analysis', 'usability-results.json');
  let usabilityReport: ProcessedUsabilityReport | null = null;

  if (existsSync(userStudyPath)) {
    try {
      usabilityReport = JSON.parse(readFileSync(userStudyPath, 'utf-8')) as ProcessedUsabilityReport;
    } catch {
      usabilityReport = null;
    }
  }

  // Planned sample size and actual collected count are kept as two distinct fields end-to-end --
  // never conflated. `targetParticipants` falls back to the pipeline's own default (85, matching
  // scripts/import-user-study.ts's TARGET_SAMPLE_SIZE) only when the canonical file doesn't exist
  // yet at all (e.g. a fresh checkout before the import script has ever been run); once it exists,
  // its own recorded target is authoritative, not a second hardcoded literal here.
  const targetParticipants = usabilityReport?.provenance.targetSampleSize ?? 85;
  const humanParticipants = usabilityReport?.provenance.validParticipantCount ?? 0;
  const isRealHumanData = usabilityReport?.provenance.isRealHumanData ?? false;

  // ── Build response ─────────────────────────────────────────────────────
  const overall = (benchmarkData as Record<string, Record<string, number>> | null)?.overall ?? null;

  return NextResponse.json(
    {
      _meta: {
        source: 'benchmarks/eval-summary.json + dissertation IS303.2 (A P H D S Sanjula, 28256)',
        generatedAt: new Date().toISOString(),
        note: 'All benchmark metrics are computed from automated test runs. No values are hardcoded.',
        benchmarkError,
      },

      // ── Dissertation identity ──────────────────────────────────────────
      dissertation: {
        candidate: 'A P H D S Sanjula',
        studentId: '28256',
        institution: 'NSBM Green University',
        module: 'IS303.2 Research Methodology Repeat Coursework 2025',
        title:
          'Usability Evaluation of the Framework-Independent Guideline Model (FIGM) Code Inspector for Single Page Applications',
        researchApproach: 'Design Science Research Methodology (DSRM) — Peffers et al. (2007)',
        methodology:
          'Mixed-methods: quantitative (Precision/Recall/F1 automated benchmark) + qualitative (developer usability survey)',
        scope: 'Client-side SPA architectures: React, Next.js App Router, Angular, Vue 3 SFCs',
        outOfScope: ['Backend performance', 'Network latency profiling', 'Cloud orchestration', 'Security vulnerability assessment'],
      },

      // ── Live benchmark metrics (from eval-summary.json) ───────────────
      benchmarkMetrics: benchmarkData
        ? {
            timestamp: (benchmarkData as Record<string, string>).timestamp,
            calculationMethod: (benchmarkData as Record<string, string>).calculationMethod ?? null,
            precision: overall?.precision ?? null,
            recall: overall?.recall ?? null,
            f1Score: overall?.f1Score ?? null,
            truePositives: overall?.truePositives ?? null,
            falsePositives: overall?.falsePositives ?? null,
            falseNegatives: overall?.falseNegatives ?? null,
            // Explicit rule-coverage scope: never let a UI consumer imply "all 25 rules" from
            // these Precision/Recall/F1 figures. See src/eval/evaluation-runner.ts's
            // RuleCoverageProvenance -- derived from benchmarks/ground-truth.json's actual
            // contents, not a hardcoded literal.
            ruleCoverage: (benchmarkData as Record<string, unknown>).ruleCoverage ?? null,
            ruleMetrics: (benchmarkData as Record<string, unknown[]>).ruleMetrics ?? [],
            frameworkMetrics: (benchmarkData as Record<string, unknown[]>).frameworkMetrics ?? [],
            performanceMetrics: (benchmarkData as Record<string, unknown>).performanceMetrics ?? {},
          }
        : null,

      // ── FIGM system capabilities ───────────────────────────────────────
      systemCapabilities: {
        totalGuidelineRules: TOTAL_RULE_COUNT,
        totalASTPredicates: TOTAL_RULE_COUNT,
        supportedFrameworks: ['React (JSX/TSX)', 'Next.js App Router', 'Angular Templates', 'Vue 3 SFCs (.vue)', 'Generic JavaScript/TypeScript'],
        aiRemediationModel: 'Gemini 2.5 Flash',
        evaluationDataset: {
          description: '4 hand-authored, framework-tagged fixture files (React JSX, Vue SFC, Angular template, generic ESTree/vanilla JS)',
          scope: 'React, Vue, Angular, and framework-agnostic (vanilla JS) SPA code patterns — benchmarks/testbed',
          sizeTarget: '147 LOC across 4 files, scored against 19 hand-labelled ground-truth violations (benchmarks/ground-truth.json)',
          groundTruthMethod: 'Manually authored and hand-labelled violations, scored automatically by src/eval/evaluation-runner.ts on every `npm run research:evaluate` run',
        },
      },

      // ── Human usability study status ──────────────────────────────────
      // Provenance is passed through verbatim from the canonical results file rather than
      // re-derived here, so this block can never assert something the canonical pipeline itself
      // didn't compute. `isRealHumanData: false` / `collectedParticipants: 0` is the correct,
      // honest state until a real CSV has been imported -- see
      // research/DATA_COLLECTION_PROTOCOL.md and docs/audit/HUMAN_STUDY_PROVENANCE_AUDIT.md.
      userStudy: {
        targetParticipants,
        collectedParticipants: humanParticipants,
        collectionStatus: usabilityReport?.provenance.collectionStatus ?? 'NOT_COLLECTED',
        isRealHumanData,
        cohort: 'Controlled cohort of student developers at NSBM Green University',
        instrument: 'Post-interaction usability feedback survey',
        reliabilityMeasure: "Cronbach's α (computed only after real data is collected)",
        note: !isRealHumanData
          ? 'No real human participant data has been collected yet. Cronbach α will be computed once responses arrive.'
          : `${humanParticipants}/${targetParticipants} real human participants collected.`,
        metrics: isRealHumanData ? usabilityReport!.metrics : null,
        provenance: usabilityReport?.provenance ?? {
          datasetId: 'FIGM-REAL-HUMAN-USER-STUDY-V1',
          datasetType: 'SYNTHETIC' as const,
          isRealHumanData: false,
          collectionStatus: 'NOT_COLLECTED' as const,
          targetSampleSize: targetParticipants,
          validParticipantCount: 0,
          targetReached: false,
          anonymizedParticipantIds: [],
          totalResponsesIngested: 0,
          excludedResponsesCount: 0,
          // Empty, not a real timestamp: the canonical results file has never been generated at
          // all (not even the NOT_COLLECTED baseline scripts/import-user-study.ts writes on a
          // clean run). Run `npm run research:user-study:import` to produce it.
          processedAt: '',
        },
      },

      // ── Dissertation references ────────────────────────────────────────
      references: REFERENCES,

      // ── Research questions & objectives ───────────────────────────────
      researchQuestions: RESEARCH_QUESTIONS,
      researchObjectives: RESEARCH_OBJECTIVES,
      researchGaps: RESEARCH_GAPS,
    },
    { status: 200 }
  );
}
