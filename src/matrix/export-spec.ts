/**
 * Script to generate figm-spec.json from the Four-Layer Architecture Meta-Model
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateMasterSpecification } from './four-layer-meta-model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const spec = generateMasterSpecification();
const outputPath = path.resolve(__dirname, '../../figm-spec.json');

fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2), 'utf-8');
console.log(`[FIGM] Master Specification exported successfully to: ${outputPath}`);
console.log(`[FIGM] Total Core Rules in Matrix: ${spec.rules.length}`);
