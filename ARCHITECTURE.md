# FIGM Code Inspector — System Architecture & Design Specification

This document presents the architectural topology, design patterns, software layers, and evaluation principles governing the FIGM Code Inspector cloud SaaS platform.

---

## 1. High-Level Architecture

```mermaid
graph TD
    Client["Client UI (Next.js 14 App Router)"] --> REST["REST API Layer (/api/*)"]
    REST --> Middleware["Auth & RBAC Middleware"]
    Middleware --> Services["Engine Layer (ScanRepository, ProjectRepository, etc.)"]
    Services --> Factory["RepositoryFactory"]
    Factory -->|Supabase Configured| SupabaseProvider["SupabaseStorageProvider"]
    Factory -->|Local Fallback| JsonProvider["JsonStorageProvider"]
    SupabaseProvider --> Postgres["Supabase PostgreSQL (Prisma ORM)"]
    SupabaseProvider --> Storage["Supabase Cloud Storage"]
    SupabaseProvider --> Realtime["Supabase WebSockets"]
    Services --> ASTEngine["FIGM 3-Stage AST Protocol"]
```

---

## 2. Architectural Principles & SOLID Adherence

1. **Single Responsibility Principle (SRP)**:
   - `SourceParser`: AST parsing.
   - `ALPExtractionEngine`: Normalizes AST into ALP format.
   - `RuleExecutionEngine`: Evaluates ALP nodes against FIGM rules.
   - `ExportService`: Formats inspection reports.

2. **Open/Closed Principle (OCP)**:
   - FIGM guidelines are mapped declaratively via `FOUR_LAYER_MAPPINGS`. New rules can be registered without mutating core parser algorithms.

3. **Liskov Substitution Principle (LSP)**:
   - `JsonStorageProvider` and `SupabaseStorageProvider` implement `IStorageProvider` and can be substituted transparently.

4. **Interface Segregation Principle (ISP)**:
   - Isolated granular repository contracts.

5. **Dependency Inversion Principle (DIP)**:
   - Repositories depend on `IStorageProvider` abstraction rather than database implementations.
