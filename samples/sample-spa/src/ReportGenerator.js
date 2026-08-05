// Defect: FIGM-PERF-04 (Static import used in conditional execution branch)
import HeavyPdfExport from 'heavy-pdf-export-lib';

export function generateUserReport(shouldExportPdf, data) {
  if (shouldExportPdf) {
    return HeavyPdfExport.buildPdf(data);
  }
  return { status: 'Skipped PDF Export' };
}
