// ProjectFit core types — §3 Opportunity DNA, §4 Opportunity, §8 Evidence, §10 Decision
// Règle Responsible AI: pas de nom, photo, religion, ethnie, opinions, santé dans le ranking.

export type OpportunityType = 'JOB' | 'BUSINESS' | 'PROGRAM' | 'LEARN';
export type DecisionType =
  | 'JOB'
  | 'BUSINESS'
  | 'HYBRID'
  | 'LEARN_FIRST'
  | 'KEEP_YOUR_CAPITAL'
  | 'INSUFFICIENT_EVIDENCE'
  | 'NO_SAFE_RECOMMENDATION';

export type GeographyLevel = 'LOCAL' | 'REGIONAL' | 'NATIONAL';
export type EvidenceKind = 'OBSERVED' | 'DERIVED' | 'ESTIMATED' | 'UNKNOWN' | 'USER_VALIDATION_REQUIRED';

export interface OpportunityDNA {
  skills: { name: string; level: 'beginner' | 'intermediate' | 'advanced' }[];
  experience: { role: string; duration_months: number; tasks: string[] }[];
  education: string; // ex: "Bac+3 marketing"
  location: string; // ville/région, pas GPS précis
  mobility: 'faible' | 'moyenne' | 'forte';
  languages: string[];
  assets: string[]; // smartphone, laptop, moto...
  available_capital: number; // FCFA
  capital_at_risk: number; // contrainte dure : max acceptable à perdre
  available_time: string;
  income_urgency: string; // ex: "<60 jours"
  income_urgency_days: number;
  interests: string[];
  constraints: string[]; // exclusions, ex: ["restauration", "nuit"]
  risk_tolerance: 'faible' | 'moyenne' | 'forte';
  country_id: string; // ex: "SN"
  region_id?: string;
}

export interface Opportunity {
  id: string;
  type: OpportunityType;
  title: string;
  region: string;
  country_id: string;
  source_refs: string[];
  skill_fit: 'Low' | 'Medium' | 'High';
  location_fit: 'Low' | 'Medium' | 'High';
  capital_required: number;
  capital_at_risk_exposure: number;
  time_to_income_days: number;
  reversibility: 'Low' | 'Medium' | 'High';
  risk: 'Low' | 'Medium' | 'High';
  evidence_confidence: 'Low' | 'Medium' | 'High';
  hard_constraint_status: 'PASS' | 'FAIL';
  hard_constraint_reasons: string[];
  assumptions: string[];
  unknowns: string[];
  next_validation_step: string;
  status: 'PROMISING' | 'TEST' | 'INVESTIGATE' | 'REJECTED';
  status_reason?: string;
  // scores numériques internes (jamais affichés comme vérité scientifique au front)
  _scores?: {
    skill: number;
    location: number;
    capital: number;
    time: number;
    evidence: number;
    risk_penalty: number;
    devil_penalty: number;
    total: number;
  };
  // champs JOB spécifiques
  education_required?: string;
  experience_required_months?: number;
  expires_at?: string;
  employer?: string;
  contract_type?: string;
  source_url?: string;
}

export interface Evidence {
  source_id: string;
  source_url: string;
  publisher: string;
  observed_at: string;
  published_at?: string;
  geography_level: GeographyLevel;
  field_or_passage: string;
  value: string;
  evidence_type: EvidenceKind;
  freshness: 'fresh' | 'aging' | 'stale';
  confidence: number; // 0-100
  /** Provenance conservée jusqu'au résultat final : liens sources d'une conclusion DERIVED/ESTIMATED. Absent pour OBSERVED. */
  derived_from?: string[];
  /** Provenance par champ (séparation observé/dérivé/inconnu). */
  field_provenance?: Record<string, EvidenceKind>;
}

export interface Source {
  id: string;
  url: string;
  publisher: string;
  title: string;
  country_id: string;
  geography_level: GeographyLevel;
  observed_at: string;
  expires_at?: string;
  license?: string;
}

export interface DevilFinding {
  opportunity_id: string;
  risks: string[];
  fragile_assumptions: string[];
  counter_evidence: string[];
  missing_evidence: string[];
  penalty: number; // 0-30 points retirés au score
  suggested_status?: 'REJECTED' | 'INVESTIGATE';
}

export interface Decision {
  decision: DecisionType;
  best_next_move: string;
  reasons: string[];
  unknowns: string[];
  next_action: string;
  preserved_capital: number;
  test_budget: number;
  ranking: { opportunity_id: string; title: string; type: OpportunityType; total: number; status: string }[];
  rejected: { opportunity_id: string; title: string; reason: string }[];
  evidence_confidence_global: 'Low' | 'Medium' | 'High';
  disclaimer: string;
}

export interface SessionArtifacts {
  session_id: string;
  profile_raw: unknown;
  normalized_profile: OpportunityDNA | null;
  opportunities: Opportunity[];
  evidence: Evidence[];
  devil_findings: DevilFinding[];
  scores: Record<string, number>;
  decision: Decision | null;
  created_at: string;
  updated_at: string;
}
