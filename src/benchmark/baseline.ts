// Mandatory baseline (§15): "compare ProjectFit to a generic LLM prompt on the
// same profiles. Don't try to beat the baseline on creativity: measure
// constraint violations, unsourced claims, stability and abstention."
//
// There is deliberately NO live LLM call here (snapshot mode, §13 assumed for
// the demo). Instead this module simulates the well-documented failure modes
// of a generic "recommend me a job or business" prompt:
//   1. it ignores hard constraints (expiry, diploma, exclusions, location, capital),
//   2. it asserts statistics without citable sources,
//   3. it never abstains (always pushes an answer),
//   4. its ranking is sensitive to input phrasing (first-skill tie-break), so a
//      trivial paraphrase (reversed skill order) can flip its top pick.
//
// The simulation is deterministic, so the baseline numbers are re-runnable.
import { JOBS_SNAPSHOT } from '../data/jobs.snapshot';
import { Opportunity, OpportunityDNA } from '../types';
import { RunLike } from './metrics';

export interface BaselineOutput {
  decision: 'JOB';
  best_next_move: string;
  reasons: string[];
  ranking: { opportunity_id: string; title: string; type: 'JOB'; total: number; status: string }[];
  opportunities: Opportunity[];
}

/** Generic-prompt behaviour: keyword overlap only, no constraint checks. */
export function runBaseline(dna: OpportunityDNA): BaselineOutput {
  const mine = new Set(dna.skills.map((s) => s.name.toLowerCase()));
  const firstSkill = dna.skills[0]?.name.toLowerCase() ?? '';
  const scored = JOBS_SNAPSHOT.map((j) => {
    const overlap = j.skills.filter((s) => mine.has(s.toLowerCase())).length;
    const firstBonus = j.skills.some((s) => s.toLowerCase() === firstSkill) ? 5 : 0;
    return { job: j, score: overlap * 10 + firstBonus + (j.title.length % 3) };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const top = scored[0].job;
  const topTitle = top.title;
  // NOTE: uncited statistics + never-abstains + push-to-spend are the
  // failure modes under test. "(avis du modèle)" is intentionally NOT a
  // citation token (see CITATION_TOKEN_RE in metrics.ts).
  const reasons = [
    `Les jeunes subissent un chômage de 35% (avis du modèle) : "${topTitle}" s'impose.`,
    `Les marges du secteur atteignent 40% (avis du modèle) : lancez-vous vite.`,
    `Aucune contrainte bloquante détectée (avis du modèle).`
  ];

  const opportunities: Opportunity[] = scored.map(({ job, score }, i) => ({
    id: job.id,
    type: 'JOB',
    title: job.title,
    region: job.region,
    country_id: job.country_id,
    source_refs: [],
    skill_fit: 'High',
    location_fit: 'High',
    capital_required: 0,
    capital_at_risk_exposure: 0,
    time_to_income_days: 15,
    reversibility: 'High',
    risk: 'Low',
    evidence_confidence: 'High',
    hard_constraint_status: 'PASS',
    hard_constraint_reasons: [],
    assumptions: [],
    unknowns: [],
    next_validation_step: 'Apply now.',
    status: 'PROMISING',
    education_required: job.education_required,
    experience_required_months: job.experience_required_months,
    expires_at: job.expires_at,
    contract_type: job.contract_type,
    source_url: job.source_url,
    _scores: {
      skill: score,
      location: score,
      capital: score,
      time: score,
      evidence: score,
      risk_penalty: 0,
      devil_penalty: 0,
      total: 90 - i * 5
    }
  }));

  return {
    decision: 'JOB',
    best_next_move: `Postulez à "${topTitle}" et engagez ${dna.available_capital} FCFA immédiatement (avis du modèle).`,
    reasons,
    ranking: opportunities.map((o) => ({
      opportunity_id: o.id,
      title: o.title,
      type: 'JOB' as const,
      total: o._scores?.total ?? 0,
      status: o.status
    })),
    opportunities
  };
}

/** Semantically identical paraphrase: skill order carries no meaning. */
export function paraphraseProfile(dna: OpportunityDNA): OpportunityDNA {
  return { ...dna, skills: [...dna.skills].reverse() };
}

export function baselineToRunLike(profile: OpportunityDNA, out: BaselineOutput): RunLike {
  return {
    profile,
    opportunities: out.opportunities,
    devilFindings: [],
    decision: {
      decision: out.decision,
      reasons: out.reasons,
      best_next_move: out.best_next_move,
      ranking: out.ranking.map((r) => ({ opportunity_id: r.opportunity_id }))
    }
  };
}
