# Privacy and Anonymization Protocol

**Project**: FIGM Code Inspector  
**Standard**: GDPR / Academic Research Data Anonymization Standards  

## 1. PII Stripping Guidelines

- **Names / Emails**: No personal names, email addresses, IP addresses, or GitHub usernames are stored in research response files.
- **Participant Hash**: Each participant is assigned a sequential ID (`P001`, `P002`, ...).

## 2. Storage & Immutable Raw Data

- Raw CSV files are stored in `/research/raw/` and marked read-only.
- Processed analysis exports are written to `/research/processed/` and `/research/evidence/`.
- No raw response data is committed with PII.
