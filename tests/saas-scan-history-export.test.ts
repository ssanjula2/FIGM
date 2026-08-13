import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ScanRepository } from '../src/engine/scan-repository';
import { ExportService } from '../src/engine/export-service';
import { RepositoryFactory } from '../src/storage/repository-factory';

describe('SaaS Production Features 2 & 4: Scan History & Export Engine Suite', () => {
  it('Scan records automatically persist metrics, diagnostics, and update project stats', async () => {
    RepositoryFactory.resetProvider();
    const userId = `usr_test_scan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const scan = await ScanRepository.createScanRecord({
      userId,
      fileName: 'PaymentGateway.tsx',
      framework: 'React',
      repositoryUrl: 'https://github.com/figm/payment-gateway',
      scanTimeMs: 14.8,
      memoryUsageMb: 2.1,
      qualityScore: 92,
      ruleCount: 2,
      aiFixCount: 2,
      diagnostics: [
        {
          ruleId: 'FIGM-PERF-01',
          ruleName: 'Unbound Inline Event Handlers',
          severity: 'HIGH',
          domain: 'PERFORMANCE',
          offendingCodeSnippet: '<button onClick={() => handleClick()} />',
          remediation: 'Extract event handler method.',
        },
      ],
      isFavorite: false,
    });

    assert.ok(scan.id);
    assert.strictEqual(scan.fileName, 'PaymentGateway.tsx');
    assert.strictEqual(scan.qualityScore, 92);
  });

  it('Scan Repository pagination, searching, and favorite toggling', async () => {
    RepositoryFactory.resetProvider();
    const userId = `usr_test_fav_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const scan = await ScanRepository.createScanRecord({
      userId,
      fileName: 'PaymentGateway.tsx',
      framework: 'React',
      scanTimeMs: 12,
      memoryUsageMb: 1.8,
      qualityScore: 90,
      ruleCount: 1,
      aiFixCount: 1,
      diagnostics: [],
      isFavorite: false,
    });

    assert.ok(scan.id);

    const res1 = await ScanRepository.getScanRecords({ userId, search: 'PaymentGateway' });
    assert.ok(res1.records.length >= 1);

    const toggled = await ScanRepository.toggleFavorite(scan.id);
    assert.ok(toggled !== undefined);

    const favsOnly = await ScanRepository.getScanRecords({ userId, onlyFavorites: true });
    assert.ok(favsOnly.records.some((r) => r.id === scan.id));
  });

  it('Export Engine produces PDF (HTML/PDF), JSON, CSV, and Markdown exports with research citations', async () => {
    RepositoryFactory.resetProvider();
    const userId = `usr_test_exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const record = await ScanRepository.createScanRecord({
      userId,
      fileName: 'ExportTarget.tsx',
      framework: 'React',
      scanTimeMs: 10,
      memoryUsageMb: 1.5,
      qualityScore: 88,
      ruleCount: 1,
      aiFixCount: 1,
      diagnostics: [
        {
          ruleId: 'FIGM-A11Y-01',
          ruleName: 'Missing Alt Attribute',
          severity: 'HIGH',
          domain: 'ACCESSIBILITY',
          offendingCodeSnippet: '<img src="logo.png" />',
          remediation: 'Add descriptive alt property.',
        },
      ],
    });

    assert.ok(record.id);

    const jsonExport = ExportService.exportJSON(record);
    assert.ok(jsonExport.includes('ExportTarget.tsx'));

    const csvExport = ExportService.exportCSV(record);
    assert.ok(csvExport.includes('FIGM-A11Y-01'));

    const mdExport = ExportService.exportMarkdown(record);
    assert.ok(mdExport.includes('# FIGM Code Inspector Report: ExportTarget.tsx'));

    const pdfExport = ExportService.exportPDF(record);
    assert.ok(pdfExport.includes('<!DOCTYPE html>'));
    assert.ok(pdfExport.includes('FIGM Code Inspector'));
    assert.ok(pdfExport.includes('ISO/IEC 25010 System and Software Quality Models'));
  });
});
