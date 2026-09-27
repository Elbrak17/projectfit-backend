// Provenance intacte : conversion d'un chunk reranké vers Evidence SANS remplacer
// les métadonnées originales (observed_at, evidence_type, freshness, value,
// confidence, published_at). Seuls field_or_passage (= texte du chunk) et un
// éventuel repli de confidence sont renseignés par l'analyse.
import type { Evidence } from '../types';

export interface RerankedProvenance {
  source_id: string;
  source_url: string;
  publisher: string;
  observed_at: string;
  published_at?: string;
  geography_level: 'LOCAL' | 'REGIONAL' | 'NATIONAL';
  text: string;
  value?: string;
  evidence_type: 'OBSERVED' | 'DERIVED' | 'ESTIMATED' | 'UNKNOWN' | 'USER_VALIDATION_REQUIRED';
  freshness?: 'fresh' | 'aging' | 'stale';
  confidence?: number;
  derived_from?: string[];
  field_provenance?: Record<string, 'OBSERVED' | 'DERIVED' | 'ESTIMATED' | 'UNKNOWN' | 'USER_VALIDATION_REQUIRED'>;
}

export function chunkProvenance(r: RerankedProvenance, pipelineConfidence: number): Evidence {
  return {
    source_id: r.source_id,
    source_url: r.source_url,
    publisher: r.publisher,
    observed_at: r.observed_at,
    published_at: r.published_at,
    geography_level: r.geography_level,
    field_or_passage: r.text,
    value: r.value ?? r.text,
    evidence_type: r.evidence_type,
    freshness: r.freshness ?? 'fresh',
    confidence: typeof r.confidence === 'number' ? r.confidence : pipelineConfidence,
    derived_from: r.derived_from ? [...r.derived_from] : undefined,
    field_provenance: r.field_provenance ? { ...r.field_provenance } : undefined
  };
}
