import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

// 10 Tier-1 Frozen Files and their immutable baseline SHA-256 hashes
const TIER1_FROZEN_FILES = {
  'src/llm/sql.validator.js': '57650b1b24dd0941ed31ef567b1940514b5a912e23c5a36c311fccfba0eac66d',
  'src/kernel/gate.chain.js': 'b224bf22763b120b855fc8ce8eb88ad40681dbfabb29d60aba1080964d5b96b5',
  'src/kernel/pipeline.config.js': '8a28e649ace7143f868ebb8ba3058eb191b83713507fe096d7b10fe840fd0ef8',
  'src/kernel/handler-result.js': 'c857c2585ca8e41f6feae252dfb92982bd73c911272ded7bba0d776c06c1a8af',
  'src/kernel/formatter.registry.js': '42c249acfd1fcb49dbce7c2d4eeace409f251e4abf3f82f8a469c90f489c714b',
  'src/core/result.sanity.js': '9f3a52642aaa3aa4eff8945423b71cea82d33a0f160d877f7871bef70e380fd1',
  'src/core/guard-markers.js': 'e12f8b40a7c0ebac7e415fc4525809c9d98b1edb0dbc553cf8238908703a2347',
  'src/llm/llm.client.js': 'c3a5df3d138c8b64b1420ab10cebbeb749ac9bbffc5f12c68962cceb9437e128',
  'src/config/semantic.profile.js': 'a6d1383301a03cacec67b3d03ea5ec89540890bfba148ac2f282ea23382c051b',
  'src/config/database.js': 'b58d6b3a34b7765cefd0907c238c1ef9979616b2bf9ec633878dccf99dd99d9f'
};

function runAuditFreeze() {
  console.log("==================================================");
  console.log("   STEP 1 (D0a) — AUDIT FREEZE GATE (10 TIER-1)   ");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  for (const [relPath, expectedHash] of Object.entries(TIER1_FROZEN_FILES)) {
    const fullPath = path.join(backendDir, relPath);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ MISSING: ${relPath}`);
      failed++;
      continue;
    }

    const content = fs.readFileSync(fullPath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    if (hash === expectedHash) {
      console.log(`✅ MATCH [SHA256]: ${relPath}`);
      passed++;
    } else {
      console.error(`🚨 HASH MISMATCH: ${relPath}`);
      console.error(`   Expected: ${expectedHash}`);
      console.error(`   Actual:   ${hash}`);
      failed++;
    }
  }

  // Git diff check
  try {
    const gitDiff = execSync(`git diff --name-only HEAD -- ${Object.keys(TIER1_FROZEN_FILES).join(' ')}`, {
      cwd: backendDir,
      encoding: 'utf8'
    }).trim();

    if (gitDiff.length > 0) {
      console.error(`🚨 GIT DIFF DETECTED IN TIER-1 FILES:\n${gitDiff}`);
      failed++;
    } else {
      console.log("✅ GIT DIFF: 0 diffs across all 10 Tier-1 frozen files");
    }
  } catch (err) {
    // If git diff throws or fails, note it
    console.log("ℹ️ Git diff check skipped or not in repo root; sha256 gate enforced.");
  }

  console.log("==================================================");
  console.log(`TIER-1 AUDIT: ${passed}/${Object.keys(TIER1_FROZEN_FILES).length} files verified clean`);
  if (failed === 0) {
    console.log("🏆 FREEZE GATE PASSED — ALL TIER-1 FILES UNTOUCHED");
    console.log("==================================================");
    process.exit(0);
  } else {
    console.error("🚨 FREEZE GATE BREACH DETECTED — HALTING!");
    console.log("==================================================");
    process.exit(1);
  }
}

runAuditFreeze();
