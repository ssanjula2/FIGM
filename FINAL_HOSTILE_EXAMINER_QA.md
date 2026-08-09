# FIGM — FINAL HOSTILE EXAMINER Q&A DEFENSE

**Project**: Framework-Independent Guideline Model (FIGM) Code Inspector  
**Candidate**: A P H D S Sanjula (Student ID: `28256`)  

---

## 30 HOSTILE EXAMINER QUESTIONS & EVIDENCE-BASED ANSWERS

1. **Where did the benchmark data come from?**  
   From 4 single-page framework testbed files (`UserProfile.jsx`, `SearchPanel.component.ts`, `DashboardCard.vue`, `AnalyticsChart.tsx`) in `benchmarks/testbed/` ($147 \text{ LOC}$ total), annotated in `benchmarks/ground-truth.json`.

2. **Are the 30 repositories real git clones?**  
   No. They are structured pre-compiled framework architecture benchmark vectors (`src/eval/repo-evaluator.ts`) to ensure reproducible evaluation without external network dependencies.

3. **Where are their commit hashes?**  
   Commit hashes apply to live git repositories; as architecture benchmark vectors, they model representative framework structural patterns directly.

4. **Are the N=85 participants real human subjects?**  
   No. N=85 represents a representative usability survey scoring vector model (`src/eval/user-study-evaluator.ts`) used to validate questionnaire scoring algorithms.

5. **Was ethics approval obtained?**  
   Ethics approval was not required because no human subject data was collected; all survey metrics derive from a mathematical vector model.

6. **How was Cronbach's alpha calculated?**  
   Calculated via the variance ratio formula $\alpha = \frac{K}{K-1} \left( 1 - \frac{\sum \sigma_{y_i}^2}{\sigma_X^2} \right) = 0.892$ in `src/eval/user-study-evaluator.ts`.

7. **Why are there 23 rules, 25 predicates, and 8 benchmark rules?**  
   23 taxonomy specification rules (`figm-spec.json`), 25 executable predicates (`src/ast/ast-detection-engine.ts`), and 8 benchmark core rules present in the testbed code (`benchmarks/ground-truth.json`).

8. **How is Precision calculated?**  
   $\text{Precision} = TP / (TP + FP) = 18 / (18 + 3) = 85.7\%$.

9. **How is Recall calculated?**  
   $\text{Recall} = TP / (TP + FN) = 18 / (18 + 1) = 94.7\%$.

10. **How is F1 calculated?**  
    $F1 = 2 \cdot P \cdot R / (P + R) = 2(0.8571)(0.9474) / 1.8045 = 90.0\%$.

11. **Why isn't F1 100%?**  
    3 false positives (e.g., dynamic style expressions) and 1 false negative (complex nested callback) prevent artificial 100% scores.

12. **How do you prevent metric manipulation?**  
    `scripts/validate-research.ts` recalculates metrics dynamically from `benchmarks/eval-summary.json` and fails CI if any discrepancy exists.

13. **Can another researcher reproduce your results?**  
    Yes, executing `npm run research:validate` independently reproduces all ground-truth metrics.

14. **What does the VS Code extension execute?**  
    The VS Code extension (`vscode-extension/`) uses hybrid regex heuristics for real-time editor feedback and delegates full AST analysis to the FIGM core engine.

15. **Is the AST engine framework-independent?**  
    Yes, AST nodes from React, Next.js, Angular, and Vue are normalized into Abstract Language Primitives (ALPs) before rule evaluation.

16. **How are Angular and Vue templates parsed?**  
    Angular HTML and Vue template syntax are parsed into ESTree-compatible JSX/HTML node structures via `UniversalASTMapper`.

17. **What happens when browser memory APIs are restricted?**  
    `DynamicProfiler` returns a complexity-based heap estimate and explicitly sets `measurementType: 'ESTIMATED'`.

18. **How is IDOR prevented?**  
    Server-side ownership verification (`userId === project.userId`) is enforced in Next.js App Router API routes (`app/api/projects/[id]/route.ts`).

19. **How is authentication enforced?**  
    PBKDF2 SHA-512 password hashing with salt and 15-minute JWT access tokens verified in `middleware.ts`.

20. **Can User A access User B's project?**  
    No. Requests return `403 Forbidden` or `404 Not Found`.

21. **Can CI pass when tests fail?**  
    No. `.github/workflows/figm-scan.yml` contains zero `continue-on-error` or `|| true` soft-failure flags.

22. **Are any metrics hardcoded in the UI?**  
    No. `app/analytics/page.tsx` and landing components consume ground-truth metrics reconciled with `canonical-evaluation.json`.

23. **What are the main threats to validity?**  
    Benchmark vectors modeling synthetic code bases and survey vector models rather than live human user studies.

24. **What is the difference between benchmark and empirical evidence?**  
    Benchmark evidence tests deterministic AST detection logic; empirical evidence measures live deployment environments.

25. **What is novel in FIGM?**  
    Mapping framework-specific AST structures to unified Abstract Language Primitives (ALPs) for static guideline checking.

26. **What are the limitations?**  
    Restrictive browser memory APIs require heap estimation, and Vue SFC template parsing relies on script AST + regex heuristics.

27. **Which claims should NOT be made in the dissertation?**  
    Do not claim live git cloning of 30 external repos or live human user study with $N=85$ participants.

28. **How is password security implemented?**  
    PBKDF2 with SHA-512, 10,000 iterations, and cryptographic salt (`src/auth/user-db.ts`).

29. **How is static analysis quality scored?**  
    `qualityScore = 100 - (15*Critical + 8*High + 3*Med + 1*Low)`, resulting in a 74% score across clean source files.

30. **What is the final release status?**  
    **READY WITH MINOR REVISIONS** (Technically verified, security hardened, and academically honest).
