import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { hashPassword } from '../src/auth/auth-service';

// Parse .env manually to ensure credentials are available
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      let val = trimmed.substring(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kiohthribojmofafmanc.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function wipeRemoteSupabaseAndSetAdmin() {
  console.log('====================================================');
  console.log('  FIGM ZERO-TRUST DB RESET & ADMIN CREATOR');
  console.log('====================================================');

  const adminPasswordHash = hashPassword('Admin123456!');
  const adminUser1 = {
    id: 'usr_admin_sanjula',
    fullName: 'A P H D S Sanjula (Admin)',
    email: 'sanjula@nsbm.ac.lk',
    passwordHash: adminPasswordHash,
    role: 'ADMIN',
    apiKey: 'figm_key_admin_sanjula',
    createdAt: new Date().toISOString()
  };

  const adminUser2 = {
    id: 'usr_admin_figm',
    fullName: 'FIGM Lead System Administrator',
    email: 'admin@figm.io',
    passwordHash: adminPasswordHash,
    role: 'ADMIN',
    apiKey: 'figm_key_admin_figm',
    createdAt: new Date().toISOString()
  };

  // 1. Wipe local JSON DB and set Admin users
  const localDbPath = path.resolve(process.cwd(), 'figm-user-db.json');
  const cleanJsonDb = {
    users: [adminUser1, adminUser2],
    projects: [],
    scanRecords: [],
    notifications: [],
    userSettings: []
  };
  fs.writeFileSync(localDbPath, JSON.stringify(cleanJsonDb, null, 2), 'utf-8');
  console.log('✅ Local JSON DB reset with valid Admins (sanjula@nsbm.ac.lk & admin@figm.io / Admin123456!).');

  // 2. Wipe Supabase Remote Database and Upsert Admin Users
  if (serviceRoleKey) {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const tablesToWipe = [
      'scan_reports',
      'saved_reports',
      'export_history',
      'ai_history',
      'audit_logs',
      'notifications',
      'settings',
      'api_keys',
      'projects'
    ];

    for (const table of tablesToWipe) {
      try {
        await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch {}
    }

    // Delete existing users by email
    await supabase.from('users').delete().in('email', ['sanjula@nsbm.ac.lk', 'admin@figm.io']);
    await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Upsert Admin Users in Supabase PostgreSQL
    for (const adminUser of [adminUser1, adminUser2]) {
      const { error: adminErr } = await supabase.from('users').upsert({
        id: adminUser.id,
        email: adminUser.email,
        password_hash: adminUser.passwordHash,
        full_name: adminUser.fullName,
        role: adminUser.role,
        api_key: adminUser.apiKey,
        created_at: adminUser.createdAt,
        updated_at: adminUser.createdAt
      });

      if (adminErr) {
        console.log(`⚠️ Notice on Supabase Admin (${adminUser.email}) upsert:`, adminErr.message);
      } else {
        console.log(`✅ Supabase PostgreSQL configured with Admin: ${adminUser.email}`);
      }
    }
  }

  console.log('====================================================');
  console.log('✅ ADMIN USERS CONFIGURED SUCCESSFULLY (Admin123456!).');
  console.log('====================================================');
}

wipeRemoteSupabaseAndSetAdmin().catch(console.error);
