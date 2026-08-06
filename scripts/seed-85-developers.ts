import fs from 'node:fs';
import path from 'node:path';
import { DBUserStore, DBUser, DBScanRecord, DBProject } from '../src/auth/user-db';
import { getPrismaClient } from '../src/storage/supabase-storage-provider';

const DB_FILE = path.resolve(process.cwd(), 'figm-user-db.json');

const developerNames = [
  'Aarav Sharma', 'Liam Chen', 'Emma Watson', 'Noah Miller', 'Sophia Martinez',
  'Oliver Taylor', 'Isabella Anderson', 'James Thomas', 'Ava Jackson', 'Benjamin White',
  'Mia Harris', 'Lucas Martin', 'Charlotte Thompson', 'Henry Garcia', 'Amelia Martinez',
  'Alexander Robinson', 'Harper Clark', 'Sebastian Rodriguez', 'Evelyn Lewis', 'Jack Lee',
  'Abigail Walker', 'Daniel Hall', 'Emily Allen', 'Matthew Young', 'Ella Hernandez',
  'Jackson King', 'Elizabeth Wright', 'David Lopez', 'Camila Hill', 'Joseph Scott',
  'Luna Green', 'Samuel Adams', 'Sofia Baker', 'Henry Gonzalez', 'Avery Nelson',
  'Owen Carter', 'Scarlett Mitchell', 'Sebastian Perez', 'Victoria Roberts', 'Gabriel Turner',
  'Grace Phillips', 'Carter Campbell', 'Chloe Parker', 'Jayden Evans', 'Penelope Edwards',
  'John Collins', 'Riley Stewart', 'Luke Sanchez', 'Zoey Morris', 'Dylan Rogers',
  'Nora Reed', 'Grayson Cook', 'Lily Morgan', 'Levi Bell', 'Eleanor Murphy',
  'Isaac Bailey', 'Hannah Rivera', 'Gabriel Cooper', 'Lillian Richardson', 'Julian Cox',
  'Addison Howard', 'Mateo Ward', 'Aubrey Torres', 'Anthony Peterson', 'Ellie Gray',
  'Jaxon Ramirez', 'Stella James', 'Lincoln Watson', 'Natalie Brooks', 'Joshua Kelly',
  'Zoe Sanders', 'Christopher Price', 'Leah Bennett', 'Andrew Wood', 'Hazel Barnes',
  'Theodore Ross', 'Violet Henderson', 'Caleb Coleman', 'Aurora Jenkins', 'Ryan Perry',
  'Savannah Powell', 'Asher Long', 'Audrey Patterson', 'Nathan Hughes', 'Claire Flores'
];

const frameworks = ['React', 'Next.js', 'Angular', 'Vue', 'Next.js', 'React'];
const fileTargets = [
  'UserProfileComponent.jsx', 'DashboardSummary.tsx', 'SearchPanel.component.ts',
  'AnalyticsCard.vue', 'NavigationMenu.tsx', 'CheckoutForm.jsx', 'AuthModal.tsx',
  'HeaderBar.tsx', 'ProductGrid.vue', 'OrderHistory.component.ts'
];

export async function seed85Developers() {
  console.log('====================================================');
  console.log('FIGM Seed 85 Developer Cohort & Scans Utility');
  console.log('====================================================');

  let store: DBUserStore = {
    users: [],
    submissions: [],
    projects: [],
    scanRecords: [],
    notifications: [],
    settings: [],
    auditLogs: [],
  };

  if (fs.existsSync(DB_FILE)) {
    try {
      store = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } catch {}
  }

  const users: DBUser[] = [
    {
      id: 'usr_admin_default',
      email: 'admin@figm.io',
      fullName: 'Lead Software Architect & Reviewer',
      role: 'ADMIN',
      passwordHash: '3b16dbf2d7dc7abe084ed81018aa389a:54657a1020fc4b24ef8af6159fc58875cfffa96c5b90bd28564d9a2b95714641a9bc193fb9943fd4f8f50989ec3b30455b135340a78b2c53d1f030bbfd2f606c',
      apiKey: 'figm_key_admin_default',
      createdAt: new Date().toISOString(),
    },
  ];

  const projects: DBProject[] = [
    {
      id: 'proj_default_spa_01',
      userId: 'usr_admin_default',
      name: 'Enterprise SPA Dashboard Platform',
      description: 'Production Multi-Framework Static Analysis Benchmark Target',
      framework: 'Next.js',
      repoUrl: 'https://github.com/figm/enterprise-spa-platform',
      status: 'ACTIVE',
      qualityScore: 92,
      totalScans: 85,
      createdAt: new Date(Date.now() - 3600000 * 24 * 30).toISOString(),
    },
  ];

  const scanRecords: DBScanRecord[] = [];

  for (let i = 0; i < 85; i++) {
    const userId = `usr_eval_${String(i + 1).padStart(2, '0')}`;
    const name = developerNames[i] || `Software Engineer #${i + 1}`;
    const email = `engineer_${i + 1}@cohort.figm.io`;
    const fw = frameworks[i % frameworks.length];
    const targetFile = fileTargets[i % fileTargets.length];
    const score = Math.floor(Math.random() * 20) + 80;
    const scanTime = parseFloat((Math.random() * 5 + 1.2).toFixed(2));
    const memory = parseFloat((Math.random() * 1.5 + 0.8).toFixed(2));

    users.push({
      id: userId,
      email,
      fullName: name,
      role: i === 0 ? 'ADMIN' : i % 8 === 0 ? 'AUDITOR' : 'DEVELOPER',
      passwordHash: 'hashedpass',
      apiKey: `figm_key_eval_${i + 1}`,
      createdAt: new Date(Date.now() - 3600000 * 24 * (85 - i)).toISOString(),
    });

    scanRecords.push({
      id: `scn_eval_${String(i + 1).padStart(2, '0')}`,
      userId,
      projectId: 'proj_default_spa_01',
      fileName: targetFile,
      framework: fw,
      qualityScore: score,
      scanTimeMs: scanTime,
      memoryUsageMb: memory,
      ruleCount: Math.floor(Math.random() * 4) + 1,
      aiFixCount: Math.floor(Math.random() * 2) + 1,
      isFavorite: i % 4 === 0,
      createdAt: new Date(Date.now() - 3600000 * (85 - i)).toISOString(),
      diagnostics: [
        {
          ruleId: 'FIGM-PERF-01',
          ruleName: 'Invariant Object Allocation in Iteration Scopes',
          domain: 'PERFORMANCE',
          concern: 'INVARIANT_ALLOCATIONS',
          severity: 'HIGH',
          filePath: targetFile,
          location: { start: { line: 12, column: 15 } },
          offendingCodeSnippet: 'const configOptions = { timeout: 5000, retry: true };',
          remediation: 'Hoist invariant object declaration out of render loop scope.',
          standardReference: 'FIGM-PERF-01',
        },
      ],
    });
  }

  store.users = users;
  store.projects = projects;
  store.scanRecords = scanRecords;

  fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf-8');
  console.log(`✅ Successfully seeded 85 developer users & 85 scan records to ${DB_FILE}`);

  // Migrate to Supabase if connected
  const prisma = getPrismaClient();
  if (prisma) {
    console.log('Migrating 85 developer records to Supabase Database...');
    try {
      for (const u of users) {
        await prisma.user.upsert({
          where: { id: u.id },
          update: { fullName: u.fullName, email: u.email, role: u.role as any },
          create: {
            id: u.id,
            email: u.email,
            passwordHash: u.passwordHash,
            fullName: u.fullName,
            role: u.role as any,
            apiKey: u.apiKey,
          },
        });
      }
      console.log('✅ Successfully synced 85 developer user records to Supabase PostgreSQL Database.');
    } catch (err: any) {
      console.log('Supabase sync note:', err.message);
    }
  }
}

if (process.argv[1]?.includes('seed-85-developers')) {
  seed85Developers().catch(console.error);
}
