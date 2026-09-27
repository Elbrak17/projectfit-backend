// Retrieval local fonctionnel (étape 6/6 de la commande).
// - buildEvidenceQuery(profile, opportunity) : requête evidence déterministe.
// - retrieveLocal(index|chunks, query, {topK 15-20}) : vectoriel si provider OK,
//   sinon fallback lexical avec confidence réduite.
// - Aucune invention : on ne retourne que des chunks du snapshot + provenance.
// - geography_mismatch=true si stat NATIONALE servie pour opportunité LOCALE (visible front).
import type { Opportunity, OpportunityDNA } from '../types';
import type { CorpusChunk, ScoredChunk } from './corpusTypes';
import type { EmbeddingProvider } from './embeddingProvider';
import { cosineSearch, lexicalFallback, type VectorIndex } from './vectorStore';

export function buildEvidenceQuery(profile: OpportunityDNA, opp?: { title?: string }): string {
  const skills = profile.skills.map((s) => s.name).join(' ');
  const parts = [
    opp?.title ?? '',
    `competences ${skills}`,
    `diplome ${profile.education}`,
    `localisation ${profile.location} ${profile.country_id}`,
    `mobilite ${profile.mobility}`,
    (profile.constraints ?? []).length ? `exclusions ${(profile.constraints ?? []).join(' ')}` : ''
  ];
  return parts.filter(Boolean).join('. ');
}

export interface RetrieveOptions {
  topK?: number; // 15-20 par spec
  opportunityRegion?: string;
  opportunityGeography?: 'LOCAL' | 'REGIONAL' | 'NATIONAL';
}

export async function retrieveLocal(
  index: VectorIndex,
  provider: EmbeddingProvider,
  queryText: string,
  opts: RetrieveOptions = {}
): Promise<{ results: ScoredChunk[]; method: 'vector' | 'lexical-fallback'; confidencePenalty: number }> {
  const topK = opts.topK ?? 18;
  try {
    const q = await provider.embedQuery(queryText);
    const results = cosineSearch(index, q, topK).map((r) => ({
      ...r,
      geography_mismatch:
        r.geography_level === 'NATIONAL' && (opts.opportunityGeography ?? 'LOCAL') === 'LOCAL'
    }));
    return { results, method: 'vector', confidencePenalty: 0 };
  } catch {
    const results = lexicalFallback(index.chunks, queryText, topK).map((r) => ({
      ...r,
      geography_mismatch:
        r.geography_level === 'NATIONAL' && (opts.opportunityGeography ?? 'LOCAL') === 'LOCAL'
    }));
    return { results, method: 'lexical-fallback', confidencePenalty: 20 };
  }
}

/** Variante sans embedding (tests / démo hors-ligne garantie). */
export function retrieveLexical(
  chunks: CorpusChunk[],
  queryText: string,
  opts: RetrieveOptions = {}
): ScoredChunk[] {
  return lexicalFallback(chunks, queryText, opts.topK ?? 18).map((r) => ({
    ...r,
    geography_mismatch:
      r.geography_level === 'NATIONAL' && (opts.opportunityGeography ?? 'LOCAL') === 'LOCAL'
  }));
}
