// Abstractions des dépendances suivantes (NON implémentées à cette étape — signal attendu).
// - RerankerProvider -> endpoint HTTPS Modal (nvidia/llama-nemotron-rerank-1b-v2), Top 15-20 -> 4-5.
// - LLMProvider -> endpoint gratuit NVIDIA (nvidia/nemotron-3-ultra-550b-a55b), sortie structurée.
// Le Decision Engine garde le dernier mot : le LLM ne touche jamais contraintes, budget,
// capital_at_risk, dates, exigences d'offre, valeurs sources, ni score final.
import type { ScoredChunk } from './corpusTypes';

export interface RerankedChunk extends ScoredChunk {
  rerank_score: number;
}

export interface RerankerProvider {
  readonly name: string;
  rerank(query: string, candidates: ScoredChunk[], topN?: number): Promise<RerankedChunk[]>;
}

/** Fallback spec : reranker indisponible -> ordre du retrieval conservé, confidence réduite. */
export class PassthroughReranker implements RerankerProvider {
  readonly name = 'passthrough-fallback';
  async rerank(_q: string, cands: ScoredChunk[], topN = 5): Promise<RerankedChunk[]> {
    return cands.slice(0, topN).map((c) => ({ ...c, rerank_score: c.score }));
  }
}

export interface StructuredEvidence {
  supporting_evidence: { chunk_id: string; source_id: string; quote: string }[];
  contradicting_evidence: { chunk_id: string; source_id: string; quote: string }[];
  unknowns: string[];
  assumptions: string[];
  source_refs: string[];
  evidence_confidence: number;
  summary?: string;
}

export interface LLMProvider {
  readonly name: string;
  analyze(query: string, passages: ScoredChunk[]): Promise<StructuredEvidence>;
}

/** Fallback spec : LLM indisponible -> preuves brutes + Decision Engine déterministe, sans analyse inventée. */
export class NoopLLM implements LLMProvider {
  readonly name = 'noop-fallback';
  async analyze(_q: string, passages: ScoredChunk[]): Promise<StructuredEvidence> {
    return {
      supporting_evidence: [],
      contradicting_evidence: [],
      unknowns: passages.length
        ? ['UNKNOWN: analyse LLM indisponible — preuves brutes du snapshot uniquement.']
        : ['INSUFFICIENT EVIDENCE: aucun passage récupéré.'],
      assumptions: [],
      source_refs: [...new Set(passages.map((p) => p.source_id))],
      evidence_confidence: 0
    };
  }
}
