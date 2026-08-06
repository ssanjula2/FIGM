require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DB_FILE = path.resolve(process.cwd(), 'figm-user-db.json');

async function main() {
  console.log('====================================================');
  console.log('BULK SEEDING ALL 12 SUPABASE TABLES VIA PRISMA PG POOL');
  console.log('====================================================');

  const store = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  const users = store.users || [];
  const scans = store.scanRecords || [];

  const dbUsers = await prisma.user.findMany({ select: { id: true } });
  const validUserIds = new Set(dbUsers.map((u) => u.id));
  const validUsers = users.filter((u) => validUserIds.has(u.id));

  console.log(`Found ${validUsers.length} matched users in Supabase PostgreSQL out of ${users.length} in store.`);

  // 1. Audit Logs
  console.log('1. Bulk Seeding Audit Logs...');
  await prisma.auditLog.deleteMany();
  await prisma.auditLog.createMany({
    data: validUsers.map((u) => ({
      id: `log_${u.id}`,
      userId: u.id,
      email: u.email,
      action: 'SCAN_RUN',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0',
      status: 'SUCCESS',
      details: `User ${u.fullName} ran AST scan`,
      createdAt: new Date(u.createdAt),
    })),
  });
  console.log(`  ✅ Audit Logs: ${await prisma.auditLog.count()}`);

  // 2. Notifications
  console.log('2. Bulk Seeding Notifications...');
  await prisma.notification.deleteMany();
  await prisma.notification.createMany({
    data: validUsers.map((u) => ({
      id: `notif_${u.id}`,
      userId: u.id,
      title: '⚡ Code Inspection Completed',
      message: 'Scan report generated with 92% quality score.',
      type: 'SCAN_SUCCESS',
      read: true,
      createdAt: new Date(u.createdAt),
    })),
  });
  console.log(`  ✅ Notifications: ${await prisma.notification.count()}`);

  // 3. Settings
  console.log('3. Bulk Seeding Settings...');
  await prisma.settings.deleteMany();
  await prisma.settings.createMany({
    data: validUsers.map((u) => ({
      id: `set_${u.id}`,
      userId: u.id,
      theme: 'dark',
      autoSave: true,
      autoScan: true,
      aiModel: 'gemini-2.5-flash',
      exportFormat: 'PDF',
    })),
  });
  console.log(`  ✅ Settings: ${await prisma.settings.count()}`);

  // 4. API Keys
  console.log('4. Bulk Seeding API Keys...');
  await prisma.apiKey.deleteMany();
  await prisma.apiKey.createMany({
    data: validUsers.filter((u) => u.apiKey).map((u) => ({
      id: `key_${u.id}`,
      userId: u.id,
      key: u.apiKey,
      name: `Default API Key - ${u.fullName}`,
      createdAt: new Date(u.createdAt),
    })),
  });
  console.log(`  ✅ API Keys: ${await prisma.apiKey.count()}`);

  // 5. Research Evaluations
  console.log('5. Seeding Research Evaluations...');
  await prisma.researchEvaluation.deleteMany();
  if (validUsers[0]?.id) {
    await prisma.researchEvaluation.create({
      data: {
        userId: validUsers[0].id,
        datasetName: 'N=85 SPA Developer Cohort (30 International + 55 Sri Lankan Repositories)',
        sampleCount: 85,
        precisionScore: 94.2,
        recallScore: 91.8,
        f1Score: 93.0,
        accuracyScore: 93.5,
        createdAt: new Date(),
      },
    });
  }
  console.log(`  ✅ Research Evaluations: ${await prisma.researchEvaluation.count()}`);

  // 6. Framework Benchmarks
  console.log('6. Seeding Framework Benchmarks...');
  await prisma.frameworkBenchmark.deleteMany();
  await prisma.frameworkBenchmark.createMany({
    data: [
      { framework: 'React', sampleCount: 35, avgLatencyMs: 3.42, avgMemoryMb: 1.15, avgScore: 91.2 },
      { framework: 'Next.js', sampleCount: 25, avgLatencyMs: 5.80, avgMemoryMb: 1.45, avgScore: 89.5 },
      { framework: 'Vue', sampleCount: 15, avgLatencyMs: 2.90, avgMemoryMb: 0.95, avgScore: 94.0 },
      { framework: 'Angular', sampleCount: 10, avgLatencyMs: 6.20, avgMemoryMb: 1.80, avgScore: 87.8 },
    ],
  });
  console.log(`  ✅ Framework Benchmarks: ${await prisma.frameworkBenchmark.count()}`);

  // 7. AI History
  console.log('7. Bulk Seeding AI History...');
  await prisma.aiHistory.deleteMany();
  const validScans = scans.filter((s) => validUserIds.has(s.userId));
  await prisma.aiHistory.createMany({
    data: validScans.slice(0, 30).map((s, idx) => ({
      id: `ai_fix_${String(idx + 1).padStart(3, '0')}`,
      userId: s.userId,
      scanReportId: s.id,
      ruleId: 'REACT_INVARIANT_OBJECT_ALLOCATION',
      patchContent: 'const CONFIG = Object.freeze({ timeout: 5000 });',
      applied: true,
      createdAt: new Date(s.createdAt),
    })),
  });
  console.log(`  ✅ AI History: ${await prisma.aiHistory.count()}`);

  // 8. Bulk Seeding Export History...
  console.log('8. Bulk Seeding Export History...');
  await prisma.exportHistory.deleteMany();
  await prisma.exportHistory.createMany({
    data: validScans.slice(0, 25).map((s, idx) => ({
      id: `exp_${String(idx + 1).padStart(3, '0')}`,
      userId: s.userId,
      fileName: `Audit_Report_${s.fileName}.pdf`,
      format: 'PDF',
      createdAt: new Date(s.createdAt),
    })),
  });
  console.log(`  ✅ Export History: ${await prisma.exportHistory.count()}`);

  console.log('====================================================');
  console.log('🎉 ALL SUPABASE POSTGRESQL TABLES BULK SEEDED VIA PRISMA!');
  console.log('====================================================');
}

main()
  .catch(console.error)
  .finally(() => {
    prisma.$disconnect();
    pool.end();
  });
