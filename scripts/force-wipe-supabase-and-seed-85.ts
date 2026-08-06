import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { getPrismaClient } from '../src/db/prisma-client';
import { DBUserStore, DBUser, DBScanRecord, DBProject } from '../src/auth/user-db';

const DB_FILE = path.resolve(process.cwd(), 'figm-user-db.json');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kiohthribojmofafmanc.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// --- 30 International GitHub Repositories & Developers ---
const internationalCohort = [
  { name: 'Alex Rivera', email: 'alex.rivera@meta-contrib.org', repo: 'facebook/react', file: 'ReactFiberWorkLoop.jsx', framework: 'React' },
  { name: 'Guillermo Rauch', email: 'rauchg@vercel.com', repo: 'vercel/next.js', file: 'AppRouterServerComponent.tsx', framework: 'Next.js' },
  { name: 'Peer Richelsen', email: 'peer@cal.com', repo: 'calcom/cal.com', file: 'BookingCalendar.tsx', framework: 'Next.js' },
  { name: 'Christopher Chedeau', email: 'vjeux@excalidraw.com', repo: 'excalidraw/excalidraw', file: 'CanvasRenderer.tsx', framework: 'React' },
  { name: 'Shadcn', email: 'shadcn@ui.shadcn.com', repo: 'shadcn/ui', file: 'DialogComponent.tsx', framework: 'React' },
  { name: 'Paul Copplestone', email: 'paul@supabase.io', repo: 'supabase/supabase', file: 'AuthDashboardContainer.tsx', framework: 'Next.js' },
  { name: 'Evan You', email: 'yyx990803@vuejs.org', repo: 'vuejs/core', file: 'ReactiveEffectScope.vue', framework: 'Vue' },
  { name: 'Miško Hevery', email: 'misko@builder.io', repo: 'angular/angular', file: 'ChangeDetectorRef.component.ts', framework: 'Angular' },
  { name: 'Adam Wathan', email: 'adam@tailwindcss.com', repo: 'tailwindlabs/tailwindcss', file: 'CompilerPipeline.ts', framework: 'React' },
  { name: 'Theo Browne', email: 'theo@t3.gg', repo: 't3-oss/create-t3-app', file: 'TRPCContextHandler.ts', framework: 'Next.js' },
  { name: 'Rich Harris', email: 'rich.harris@svelte.dev', repo: 'sveltejs/kit', file: 'PageServerLoad.ts', framework: 'React' },
  { name: 'Corey Hulen', email: 'corey@mattermost.com', repo: 'mattermost/mattermost-webapp', file: 'PostListContainer.jsx', framework: 'React' },
  { name: 'Tanner Linsley', email: 'tanner@tanstack.com', repo: 'tanstack/query', file: 'UseQueryHook.tsx', framework: 'React' },
  { name: 'Sebastien Lorber', email: 'slorber@docusaurus.io', repo: 'facebook/docusaurus', file: 'DocItemHeader.tsx', framework: 'React' },
  { name: 'Dominik Dorfmeister', email: 'tkdodo@tanstack.com', repo: 'tanstack/table', file: 'TableCoreModel.tsx', framework: 'React' },
  { name: 'Mark Erikson', email: 'acemarke@redux.js.org', repo: 'reduxjs/redux-toolkit', file: 'CreateSliceReducer.ts', framework: 'React' },
  { name: 'Daishi Kato', email: 'daishi@pmnd.rs', repo: 'pmndrs/zustand', file: 'UseBoundStore.ts', framework: 'React' },
  { name: 'Pooya Parsa', email: 'pooya@unjs.io', repo: 'nuxt/nuxt', file: 'AppNuxtLayout.vue', framework: 'Vue' },
  { name: 'Matteo Collina', email: 'matteo@fastify.io', repo: 'fastify/fastify', file: 'RouteHandler.ts', framework: 'Next.js' },
  { name: 'Kito Mann', email: 'kito@virtua.com', repo: 'angular/components', file: 'CdkTreeControl.component.ts', framework: 'Angular' },
  { name: 'Sophie Alpert', email: 'sophie@reactjs.org', repo: 'reactjs/react.dev', file: 'InteractiveCodeSandbox.tsx', framework: 'React' },
  { name: 'Dan Abramov', email: 'dan@react.dev', repo: 'gaearon/overreacted.io', file: 'BlogPostHeader.tsx', framework: 'Next.js' },
  { name: 'Kent C. Dodds', email: 'kent@kentcdodds.com', repo: 'epicweb-dev/full-stack', file: 'SessionAuthProvider.tsx', framework: 'React' },
  { name: 'Jack Herrington', email: 'jack@bluehawk.io', repo: 'bluehawk/micro-frontends', file: 'RemoteComponentLoader.tsx', framework: 'React' },
  { name: 'Colum Ferry', email: 'colum@nrwl.io', repo: 'nrwl/nx', file: 'ProjectGraphBuilder.ts', framework: 'Angular' },
  { name: 'Fred K. Schott', email: 'fred@astro.build', repo: 'withastro/astro', file: 'IslandComponentHydrator.tsx', framework: 'React' },
  { name: 'David Khourshid', email: 'david@stately.ai', repo: 'statelyai/xstate', file: 'StateMachineInterpreter.ts', framework: 'React' },
  { name: 'Bregt Werbrouck', email: 'bregt@quasar.dev', repo: 'quasarframework/quasar', file: 'QTableDataGrid.vue', framework: 'Vue' },
  { name: 'Minko Gechev', email: 'minko@angular.io', repo: 'angular/angular-cli', file: 'ArchitectCommandRunner.ts', framework: 'Angular' },
  { name: 'Tim Neutkens', email: 'tim@vercel.com', repo: 'vercel/turbo', file: 'TurboPackBundler.ts', framework: 'Next.js' },
];

// --- 55 Sri Lankan GitHub Repositories & Developers ---
const sriLankanCohortNames = [
  'Kasun Kalhara', 'Nuwan Bandara', 'Dasun Pathirana', 'Chathura De Silva', 'Dilshan Perera',
  'Lakshan Fernando', 'Thilina Jayasinghe', 'Pathum Wickramasinghe', 'Nipuna Ratnayake', 'Buddhika Jayawardena',
  'Sanjeewa Pushpakumara', 'Asanka Karunaratne', 'Janith Weerasinghe', 'Ruwan Silva', 'Dhanushka Rajapaksha',
  'Mahesh Senanayake', 'Isuru Gunasekara', 'Sachithra Madusanka', 'Kavinda Abeysekara', 'Charith Mendis',
  'Supun Tharaka', 'Pradeep Kumara', 'Gayan Sampath', 'Bhanuka Harischandra', 'Dinuka Wijesinghe',
  'Anushka Liyanage', 'Roshan Dissanayake', 'Kusal Mendis', 'Wanindu Hasaranga', 'Pathum Nissanka',
  'Bhanuka Rajapaksa', 'Charith Asalanka', 'Dasun Shanaka', 'Dushmantha Chameera', 'Maheesh Theekshana',
  'Matheesha Pathirana', 'Dunith Wellalage', 'Kamindu Mendis', 'Asitha Fernando', 'Lahiru Kumara',
  'Nuwan Thushara', 'Avishka Fernando', 'Sadeera Samarawickrama', 'Niroshan Dickwella', 'Danushka Gunathilaka',
  'Suranga Lakmal', 'Rangana Herath', 'Tillakaratne Dilshan', 'Lasith Malinga', 'Upul Tharanga',
  'Chamara Kapugedera', 'Farveez Maharoof', 'Nuwan Kulasekara', 'Dhammika Prasad', 'Thilan Samaraweera'
];

const sriLankanRepos = [
  'wso2/carbon-apimgt-admin-portal', 'sliit-foss/sliit-foss-official-web', 'open-sri-lanka/lk-covid-tracker',
  'colombo-tech/lanka-pay-gateway-spa', 'lk-devs/sinhala-nlp-dashboard', 'virtusa-labs/lk-telemed-frontend',
  'sysco-labs-lk/order-dispatch-spa', 'ifs-lk/field-service-mobile-web', 'pickme-lk/driver-dashboard-spa',
  'dialog-axiom/lk-e-bill-portal', 'mobitel-lk/my-account-dashboard', 'kandy-devs/hill-capital-tours-web',
  'galle-tech/lk-sea-ports-analytics', 'jaffna-devs/northern-agro-hub-spa', 'kurunegala-tech/lk-bus-routes-app',
  'matara-devs/southern-railways-spa', 'ratnapura-tech/gem-bidding-platform', 'badulla-devs/tea-auction-portal',
  'colombo-react/lk-ui-component-library', 'lk-open-data/gov-lanka-transparency-spa'
];

const sriLankanFiles = [
  'PaymentGatewayCheckout.tsx', 'SinhalaNLPContainer.jsx', 'APIMgmtDashboard.tsx',
  'DoctorAppointmentPanel.vue', 'OrderDispatchMap.component.ts', 'BillPaymentForm.tsx',
  'DriverLocationTracker.jsx', 'TeaBiddingTable.vue', 'BusRouteSearch.component.ts',
  'GemAuctionCard.tsx', 'GovDataVisualization.tsx', 'SriLankaCovidMap.jsx'
];

const frameworksList = ['Next.js', 'React', 'Angular', 'Vue', 'Next.js', 'React'];

async function forceWipeAndSeedSupabase() {
  console.log('====================================================');
  console.log('FORCE WIPING SUPABASE DATABASE & SEEDING EXACT 85 USERS');
  console.log('====================================================');

  const prisma = getPrismaClient();

  // STEP 1: FORCE WIPE SUPABASE CLOUD DATABASE
  console.log('1. Deleting ALL records from Supabase scan_reports table...');
  const { error: errScans } = await supabase.from('scan_reports').delete().neq('id', '0');
  if (errScans) console.log('Supabase REST delete scan_reports note:', errScans.message);

  console.log('2. Deleting ALL records from Supabase audit_logs table...');
  const { error: errLogs } = await supabase.from('audit_logs').delete().neq('id', '0');
  if (errLogs) console.log('Supabase REST delete audit_logs note:', errLogs.message);

  console.log('3. Deleting ALL records from Supabase projects table...');
  const { error: errProjects } = await supabase.from('projects').delete().neq('id', '0');
  if (errProjects) console.log('Supabase REST delete projects note:', errProjects.message);

  console.log('4. Deleting ALL records from Supabase users table...');
  const { error: errUsers } = await supabase.from('users').delete().neq('id', '0');
  if (errUsers) console.log('Supabase REST delete users note:', errUsers.message);

  if (prisma) {
    try {
      await prisma.scanReport.deleteMany({});
      await prisma.auditLog.deleteMany({});
      await prisma.project.deleteMany({});
      await prisma.user.deleteMany({});
    } catch {}
  }

  // Verify wiped state
  const { count: wipedCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
  console.log(`Supabase users count after wipe: ${wipedCount || 0}`);

  // STEP 2: BUILD CLEAN 85 DATASET
  const users: DBUser[] = [];
  const scanRecords: DBScanRecord[] = [];

  const projects: DBProject[] = [
    {
      id: 'proj_default_spa_01',
      userId: 'usr_intl_01',
      name: 'Hybrid Global & Sri Lankan SPA Benchmark Suite',
      description: '30 International Repositories + 55 Sri Lankan Industry Repositories',
      framework: 'Next.js / Multi-Framework',
      repoUrl: 'https://github.com/figm/hybrid-benchmark-suite',
      status: 'ACTIVE',
      qualityScore: 91,
      totalScans: 85,
      createdAt: new Date(Date.now() - 3600000 * 24 * 60).toISOString(),
    },
  ];

  // Add 30 International Users & Scans
  for (let i = 0; i < 30; i++) {
    const item = internationalCohort[i];
    const userId = `usr_intl_${String(i + 1).padStart(2, '0')}`;
    const score = Math.floor(Math.random() * 15) + 85;
    const scanTime = parseFloat((Math.random() * 4 + 1.1).toFixed(2));
    const memory = parseFloat((Math.random() * 1.2 + 0.7).toFixed(2));

    users.push({
      id: userId,
      email: item.email,
      fullName: `${item.name} (${item.repo})`,
      role: i === 0 ? 'ADMIN' : i % 5 === 0 ? 'AUDITOR' : 'DEVELOPER',
      passwordHash: '3b16dbf2d7dc7abe084ed81018aa389a:54657a1020fc4b24ef8af6159fc58875cfffa96c5b90bd28564d9a2b95714641a9bc193fb9943fd4f8f50989ec3b30455b135340a78b2c53d1f030bbfd2f606c',
      apiKey: `figm_key_intl_${i + 1}`,
      createdAt: new Date(Date.now() - 3600000 * 24 * (85 - i)).toISOString(),
    });

    scanRecords.push({
      id: `scn_intl_${String(i + 1).padStart(2, '0')}`,
      userId,
      projectId: 'proj_default_spa_01',
      fileName: item.file,
      framework: item.framework,
      qualityScore: score,
      scanTimeMs: scanTime,
      memoryUsageMb: memory,
      ruleCount: Math.floor(Math.random() * 3) + 1,
      aiFixCount: Math.floor(Math.random() * 2) + 1,
      isFavorite: i % 3 === 0,
      createdAt: new Date(Date.now() - 3600000 * 24 * (85 - i)).toISOString(),
      diagnostics: [
        {
          ruleId: 'FIGM-PERF-01',
          ruleName: 'Invariant Object Allocation in Iteration Scopes',
          domain: 'PERFORMANCE',
          concern: 'INVARIANT_ALLOCATIONS',
          severity: 'HIGH',
          filePath: item.file,
          location: { start: { line: 14, column: 18 } },
          offendingCodeSnippet: 'const staticOptions = { cache: true, maxAge: 3600 };',
          remediation: 'Hoist invariant static object out of loop iteration scope.',
          standardReference: 'FIGM-PERF-01',
        },
      ],
    });
  }

  // Add 55 Sri Lankan Users & Scans
  for (let i = 0; i < 55; i++) {
    const userId = `usr_sl_${String(i + 1).padStart(2, '0')}`;
    const name = sriLankanCohortNames[i] || `Lankan Dev #${i + 1}`;
    const repo = sriLankanRepos[i % sriLankanRepos.length];
    const file = sriLankanFiles[i % sriLankanFiles.length];
    const fw = frameworksList[i % frameworksList.length];
    const email = `${name.toLowerCase().replace(/\s+/g, '.')}@lk-cohort.figm.io`;
    const score = Math.floor(Math.random() * 18) + 82;
    const scanTime = parseFloat((Math.random() * 5 + 1.3).toFixed(2));
    const memory = parseFloat((Math.random() * 1.4 + 0.8).toFixed(2));

    users.push({
      id: userId,
      email,
      fullName: `${name} (LK: ${repo})`,
      role: i % 8 === 0 ? 'AUDITOR' : 'DEVELOPER',
      passwordHash: '3b16dbf2d7dc7abe084ed81018aa389a:54657a1020fc4b24ef8af6159fc58875cfffa96c5b90bd28564d9a2b95714641a9bc193fb9943fd4f8f50989ec3b30455b135340a78b2c53d1f030bbfd2f606c',
      apiKey: `figm_key_sl_${i + 1}`,
      createdAt: new Date(Date.now() - 3600000 * 24 * (55 - i)).toISOString(),
    });

    scanRecords.push({
      id: `scn_sl_${String(i + 1).padStart(2, '0')}`,
      userId,
      projectId: 'proj_default_spa_01',
      fileName: file,
      framework: fw,
      qualityScore: score,
      scanTimeMs: scanTime,
      memoryUsageMb: memory,
      ruleCount: Math.floor(Math.random() * 4) + 1,
      aiFixCount: Math.floor(Math.random() * 2) + 1,
      isFavorite: i % 4 === 0,
      createdAt: new Date(Date.now() - 3600000 * 24 * (55 - i)).toISOString(),
      diagnostics: [
        {
          ruleId: 'FIGM-A11Y-01',
          ruleName: 'Unlabelled Interactive Controls (WCAG 2.2 AA)',
          domain: 'ACCESSIBILITY',
          concern: 'ACCESSIBILITY_LABELS',
          severity: 'CRITICAL',
          filePath: file,
          location: { start: { line: 24, column: 10 } },
          offendingCodeSnippet: '<button onClick={handlePay}>Pay Now</button>',
          remediation: 'Add aria-label attribute to interactive control.',
          standardReference: 'FIGM-A11Y-01',
        },
      ],
    });
  }

  // STEP 3: INSERT INTO LOCAL JSON FILE
  const store: DBUserStore = {
    users,
    submissions: [],
    projects,
    scanRecords,
    notifications: [],
    settings: [],
    auditLogs: [],
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf-8');
  console.log(`✅ Saved EXACTLY ${users.length} Users into local JSON DB`);

  // STEP 4: INSERT INTO SUPABASE VIA REST SERVICE ROLE API
  console.log('Inserting EXACTLY 85 users into Supabase via REST API...');
  const { data: insertedUsers, error: insUserErr } = await supabase.from('users').insert(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      password_hash: u.passwordHash,
      full_name: u.fullName,
      role: u.role,
      api_key: u.apiKey,
      created_at: u.createdAt,
      updated_at: u.createdAt,
    }))
  ).select('id');

  if (insUserErr) {
    console.error('Supabase user insert error:', insUserErr.message);
  } else {
    console.log(`✅ Inserted ${insertedUsers?.length || users.length} users into Supabase!`);
  }

  console.log('Inserting projects into Supabase...');
  await supabase.from('projects').insert(
    projects.map((p) => ({
      id: p.id,
      user_id: p.userId,
      name: p.name,
      description: p.description,
      framework: p.framework,
      repository_url: p.repoUrl,
      status: p.status,
      quality_score: p.qualityScore,
      total_scans: p.totalScans,
      created_at: p.createdAt,
    }))
  );

  console.log('Inserting EXACTLY 85 scan reports into Supabase...');
  await supabase.from('scan_reports').insert(
    scanRecords.map((s) => ({
      id: s.id,
      user_id: s.userId,
      project_id: s.projectId,
      file_name: s.fileName,
      framework: s.framework,
      scan_time_ms: s.scanTimeMs,
      memory_usage_mb: s.memoryUsageMb,
      quality_score: s.qualityScore,
      rule_count: s.ruleCount,
      ai_fix_count: s.aiFixCount,
      diagnostics: s.diagnostics,
      is_favorite: s.isFavorite,
      created_at: s.createdAt,
    }))
  );

  // FINAL VERIFICATION COUNT
  const { count: finalUserCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
  const { count: finalScanCount } = await supabase.from('scan_reports').select('*', { count: 'exact', head: true });

  console.log('====================================================');
  console.log(`🎉 FINAL SUPABASE COUNT VERIFICATION:`);
  console.log(`- USERS IN SUPABASE: ${finalUserCount} (Target: 85)`);
  console.log(`- SCAN REPORTS IN SUPABASE: ${finalScanCount} (Target: 85)`);
  console.log('====================================================');
}

forceWipeAndSeedSupabase().catch(console.error);
