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
  'backend/test_task2_live_e2e_admin_export.js',
  'backend/test_task3_security_verification.js',
  'backend/test_task4_lifecycle_verification.js',
  'test_task5_browser_compatibility.js',
  'backend/test_phase7_1_auth_security.js',
  'backend/test_phase7_2_api_security.js',
  'backend/test_phase7_3_export_reliability.js',
  'backend/test_phase7_4_backup_recovery.js',
  'backend/test_phase7_final_security_corrections.js',
];

console.log('================================================================================');
console.log('STARTING PHASE 7 COMPLETE AUTOMATED TEST RECONCILIATION RUN');
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

  process.stdout.write(`Running: ${file.padEnd(48)} ... `);
  const start = Date.now();
  const res = spawnSync(process.execPath, ['--test', file], {
    env: { ...process.env, NODE_ENV: 'test' },
    encoding: 'utf8',
    timeout: 180000,
  });
  const duration = Date.now() - start;

  const stdout = res.stdout || '';
  const stderr = res.stderr || '';
  const fullOutput = stdout + '\n' + stderr;

  // Parse node:test output
  const passMatch = fullOutput.match(/ℹ\s+pass\s+(\d+)/);
  const failMatch = fullOutput.match(/ℹ\s+fail\s+(\d+)/);
  const skipMatch = fullOutput.match(/ℹ\s+skipped\s+(\d+)/);
  const totalMatch = fullOutput.match(/ℹ\s+tests\s+(\d+)/);

  const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
  const failed = failMatch ? parseInt(failMatch[1], 10) : (res.status !== 0 ? 1 : 0);
  const skipped = skipMatch ? parseInt(skipMatch[1], 10) : 0;
  const discovered = totalMatch ? parseInt(totalMatch[1], 10) : (passed + failed + skipped);
  const executed = passed + failed;

  totalDiscovered += discovered;
  totalExecuted += executed;
  totalPassed += passed;
  totalFailed += failed;
  totalSkipped += skipped;
  totalDurationMs += duration;

  const status = failed === 0 ? 'PASS' : 'FAIL';
  console.log(`${status} (${duration}ms, ${passed}/${discovered} passed)`);

  results.push({
    file,
    discovered,
    executed,
    passed,
    failed,
    skipped,
    durationMs: duration,
    status,
  });
}

console.log('\n================================================================================');
console.log('RECONCILIATION SUMMARY REPORT');
console.log('================================================================================');
console.log(`Total Suites Executed : ${results.length}`);
console.log(`Total Tests Discovered: ${totalDiscovered}`);
console.log(`Total Tests Executed  : ${totalExecuted}`);
console.log(`Total Tests Passed    : ${totalPassed}`);
console.log(`Total Tests Failed    : ${totalFailed}`);
console.log(`Total Tests Skipped   : ${totalSkipped}`);
console.log(`Total Execution Time  : ${(totalDurationMs / 1000).toFixed(2)}s`);
console.log('================================================================================\n');

const reportPath = path.resolve(process.cwd(), 'test_reconciliation_summary.json');
fs.writeFileSync(
  reportPath,
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
  ),
  'utf8'
);

console.log(`Summary JSON written to: ${reportPath}`);

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
