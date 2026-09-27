// Benchmark §15 — 20 synthetic profiles (must-have §21).
// Synthetic only: no PII, no real persons, no CV logging (§16).
import { OpportunityDNA } from '../types';

export interface BenchmarkCase {
  id: string;
  label: string;
  profile: OpportunityDNA;
  /** Job IDs a careful human reader would call relevant for this profile. */
  relevantJobIds: string[];
  /** True when the only safe answer is an abstention outcome
   *  (KEEP_YOUR_CAPITAL / INSUFFICIENT_EVIDENCE / NO_SAFE_RECOMMENDATION). */
  shouldAbstain: boolean;
}

function base(over: Partial<OpportunityDNA> = {}): OpportunityDNA {
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

const skill = (name: string) => ({ name, level: 'intermediate' as const });

export const BENCHMARK_CASES: BenchmarkCase[] = [
  {
    id: 'P01',
    label: 'demo-hybrid (golden path §15.1)',
    profile: base({ constraints: ['restauration'] }),
    relevantJobIds: ['senjob-163993', 'senjob-163896', 'senjob-164010', 'senjob-163821'],
    shouldAbstain: false
  },
  {
    id: 'P02',
    label: 'zero-risk budget → jobs only (live proof)',
    profile: base({ constraints: ['restauration'], capital_at_risk: 0 }),
    relevantJobIds: ['senjob-163993', 'senjob-163896', 'senjob-164010', 'senjob-163821'],
    shouldAbstain: false
  },
  {
    id: 'P03',
    label: 'junior python dev, Dakar',
    profile: base({
      skills: [skill('python'), skill('api'), skill('sql')],
      education: 'Bac+3 informatique'
    }),
    relevantJobIds: ['senjob-163983', 'senjob-164024'],
    shouldAbstain: false
  },
  {
    id: 'P04',
    label: 'field sales, Thiès (Vendeuse Keur Massar)',
    profile: base({
      skills: [skill('vente'), skill('negociation'), skill('wolof')],
      education: 'Bac+2',
      location: 'Thiès'
    }),
    relevantJobIds: ['senjob-164028'],
    shouldAbstain: false
  },
  {
    id: 'P05',
    label: 'data entry, low diploma, Dakar',
    profile: base({
      skills: [skill('saisie'), skill('excel'), skill('francais')],
      education: 'Bac+2',
      capital_at_risk: 5000
    }),
    relevantJobIds: ['senjob-163869', 'senjob-163957', 'senjob-164007'],
    shouldAbstain: false
  },
  {
    id: 'P06',
    label: 'broad exclusions (restauration, cuisine, night)',
    profile: base({ constraints: ['restauration', 'cuisine', 'nuit'] }),
    relevantJobIds: ['senjob-163993', 'senjob-163896', 'senjob-164010', 'senjob-163821'],
    shouldAbstain: false
  },
  {
    id: 'P07',
    label: 'low mobility, Dakar (non-Dakar offers must FAIL)',
    profile: base({ mobility: 'faible' }),
    relevantJobIds: ['senjob-163993', 'senjob-163896', 'senjob-164010', 'senjob-163821'],
    shouldAbstain: false
  },
  {
    id: 'P08',
    label: 'high mobility, Dakar (Thiès/Kédougou offers eligible)',
    profile: base({ mobility: 'forte' }),
    relevantJobIds: ['senjob-163993', 'senjob-164010', 'senjob-164028', 'senjob-163821'],
    shouldAbstain: false
  },
  {
    id: 'P09',
    label: 'no diploma, low-barrier sales jobs fit',
    profile: base({
      skills: [skill('vente')],
      education: 'Aucun diplôme',
      mobility: 'moyenne'
    }),
    relevantJobIds: ['senjob-164028', 'senjob-163996', 'senjob-163896'],
    shouldAbstain: false
  },
  {
    id: 'P10',
    label: 'accountant, Thiès — matching posts are Dakar-only (all FAIL location)',
    profile: base({
      skills: [skill('comptabilite'), skill('excel'), skill('sage')],
      education: 'Bac+3 comptabilité',
      location: 'Thiès'
    }),
    relevantJobIds: [],
    shouldAbstain: false
  },
  {
    id: 'P11',
    label: 'low urgency, larger test budget',
    profile: base({
      income_urgency: '<120 jours',
      income_urgency_days: 120,
      capital_at_risk: 50000
    }),
    relevantJobIds: ['senjob-163993', 'senjob-163896', 'senjob-164010', 'senjob-163821'],
    shouldAbstain: false
  },
  {
    id: 'P12',
    label: 'small capital (B2B fits, stock business does not)',
    profile: base({ available_capital: 50000, capital_at_risk: 10000 }),
    relevantJobIds: ['senjob-163993', 'senjob-163896', 'senjob-164010', 'senjob-163821'],
    shouldAbstain: false
  },
  {
    id: 'P13',
    label: 'high risk tolerance, large budget',
    profile: base({
      available_capital: 500000,
      capital_at_risk: 100000,
      risk_tolerance: 'forte'
    }),
    relevantJobIds: ['senjob-163993', 'senjob-163896', 'senjob-164010', 'senjob-163821'],
    shouldAbstain: false
  },
  {
    id: 'P14',
    label: 'wolof-speaking sales, mobile',
    profile: base({
      skills: [skill('vente'), skill('wolof'), skill('excel')],
      education: 'Bac+2',
      mobility: 'moyenne'
    }),
    relevantJobIds: ['senjob-163996', 'senjob-164028', 'senjob-163994'],
    shouldAbstain: false
  },
  {
    id: 'P15',
    label: 'out-of-snapshot country + zero risk → abstain',
    profile: base({
      skills: [skill('vente')],
      education: 'Bac+2',
      location: 'Bamako',
      country_id: 'ML',
      capital_at_risk: 0
    }),
    relevantJobIds: [],
    shouldAbstain: true
  },
  {
    id: 'P16',
    label: 'off-coverage region (Kolda) + zero risk → abstain',
    profile: base({
      location: 'Kolda',
      mobility: 'faible',
      capital_at_risk: 0
    }),
    relevantJobIds: [],
    shouldAbstain: true
  },
  {
    id: 'P17',
    label: 'no diploma, immobile, off-coverage region (Sédhiou) + zero risk → abstain',
    profile: base({
      skills: [skill('vente')],
      education: 'Aucun diplôme',
      location: 'Sédhiou',
      mobility: 'faible',
      capital_at_risk: 0
    }),
    relevantJobIds: [],
    shouldAbstain: true
  },
  {
    id: 'P18',
    label: 'tied skills (marketing/saisie) — order-sensitivity probe',
    profile: base({ skills: [skill('marketing'), skill('saisie')] }),
    relevantJobIds: ['senjob-163993', 'senjob-163896', 'senjob-164010', 'senjob-163821', 'senjob-163869', 'senjob-164007'],
    shouldAbstain: false
  },
  {
    id: 'P19',
    label: 'remote data entry, night excluded',
    profile: base({
      skills: [skill('saisie'), skill('excel')],
      education: 'Bac+2',
      constraints: ['nuit'],
      capital_at_risk: 15000
    }),
    relevantJobIds: ['senjob-163869', 'senjob-163957', 'senjob-164007'],
    shouldAbstain: false
  },
  {
    id: 'P20',
    label: 'marketer in Thiès, mobile (Dakar offers eligible)',
    profile: base({ location: 'Thiès', mobility: 'forte' }),
    relevantJobIds: ['senjob-164028', 'senjob-163993', 'senjob-163821'],
    shouldAbstain: false
  }
];
