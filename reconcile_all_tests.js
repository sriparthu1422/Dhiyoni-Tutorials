import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const testFiles = [
  'backend/test_phase1.js',
  'backend/test_phase2.js',
  'backend/test_phase2_concurrency.js',
  'backend/test_phase2_failure.js',
  'backend/test_phase3.js',
  'test_e2e_browser.js',
  'backend/test_phase4.js',
  'test_e2e_admin.js',
  'backend/test_phase5.js',
  'backend/test_phase5_safe_publication.js',
  'backend/test_phase5_live.js',
  'backend/test_phase5_live_export.js',
  'backend/test_final_verification.js',
  'backend/test_hotfix.js',
  'test_export_service.js',
  'test_e2e_admin_export.js',
];

console.log('================================================================================');
console.log('STARTING AUTOMATED TEST COUNT RECONCILIATION RUN');
console.log('================================================================================\n');

const results = [];
let totalDiscovered = 0;
let totalExecuted = 0;
let totalPassed = 0;
let totalFailed = 0;
let totalSkipped = 0;
let totalDurationMs = 0;

for (const file of testFiles) {
  const fullPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${file}`);
    continue;
  }

  process.stdout.write(`Running: ${file.padEnd(45)} ... `);
  const start = Date.now();
  const res = spawnSync(process.execPath, ['--test', file], {
    env: { ...process.env, NODE_ENV: 'test' },
    encoding: 'utf8',
    timeout: 180000,
  });
  const duration = Date.now() - start;

  const stdout = res.stdout || '';
  const stderr = res.stderr || '';
  const combined = stdout + '\n' + stderr;

  // Extract counts from node:test summary
  // Example lines:
  // ℹ tests 8
  // ℹ pass 8
  // ℹ fail 0
  // ℹ cancelled 0
  // ℹ skipped 0
  // ℹ duration_ms 134.0733
  const testsMatch = combined.match(/ℹ tests\s+(\d+)/);
  const passMatch = combined.match(/ℹ pass\s+(\d+)/);
  const failMatch = combined.match(/ℹ fail\s+(\d+)/);
  const skipMatch = combined.match(/ℹ skipped\s+(\d+)/);
  const cancelMatch = combined.match(/ℹ cancelled\s+(\d+)/);

  const tests = testsMatch ? parseInt(testsMatch[1], 10) : 0;
  const pass = passMatch ? parseInt(passMatch[1], 10) : 0;
  const fail = failMatch ? parseInt(failMatch[1], 10) : (res.status !== 0 ? 1 : 0);
  const skip = (skipMatch ? parseInt(skipMatch[1], 10) : 0) + (cancelMatch ? parseInt(cancelMatch[1], 10) : 0);

  const statusStr = fail === 0 && res.status === 0 ? 'PASS' : 'FAIL';
  console.log(`${statusStr} (${pass}/${tests} passed in ${(duration / 1000).toFixed(1)}s)`);

  results.push({
    file,
    discovered: tests,
    executed: tests,
    passed: pass,
    failed: fail,
    skipped: skip,
    durationMs: duration,
    status: statusStr,
  });

  totalDiscovered += tests;
  totalExecuted += tests;
  totalPassed += pass;
  totalFailed += fail;
  totalSkipped += skip;
  totalDurationMs += duration;
}

console.log('\n================================================================================');
console.log('RECONCILIATION SUMMARY TABLE');
console.log('================================================================================\n');

console.table(results);

console.log(`\nTOTALS:`);
console.log(`- Total Files:      ${results.length}`);
console.log(`- Tests Discovered: ${totalDiscovered}`);
console.log(`- Tests Executed:   ${totalExecuted}`);
console.log(`- Tests Passed:     ${totalPassed}`);
console.log(`- Tests Failed:     ${totalFailed}`);
console.log(`- Tests Skipped:    ${totalSkipped}`);
console.log(`- Total Duration:   ${(totalDurationMs / 1000).toFixed(1)}s\n`);

// Save JSON artifact
fs.writeFileSync(
  path.resolve(process.cwd(), 'test_reconciliation_summary.json'),
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: results.length,
        totalDiscovered,
        totalExecuted,
        totalPassed,
        totalFailed,
        totalSkipped,
        totalDurationMs,
      },
      suites: results,
    },
    null,
    2
  )
);
console.log('Saved machine-readable summary to test_reconciliation_summary.json');

