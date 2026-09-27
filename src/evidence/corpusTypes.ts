// Evidence-first corpus types — snapshot-first, provenance obligatoire.
// Chaque document/passage conserve les métadonnées minimales exigées :
// source_id, source_url, publisher, observed_at, published_at?, country_id,
// region?, geography_level, category, text, value?, evidence_type, freshness?, confidence?
import type { EvidenceKind, GeographyLevel } from '../types';
export type CorpusCategory =
  | 'JOB_OFFER'
  | 'ECON_STAT'
  | 'PROGRAM_INFO'
  | 'PRICE_COST';

export interface CorpusDoc {
  doc_id: string;
  source_id: string;
  source_url: string;
  publisher: string;
  observed_at: string; // YYYY-MM-DD — date du snapshot, jamais inventée
  published_at?: string;
  expires_at?: string;
  country_id: string;
  region?: string;
  geography_level: GeographyLevel;
  category: CorpusCategory;
  title: string;
  /** Texte source du passage (extrait snapshot, pas de génération). */
  text: string;
  /** Valeur structurée quand disponible (ex: taux, montant). */
  value?: string;
  evidence_type: EvidenceKind;
  freshness?: 'fresh' | 'aging' | 'stale';
  confidence?: number; // 0-100
  /** IDs d'entrées sources dont une conclusion DERIVED/ESTIMATED est tirée. Absent pour OBSERVED. */
  derived_from?: string[];
  /**
   * Provenance par champ (séparation observé/dérivé/inconnu).
   * Ex JOB: { title: 'OBSERVED', skills: 'DERIVED', education_required: 'UNKNOWN' }.
   */
  field_provenance?: Record<string, EvidenceKind>;
  // Champs JOB
  education_required?: string;
  experience_required_months?: number;
  skills?: string[];
  locality?: string;
}

export interface CorpusChunk {
  chunk_id: string; // `${doc_id}#c${index}`
  doc_id: string;
  chunk_index: number;
  char_start: number;
  char_end: number;
  text: string;
  // Provenance recopiée du doc (jamais modifiée par le retrieval/LLM)
  source_id: string;
  source_url: string;
  publisher: string;
  observed_at: string;
  published_at?: string;
  country_id: string;
  region?: string;
  geography_level: GeographyLevel;
  category: CorpusCategory;
  evidence_type: EvidenceKind;
  freshness?: 'fresh' | 'aging' | 'stale';
  confidence?: number;
  value?: string;
  derived_from?: string[];
  field_provenance?: Record<string, EvidenceKind>;
}

export interface ScoredChunk extends CorpusChunk {
  score: number;
  method: 'vector' | 'lexical-fallback';
  /** true quand une stat NATIONALE est utilisée pour une opportunité LOCALE : affichée, jamais promue en preuve locale. */
  geography_mismatch: boolean;
}
