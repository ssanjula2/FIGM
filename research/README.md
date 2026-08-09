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

1. **Synthetic Usability Model ($N=85$)**: Methodological validation model based on 85 simulated scoring vectors used to verify statistical pipeline calculation integrity prior to live human data collection.
2. **Architecture Benchmark Suite ($N=30$)**: Precompiled representative architecture benchmark vectors used for cross-framework rule evaluation.
3. **Ground Truth Annotations**: Expert-authored violation labels (`benchmarks/ground-truth.json`) used for dynamic Precision, Recall, and F1-score evaluation.
