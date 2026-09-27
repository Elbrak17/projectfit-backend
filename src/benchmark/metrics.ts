// Benchmark metrics — §15 table. Each metric is deterministic and documented
// so the jury can re-run `npm run benchmark` and get identical numbers.
import { DevilFinding, Opportunity, OpportunityDNA } from '../types';
import { checkHardConstraints } from '../engine/constraints';
import { JOBS_SNAPSHOT } from '../data/jobs.snapshot';
import { SOURCES } from '../data/evidence.corpus';

export interface RankedEntry {
  opportunity_id: string;
}

export interface DecisionLike {
  decision: string;
  reasons: string[];
  best_next_move: string;
  ranking: RankedEntry[];
}

export interface RunLike {
  profile: OpportunityDNA;
  opportunities: Opportunity[];
  devilFindings: DevilFinding[];
  decision: DecisionLike;
}

export interface ExpectedLabels {
  relevantJobIds: string[];
  shouldAbstain: boolean;
}

export interface BenchmarkMetrics {
  n: number;
  /** Share of ranked items that violate a hard constraint on re-check (target 0). */
  hard_constraint_violation_rate: number;
  /** Mean over profiles of |suggested jobs ∩ relevant| / |suggested jobs| (top-3). */
  precision_at_3_jobs: number;
  /** Share of ranked items whose source_refs resolve to a known source. */
  citation_precision: number;
  /** Share of profiles where every ranked item (or an empty ranking) is sourced. */
  citation_coverage: number;
  /** Share of decision claims making externally-factual assertions without a citation. */
  unsupported_claim_rate: number;
  /** Expired jobs present in rankings (freshness — target 0). */
  expired_jobs_suggested: number;
  expired_jobs_suggested_rate: number;
  /** Share of profiles where (abstention predicted) == (abstention expected). */
  correct_abstention_rate: number;
  /** Share of profiles with Devil findings where the Devil forced INVESTIGATE/REJECTED. */
  adversarial_downgrade_rate: number;
  /** Share of profiles with an identical decision + ranking order across two runs. */
  decision_stability: number;
}

export const ABSTENTION_DECISIONS = new Set([
  'KEEP_YOUR_CAPITAL',
  'INSUFFICIENT_EVIDENCE',
  'NO_SAFE_RECOMMENDATION'
]);

const VALID_SOURCE_URLS = new Set([
  ...SOURCES.map((s) => s.url),
  ...JOBS_SNAPSHOT.map((j) => j.source_url)
]);

/** Mentions an externally-factual claim (statistic or market assertion). */
const EXTERNAL_FACT_RE =
  /(\d+\s*%|\bchômage\b|\bNINEA\b|\bANSD\b|\bDER\b|\bconcurrence\b|\bmarges?\b|\bloyers?\b|\bmarché\b|\bIHPC\b)/i;

/** Tokens that count as citing a source or hedging as an estimate. */
const CITATION_TOKEN_RE =
  /(ANSD|DER|NINEA|https?:\/\/|ESTIMATED|UNKNOWN|USER_VALIDATION|FIELD VALIDATION)/;

function oppById(run: RunLike, id: string): Opportunity | undefined {
  return run.opportunities.find((o) => o.id === id);
}

/** Deterministic signature: same state → same string (§15 decision_stability). */
export function rankSignature(run: RunLike): string {
  return `${run.decision.decision}|${run.decision.ranking.map((r) => r.opportunity_id).join(',')}`;
}

export function computeMetrics(
  runs: RunLike[],
  expectedByCase: Map<string, ExpectedLabels>,
  reruns: RunLike[],
  now: Date
): BenchmarkMetrics {
  const n = runs.length;
  let violations = 0;
  let rankedTotal = 0;
  let precisionSum = 0;
  let citedItems = 0;
  let coveredProfiles = 0;
  let unsupported = 0;
  let claimsTotal = 0;
  let expiredCount = 0;
  let expiredDenominator = 0;
  let abstentionCorrect = 0;
  let devilProfiles = 0;
  let devilDowngrades = 0;
  let stable = 0;

  runs.forEach((run, i) => {
    const expected = expectedByCase.get(`P${String(i + 1).padStart(2, '0')}`);
    const relevant = new Set(expected?.relevantJobIds ?? []);
    const ranking = run.decision.ranking;

    // Hard-constraint violations + expiry + citations, re-checked from scratch.
    let profileCited = true;
    const suggestedJobs: string[] = [];
    for (const entry of ranking) {
      rankedTotal++;
      const opp = oppById(run, entry.opportunity_id);
      if (!opp) {
        violations++;
        profileCited = false;
        continue;
      }
      const check = checkHardConstraints(opp, run.profile, now);
      if (!check.pass) violations++;
      if (opp.type === 'JOB') {
        expiredDenominator++;
        suggestedJobs.push(opp.id);
        if (opp.expires_at && new Date(opp.expires_at).getTime() < now.getTime()) expiredCount++;
      }
      const cited = opp.source_refs.length > 0 && opp.source_refs.every((u) => VALID_SOURCE_URLS.has(u));
      if (cited) citedItems++;
      else profileCited = false;
    }
    if (profileCited) coveredProfiles++;

    // Precision@3 over JOB suggestions.
    if (suggestedJobs.length === 0) {
      precisionSum += relevant.size === 0 ? 1 : 0;
    } else {
      const hits = suggestedJobs.filter((id) => relevant.has(id)).length;
      precisionSum += hits / suggestedJobs.length;
    }

    // Unsupported claims: externally-factual assertions without any citation token.
    const claims = [...run.decision.reasons, run.decision.best_next_move];
    for (const claim of claims) {
      claimsTotal++;
      if (EXTERNAL_FACT_RE.test(claim) && !CITATION_TOKEN_RE.test(claim)) unsupported++;
    }

    // Abstention correctness.
    const abstains = ABSTENTION_DECISIONS.has(run.decision.decision);
    if (!expected || abstains === expected.shouldAbstain) abstentionCorrect++;

    // Adversarial downgrade: the Devil forced a visible status change.
    if (run.devilFindings.length > 0) {
      devilProfiles++;
      if (run.devilFindings.some((f) => f.suggested_status === 'REJECTED' || f.suggested_status === 'INVESTIGATE')) {
        devilDowngrades++;
      }
    }

    // Stability: identical decision + ranking order on re-run.
    if (reruns[i] && rankSignature(reruns[i]) === rankSignature(run)) stable++;
  });

  return {
    n,
    hard_constraint_violation_rate: rankedTotal === 0 ? 1 : violations / rankedTotal,
    precision_at_3_jobs: n === 0 ? 0 : precisionSum / n,
    citation_precision: rankedTotal === 0 ? 1 : citedItems / rankedTotal,
    citation_coverage: n === 0 ? 0 : coveredProfiles / n,
    unsupported_claim_rate: claimsTotal === 0 ? 0 : unsupported / claimsTotal,
    expired_jobs_suggested: expiredCount,
    expired_jobs_suggested_rate: expiredDenominator === 0 ? 0 : expiredCount / expiredDenominator,
    correct_abstention_rate: n === 0 ? 0 : abstentionCorrect / n,
    adversarial_downgrade_rate: devilProfiles === 0 ? 0 : devilDowngrades / devilProfiles,
    decision_stability: n === 0 ? 0 : stable / n
  };
}
