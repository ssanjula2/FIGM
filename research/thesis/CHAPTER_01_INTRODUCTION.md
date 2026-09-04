# Chapter 1: Introduction

## 1.1 Chapter Overview

This chapter introduces the research problem addressed by this dissertation. It sets out the background and context of modern Single Page Application (SPA) development, states the general and specific problems this research responds to, presents the research question and its four constituent sub-questions, explains the motivation for the study, and states the research aim and objectives. It then presents a conceptual overview (rich picture) of the proposed solution, the resources the research required, and the boundaries of the project scope. The chapter closes with a summary that leads into Chapter 2's review of the relevant literature. No results, measurements, or evaluation outcomes are reported in this chapter; these are reserved for Chapters 5 and 6, once the evidence supporting them has been presented.

## 1.2 Problem Background

Over the last decade, web application architecture has shifted markedly from the Multi-Page Application (MPA) model — in which the server returns a complete HTML document for every user action — toward the Single Page Application (SPA) model, in which a single initial page load is followed by client-side, asynchronous updates to the document without a full page refresh [12]. This shift was enabled by, and has in turn driven the maturity of, component-based frontend frameworks that manage rendering, state, and client-side routing on the developer's behalf [13]. This research treats **React** [17], **Next.js** [18], and **Angular** [19] as its primary framework environments, on the basis that they represent, respectively, a widely adopted client-rendering library, a production React framework with built-in server-rendering and routing conventions, and a full application framework with its own template and dependency-injection model — together spanning the principal architectural styles found in contemporary SPA development. **Vue.js** [20] is additionally recognised by the automated validation tool developed for this research (Chapter 4), but is not treated as a primary framework for guideline derivation or evaluation; Section 1.10 states this distinction precisely.

Each of these frameworks solves the same underlying problems — component composition, client-side routing, and application state management — through its own idiomatic syntax and compilation model. A performance or accessibility defect that is conceptually identical across frameworks can therefore manifest as syntactically unrelated source code in each one: an inline object literal re-created on every render in a React component, the equivalent pattern inside a Vue single-file component's `<script>` block, or inside an Angular component class, are the same underlying architectural concern expressed through three different Abstract Syntax Trees (ASTs). Systematic web engineering has long argued that this kind of complexity is best addressed through planned, discipline-level design rather than through ad hoc, per-project convention [16]; the practical difficulty is that most quality guidance available to developers today is written and enforced at the level of an individual framework's own tooling, not at the level of the underlying architectural concern.

This difficulty is compounded because the quality attributes at stake — performance and accessibility — are themselves defined independently of any implementation technology. ISO/IEC 25010:2011 defines *Performance Efficiency* as one of several product quality characteristics that any software system can be assessed against, regardless of the technology used to build it [1]. The Web Content Accessibility Guidelines (WCAG) 2.2 likewise state their success criteria as testable, technology-neutral conditions rather than as prescriptions tied to a specific framework's API [2]. The result is what this dissertation treats as an *enforcement gap*: a standard expressed in framework-neutral language has no direct, executable counterpart capable of inspecting a specific React component, Vue single-file component, or Angular template and determining whether that standard is met.

Two further, related challenges motivate this research. First, rendering strategy and state-management strategy are architectural decisions made early in a project's life, and their influence on measurable performance outcomes such as First Contentful Paint (FCP) and Time to Interactive (TTI) is not always transparent to development teams working within a single framework's conventions — this is the concern RQ1 (Section 1.4) investigates directly, through a controlled experiment described in Chapter 3 and reported in Chapter 6. Second, dynamically updating content without a full page reload — the defining characteristic of an SPA — introduces accessibility risks that do not arise in the same way in traditional server-rendered pages, particularly around focus management, keyboard operability, and announcing state changes to assistive technology; automated crawler-based accessibility evaluation has been an active area of research in response to exactly this class of problem [14], and empirical work on the design and transparency of automated accessibility evaluation tooling more broadly has highlighted how differently such tools can behave depending on what they are built to check and how that scope is communicated to their users [15].

A further, practical limitation runs through much of the existing tooling landscape: most automated quality tools evaluate an application only after it has been built and, typically, deployed or run in a browser — a runtime or post-deployment evaluation model. This provides a measurement of the symptom (a slow paint time, a failed accessibility audit rule) without necessarily connecting that symptom back to the specific architectural or source-code decision that caused it, and without giving a development team the opportunity to catch the underlying issue before the code is merged. This dissertation argues that a framework-agnostic guideline model, combined with a static, pre-deployment validation tool capable of inspecting source code directly, is a necessary complement to — not a replacement for — existing runtime evaluation tools, and this argument is developed into the specific research problem stated in Section 1.3.

## 1.3 Problem Statement

### 1.3.1 General Problem

Modern organisations increasingly deliver core digital services — in healthcare, education, finance, and commerce — through SPAs. Because frontend frameworks provide the building blocks for interactive interfaces but do not themselves impose architectural rules, individual project teams typically arrive at their own architectural conventions, shaped by team preference and immediate project pressure rather than by a shared, standardised body of guidance. Where this happens, the consequences reported in the software engineering literature and observed across the frameworks reviewed in Chapter 2 include degraded maintainability, inconsistent architecture between teams and between projects using different frameworks, elevated performance risk from patterns such as unnecessary re-rendering or unmanaged JavaScript bundle growth, and accessibility barriers for users who rely on assistive technology. Left unaddressed, these problems compound into technical debt that becomes progressively more expensive to correct the later it is discovered. No specific quantitative estimate of this cost is claimed here; the general problem is stated qualitatively, consistent with the absence of a single authoritative, cross-framework measurement of it in the literature reviewed for this dissertation (Chapter 2).

### 1.3.2 Specific Problem

Existing approaches to this general problem remain fragmented along five distinct lines, each of which this dissertation treats as part of the research gap it addresses:

1. **Fragmented, framework-specific guidance.** Architectural and quality guidance for SPA development is typically published and enforced per framework — a React-specific linting convention, an Angular style guide, a Vue-specific set of best practices — with no shared, formal statement of the underlying guideline that a reader could confirm is the same rule expressed three different ways.
2. **Limited framework-agnostic architectural guidance.** Where framework-agnostic principles are discussed at all, they tend to remain at the level of prose recommendation rather than being operationalised into a structure that could be consistently applied, and checked, across multiple frameworks.
3. **A gap between runtime assessment and pre-deployment static validation.** The reviewed literature and existing tooling landscape (Chapter 2) showed a strong emphasis on runtime and post-deployment measurement — auditing a running page in a browser — with comparatively limited emphasis on static, pre-deployment analysis of the source code that produced that page.
4. **A limited connection from observed quality symptoms to actionable source-code structure.** Tools that do report a performance or accessibility problem frequently report the symptom (e.g., a slow paint metric, a failed automated accessibility check) without identifying the specific architectural pattern in the source code responsible for it, leaving the developer to diagnose the root cause manually.
5. **No single framework-agnostic model combining both performance-oriented architectural guidance and statically detectable accessibility guidance.** Performance-focused tooling and accessibility-focused tooling have, in the tools and literature reviewed for this dissertation, generally developed as separate concerns rather than as two facets of one guideline model that could be defined, and validated, together.

This is the research gap this dissertation addresses: the absence of a validated, framework-agnostic guideline model — covering both performance-oriented architectural patterns and a statically detectable subset of accessibility guidance — together with an automated tool capable of checking a codebase against that model before deployment, across more than one SPA framework.

## 1.4 Research Question

**Main Research Question:** How can a framework-agnostic guideline model and an automated validation tool be designed and implemented to improve the performance and accessibility of modern Single Page Applications?

- **RQ1:** How do different Single Page Application (SPA) render and state-management strategies influence performance metrics such as First Contentful Paint (FCP) and Time to Interactive (TTI)?
- **RQ2:** What framework-agnostic architectural and accessibility patterns can be identified and standardized to improve the performance and accessibility of modern SPAs in compliance with WCAG 2.2 guidelines?
- **RQ3:** How effectively can an automated static analysis validation tool detect architectural and accessibility violations in SPA source code before application deployment?
- **RQ4:** To what extent does the proposed validation tool achieve acceptable accuracy levels when compared with manual expert architectural reviews using Precision, Recall, and F1-score measurements?

## 1.5 Research Motivation

The motivation for this research is both academic and practical. Academically, Section 1.2 identified an enforcement gap between framework-neutral quality standards — ISO/IEC 25010's Performance Efficiency characteristic [1] and WCAG 2.2's technology-neutral success criteria [2] — and the framework-specific tooling that development teams actually use day to day. Closing part of that gap, even for a defined, statically detectable subset of the underlying standards, contributes a concrete artefact (the guideline model and validation tool described in Chapters 3–4) to a problem that is otherwise discussed mainly at the level of prose recommendation.

Practically, the three primary frameworks studied in this research — React, Next.js, and Angular — are in active, widespread use across the kinds of organisation named in Section 1.3.1, and Vue.js is in comparably wide use beyond them. A development team working across more than one of these frameworks currently has no single, shared reference point for architectural and accessibility quality that applies consistently regardless of which framework a given project uses; each framework's own ecosystem of linting and auditing tools must be learned, configured, and trusted separately, with no guarantee that a rule enforced in one project's framework carries the same meaning in another's. A validated, framework-agnostic guideline model — and a tool capable of applying it automatically, before deployment — offers a way to reduce that duplication of effort and to give a development team earlier, more actionable feedback than a post-deployment audit can provide. This motivation does not imply that framework-specific tooling is unnecessary or should be replaced; rather, it treats a framework-agnostic layer as a complement that existing tooling, reviewed in Chapter 2, does not yet provide in combined performance-and-accessibility form.

## 1.6 Research Aim

The aim of this research is to design, develop, and validate a comprehensive framework-agnostic guideline model, alongside an integrated automated validation tool, to improve the performance and accessibility of modern Single Page Applications.

This aim is pursued through a specific technical artefact, described in full in Chapters 3 and 4: the **Framework-Agnostic Guideline Model (FIGM)** — hereafter referred to as FIGM throughout this dissertation. FIGM formalises SPA performance and accessibility guidelines once, at a level of abstraction above any single framework's syntax, and projects them onto framework-specific, compiler-derived Abstract Syntax Trees, coupled with an automated static validation tool that applies the resulting rules to source code before deployment. (Within the project's own implementation artefacts, "Framework-Independent Guideline Model" is used interchangeably with "Framework-Agnostic Guideline Model" to refer to the identical concept and the identical FIGM acronym; this dissertation uses "framework-agnostic" as the primary term, consistent with the official research title and RQ2, and notes the equivalence here rather than alternating between the two terms without explanation.)

## 1.7 Research Objectives

The following four objectives align one-to-one with RQ1–RQ4 stated in Section 1.4.

### 1.7.1 To Identify Framework-Agnostic Architectural and Accessibility Patterns

To identify and define a framework-agnostic set of architectural and accessibility patterns that can be standardised to improve SPA performance and accessibility, in alignment with WCAG 2.2 guidelines. (Objective 2, addressing RQ2.)

### 1.7.2 To Analyze SPA Rendering and State-Management Strategies

To analyse diverse SPA rendering and state-management strategies and evaluate their influence on performance metrics such as First Contentful Paint (FCP) and Time to Interactive (TTI), so as to identify practices associated with better measured performance under controlled conditions. (Objective 1, addressing RQ1.)

### 1.7.3 To Design and Develop an Automated Validation Tool

To design and develop a framework-agnostic, static-analysis validation tool capable of detecting architectural anti-patterns and accessibility issues in SPA source code prior to deployment. (Objective 3, addressing RQ3.)

### 1.7.4 To Evaluate the Effectiveness of the Proposed Solution

To evaluate the effectiveness and accuracy of the proposed validation tool by comparing its detection results against independent expert architectural review, using Precision, Recall, and F1-score as the evaluation metrics. (Objective 4, addressing RQ4.)

## 1.8 Rich Picture of the Proposed Solution

The proposed solution addresses the performance and accessibility challenges identified in Section 1.2 through two linked artefacts: a framework-agnostic guideline model and an automated static validation tool built on it. Figure 1.1 summarises the intended conceptual workflow:

```
Primary SPA framework environments                Additional framework support
   React | Next.js | Angular                              Vue.js
            |                                                 |
            +---------------------+--------------------------+
                                   |
                 Pattern identification & literature/standards synthesis
                    (architectural patterns, rendering strategies,
                     state-management strategies, WCAG 2.2 mapping)
                                   |
                    Framework-Agnostic Guideline Model (FIGM)
                                   |
                       Automated static validation tool
                    (framework detection -> AST parsing ->
                       canonical rule execution -> findings)
                                   |
                     Findings, recommendations, and
                       (where available) remediation
                                   |
                              Evaluation
              (RQ1 controlled experiment, RQ2 guideline
               traceability, RQ3 real-world repository scan,
               RQ4 independent expert comparison)
```

**Figure 1.1.** Conceptual workflow of the proposed framework-agnostic guideline model and automated validation tool. React, Next.js, and Angular are shown as the primary environments from which the guideline model was derived and against which it was evaluated; Vue.js is shown separately as an additional framework recognised by the validation tool's framework-detection and analysis capability, consistent with Section 1.10's scope statement, and is not treated as equivalent to the three primary frameworks at the pattern-identification stage.

> **FIGURE_ACTIONS_REQUIRED:** The Research Proposal's and Interim Submission 02's own Figure 1.1 ("Rich Picture of the Proposed Framework-Agnostic Guideline Model and Automated Validation Tool") lists its top box as an undifferentiated flat list — "React | Angular | Next.js | Vue JS" — with no visual distinction between primary and additional frameworks. That flat listing does not reflect the scope this dissertation now states precisely in Interim Submission 02, Section 1.10, and in Section 1.10 below (Vue.js as additional support only). This existing figure was **not** silently redrawn or reinterpreted as if it already showed that distinction; instead, a corrected textual workflow is given above, and it is recorded here that **the original diagram graphic should be redrawn** — before this chapter is finalised for submission — to visually separate the primary-framework box from a clearly-labelled "additional framework support" box, consistent with the text description above. This is the only outstanding figure action for Chapter 1.

## 1.9 Resource Requirements

### 1.9.1 Hardware Requirements

| Hardware Component | Specification |
|---|---|
| Processor | Intel Core i5 (or equivalent) minimum |
| Memory (RAM) | 8 GB minimum |
| Storage | SSD storage |
| Internet Connectivity | Stable internet connection (for dependency installation, repository retrieval, and, where used, hosted database/deployment services) |

This is a conservative minimum specification for development, static-analysis execution, and running the controlled RQ1 experiment locally; the development and evaluation work for this dissertation was carried out on a machine meeting and exceeding this specification.

### 1.9.2 Software Requirements

| Software / Technology | Purpose |
|---|---|
| Visual Studio Code (VS Code) | Primary development environment and source-code management |
| Node.js runtime | Execution environment for the validation tool, its test suite, and the RQ1 experiment harness |
| TypeScript | Primary implementation language for the validation tool and its rule engine |
| Next.js and React | Web application framework and UI library used to implement the validation tool itself (authentication, project/scan management, live-scan API, and the RQ1 experimental fixture application) |
| AST/parser libraries (TypeScript Compiler API, `@vue/compiler-sfc`/`@vue/compiler-dom`, `angular-html-parser`) | Framework-specific source-code parsing that the guideline model's rules are executed against |
| Prisma with Supabase (PostgreSQL) | Managed database and schema-migration layer used to store user accounts, projects, and scan history for the validation tool |
| Node.js built-in test runner | Automated testing of the rule engine, parsers, and API surface |
| Lighthouse | Real-browser performance measurement tool used for the controlled RQ1 First Contentful Paint / Time to Interactive experiment (Chapter 3) |
| Git and GitHub | Version control and retrieval of the open-source repositories used in the RQ3 real-world evaluation |
| Vercel | Deployment platform used to host the validation tool for browser-based verification during development |
| Microsoft Word / Markdown | Research documentation and dissertation preparation |

This list is limited to technologies genuinely used in developing and evaluating the artefacts described in this dissertation; a complete dependency manifest is not reproduced here.

## 1.10 Project Scope

**Primary research frameworks:** React, Next.js, and Angular. **Additional implementation support:** Vue.js is recognised and supported by the automated validation tool's framework-detection and analysis capability, but is not one of the frameworks the guideline model was primarily derived from or evaluated against, and no answer to RQ1–RQ4 in this dissertation depends on a Vue-specific result.

| In Scope | Out of Scope |
|---|---|
| SPA frontend architecture (component structure, client-side routing, rendering strategy, state management) | Backend performance optimisation |
| Framework-agnostic guideline model covering architectural and performance-risk patterns | Network latency profiling as a system-optimisation investigation |
| A statically detectable subset of WCAG 2.2-related accessibility concerns (WCAG 2.2-aligned; not a claim of full WCAG 2.2 conformance) | Cloud orchestration and infrastructure-management research |
| Automated static source-code validation, pre-deployment | Deep security vulnerability assessment / penetration testing |
| A controlled First Contentful Paint / Time to Interactive investigation (RQ1) | Traditional non-SPA (multi-page) web architectures |
| Real-world open-source repository evaluation (RQ3) | — |
| An independent expert validation protocol (RQ4) | — |
| A supplementary developer usability study | — |

This research does not attempt whole-project build-level analysis (e.g., a full production `next build` or `ng build` step as part of the validation tool itself), full cross-file data-flow or points-to analysis, or general-purpose security vulnerability scanning.

The real-world repository evaluation (RQ3) targets 20–30 public open-source SPA repositories. The final evaluation design and its data-collection method are described in Chapter 3; the resulting evaluation outcome is reported in Chapter 6, not here.

The independent expert validation (RQ4) requires comparison against real, independent architectural review, collected under the protocol described in Chapter 3; this comparison had not been completed at the time of this writing, and no Precision, Recall, or F1-score figure attributed to it is reported in this dissertation until it is.

The supplementary developer usability evaluation targets a final sample of 20 real student-developer participants (identified as P001–P020 in the data-collection protocol, Chapter 3). This is a revision of an earlier, larger baseline target of 80–100 student developers stated in the original Research Proposal and Interim Submission 02; the reduction to 20 participants was a later, approved research-scope decision, and this dissertation treats 20 as the operative target throughout, while preserving the 80–100 figure as the documented historical baseline rather than erasing it. This usability evaluation is supplementary to, and does not substitute for, the independent expert validation that RQ4 requires.

## 1.11 Chapter Summary

This chapter set out the background to modern Single Page Application development across React, Next.js, and Angular, with Vue.js recognised as an additional framework; stated the general and specific problems arising from fragmented, framework-specific quality guidance and the gap between runtime and pre-deployment evaluation; presented the main research question and its four sub-questions; explained the academic and practical motivation for the research; and stated the research aim and the four objectives that operationalise it. It presented a conceptual rich picture of the proposed framework-agnostic guideline model and automated validation tool, the resources the research required, and the boundaries of the project scope, including the accessibility scope (a statically detectable subset of WCAG 2.2), the real-world evaluation scope, and the revised human-participant target. Chapter 2 now reviews the literature underpinning this research problem — SPA architecture, performance and accessibility engineering, static program analysis, and existing automated validation approaches — and identifies the specific gap in that literature this dissertation responds to.
