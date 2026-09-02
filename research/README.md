# FIGM Code Inspector — Empirical Research Data Collection Infrastructure

## Overview

This directory contains the production-ready empirical research data collection infrastructure, schemas, and anonymization protocols for the **Framework-Independent Guideline Model (FIGM) Code Inspector** dissertation project.

## Directory Structure

```
research/
├── raw/                      # Immutable raw survey & observation exports (e.g. CSV/XLSX)
├── processed/                # Normalized & structured research dataset tables
├── anonymized/               # Anonymized participant records stripping PII
├── analysis/                 # Executable statistical analysis scripts (SUS, Cronbach's alpha)
├── evidence/                 # Machine-readable output evidence artifacts
├── DATA_DICTIONARY.md        # Data dictionary & item definitions
├── DATA_COLLECTION_PROTOCOL.md # Standard operating procedure for human user study
└── ANONYMIZATION_PROTOCOL.md # Privacy, consent, and PII protection guidelines
```

## Methodology & Dataset Classification

1. **Synthetic Usability Model ($N=85$)**: Methodological validation model based on 85 simulated scoring vectors used to verify statistical pipeline calculation integrity prior to live human data collection. This $N$ is a pipeline-correctness test-fixture size only (src/eval/research-data-pipeline.ts) and is intentionally independent of the real participant target below -- it is not affected by, and must not be confused with, that target's revision.
2. **Architecture Benchmark Suite ($N=30$)**: Precompiled representative architecture benchmark vectors used for cross-framework rule evaluation.
3. **Ground Truth Annotations**: Expert-authored violation labels (`benchmarks/ground-truth.json`) used for dynamic Precision, Recall, and F1-score evaluation.
4. **Google Analytics 4 (Supplementary Behavioral Telemetry)**: Aggregate, non-identifying usage events (`src/lib/analytics.ts`) -- page views and scan/fix/user-study-task started/completed counts, framework and rule ID only, never source code or any personal identifier. Contributes descriptive usage context only (e.g. how often each framework's benchmark fixture was exercised); it is supplementary evidence and must never be presented as a substitute for the SUS/Cronbach's-alpha survey results (item 1 above), the independent expert Precision/Recall/F1 evaluation (item 3), or a real FCP/TTI runtime experiment. Disabled entirely unless `NEXT_PUBLIC_GA_MEASUREMENT_ID` is configured in production.
