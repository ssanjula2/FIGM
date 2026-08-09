/**
 * Framework-Independent Guideline Model (FIGM)
 * Research Data Provenance, Participant Ingestion & Validation Pipeline
 */

export type DatasetClassification = 'REAL_HUMAN' | 'SYNTHETIC' | 'BENCHMARK' | 'GENERATED_OUTPUT';

export interface DatasetProvenanceMetadata {
  datasetId: string;
  datasetType: DatasetClassification;
  source: string;
  participantCount: number;
  collectionStatus: 'COLLECTED' | 'NOT_COLLECTED' | 'IN_PROGRESS';
  consentStatus: 'VERIFIED' | 'MISSING' | 'NOT_APPLICABLE';
  anonymizationStatus: 'ANONYMIZED' | 'NOT_APPLICABLE';
  collectedAt?: string;
  processedAt: string;
  schemaVersion: string;
  provenance: string;
  isRealHumanData: boolean;
}

export interface ParticipantResponseRecord {
  anonymousParticipantId: string;
  consentGiven: boolean;
  consentTimestamp: string;
  sessionId: string;
  studyVersion: string;
  experienceYears?: number;
  primaryFramework?: string;
  susResponses: [number, number, number, number, number, number, number, number, number, number];
  taskPerformance?: {
    taskId: string;
    completed: boolean;
    completionTimeMs: number;
    errorCount: number;
  };
}

export interface DataIngestionValidationResult {
  valid: boolean;
  dataSource: DatasetClassification;
  participantCount: number;
  validRows: number;
  invalidRows: number;
  errors: string[];
  warnings: string[];
}

export class ResearchDataPipeline {
  public static getSyntheticModelProvenance(): DatasetProvenanceMetadata {
    return {
      datasetId: 'FIGM-SYNTHETIC-USABILITY-V1',
      datasetType: 'SYNTHETIC',
      source: 'Simulated 85-profile Likert scoring vectors',
      participantCount: 85,
      collectionStatus: 'NOT_COLLECTED',
      consentStatus: 'NOT_APPLICABLE',
      anonymizationStatus: 'NOT_APPLICABLE',
      processedAt: new Date().toISOString(),
      schemaVersion: '1.0.0',
      provenance: 'Methodological pipeline verification model for Cronbach alpha & SUS calculation engine',
      isRealHumanData: false
    };
  }

  public static validateParticipantRecord(record: ParticipantResponseRecord): string[] {
    const errors: string[] = [];

    if (!record.anonymousParticipantId || !/^P\d{3,}$/i.test(record.anonymousParticipantId)) {
      errors.push(`Invalid participant ID format: ${record.anonymousParticipantId}`);
    }

    if (record.consentGiven !== true) {
      errors.push(`Participant ${record.anonymousParticipantId} did not provide informed consent`);
    }

    if (!record.susResponses || record.susResponses.length !== 10) {
      errors.push(`Participant ${record.anonymousParticipantId} must have exactly 10 SUS response items`);
    } else {
      record.susResponses.forEach((val, idx) => {
        if (!Number.isInteger(val) || val < 1 || val > 5) {
          errors.push(`Participant ${record.anonymousParticipantId} item ${idx + 1} response (${val}) must be integer in [1, 5]`);
        }
      });
    }

    return errors;
  }

  public static ingestParticipantBatch(records: ParticipantResponseRecord[]): DataIngestionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const seenIds = new Set<string>();
    let validCount = 0;
    let invalidCount = 0;

    records.forEach((record) => {
      if (seenIds.has(record.anonymousParticipantId)) {
        errors.push(`Duplicate participant ID detected: ${record.anonymousParticipantId}`);
        invalidCount++;
        return;
      }
      seenIds.add(record.anonymousParticipantId);

      const recordErrors = this.validateParticipantRecord(record);
      if (recordErrors.length > 0) {
        errors.push(...recordErrors);
        invalidCount++;
      } else {
        validCount++;
      }
    });

    return {
      valid: errors.length === 0,
      dataSource: 'REAL_HUMAN',
      participantCount: records.length,
      validRows: validCount,
      invalidRows: invalidCount,
      errors,
      warnings
    };
  }
}
