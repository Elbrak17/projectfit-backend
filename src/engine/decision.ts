// Decision Engine déterministe — §10 (8 étapes). Code décide, LLM explique.
import { Decision, Opportunity, OpportunityDNA } from '../types';

export const ENABLE_HYBRID = process.env.ENABLE_HYBRID !== 'false';

export function decide(
  opportunities: Opportunity[],
  profile: OpportunityDNA,
  devilPenalties: Map<string, number> = new Map()
): Decision {
  // 1-2. contraintes déjà appliquées + expirés exclus
  const viable = opportunities.filter((o) => o.hard_constraint_status === 'PASS');
  // 3-6. tri sur score total (déjà ajusté devil)
  const ranked = [...viable].sort((a, b) => (b._scores?.total ?? 0) - (a._scores?.total ?? 0));

  const rejected = opportunities
    .filter((o) => o.hard_constraint_status === 'FAIL' || o.status === 'REJECTED')
    .map((o) => ({
      opportunity_id: o.id,
      title: o.title,
      reason: o.status_reason ?? o.hard_constraint_reasons.join(' ') ?? 'Contrainte dure'
    }));

  const disclaimer =
    'Based on the information and evidence available, this is the lowest-risk next move we found. You decide what to do next. Aucune garantie de revenu, d’embauche ou de rentabilité.';

  // 8. abstention si rien de sûr
  if (ranked.length === 0) {
    const hasBusinessOnly = opportunities.some((o) => o.type === 'BUSINESS');
    return {
      decision: hasBusinessOnly ? 'KEEP_YOUR_CAPITAL' : 'NO_SAFE_RECOMMENDATION',
      best_next_move: hasBusinessOnly
        ? 'KEEP YOUR CAPITAL — aucune option ne justifie de risquer le capital à ce stade.'
        : 'NO SAFE RECOMMENDATION — contraintes incompatibles ou preuves insuffisantes.',
      reasons: ['Toutes les options violent une contrainte dure ou ont été rejetées.', ...rejected.map((r) => r.reason)],
      unknowns: ['Données locales insuffisantes — validation terrain requise.'],
      next_action: 'Ne rien dépenser. Compléter le profil (localisation, budget à risque, urgence) puis relancer.',
      preserved_capital: profile.available_capital,
      test_budget: 0,
      ranking: [],
      rejected,
      evidence_confidence_global: 'Low',
      disclaimer
    };
  }

  const top = ranked[0];
  const jobs = ranked.filter((o) => o.type === 'JOB');
  const biz = ranked.filter((o) => o.type === 'BUSINESS' && o.status !== 'REJECTED');
  void devilPenalties;

  const testBudget = Math.min(10000, profile.capital_at_risk);
  const preserved = profile.available_capital - testBudget;

  // HYBRID : job solide + business testable petit ticket
  if (ENABLE_HYBRID && jobs.length > 0 && biz.length > 0 && biz[0]._scores!.total >= 45) {
    const j = jobs[0];
    const b = biz[0];
    return {
      decision: 'HYBRID',
      best_next_move: `HYBRID — Apply to these jobs (dont "${j.title}"). Keep ${preserved} FCFA. Spend at most ${testBudget} FCFA testing "${b.title}".`,
      reasons: [
        `JOB "${j.title}" : skill_fit=${j.skill_fit}, time_to_income=${j.time_to_income_days}j.`,
        `BUSINESS "${b.title}" : test réversible plafonné, evidence=${b.evidence_confidence}.`,
        rejected.length ? `${rejected.length} option(s) rejetée(s) explicitement (voir rejected).` : 'Aucune exclusion bloquante sur le top-2.'
      ],
      unknowns: [...new Set([...j.unknowns, ...b.unknowns])].slice(0, 5),
      next_action: `Candidater à ${Math.min(3, jobs.length)} job(s) cette semaine + micro-test "${b.title}" : ${b.next_validation_step}`,
      preserved_capital: preserved,
      test_budget: testBudget,
      ranking: ranked.slice(0, 3).map((o) => ({
        opportunity_id: o.id,
        title: o.title,
        type: o.type,
        total: o._scores?.total ?? 0,
        status: o.status
      })),
      rejected,
      evidence_confidence_global: top.evidence_confidence,
      disclaimer
    };
  }

  if (jobs.length > 0 && (biz.length === 0 || jobs[0]._scores!.total >= (biz[0]?._scores?.total ?? -1))) {
    const j = jobs[0];
    return {
      decision: 'JOB',
      best_next_move: `JOB — Apply to "${j.title}" + ${Math.min(2, jobs.length - 1)} autres.`,
      reasons: [`Meilleur score déterministe (${j._scores?.total}) avec skill_fit=${j.skill_fit}.`, 'Revenu le plus rapide à risque faible.'],
      unknowns: j.unknowns.slice(0, 4),
      next_action: 'Candidater + combler le skill gap indiqué dans assumptions.',
      preserved_capital: profile.available_capital,
      test_budget: 0,
      ranking: ranked.slice(0, 3).map((o) => ({
        opportunity_id: o.id,
        title: o.title,
        type: o.type,
        total: o._scores?.total ?? 0,
        status: o.status
      })),
      rejected,
      evidence_confidence_global: j.evidence_confidence,
      disclaimer
    };
  }

  if (biz.length > 0) {
    const b = biz[0];
    if (b.evidence_confidence === 'Low') {
      return {
        decision: 'INSUFFICIENT_EVIDENCE',
        best_next_move: 'INSUFFICIENT EVIDENCE — preuves business trop faibles pour engager du capital.',
        reasons: ['Evidence confidence Low sur la meilleure hypothèse business.', 'Aucun job sûr en alternative.'],
        unknowns: b.unknowns.slice(0, 5),
        next_action: `FIELD VALIDATION REQUIRED : ${b.next_validation_step}`,
        preserved_capital: profile.available_capital,
        test_budget: 0,
        ranking: ranked.slice(0, 3).map((o) => ({
          opportunity_id: o.id,
          title: o.title,
          type: o.type,
          total: o._scores?.total ?? 0,
          status: o.status
        })),
        rejected,
        evidence_confidence_global: 'Low',
        disclaimer
      };
    }
    return {
      decision: 'BUSINESS',
      best_next_move: `BUSINESS TEST — tester "${b.title}" avec max ${testBudget} FCFA avant tout investissement.`,
      reasons: [`Hypothèse la mieux prouvée (evidence=${b.evidence_confidence}).`, 'Test réversible, capital préservé.'],
      unknowns: b.unknowns.slice(0, 5),
      next_action: b.next_validation_step,
      preserved_capital: preserved,
      test_budget: testBudget,
      ranking: ranked.slice(0, 3).map((o) => ({
        opportunity_id: o.id,
        title: o.title,
        type: o.type,
        total: o._scores?.total ?? 0,
        status: o.status
      })),
      rejected,
      evidence_confidence_global: b.evidence_confidence,
      disclaimer
    };
  }

  return {
    decision: 'LEARN_FIRST',
    best_next_move: 'LEARN FIRST — un skill gap bloque les meilleures options.',
    reasons: ['Aucune opportunité JOB/BUSINESS sûre et prouvée.'],
    unknowns: [],
    next_action: 'Formation courte ciblée sur le gap puis recalcul.',
    preserved_capital: profile.available_capital,
    test_budget: 0,
    ranking: ranked.slice(0, 3).map((o) => ({
      opportunity_id: o.id,
      title: o.title,
      type: o.type,
      total: o._scores?.total ?? 0,
      status: o.status
    })),
    rejected,
    evidence_confidence_global: 'Low',
    disclaimer
  };
}
