// Génération opportunités : snapshot JOB (§6) + 2 hypothèses BUSINESS (§7, max 2-3).
// Les chiffres business critiques sont marqués ESTIMATED/UNKNOWN, jamais inventés comme faits.
import { Opportunity, OpportunityDNA } from '../types';
import { JOBS_SNAPSHOT } from '../data/jobs.snapshot';
import { randomUUID } from 'crypto';

export function buildJobOpportunities(profile: OpportunityDNA): { opp: Opportunity; skills: string[] }[] {
  return JOBS_SNAPSHOT.filter((j) => j.country_id === profile.country_id).map((j) => {
    const opp: Opportunity = {
      id: j.id,
      type: 'JOB',
      title: `${j.title} — ${j.employer}`,
      region: j.region,
      country_id: j.country_id,
      source_refs: [j.source_url],
      skill_fit: 'Medium',
      location_fit: 'Medium',
      capital_required: 0,
      capital_at_risk_exposure: 0,
      time_to_income_days: 30,
      reversibility: 'High',
      risk: 'Low',
      evidence_confidence: 'High',
      hard_constraint_status: 'PASS',
      hard_constraint_reasons: [],
      assumptions: [`Exigences: ${j.education_required}, ${j.experience_required_months} mois exp.`],
      unknowns: ['Processus exact de recrutement', 'Rémunération exacte (non publiée)'],
      next_validation_step: 'Apply / combler le skill gap indiqué',
      status: 'PROMISING',
      education_required: j.education_required,
      experience_required_months: j.experience_required_months,
      expires_at: j.expires_at,
      employer: j.employer,
      contract_type: j.contract_type,
      source_url: j.source_url
    };
    return { opp, skills: j.skills };
  });
}

export function buildBusinessHypotheses(profile: OpportunityDNA): Opportunity[] {
  const hasDigital = profile.skills.some((s) => /marketing|excel|python|canva|reseaux/i.test(s.name));
  const hyps: Opportunity[] = [];

  if (hasDigital) {
    hyps.push({
      id: `biz-${randomUUID().slice(0, 8)}`,
      type: 'BUSINESS',
      title: 'Service B2B mobile (saisie, reporting Excel, community management)',
      region: profile.location,
      country_id: profile.country_id,
      source_refs: [
        'https://www.der.sn/devenez-entrepreneur/secteurs-prioritaires/',
        'https://www.ansd.sn/Indicateur/bulletin-trimestriel-sur-les-nouvelles-immatriculations-au-ninea-btnin'
      ],
      skill_fit: 'High',
      location_fit: 'High',
      capital_required: 20000,
      capital_at_risk_exposure: 10000,
      time_to_income_days: 21,
      reversibility: 'High',
      risk: 'Low',
      evidence_confidence: 'Medium',
      hard_constraint_status: 'PASS',
      hard_constraint_reasons: [],
      assumptions: [
        'ESTIMATED: ticket test ~10 000 FCFA (transport + data + impressions).',
        'Hypothèse: 3-5 prospects accessibles via réseau/WhatsApp.'
      ],
      unknowns: ['USER_VALIDATION_REQUIRED: willingness-to-pay exacte', 'Concurrence informelle du quartier'],
      next_validation_step: 'Interroger 5 prospects + vendre 1 micro-prestation à 5 000–10 000 FCFA avant tout spend.',
      status: 'PROMISING'
    });
  }

  // Hypothèse volontairement fragile pour la démo du REJECT (dossier §8/§20)
  hyps.push({
    id: `biz-${randomUUID().slice(0, 8)}`,
    type: 'BUSINESS',
    title: 'Commerce général (stock + local)',
    region: profile.location,
    country_id: profile.country_id,
    source_refs: ['https://www.ansd.sn/Indicateur/bulletin-trimestriel-sur-les-nouvelles-immatriculations-au-ninea-btnin'],
    skill_fit: 'Medium',
    location_fit: 'Medium',
    capital_required: 250000,
    capital_at_risk_exposure: 15000,
    time_to_income_days: 45,
    reversibility: 'Low',
    risk: 'High',
    evidence_confidence: 'Low',
    hard_constraint_status: 'PASS',
    hard_constraint_reasons: [],
    assumptions: ['ESTIMATED: besoin stock/local ~150 000+ FCFA (ticket affiché sous-estimé).', 'Hypothèse fragile: écoulement rapide sans preuve locale.'],
    unknowns: ['UNKNOWN: demande exacte du quartier', 'UNKNOWN: marges nettes réelles', 'Concurrence informelle'],
    next_validation_step: 'Ne rien acheter. Relever 10 prix concurrents + estimer loyer avant décision.',
    status: 'PROMISING'
  });

  return hyps.slice(0, 2);
}
