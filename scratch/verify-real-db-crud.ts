import { SupabaseStorageProvider } from '../src/storage/supabase-storage-provider';
import { hashPassword } from '../src/auth/auth-service';

async function main() {
  const provider = new SupabaseStorageProvider();
  console.log('Connected to real Postgres:', provider.isConnected());
  if (!provider.isConnected()) {
    console.log('FAIL: not connected to real Postgres, aborting CRUD verification');
    process.exit(1);
  }

  const marker = `crud_verify_${Date.now()}`;
  const email = `${marker}@figm-audit-test.io`;

  // CREATE
  const user = await provider.createUser({
    email,
    passwordHash: hashPassword('TempAuditPass123!'),
    fullName: 'CRUD Verification User',
    role: 'DEVELOPER',
  });
  console.log('CREATE user:', user.id, user.email);

  // READ
  const fetched = await provider.findUserById(user.id);
  console.log('READ user found:', fetched?.email === email);

  // UPDATE
  const updated = await provider.updateUser(user.id, { fullName: 'CRUD Verification User (Updated)' });
  console.log('UPDATE applied:', updated?.fullName === 'CRUD Verification User (Updated)');

  // READ again to confirm update persisted
  const reread = await provider.findUserById(user.id);
  console.log('RE-READ reflects update:', reread?.fullName === 'CRUD Verification User (Updated)');

  // Nested entity CRUD: project + scan + notification + settings + audit log
  const project = await provider.createProject({
    userId: user.id,
    name: 'CRUD Verify Project',
    description: 'temp',
    framework: 'React',
    repoUrl: '',
    status: 'ACTIVE',
  });
  console.log('CREATE project:', project.id);

  const scan = await provider.createScanRecord({
    userId: user.id,
    projectId: project.id,
    fileName: 'CrudVerify.tsx',
    framework: 'React',
    scanTimeMs: 1.23,
    memoryUsageMb: 0.5,
    qualityScore: 91,
    ruleCount: 1,
    aiFixCount: 0,
    diagnostics: [],
    isFavorite: false,
  });
  console.log('CREATE scan:', scan.id);

  const toggled = await provider.toggleFavoriteScan(scan.id);
  console.log('TOGGLE favorite:', toggled?.isFavorite === true);

  const notif = await provider.createNotification({
    userId: user.id,
    type: 'SCAN_SUCCESS',
    title: 'CRUD test',
    message: 'verify notifications table',
  });
  console.log('CREATE notification:', notif.id);

  const settings = await provider.updateUserSettings(user.id, { theme: 'light' });
  console.log('UPSERT settings:', settings.theme === 'light');

  const auditLog = await provider.addAuditLog({
    userId: user.id,
    email,
    action: 'LOGIN',
    ipAddress: '127.0.0.1',
    userAgent: 'crud-verify-script',
    status: 'SUCCESS',
  });
  console.log('CREATE audit log:', auditLog.id);

  // DELETE (cascades project/scan/notification/settings via schema)
  const scanDeleted = await provider.deleteScanRecord(scan.id);
  console.log('DELETE scan:', scanDeleted);

  const projectDeleted = await provider.deleteProject(project.id);
  console.log('DELETE project:', projectDeleted);

  const userDeleted = await provider.deleteUser(user.id);
  console.log('DELETE user (cascades notification/settings/apikeys):', userDeleted);

  // READ after delete to confirm gone
  const goneCheck = await provider.findUserById(user.id);
  console.log('POST-DELETE read returns undefined:', goneCheck === undefined);

  // --- Regression coverage for two real bugs found & fixed during live E2E API testing (Phase 10) ---
  // Bug 1: app/api/scan/route.ts used to pass a hardcoded, non-existent projectId ('prj_default_spa')
  // to createScanRecord, which silently violated the real FK constraint (caught by an empty catch{}),
  // meaning every authenticated scan silently failed to persist. Fix: omit projectId when none is real.
  const regressionUser = await provider.createUser({
    email: `${marker}_regression@figm-audit-test.io`,
    passwordHash: hashPassword('TempAuditPass123!'),
    fullName: 'Regression Verification User',
    role: 'DEVELOPER',
  });
  const scanWithoutProjectId = await provider.createScanRecord({
    userId: regressionUser.id,
    fileName: 'NoProjectRegression.tsx',
    framework: 'React',
    scanTimeMs: 1,
    memoryUsageMb: 0.1,
    qualityScore: 100,
    ruleCount: 0,
    aiFixCount: 0,
    diagnostics: [],
    isFavorite: false,
  });
  console.log('Scan WITHOUT a projectId succeeds (Bug 1 fix confirmed):', !!scanWithoutProjectId.id);

  // Bug 2: app/api/user-study/log-scan/route.ts passed userId: "P001"-style synthetic participant IDs
  // to createScanRecord without a matching User row existing, violating the required (non-null) FK
  // scan_reports_user_id_fkey. Fix: createUser now accepts an optional custom `id`, letting the route
  // upsert a real User row with the participant's literal ID before creating the scan.
  const customIdParticipant = `P_REGRESSION_${Date.now()}`;
  const participantUser = await provider.createUser({
    id: customIdParticipant,
    email: `${customIdParticipant.toLowerCase()}@user-study.figm-audit-test.io`,
    passwordHash: hashPassword('irrelevant'),
    fullName: 'Regression Participant',
    role: 'DEVELOPER',
  });
  console.log('createUser honors custom id (Bug 2 fix confirmed):', participantUser.id === customIdParticipant);

  const participantScan = await provider.createScanRecord({
    userId: customIdParticipant,
    fileName: 'ParticipantRegression.tsx',
    framework: 'React',
    scanTimeMs: 1,
    memoryUsageMb: 0.1,
    qualityScore: 100,
    ruleCount: 0,
    aiFixCount: 0,
    diagnostics: [],
    isFavorite: false,
  });
  console.log('Scan for a synthetic-ID participant with a matching User row succeeds:', !!participantScan.id);

  // Clean up regression fixtures
  await provider.deleteScanRecord(scanWithoutProjectId.id);
  await provider.deleteScanRecord(participantScan.id);
  await provider.deleteUser(regressionUser.id);
  await provider.deleteUser(customIdParticipant);
  console.log('Regression fixtures cleaned up.');

  console.log('ALL_CRUD_STEPS_COMPLETED');
}

main().catch((err) => {
  console.error('CRUD_VERIFY_FAILED', err);
  process.exit(1);
});
