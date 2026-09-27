// Benchmark CLI — `npm run benchmark`.
// Prints the §15 jury table and writes benchmark-results.json (git-ignored,
// regenerate any time with this command).
import '../../env';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BenchmarkMetrics } from './metrics';
import { runBenchmark } from './runner';

const ROWS: { key: keyof BenchmarkMetrics; label: string; target: string }[] = [
  { key: 'hard_constraint_violation_rate', label: 'hard_constraint_violation_rate', target: '→ 0' },
  { key: 'precision_at_3_jobs', label: 'precision_at_3_jobs', target: 'higher wins' },
  { key: 'citation_precision', label: 'citation_precision', target: '→ 1' },
  { key: 'citation_coverage', label: 'citation_coverage', target: '→ 1' },
  { key: 'unsupported_claim_rate', label: 'unsupported_claim_rate', target: '→ 0' },
  { key: 'correct_abstention_rate', label: 'correct_abstention_rate', target: '→ 1' },
  { key: 'adversarial_downgrade_rate', label: 'adversarial_downgrade_rate', target: '> 0' },
  { key: 'decision_stability', label: 'decision_stability', target: '= 1' }
];

function main() {
  const report = runBenchmark();

  console.log(`# ProjectFit benchmark (§15) — ${report.projectfit.n} synthetic profiles, clock=${report.now}`);
  console.log('');
  console.log('| metric | ProjectFit | generic-LLM baseline | target |');
  console.log('|---|---|---|---|');
  for (const row of ROWS) {
    const pf = report.projectfit[row.key] as number;
    const bl = report.baseline[row.key] as number;
    console.log(`| ${row.label} | **${pf.toFixed(3)}** | ${bl.toFixed(3)} | ${row.target} |`);
  }
  console.log(
    `| expired_jobs_suggested | **${report.projectfit.expired_jobs_suggested}** | ${report.baseline.expired_jobs_suggested} | → 0 |`
  );
  console.log('');
  console.log(
    `paraphrase stability (reversed skill order): ProjectFit=${report.paraphrase_stability_projectfit.toFixed(3)} baseline=${report.paraphrase_stability_baseline.toFixed(3)}`
  );
  console.log('');
  console.log('| case | decision | top ranking | devil | abstention expected |');
  console.log('|---|---|---|---|---|');
  for (const p of report.per_profile) {
    console.log(
      `| ${p.case_id} ${p.label} | ${p.decision} | ${p.ranking.join(', ') || '—'} | ${p.devil.join(', ') || '—'} | ${p.expected_abstention ? 'yes' : 'no'} |`
    );
  }

  const out = resolve(process.cwd(), 'benchmark-results.json');
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`\nwrote ${out}`);
}

main();
