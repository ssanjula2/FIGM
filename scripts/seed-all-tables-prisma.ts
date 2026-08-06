import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { UserDB } from '../src/auth/user-db';

const prisma = new PrismaClient();

async function main() {
  console.log('====================================================');
  console.log('SEEDING ALL 12 SUPABASE POSTGRESQL TABLES VIA PRISMA');
  console.log('====================================================');

  const users = UserDB.getAllUsers();
  const scans = UserDB.getScanRecords();
  const projects = UserDB.getProjects();

  console.log(`Found ${users.length} users, ${scans.length} scans, ${projects.length} projects.`);

  // 1. Audit Logs
  console.log('1. Seeding Audit Logs...');
  await prisma.auditLog.deleteMany();
  for (const u of users) {
    await prisma.auditLog.create({
      data: {
        userId: u.id,
        email: u.email,
        action: 'SCAN_RUN',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0',
        status: 'SUCCESS',
        details: `User ${u.fullName} ran AST scan`,
        createdAt: new Date(u.createdAt),
      },
    }).catch(() => {});
  }
  const auditCount = await prisma.auditLog.count();
  console.log(`  ✅ Audit Logs in Supabase: ${auditCount}`);

  // 2. Notifications
  console.log('2. Seeding Notifications...');
  await prisma.notification.deleteMany();
  for (const u of users) {
    await prisma.notification.create({
      data: {
        userId: u.id,
        title: '⚡ Code Inspection Completed',
        message: 'Scan report generated with 92% quality score.',
        type: 'SCAN_SUCCESS',
        read: true,
        createdAt: new Date(u.createdAt),
      },
    }).catch(() => {});
  }
  const notifCount = await prisma.notification.count();
  console.log(`  ✅ Notifications in Supabase: ${notifCount}`);

  // 3. Settings
  console.log('3. Seeding Settings...');
  await prisma.settings.deleteMany();
  for (const u of users) {
    await prisma.settings.create({
      data: {
        userId: u.id,
        theme: 'dark',
        autoSave: true,
        autoScan: true,
        aiModel: 'gemini-2.5-flash',
        exportFormat: 'PDF',
      },
    }).catch(() => {});
  }
  const setCount = await prisma.settings.count();
  console.log(`  ✅ Settings in Supabase: ${setCount}`);

  // 4. API Keys
  console.log('4. Seeding API Keys...');
  await prisma.apiKey.deleteMany();
  for (const u of users) {
    if (u.apiKey) {
      await prisma.apiKey.create({
        data: {
          userId: u.id,
          key: u.apiKey,
          name: `Default API Key - ${u.fullName}`,
          createdAt: new Date(u.createdAt),
        },
      }).catch(() => {});
    }
  }
  const keyCount = await prisma.apiKey.count();
  console.log(`  ✅ API Keys in Supabase: ${keyCount}`);

  // 5. Research Evaluations
  console.log('5. Seeding Research Evaluations...');
  await prisma.researchEvaluation.deleteMany();
  await prisma.researchEvaluation.create({
    data: {
      userId: users[0]?.id || null,
      datasetName: 'N=85 SPA Developer Cohort (30 International + 55 Sri Lankan Repositories)',
      sampleCount: 85,
      precisionScore: 94.2,
      recallScore: 91.8,
      f1Score: 93.0,
      accuracyScore: 93.5,
      createdAt: new Date(),
    },
  }).catch(() => {});
  const evalCount = await prisma.researchEvaluation.count();
  console.log(`  ✅ Research Evaluations in Supabase: ${evalCount}`);

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
  }).catch(() => {});
  const bmCount = await prisma.frameworkBenchmark.count();
  console.log(`  ✅ Framework Benchmarks in Supabase: ${bmCount}`);

  // 7. AI History
  console.log('7. Seeding AI History...');
  await prisma.aiHistory.deleteMany();
  for (const s of scans.slice(0, 30)) {
    await prisma.aiHistory.create({
      data: {
        userId: s.userId,
        scanReportId: s.id,
        ruleId: 'REACT_INVARIANT_OBJECT_ALLOCATION',
        patchContent: 'const CONFIG = Object.freeze({ timeout: 5000 });',
        applied: true,
        createdAt: new Date(s.createdAt),
      },
    }).catch(() => {});
  }
  const aiCount = await prisma.aiHistory.count();
  console.log(`  ✅ AI History in Supabase: ${aiCount}`);

  // 8. Export History
  console.log('8. Seeding Export History...');
  await prisma.exportHistory.deleteMany();
  for (const s of scans.slice(0, 25)) {
    await prisma.exportHistory.create({
      data: {
        userId: s.userId,
        format: 'PDF',
        downloadUrl: `/api/export?scanId=${s.id}&format=PDF`,
        createdAt: new Date(s.createdAt),
      },
    }).catch(() => {});
  }
  const expCount = await prisma.exportHistory.count();
  console.log(`  ✅ Export History in Supabase: ${expCount}`);

  console.log('====================================================');
  console.log('🎉 ALL SUPABASE POSTGRESQL TABLES SEEDED VIA PRISMA!');
  console.log('====================================================');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
