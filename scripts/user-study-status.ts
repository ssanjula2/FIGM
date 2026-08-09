/**
 * FIGM Code Inspector — User Study Target Progress & Collection Status CLI
 * 
 * Usage:
 *   npx tsx scripts/user-study-status.ts
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processUserStudyPipeline } from './import-user-study.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

export function checkUserStudyStatus() {
  const rawCSVPath = path.join(rootDir, 'research/raw/real/responses.csv');
  const report = processUserStudyPipeline(rawCSVPath);
  const prov = report.provenance;

  const target = prov.targetSampleSize || 85;
  const valid = prov.validParticipantCount || 0;
  const remaining = Math.max(0, target - valid);
  const percent = parseFloat(((valid / target) * 100).toFixed(1));

  console.log('====================================================');
  console.log('  FIGM REAL HUMAN USER STUDY STATUS');
  console.log('====================================================');
  console.log(`  Target Sample Size   : ${target}`);
  console.log(`  Valid Participants  : ${valid} (${valid}/${target} collected - ${percent}%)`);
  console.log(`  Remaining Needed    : ${remaining}`);
  console.log(`  Collection Status   : ${prov.collectionStatus}`);
  console.log(`  Real Human Data     : ${prov.isRealHumanData}`);
  console.log(`  Target Reached      : ${prov.targetReached}`);
  console.log('====================================================');

  if (prov.collectionStatus === 'NOT_COLLECTED' || valid === 0) {
    console.log('ℹ️ [STATUS] Real participant data is PENDING. Deployment guide: research/user-study/README.md');
  } else if (prov.targetReached) {
    console.log(`🎉 [STATUS] Target sample size of ${target} REACHED with ${valid} valid responses!`);
  } else {
    console.log(`⏳ [STATUS] Collection in progress (${valid}/${target} valid responses ingested).`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('user-study-status.ts')) {
  checkUserStudyStatus();
}
