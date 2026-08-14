/**
 * Framework-Independent Guideline Model (FIGM)
 * Dissertation Artifact & LaTeX Report Exporter
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EvaluationRunner } from '../eval/evaluation-runner.js';
import { CORE_ALPS, FOUR_LAYER_MAPPINGS, FORMAL_PREDICATES_MAP } from '../matrix/four-layer-meta-model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DissertationExporter {
  public static exportAllArtifacts(): string[] {
    const rootDir = path.resolve(__dirname, '../../');
    const docsDir = path.join(rootDir, 'docs/dissertation');

    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    const evalResults = EvaluationRunner.runEvaluation();
    const exportedFiles: string[] = [];

    // 1. Chapter 3: System Architecture & Meta-Model (.tex)
    const ch3Tex = this.generateChapter3LaTeX();
    const ch3Path = path.join(docsDir, 'chapter3_architecture.tex');
    fs.writeFileSync(ch3Path, ch3Tex, 'utf-8');
    exportedFiles.push(ch3Path);

    // 2. Chapter 4: Implementation & Formal Predicates (.tex)
    const ch4Tex = this.generateChapter4LaTeX();
    const ch4Path = path.join(docsDir, 'chapter4_implementation.tex');
    fs.writeFileSync(ch4Path, ch4Tex, 'utf-8');
    exportedFiles.push(ch4Path);

    // 3. Chapter 5: Empirical Evaluation & Results (.tex)
    const ch5Tex = this.generateChapter5LaTeX(evalResults);
    const ch5Path = path.join(docsDir, 'chapter5_evaluation.tex');
    fs.writeFileSync(ch5Path, ch5Tex, 'utf-8');
    exportedFiles.push(ch5Path);

    console.log(`[FIGM EXPORTER] Successfully exported LaTeX dissertation artifacts to:`);
    exportedFiles.forEach((f) => console.log(`  - ${f}`));

    return exportedFiles;
  }

  private static generateChapter3LaTeX(): string {
    return `% Chapter 3: System Architecture & Meta-Model
\\chapter{System Architecture \\& Framework-Independent Meta-Model}
\\label{ch:architecture}

\\section{The 4-Layer Hierarchy}
The Framework-Independent Guideline Model (FIGM) establishes a 4-layer hierarchical abstraction architecture:
\\begin{equation}
\\text{Quality Domain (Layer 1)} \\longrightarrow \\text{Architectural Concern (Layer 2)} \\longrightarrow \\text{Abstract Language Primitive (Layer 3)} \\longrightarrow \\text{Guideline Rule (Layer 4)}
\\end{equation}

\\section{Abstract Language Primitives (ALPs)}
Table~\\ref{tab:figm_alps} details the 8 core Abstract Language Primitives (ALPs) spanning AST constructs across React, Angular, Vue, and Svelte single-page application paradigms.

\\begin{table}[htbp]
\\centering
\\caption{FIGM Core Abstract Language Primitives (ALPs)}
\\label{tab:figm_alps}
\\begin{tabular}{lll}
\\toprule
\\textbf{ALP ID} & \\textbf{Primitive Name} & \\textbf{Target AST Constructs} \\\\
\\midrule
${CORE_ALPS.map(
  (a) => `${a.id} & ${a.name} & ${a.astNodeType.slice(0, 2).join(', ')} \\\\`
).join('\n')}
\\bottomrule
\\end{tabular}
\\end{table}

\\section{AST Normalization Protocol}
FIGM parses framework templates into unified ESTree-compatible nodes via resilient source parsing, converting JSX, Vue SFC templates, and Angular template expressions into normalized AST nodes for static evaluation.
`;
  }

  private static generateChapter4LaTeX(): string {
    const predicatesTex = Object.entries(FORMAL_PREDICATES_MAP)
      .map(([id, pred]) => `\\subsection{Formal Predicate for ${id}}\n\\begin{equation}\n${pred.replace(/<=>/g, '\\iff').replace(/\bAND\b/g, '\\land').replace(/\bNOT\b/g, '\\neg').replace(/\bOR\b/g, '\\lor').replace(/\bexists\b/g, '\\exists').replace(/\bin\b/g, '\\in')}\n\\end{equation}`)
      .join('\n\n');

    return `% Chapter 4: Implementation & Static Detection Engine
\\chapter{Implementation \\& Detection Predicate Engine}
\\label{ch:implementation}

\\section{Static Rule Execution Engine}
The FIGM static analysis engine matches extracted Abstract Language Primitives (ALPs) against formal boolean predicates over a normalized node representation. As of the AST migration documented in \\texttt{docs/architecture/AST\\_MIGRATION\\_MAP.md}, this normalized representation is populated by two distinct mechanisms depending on rule and framework: 15 of the 25 FIGM rules are detected via genuine TypeScript-compiler-API AST traversal for React, Next.js, plain JS/TS, and the TypeScript class body of Angular components (the frameworks/syntax for which a real parse is possible without adding a new dependency); the remaining rules, and every rule applied to Vue SFC markup or Angular's inline template markup (neither of which the TypeScript compiler can parse), are detected via a regex/substring text-heuristic over the source. This is not a uniform "unified AST traversal" claim -- it is a framework- and rule-gated hybrid, and every emitted finding is labeled with which of the two mechanisms produced it (\\texttt{sourceKind}: \\texttt{REAL\\_AST} or \\texttt{LEGACY\\_TEXT\\_HEURISTIC}) so this distinction is verifiable in the tool's own output, not only in this text.

${predicatesTex}

\\section{Resilient Source Parsing \\& Diagnostics}
The engine handles malformed syntax gracefully, isolating parse errors per component file and returning structured diagnostic reports annotated with WCAG 2.2 and ISO 25010 standard references.
`;
  }

  private static generateChapter5LaTeX(evalResults: ReturnType<typeof EvaluationRunner.runEvaluation>): string {
    return `% Chapter 5: Empirical Evaluation & Results
\\chapter{Empirical Evaluation \\& Accuracy Benchmarks}
\\label{ch:evaluation}

\\section{Overall System Accuracy}
The empirical benchmark suite evaluated FIGM across React JSX, Vue SFC, Angular component templates, and ES2022 scripts.
The system achieved an overall Precision of \\textbf{${(evalResults.overall.precision * 100).toFixed(1)}\\%}, Recall of \\textbf{${(evalResults.overall.recall * 100).toFixed(1)}\\%}, and F1-Score of \\textbf{${(evalResults.overall.f1Score * 100).toFixed(1)}\\%}.

\\section{Rule-by-Rule Accuracy Evaluation}
Table~\\ref{tab:rule_eval_results} presents the empirical evaluation breakdown for all 8 core guidelines.

\\begin{table}[htbp]
\\centering
\\caption{FIGM Rule Accuracy Matrix}
\\label{tab:rule_eval_results}
\\begin{tabular}{llcccccc}
\\toprule
\\textbf{Rule ID} & \\textbf{Domain} & \\textbf{TP} & \\textbf{FP} & \\textbf{FN} & \\textbf{Precision} & \\textbf{Recall} & \\textbf{F1-Score} \\\\
\\midrule
${evalResults.ruleMetrics
  .map(
    (r) =>
      `${r.ruleId} & ${r.domain} & ${r.truePositives} & ${r.falsePositives} & ${r.falseNegatives} & ${(r.precision * 100).toFixed(1)}\\% & ${(r.recall * 100).toFixed(1)}\\% & ${(r.f1Score * 100).toFixed(1)}\\% \\\\`
  )
  .join('\n')}
\\midrule
\\textbf{Overall} & \\textbf{All} & \\textbf{${evalResults.overall.truePositives}} & \\textbf{${evalResults.overall.falsePositives}} & \\textbf{${evalResults.overall.falseNegatives}} & \\textbf{${(evalResults.overall.precision * 100).toFixed(1)}\\%} & \\textbf{${(evalResults.overall.recall * 100).toFixed(1)}\\%} & \\textbf{${(evalResults.overall.f1Score * 100).toFixed(1)}\\%} \\\\
\\bottomrule
\\end{tabular}
\\end{table}

\\section{Developer Usability Study}
A target cohort of $N = 85$ student developers at NSBM Green University was planned for a System Usability Scale (SUS) evaluation of FIGM. As of this export, \\textbf{0 of 85} real participant responses have been collected (see \\texttt{research/CONSENT\\_FORM.md} and \\texttt{data/user-study-responses.json}) -- no SUS score, patch-acceptance rate, or satisfaction metric is reported here, because none has been measured from real data. A prior version of this chapter reported a completed evaluation with a specific SUS score and satisfaction percentages; those figures were fabricated (invented, with no underlying computation or data source) and have been retracted rather than replaced with different numbers.

\\section{Scan Throughput \\& Memory Usage}
\\begin{itemize}
    \\item \\textbf{Total Code Base Scanned}: ${evalResults.performanceMetrics.totalLinesOfCode} LOC
    \\item \\textbf{Scan Duration}: ${evalResults.performanceMetrics.totalScanDurationMs.toFixed(2)} ms
    \\item \\textbf{Scan Speed}: ${evalResults.performanceMetrics.scanSpeedLOCPerSec.toFixed(0)} LOC/sec
    \\item \\textbf{Peak Heap Memory Delta}: ${evalResults.performanceMetrics.peakMemoryMB.toFixed(2)} MB
\\end{itemize}
`;
  }
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].includes('dissertation-exporter')) {
  DissertationExporter.exportAllArtifacts();
}
