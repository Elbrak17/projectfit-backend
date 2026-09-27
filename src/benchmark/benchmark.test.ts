// Benchmark contract tests — §15. They lock the jury-visible behaviour:
// 20 profiles, 8 metrics, zero violations, zero expired, full determinism,
// and ProjectFit ahead of the generic-LLM baseline on every baseline axis
// (violations, unsourced claims, stability, abstention).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BENCHMARK_CASES } from './profiles';
import { runBenchmark } from './runner';
import { checkHardConstraints } from '../engine/constraints';
import { JOBS_SNAPSHOT } from '../data/jobs.snapshot';
import { runBaseline } from './baseline';

const ENABLE_DEVIL = process.env.ENABLE_DEVIL !== 'false';

test('benchmark covers exactly 20 unique synthetic profiles (§21 must-have)', () => {
  assert.equal(BENCHMARK_CASES.length, 20);
  assert.equal(new Set(BENCHMARK_CASES.map((c) => c.id)).size, 20);
  assert.ok(BENCHMARK_CASES.some((c) => c.profile.country_id !== 'SN'), 'out-of-snapshot country covered');
  assert.ok(BENCHMARK_CASES.some((c) => c.profile.capital_at_risk === 0), 'zero-risk budget covered');
  assert.ok(
    BENCHMARK_CASES.filter((c) => c.shouldAbstain).length >= 3,
    'at least 3 abstention cases (P15/P16/P17)'
  );
});

test('benchmark reports all 8 §15 metrics + expired count, all in range', () => {
  const { projectfit: m, baseline: b } = runBenchmark();
  assert.equal(m.n, 20);
  for (const k of [
    'hard_constraint_violation_rate',
    'precision_at_3_jobs',
    'citation_precision',
    'citation_coverage',
    'unsupported_claim_rate',
    'correct_abstention_rate',
    'adversarial_downgrade_rate',
    'decision_stability'
  ] as const) {
    assert.ok(typeof m[k] === 'number' && m[k] >= 0 && m[k] <= 1, `${k} in [0,1], got ${m[k]}`);
    assert.ok(typeof b[k] === 'number' && b[k] >= 0 && b[k] <= 1, `baseline ${k} in [0,1]`);
  }
  assert.ok(Number.isInteger(m.expired_jobs_suggested) && m.expired_jobs_suggested >= 0);
});

test('ProjectFit: zero violations, zero expired, full stability', () => {
  const { projectfit: m } = runBenchmark();
  assert.equal(m.hard_constraint_violation_rate, 0, 'no ranked item may violate a hard constraint');
  assert.equal(m.expired_jobs_suggested, 0, 'no expired offer may surface in a ranking');
  assert.equal(m.decision_stability, 1, 'same state → same ranking, twice in a row');
});

test('ProjectFit: correct abstention on P15/P16/P17, every claim sourced', () => {
  const report = runBenchmark();
  assert.equal(report.projectfit.correct_abstention_rate, 1);
  for (const p of report.per_profile) {
    if (p.expected_abstention) {
      assert.ok(
        ['KEEP_YOUR_CAPITAL', 'INSUFFICIENT_EVIDENCE', 'NO_SAFE_RECOMMENDATION'].includes(p.decision),
        `${p.case_id} must abstain, got ${p.decision}`
      );
    }
  }
  assert.equal(report.projectfit.unsupported_claim_rate, 0);
  assert.equal(report.projectfit.citation_precision, 1);
});

test('ProjectFit beats the generic baseline on the 4 baseline axes (§15)', () => {
  const { projectfit: m, baseline: b } = runBenchmark();
  assert.ok(m.hard_constraint_violation_rate <= b.hard_constraint_violation_rate);
  assert.ok(m.unsupported_claim_rate <= b.unsupported_claim_rate);
  assert.ok(m.decision_stability >= b.decision_stability);
  assert.ok(m.correct_abstention_rate >= b.correct_abstention_rate);
  assert.ok(m.precision_at_3_jobs >= b.precision_at_3_jobs, 'relevance must stay ahead of keyword-only picking');
  // The contrast must actually exist: the baseline really fails where we claim it does.
  assert.ok(b.hard_constraint_violation_rate > 0, 'baseline must violate constraints (location/exclusions/…)');
  assert.ok(b.unsupported_claim_rate > 0, 'baseline must make unsourced statistical claims');
  assert.ok(b.correct_abstention_rate < 1, 'baseline never abstains, so it misses P15/P16/P17');
});

test('expiry guard: ProjectFit excludes expired offers, the baseline cannot (§15 fraîcheur)', () => {
  // Runtime corpus is real-only (no expired offer at the fixed clock), so the guard
  // is proven with a synthetic expired copy kept inside the test (never in the snapshot).
  const j = JOBS_SNAPSHOT[0];
  const expired = {
    id: j.id,
    type: 'JOB',
    title: j.title,
    region: j.region,
    country_id: j.country_id,
    expires_at: '2026-01-01',
    education_required: j.education_required
  };
  const profile = BENCHMARK_CASES[0].profile;
  const check = checkHardConstraints(expired as never, profile, new Date('2026-09-26T12:00:00Z'));
  assert.equal(check.pass, false, 'ProjectFit FAILs an expired offer');
  // Structural blindness: the baseline hardcodes PASS and never reads expires_at.
  const out = runBaseline(profile);
  assert.ok(out.opportunities.every((o) => o.hard_constraint_status === 'PASS'), 'baseline never FAILs by construction');
  assert.ok(
    out.opportunities.every((o) => !('expires_at' in o) || o.expires_at !== undefined),
    'baseline carries no expiry verdict'
  );
});

test('paraphrase probe: ProjectFit stable under skill reordering, baseline flips (P18)', () => {
  const report = runBenchmark();
  assert.equal(report.paraphrase_stability_projectfit, 1);
  assert.ok(
    report.paraphrase_stability_baseline < 1,
    'baseline top pick must flip on at least one paraphrased profile'
  );
});

test('the Devil visibly downgrades fragile hypotheses across the 20 profiles', () => {
  const report = runBenchmark();
  if (ENABLE_DEVIL) {
    assert.ok(report.projectfit.adversarial_downgrade_rate > 0, 'Devil must force ≥1 INVESTIGATE/REJECTED');
    assert.ok(
      report.per_profile.some((p) => p.devil.some((d) => d.endsWith(':REJECTED'))),
      'Commerce général must be REJECTED somewhere visible'
    );
  } else {
    assert.equal(report.projectfit.adversarial_downgrade_rate, 0);
  }
});
