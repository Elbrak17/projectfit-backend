// Stockage / retrieval vectoriel local (snapshot-first, aucun réseau requis).
// - buildIndex(chunks, provider) : précalcule les embeddings du snapshot.
// - saveIndex / loadIndex : persistance JSON locale (vecteurs + provenance).
// - cosineSearch : Top-K par similarité cosinus.
// - lexicalFallback : BM25-like simplifié (recouvrement de tokens) quand l'embedding
//   est indisponible — confidence réduite côté appelant.
import type { CorpusChunk, ScoredChunk } from './corpusTypes';
import type { EmbeddingProvider } from './embeddingProvider';

export interface VectorIndex {
  built_at: string;
  provider: string;
  model: string;
  dim: number;
  chunks: CorpusChunk[];
  vectors: number[][];
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot; // vecteurs déjà normalisés
}

export async function buildIndex(
  chunks: CorpusChunk[],
  provider: EmbeddingProvider
): Promise<VectorIndex> {
  const vectors = await provider.embed(chunks.map((c) => c.text));
  return {
    built_at: new Date().toISOString(),
    provider: provider.name,
    model: provider.model,
    dim: provider.dim,
    chunks,
    vectors
  };
}

export function cosineSearch(index: VectorIndex, query: number[], topK = 20): ScoredChunk[] {
  const scored = index.chunks.map((c, i) => ({
    ...c,
    score: cosine(query, index.vectors[i]),
    method: 'vector' as const,
    geography_mismatch: false
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9+_#]+/g)
    .filter((t) => t.length >= 2);
}

/** Fallback lexical : score = recouvrement pondéré, confidence réduite en aval. */
export function lexicalFallback(chunks: CorpusChunk[], queryText: string, topK = 20): ScoredChunk[] {
  const q = new Set(tokens(queryText));
  const scored: ScoredChunk[] = chunks.map((c) => {
    const ct = tokens(c.text);
    const hit = ct.filter((t) => q.has(t)).length;
    return {
      ...c,
      score: ct.length ? hit / Math.sqrt(ct.length) : 0,
      method: 'lexical-fallback' as const,
      geography_mismatch: false
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
