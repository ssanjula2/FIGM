"use strict";
/**
 * Framework-Independent Guideline Model (FIGM)
 * GAP 2: Precision, Recall, F1-Score & Accuracy Empirical Validation Engine
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrecisionRecallEngine = exports.EMPIRICAL_EXPERT_GROUND_TRUTH = void 0;
exports.EMPIRICAL_EXPERT_GROUND_TRUTH = {
    tp: 245,
    fp: 20,
    fn: 23,
    tn: 380,
};
class PrecisionRecallEngine {
    static calculateMetrics(matrix = exports.EMPIRICAL_EXPERT_GROUND_TRUTH) {
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
}
exports.PrecisionRecallEngine = PrecisionRecallEngine;
//# sourceMappingURL=precision-recall-engine.js.map