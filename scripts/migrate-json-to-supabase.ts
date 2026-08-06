import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { UserDB } from '../src/auth/user-db';
import { getPrismaClient } from '../src/db/prisma-client';
import { hashPassword } from '../src/auth/auth-service';

export interface MigrationSummary {
  timestamp: string;
  usersImported: number;
  usersSkipped: number;
  projectsImported: number;
  projectsSkipped: number;
  scansImported: number;
  scansSkipped: number;
  notificationsImported: number;
  notificationsSkipped: number;
  auditLogsImported: number;
  auditLogsSkipped: number;
  status: 'SUCCESS' | 'DRY_RUN' | 'FAILED';
  errors: string[];
}

export async function runJsonToSupabaseMigration(): Promise<MigrationSummary> {
  console.log('====================================================');
  console.log('FIGM JSON to Supabase Data Migration Utility');
  console.log('====================================================');

  const errors: string[] = [];
  let usersImported = 0;
  let usersSkipped = 0;
  let projectsImported = 0;
  let projectsSkipped = 0;
  let scansImported = 0;
  let scansSkipped = 0;
  let notificationsImported = 0;
  let notificationsSkipped = 0;
  let auditLogsImported = 0;
  let auditLogsSkipped = 0;

  const users = UserDB.getAllUsers();
  const projects = UserDB.getProjects();
  const scans = UserDB.getScanRecords();
  const auditLogs = UserDB.getAuditLogs(1000);

  const prisma = getPrismaClient();
  const isConnected = Boolean(prisma);

  console.log(`Loaded from local JSON store:`);
  console.log(`- Users: ${users.length}`);
  console.log(`- Projects: ${projects.length}`);
  console.log(`- Scan Reports: ${scans.length}`);
  console.log(`- Audit Logs: ${auditLogs.length}`);
  console.log(`Supabase Client Status: ${isConnected ? 'CONNECTED' : 'DISCONNECTED (DRY RUN)'}`);

  if (isConnected) {
    const validUserIds = new Set<string>();

    for (const u of users) {
      try {
        const existing = await prisma.user.findFirst({
          where: { OR: [{ id: u.id }, { email: u.email }] },
        });
        if (!existing) {
          await prisma.user.create({
            data: {
              id: u.id,
              email: u.email,
              passwordHash: u.passwordHash,
              fullName: u.fullName,
              role: u.role,
              apiKey: u.apiKey,
              resetToken: u.resetToken,
              resetTokenExpiry: u.resetTokenExpiry ? new Date(u.resetTokenExpiry) : null,
              refreshToken: u.refreshToken,
              lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
              createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
            },
          });
          usersImported++;
          validUserIds.add(u.id);
        } else {
          usersSkipped++;
          validUserIds.add(existing.id);
        }
      } catch (err: any) {
        errors.push(`User ${u.email}: ${err.message}`);
      }
    }

    // Ensure system fallback user for orphan test projects
    const fallbackUserId = 'usr_system_default';
    if (!validUserIds.has(fallbackUserId)) {
      try {
        const existingSystemUser = await prisma.user.findUnique({ where: { id: fallbackUserId } });
        if (!existingSystemUser) {
          await prisma.user.create({
            data: {
              id: fallbackUserId,
              email: 'system_default@figm.io',
              passwordHash: hashPassword('SystemSecurePass2026!'),
              fullName: 'System Default User',
              role: 'DEVELOPER',
              apiKey: 'figm_key_system_default',
            },
          });
        }
        validUserIds.add(fallbackUserId);
      } catch {
        // Ignored if already exists
      }
    }

    for (const p of projects) {
      try {
        const targetUserId = validUserIds.has(p.userId) ? p.userId : fallbackUserId;
        const existing = await prisma.project.findUnique({ where: { id: p.id } });
        if (!existing) {
          await prisma.project.create({
            data: {
              id: p.id,
              userId: targetUserId,
              name: p.name,
              description: p.description,
              framework: p.framework,
              repoUrl: p.repoUrl,
              status: p.status || 'ACTIVE',
              totalScans: p.totalScans || 0,
              qualityScore: p.qualityScore || 100,
              lastScanAt: p.lastScanAt ? new Date(p.lastScanAt) : null,
              createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
            },
          });
          projectsImported++;
        } else {
          projectsSkipped++;
        }
      } catch (err: any) {
        errors.push(`Project ${p.name}: ${err.message}`);
      }
    }

    for (const s of scans) {
      try {
        const targetUserId = validUserIds.has(s.userId) ? s.userId : fallbackUserId;
        const existing = await prisma.scanReport.findUnique({ where: { id: s.id } });
        if (!existing) {
          await prisma.scanReport.create({
            data: {
              id: s.id,
              userId: targetUserId,
              projectId: s.projectId,
              fileName: s.fileName,
              framework: s.framework,
              scanTimeMs: s.scanTimeMs,
              memoryUsageMb: s.memoryUsageMb,
              qualityScore: s.qualityScore,
              ruleCount: s.ruleCount,
              aiFixCount: s.aiFixCount,
              isFavorite: s.isFavorite || false,
              diagnostics: (s.diagnostics || []) as any,
              createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
            },
          });
          scansImported++;
        } else {
          scansSkipped++;
        }
      } catch (err: any) {
        errors.push(`Scan ${s.fileName}: ${err.message}`);
      }
    }

    for (const a of auditLogs) {
      try {
        const targetUserId = validUserIds.has(a.userId) ? a.userId : fallbackUserId;
        await prisma.auditLog.create({
          data: {
            id: a.id,
            userId: targetUserId,
            action: a.action,
            details: a.details || 'System event',
            ipAddress: a.ipAddress || '127.0.0.1',
            userAgent: 'FIGM Inspector Backend Agent v3.0',
            createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
          },
        });
        auditLogsImported++;
      } catch {
        auditLogsSkipped++;
      }
    }
  } else {
    usersSkipped = users.length;
    projectsSkipped = projects.length;
    scansSkipped = scans.length;
  }

  const summary: MigrationSummary = {
    timestamp: new Date().toISOString(),
    usersImported,
    usersSkipped,
    projectsImported,
    projectsSkipped,
    scansImported,
    scansSkipped,
    notificationsImported,
    notificationsSkipped,
    auditLogsImported,
    auditLogsSkipped,
    status: errors.length > 0 ? 'FAILED' : isConnected ? 'SUCCESS' : 'DRY_RUN',
    errors,
  };

  console.log('\nMigration Summary Report:');
  console.log(JSON.stringify(summary, null, 2));

  const reportPath = path.join(process.cwd(), 'docs', 'migration-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`Saved report to ${reportPath}`);

  return summary;
}

if (require.main === module) {
  runJsonToSupabaseMigration().catch(console.error);
}
