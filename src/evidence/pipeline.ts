// Pipeline evidence-first complet : query -> retrieval local (15-20) -> rerank Modal (4-5)
// -> LLM Nemotron Ultra -> Evidence structurée. Decision Engine NON modifié ici :
// le LLM ne touche jamais contraintes/budget/capital/dates/exigences/valeurs/score.
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { OpportunityDNA } from '../types';
import type { ScoredChunk } from './corpusTypes';
import { CORPUS_DOCS } from './corpus';
import { chunkCorpus } from './chunking';
import { getEmbeddingProvider, HashEmbeddingProvider } from './embeddingProvider';
import { buildIndex, type VectorIndex } from './vectorStore';
import { buildEvidenceQuery, retrieveLocal } from './retrieval';
import { getReranker, RERANK_FALLBACK_PENALTY, MODAL_DEFAULT_TOP_N } from './reranker';
import { getLLM } from './llm';
import type { StructuredEvidence } from './providers';

export interface EvidencePipelineResult extends StructuredEvidence {
  query: string;
  retrieved_count: number;
  reranked_count: number;
  retrieval_method: 'vector' | 'lexical-fallback';
  rerank_method: 'modal' | 'passthrough-fallback';
  rerank_fallback: boolean;
  llm_method: 'nvidia' | 'noop-fallback';
  llm_fallback: boolean;
  sources: { source_id: string; source_url: string; publisher: string; geography_level: string; count: number }[];
  retrieved: ScoredChunk[];
  reranked: { chunk_id: string; source_id: string; rerank_score: number; score: number; text: string; source_url: string; publisher: string; geography_level: string; geography_mismatch: boolean }[];
  confidence_penalties: { retrieval: number; rerank: number };
  deterministic_note: string;
}

let cachedIndex: VectorIndex | null = null;
let cachedKey = '';

function indexPath(): string {
  return join(process.cwd(), 'src', 'data', 'evidence.index.json');
}

function loadCachedChunks(): ReturnType<typeof chunkCorpus> {
  try {
    if (existsSync(indexPath())) {
      const json = JSON.parse(readFileSync(indexPath(), 'utf8')) as VectorIndex;
      if (Array.isArray(json.chunks) && json.chunks.length > 0) return json.chunks;
    }
  } catch {
    // snapshot local : on reconstruit depuis le corpus
  }
  return chunkCorpus(CORPUS_DOCS);
}

async function getIndex(): Promise<{ index: VectorIndex; providerName: string }> {
  const provider = getEmbeddingProvider();
  const key = `${provider.name}|${provider.model}|${provider.dim}`;
  if (cachedIndex && cachedKey === key) return { index: cachedIndex, providerName: provider.name };
  // Réutilise les vecteurs précalculés si même provider/model/dim.
  try {
    if (existsSync(indexPath())) {
      const json = JSON.parse(readFileSync(indexPath(), 'utf8')) as VectorIndex;
      if (json.provider === provider.name && json.model === provider.model && json.dim === provider.dim && Array.isArray(json.vectors) && json.vectors.length === json.chunks.length) {
        cachedIndex = json;
        cachedKey = key;
        return { index: json, providerName: provider.name };
      }
    }
  } catch {
    // rebuild ci-dessous
  }
  const chunks = loadCachedChunks();
  const index = await buildIndex(chunks, provider).catch(async () => {
    // embedding indisponible -> index lexical (vecteurs vides, retrieval catch -> fallback)
    const fallback = new HashEmbeddingProvider();
    return buildIndex(chunks, fallback);
  });
  cachedIndex = index;
  cachedKey = key;
  return { index, providerName: provider.name };
}

export function resetPipelineCache(): void {
  cachedIndex = null;
  cachedKey = '';
}

export async function runEvidencePipeline(
  profile: OpportunityDNA,
  opportunityTitle?: string,
  opts: { topK?: number; topN?: number } = {}
): Promise<EvidencePipelineResult> {
  const topK = opts.topK ?? 18;
  const topN = opts.topN ?? MODAL_DEFAULT_TOP_N;
  const query = buildEvidenceQuery(profile, opportunityTitle ? { title: opportunityTitle } : undefined);

  const { index } = await getIndex();
  const provider = getEmbeddingProvider();
  const { results: retrieved, method: retrievalMethod, confidencePenalty } = await retrieveLocal(index, provider, query, { topK });

  // Rerank : Modal (15-20 -> 4-5), fallback ordre conservé + -10.
  const { reranker, method: rerankMethod } = getReranker();
  let reranked: (ScoredChunk & { rerank_score: number })[];
  let rerankFallback = false;
  try {
    reranked = await reranker.rerank(query, retrieved, topN);
    if (rerankMethod === 'passthrough-fallback') rerankFallback = true;
  } catch {
    const { PassthroughReranker } = await import('./providers');
    reranked = await new PassthroughReranker().rerank(query, retrieved, topN);
    rerankFallback = true;
  }

  // LLM : Nemotron Ultra sur les seuls passages rerankés, fallback noop.
  const { llm, method: llmMethod } = getLLM();
  let structured: StructuredEvidence;
  let llmFallback = llmMethod === 'noop-fallback';
  try {
    structured = await llm.analyze(query, reranked);
  } catch {
    const { NoopLLM } = await import('./providers');
    structured = await new NoopLLM().analyze(query, reranked);
    llmFallback = true;
  }

  const rerankPenalty = rerankFallback ? RERANK_FALLBACK_PENALTY : 0;
  const evidence_confidence = Math.max(0, Math.min(100, structured.evidence_confidence - confidencePenalty - rerankPenalty));

  const srcMap = new Map<string, { source_id: string; source_url: string; publisher: string; geography_level: string; count: number }>();
  for (const r of reranked) {
    const e = srcMap.get(r.source_id) ?? { source_id: r.source_id, source_url: r.source_url, publisher: r.publisher, geography_level: r.geography_level, count: 0 };
    e.count++;
    srcMap.set(r.source_id, e);
  }

  return {
    ...structured,
    evidence_confidence,
    query,
    retrieved_count: retrieved.length,
    reranked_count: reranked.length,
    retrieval_method: retrievalMethod,
    rerank_method: rerankFallback && rerankMethod === 'modal' ? 'modal' : rerankMethod,
    rerank_fallback: rerankFallback,
    llm_method: llmMethod,
    llm_fallback: llmFallback,
    sources: [...srcMap.values()],
    retrieved,
    reranked: reranked.map((r) => ({ chunk_id: r.chunk_id, source_id: r.source_id, rerank_score: r.rerank_score, score: r.score, text: r.text, source_url: r.source_url, publisher: r.publisher, geography_level: r.geography_level, geography_mismatch: r.geography_mismatch })),
    confidence_penalties: { retrieval: confidencePenalty, rerank: rerankPenalty },
    deterministic_note: 'Decision Engine inchangé : contraintes, budget, capital_at_risk, dates, exigences offre et score final non modifiés par le LLM.'
  };
}
