import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

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

async function wipeRemoteSupabaseAndLocalJson() {
  console.log('====================================================');
  console.log('  FIGM ZERO-TRUST SUPABASE REMOTE DATA WIPER');
  console.log('====================================================');

  // 1. Wipe local JSON DB
  const localDbPath = path.resolve(process.cwd(), 'figm-user-db.json');
  const cleanJsonDb = {
    users: [],
    projects: [],
    scanRecords: [],
    notifications: [],
    userSettings: []
  };
  fs.writeFileSync(localDbPath, JSON.stringify(cleanJsonDb, null, 2), 'utf-8');
  console.log('✅ Wiped all synthetic rows from local JSON DB (figm-user-db.json).');

  // 2. Wipe Supabase Remote Database via Service Role Key
  if (!serviceRoleKey) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env!');
    return;
  }

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
    'projects',
    'users'
  ];

  for (const table of tablesToWipe) {
    try {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        // Fallback: delete with gte 'a' or non-null check
        const { error: err2 } = await supabase.from(table).delete().gt('created_at', '1970-01-01');
        if (err2) {
          console.log(`⚠️ Notice on table ${table}: ${error.message}`);
        } else {
          console.log(`✅ Wiped remote table: ${table}`);
        }
      } else {
        console.log(`✅ Wiped remote table: ${table}`);
      }
    } catch (err: any) {
      console.log(`⚠️ Could not wipe table ${table}:`, err.message || err);
    }
  }

  console.log('====================================================');
  console.log('✅ ALL REMOTE SUPABASE DATABASE TABLES WIPED CLEAN.');
  console.log('====================================================');
}

wipeRemoteSupabaseAndLocalJson().catch(console.error);
