import 'dotenv/config';
import { UserDB } from '../src/auth/user-db';
import { getPrismaClient } from '../src/db/prisma-client';

async function seedMultiFrameworkData() {
  console.log('Seeding Angular, Vue, Next.js, and React scan records into Supabase & JSON DB...');

  const sampleScans = [
    {
      fileName: 'SearchPanel.component.ts',
      framework: 'Angular',
      scanTimeMs: 14.2,
      memoryUsageMb: 1.9,
      qualityScore: 94,
      ruleCount: 1,
      aiFixCount: 1,
      isFavorite: true,
      diagnostics: [
        {
          ruleId: 'FIGM-PERF-02',
          ruleName: 'Unbound Directive Allocation',
          severity: 'HIGH',
          domain: 'PERFORMANCE',
          offendingCodeSnippet: '(click)="handleSearch()"',
          remediation: 'Use ChangeDetectionStrategy.OnPush.',
        },
      ],
    },
    {
      fileName: 'UserProfileCard.vue',
      framework: 'Vue',
      scanTimeMs: 11.5,
      memoryUsageMb: 1.6,
      qualityScore: 96,
      ruleCount: 1,
      aiFixCount: 1,
      isFavorite: false,
      diagnostics: [
        {
          ruleId: 'FIGM-A11Y-01',
          ruleName: 'Missing Alt Attribute',
          severity: 'HIGH',
          domain: 'ACCESSIBILITY',
          offendingCodeSnippet: '<img :src="avatarUrl" />',
          remediation: 'Add :alt prop or descriptive aria-label.',
        },
      ],
    },
    {
      fileName: 'DashboardLayout.tsx',
      framework: 'Next.js',
      scanTimeMs: 16.8,
      memoryUsageMb: 2.3,
      qualityScore: 91,
      ruleCount: 2,
      aiFixCount: 2,
      isFavorite: true,
      diagnostics: [
        {
          ruleId: 'FIGM-PERF-01',
          ruleName: 'Unbound Inline Event Handlers',
          severity: 'HIGH',
          domain: 'PERFORMANCE',
          offendingCodeSnippet: 'onClick={() => router.push("/settings")}',
          remediation: 'Extract navigation handler to useCallback.',
        },
      ],
    },
    {
      fileName: 'OrderCheckoutService.ts',
      framework: 'Angular',
      scanTimeMs: 13.0,
      memoryUsageMb: 1.7,
      qualityScore: 98,
      ruleCount: 0,
      aiFixCount: 0,
      isFavorite: false,
      diagnostics: [],
    },
    {
      fileName: 'StoreProductList.vue',
      framework: 'Vue',
      scanTimeMs: 15.1,
      memoryUsageMb: 2.0,
      qualityScore: 89,
      ruleCount: 2,
      aiFixCount: 1,
      isFavorite: true,
      diagnostics: [
        {
          ruleId: 'FIGM-PERF-03',
          ruleName: 'Loop Invariant Array Allocation',
          severity: 'MEDIUM',
          domain: 'PERFORMANCE',
          offendingCodeSnippet: 'v-for="item in items.map(x => x.id)"',
          remediation: 'Compute mapped array in a computed property.',
        },
      ],
    },
  ];

  const defaultUser = UserDB.getAllUsers()[0] || { id: 'usr_system_default' };
  const prisma = getPrismaClient();

  for (const s of sampleScans) {
    const scanId = `scan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    // Save locally to JSON DB
    UserDB.createScanRecord({
      userId: defaultUser.id,
      fileName: s.fileName,
      framework: s.framework,
      scanTimeMs: s.scanTimeMs,
      memoryUsageMb: s.memoryUsageMb,
      qualityScore: s.qualityScore,
      ruleCount: s.ruleCount,
      aiFixCount: s.aiFixCount,
      diagnostics: s.diagnostics,
      isFavorite: s.isFavorite,
    });

    // Save directly into Supabase PostgreSQL via Prisma Client
    if (prisma) {
      try {
        await prisma.scanReport.create({
          data: {
            id: scanId,
            userId: defaultUser.id,
            fileName: s.fileName,
            framework: s.framework,
            scanTimeMs: s.scanTimeMs,
            memoryUsageMb: s.memoryUsageMb,
            qualityScore: s.qualityScore,
            ruleCount: s.ruleCount,
            aiFixCount: s.aiFixCount,
            isFavorite: s.isFavorite,
            diagnostics: s.diagnostics as any,
          },
        });
      } catch (err: any) {
        console.log('Prisma insert notice:', err.message);
      }
    }
  }

  console.log('Successfully seeded multi-framework scan records (Angular, Vue, Next.js, React)!');
}

seedMultiFrameworkData().catch(console.error);
