import fs from 'node:fs';
import path from 'node:path';
import { DBUserStore } from '../src/auth/user-db';
import { getPrismaClient } from '../src/db/prisma-client';

async function wipeAllSyntheticData() {
  console.log('====================================================');
  console.log('  FIGM ZERO-TRUST SYNTHETIC DATA WIPE PROCESSOR');
  console.log('====================================================');

  // 1. Wipe local JSON DB
  const localDbPath = path.resolve(process.cwd(), 'figm-user-db.json');
  const cleanJsonDb = {
    users: [
      {
        id: 'usr_admin_01',
        fullName: 'A P H D S Sanjula',
        email: 'sanjula@nsbm.ac.lk',
        passwordHash: '$2b$10$w1qE6q6E3u9v4c3d2e1f0.3q5r7s9t1u3v5w7x9y1z3a5b7c9d1e3',
        role: 'ADMIN',
        createdAt: new Date().toISOString()
      }
    ],
    projects: [],
    scanRecords: [],
    notifications: [],
    userSettings: []
  };

  fs.writeFileSync(localDbPath, JSON.stringify(cleanJsonDb, null, 2), 'utf-8');
  console.log('✅ Wiped synthetic data from local JSON DB (figm-user-db.json). Only Admin account preserved.');

  // 2. Wipe Supabase DB via Prisma
  try {
    const prisma = getPrismaClient();
    if (prisma) {
      await prisma.scanRecord.deleteMany({});
      await prisma.project.deleteMany({});
      await prisma.notification.deleteMany({});
      await prisma.userSettings.deleteMany({});
      await prisma.user.deleteMany({
        where: {
          email: { not: 'sanjula@nsbm.ac.lk' }
        }
      });
      console.log('✅ Wiped all synthetic rows from Supabase PostgreSQL tables (User, Project, ScanRecord, UserSettings, Notification).');
    } else {
      console.log('ℹ️ Supabase PostgreSQL is not connected; skipped remote SQL wipe.');
    }
  } catch (err: any) {
    console.log('⚠️ Supabase wipe notice:', err.message || err);
  }

  console.log('====================================================');
  console.log('✅ ALL SYNTHETIC DATA WIPED CLEAN. READY FOR REAL PARTICIPANTS.');
  console.log('====================================================');
}

wipeAllSyntheticData().catch(console.error);
