// Benchmark runner — §15. Replays the exact production pipeline
// (routes/opportunities.ts + routes/decision.ts) in-process, without HTTP,
// over the 20 synthetic profiles, with a FIXED clock so results are stable.
import { buildBusinessHypotheses, buildJobOpportunities } from '../engine/opportunities';
import { checkHardConstraints } from '../engine/constraints';
import { scoreOpportunity } from '../engine/scoring';
import { devilReview } from '../engine/devil';
import { decide } from '../engine/decision';
import { Decision, DevilFinding, Opportunity, OpportunityDNA } from '../types';
import { BENCHMARK_CASES } from './profiles';
import {
  BenchmarkMetrics,
  ExpectedLabels,
  RunLike,
  computeMetrics,
  rankSignature
} from './metrics';
import { baselineToRunLike, paraphraseProfile, runBaseline } from './baseline';

export const BENCHMARK_NOW = new Date('2026-09-26T00:00:00.000Z');

export interface ProfileRun {
  caseId: string;
  label: string;
  profile: OpportunityDNA;
  opportunities: Opportunity[];
  devilFindings: DevilFinding[];
  decision: Decision;
}

export function evidenceDefaultFor(opp: Opportunity): number {
  return opp.type === 'JOB' ? 85 : opp.title.includes('B2B') ? 68 : 45;
}

/** One full pass of the production pipeline for a single profile. */
export function runProfile(dna: OpportunityDNA): {
  opportunities: Opportunity[];
  devilFindings: DevilFinding[];
  decision: Decision;
} {
  const jobs = buildJobOpportunities(dna);
  const biz = buildBusinessHypotheses(dna);
  const all: { opp: Opportunity; skills: string[] }[] = [
    ...jobs.map(({ opp, skills }) => ({ opp, skills })),
    ...biz.map((opp) => ({ opp, skills: [] as string[] }))
  ];

  for (const { opp, skills } of all) {
    const c = checkHardConstraints(opp, dna, BENCHMARK_NOW);
    opp.hard_constraint_status = c.pass ? 'PASS' : 'FAIL';
    opp.hard_constraint_reasons = c.reasons;
    scoreOpportunity(opp, dna, { skills }, evidenceDefaultFor(opp), 0);
  }
  const opportunities = all.map((a) => a.opp);

  const devilFindings = devilReview(opportunities);
  const penalties = new Map(devilFindings.map((f) => [f.opportunity_id, f.penalty]));
  for (const opp of opportunities) {
    const pen = penalties.get(opp.id) ?? 0;
    const jobMeta = all.find((a) => a.opp.id === opp.id);
    scoreOpportunity(opp, dna, { skills: jobMeta?.skills ?? [] }, evidenceDefaultFor(opp), pen);
    const f = devilFindings.find((x) => x.opportunity_id === opp.id);
    if (f?.suggested_status === 'REJECTED') {
      opp.status = 'REJECTED';
      opp.status_reason = [...f.risks, ...f.counter_evidence].join(' ');
    } else if (f?.suggested_status === 'INVESTIGATE') {
      opp.status = 'INVESTIGATE';
      opp.status_reason = f.risks.join(' ');
    }
  }

  const decision = decide(opportunities, dna, penalties);
  return { opportunities, devilFindings, decision };
}

function toRunLike(pr: ProfileRun): RunLike {
  return {
    profile: pr.profile,
    opportunities: pr.opportunities,
    devilFindings: pr.devilFindings,
    decision: {
      decision: pr.decision.decision,
      reasons: pr.decision.reasons,
      best_next_move: pr.decision.best_next_move,
      ranking: pr.decision.ranking.map((r) => ({ opportunity_id: r.opportunity_id }))
    }
  };
}

export interface BenchmarkReport {
  generated_at: string;
  now: string;
  projectfit: BenchmarkMetrics;
  baseline: BenchmarkMetrics;
  /** Per-profile jury-visible summary (decision + top pick + devil outcome). */
  per_profile: {
    case_id: string;
    label: string;
    decision: string;
    ranking: string[];
    devil: string[];
    expected_abstention: boolean;
  }[];
  paraphrase_stability_projectfit: number;
  paraphrase_stability_baseline: number;
}

export function runBenchmark(): BenchmarkReport {
  const runs: ProfileRun[] = BENCHMARK_CASES.map((c) => ({
    caseId: c.id,
    label: c.label,
    profile: c.profile,
    ...runProfile(c.profile)
  }));
  // Second identical pass → decision_stability.
  const reruns: ProfileRun[] = BENCHMARK_CASES.map((c) => ({
    caseId: c.id,
    label: c.label,
    profile: c.profile,
    ...runProfile(c.profile)
  }));

  const expected = new Map<string, ExpectedLabels>(
    BENCHMARK_CASES.map((c) => [c.id, { relevantJobIds: c.relevantJobIds, shouldAbstain: c.shouldAbstain }])
  );
  const projectfit = computeMetrics(
    runs.map(toRunLike),
    expected,
    reruns.map(toRunLike),
    BENCHMARK_NOW
  );

  const baselineRuns = BENCHMARK_CASES.map((c) => baselineToRunLike(c.profile, runBaseline(c.profile)));
  const baselineReruns = BENCHMARK_CASES.map((c) =>
    baselineToRunLike(c.profile, runBaseline(c.profile))
  );
  const baseline = computeMetrics(baselineRuns, expected, baselineReruns, BENCHMARK_NOW);

  // Paraphrase probe: same meaning, reversed skill order. A deterministic
  // engine must not flip; the order-sensitive baseline does (see P18).
  const pfPara = BENCHMARK_CASES.map((c) => {
    const r = runProfile(paraphraseProfile(c.profile));
    return { profile: c.profile, opportunities: r.opportunities, devilFindings: r.devilFindings, decision: r.decision };
  });
  const blPara = BENCHMARK_CASES.map((c) => baselineToRunLike(c.profile, runBaseline(paraphraseProfile(c.profile))));
  const runsLike = runs.map(toRunLike);
  const paraphrase_stability_projectfit =
    runsLike.filter((r, i) => rankSignature(pfPara[i] as RunLike) === rankSignature(r)).length / runsLike.length;
  const paraphrase_stability_baseline =
    baselineRuns.filter((r, i) => blPara[i].decision.ranking[0]?.opportunity_id === r.decision.ranking[0]?.opportunity_id)
      .length / baselineRuns.length;

  return {
    generated_at: new Date().toISOString(),
    now: BENCHMARK_NOW.toISOString(),
    projectfit,
    baseline,
    per_profile: runs.map((r, i) => ({
      case_id: r.caseId,
      label: r.label,
      decision: r.decision.decision,
      ranking: r.decision.ranking.map((x) => x.opportunity_id),
      devil: r.devilFindings
        .filter((f) => f.suggested_status)
        .map((f) => `${f.opportunity_id}:${f.suggested_status}`),
      expected_abstention: BENCHMARK_CASES[i].shouldAbstain
    })),
    paraphrase_stability_projectfit,
    paraphrase_stability_baseline
  };
}
