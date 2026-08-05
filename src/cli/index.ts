#!/usr/bin/env node
/**
 * Framework-Independent Guideline Model (FIGM)
 * CLI Entry Point (src/cli/index.ts)
 */

export { runCLI, parseCLIArgs } from './figm-analyze.js';
import { runCLI } from './figm-analyze.js';

// Auto-execute if invoked directly from terminal
if (process.argv[1] && (process.argv[1].includes('figm-analyze') || process.argv[1].includes('index'))) {
  const exitCode = runCLI(process.argv.slice(2));
  if (exitCode !== 0 && process.env.NODE_ENV !== 'test') {
    process.exit(exitCode);
  }
}
