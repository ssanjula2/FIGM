/**
 * Framework-Independent Guideline Model (FIGM)
 * Dynamic Precision, Recall, F1-Score & Accuracy Metrics Engine
 */

export interface ConfusionMatrix {
  tp: number; // True Positives
  fp: number; // False Positives
  fn: number; // False Negatives
  tn: number; // True Negatives
}

export interface AccuracyMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  accuracy: number;
  specificity: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  confusionMatrix: ConfusionMatrix;
}

export interface GroundTruthAnnotation {
  filePath: string;
  ruleId: string;
  expectedLine?: number;
}

export interface DiagnosticDetection {
  filePath: string;
  ruleId: string;
  line?: number;
}

/** TP/FP/FN + Precision/Recall/F1 only -- deliberately has no `tn`/`accuracy`/`specificity`/
 *  false-positive-rate/false-negative-rate fields. Unlike `AccuracyMetrics`, this shape can be
 *  produced honestly from a detections-vs-ground-truth match alone: there is no well-defined
 *  "true negative" universe for a rule-based static-analysis benchmark (see
 *  docs/architecture/RESEARCH_METRICS_PIPELINE.md) -- a prior version of `calculateFromDetections`
 *  filled this gap with a hardcoded true-negative count of twenty-five ("controlled baseline
 *  negative class universe") that
 *  corresponded to no actual count of anything. Removed rather than "corrected" to a different
 *  number, since nothing in this codebase counts true negatives. */
export interface DetectionMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: { tp: number; fp: number; fn: number };
}

export class PrecisionRecallEngine {
  /**
   * Calculates metrics dynamically from a caller-supplied ConfusionMatrix. Pure formula function --
   * every field of `matrix` (including `tn`) must be a real, honestly-derived count; this method
   * never fabricates one.
   */
  public static calculateMetrics(matrix: ConfusionMatrix): AccuracyMetrics {
    const { tp, fp, fn, tn } = matrix;
    const total = tp + fp + fn + tn;

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const accuracy = total > 0 ? (tp + tn) / total : 0;
    const specificity = tn + fp > 0 ? tn / (tn + fp) : 0;
    const falsePositiveRate = fp + tn > 0 ? fp / (fp + tn) : 0;
    const falseNegativeRate = fn + tp > 0 ? fn / (fn + tp) : 0;

    return {
      precision: parseFloat((precision * 100).toFixed(2)),
      recall: parseFloat((recall * 100).toFixed(2)),
      f1Score: parseFloat((f1Score * 100).toFixed(2)),
      accuracy: parseFloat((accuracy * 100).toFixed(2)),
      specificity: parseFloat((specificity * 100).toFixed(2)),
      falsePositiveRate: parseFloat((falsePositiveRate * 100).toFixed(2)),
      falseNegativeRate: parseFloat((falseNegativeRate * 100).toFixed(2)),
      confusionMatrix: matrix,
    };
  }

  /**
   * Dynamically matches actual scanner detections against expected ground-truth annotations and
   * calculates the resulting TP/FP/FN and Precision/Recall/F1 -- no true-negative fabrication (see
   * `DetectionMetrics`'s doc comment).
   */
  public static calculateFromDetections(
    detections: DiagnosticDetection[],
    groundTruth: GroundTruthAnnotation[]
  ): DetectionMetrics {
    let tp = 0;
    let fn = 0;
    let fp = 0;

    // Match each expected ground-truth violation against actual detections
    for (const gt of groundTruth) {
      const match = detections.some(
        (d) => d.filePath === gt.filePath && d.ruleId === gt.ruleId
      );
      if (match) {
        tp++;
      } else {
        fn++;
      }
    }

    // Match each actual detection against expected ground-truth violations (False Positives)
    for (const d of detections) {
      const expected = groundTruth.some(
        (gt) => gt.filePath === d.filePath && gt.ruleId === d.ruleId
      );
      if (!expected) {
        fp++;
      }
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      precision: parseFloat((precision * 100).toFixed(2)),
      recall: parseFloat((recall * 100).toFixed(2)),
      f1Score: parseFloat((f1Score * 100).toFixed(2)),
      confusionMatrix: { tp, fp, fn },
    };
  }
}
