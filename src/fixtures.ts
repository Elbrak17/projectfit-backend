// Fixtures partagées par la suite de tests — fixtures only, jamais importé par la runtime.
import { Opportunity, OpportunityDNA } from './types';

export function makeProfile(over: Partial<OpportunityDNA> = {}): OpportunityDNA {
  return {
    skills: [
      { name: 'marketing', level: 'intermediate' },
      { name: 'excel', level: 'intermediate' },
      { name: 'canva', level: 'beginner' }
    ],
    experience: [],
    education: 'Bac+3 marketing',
    location: 'Dakar',
    mobility: 'faible',
    languages: ['Français'],
    assets: ['smartphone'],
    available_capital: 300000,
    capital_at_risk: 20000,
    available_time: 'temps plein',
    income_urgency: '<60 jours',
    income_urgency_days: 60,
    interests: [],
    constraints: [],
    risk_tolerance: 'faible',
    country_id: 'SN',
    ...over
  };
}

export function makeOpportunity(over: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opp-1',
    type: 'JOB',
    title: 'Assistant Marketing Digital — Berger Hitech (démo)',
    region: 'Dakar',
    country_id: 'SN',
    source_refs: ['https://senjob.com/offres-d-emploi.php'],
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
    assumptions: ['ESTIMATED: démo.'],
    unknowns: ['UNKNOWN: démo.'],
    next_validation_step: 'Apply.',
    status: 'PROMISING',
    ...over
  };
}

/** Score interne minimal pour piloter `decide()` sans passer par le scoring. */
export function withTotal(opp: Opportunity, total: number): Opportunity {
  opp._scores = {
    skill: total,
    location: total,
    capital: total,
    time: total,
    evidence: total,
    risk_penalty: 0,
    devil_penalty: 0,
    total
  };
  return opp;
}
