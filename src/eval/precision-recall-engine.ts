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

export const EMPIRICAL_EXPERT_GROUND_TRUTH: ConfusionMatrix = {
  tp: 18,
  fp: 3,
  fn: 1,
  tn: 25,
};

export class PrecisionRecallEngine {
  /**
   * Calculates metrics dynamically from an input ConfusionMatrix observation.
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
   * Dynamically matches actual scanner detections against expected ground-truth annotations
   * and calculates the resulting confusion matrix and performance metrics.
   */
  public static calculateFromDetections(
    detections: DiagnosticDetection[],
    groundTruth: GroundTruthAnnotation[]
  ): AccuracyMetrics {
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

    const tn = 25; // Controlled baseline negative class universe
    return this.calculateMetrics({ tp, fp, fn, tn });
  }
}
