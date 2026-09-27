// Reranker Modal self-hosted — nvidia/llama-nemotron-rerank-1b-v2 via HTTPS.
// Modal héberge UNIQUEMENT le reranker. Embeddings + LLM final = endpoints NVIDIA directs.
// Contrat attendu (documenté pour l'équipe Modal/front) :
//   POST {MODAL_RERANKER_URL} { query: string, passages: [{chunk_id, text}], top_n: number, model?: string }
//   <- { results: [{chunk_id, score}] }  (formes tolérées : tableau nu, {ranking: [...]}, {data: [...]})
// Fallback spec : URL absente / timeout / réponse invalide -> throw, le pipeline
// conserve l'ordre du retrieval (PassthroughReranker) et applique -10 de confidence.
import type { RerankedChunk, RerankerProvider } from './providers';
import { PassthroughReranker } from './providers';
import type { ScoredChunk } from './corpusTypes';

export const MODAL_DEFAULT_TOP_N = 5;
export const RERANK_FALLBACK_PENALTY = 10;

function timeoutMs(): number {
  const raw = Number(process.env.MODAL_RERANKER_TIMEOUT_MS ?? 15000);
  return Number.isFinite(raw) && raw > 0 ? raw : 15000;
}

function modalUrl(): string {
  return (process.env.MODAL_RERANKER_URL ?? '').trim();
}

function modalModel(): string {
  return (process.env.MODAL_RERANKER_MODEL ?? 'nvidia/llama-nemotron-rerank-1b-v2').trim();
}

/** Parse tolérant : accepte {results|ranking|data} ou tableau nu. */
export function parseRerankResponse(json: unknown, candidates: ScoredChunk[]): Map<string, number> | null {
  const arr: unknown =
    Array.isArray(json) ? json
    : json != null && typeof json === 'object' && Array.isArray((json as Record<string, unknown>).results)
      ? (json as Record<string, unknown>).results
    : json != null && typeof json === 'object' && Array.isArray((json as Record<string, unknown>).ranking)
      ? (json as Record<string, unknown>).ranking
    : json != null && typeof json === 'object' && Array.isArray((json as Record<string, unknown>).data)
      ? (json as Record<string, unknown>).data
    : null;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const validIds = new Set(candidates.map((c) => c.chunk_id));
  const scores = new Map<string, number>();
  for (const item of arr) {
    if (item == null || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const id =
      typeof rec.chunk_id === 'string' ? rec.chunk_id
      : typeof rec.id === 'string' ? rec.id
      : typeof rec.index === 'number' && candidates[rec.index] ? candidates[rec.index].chunk_id
      : null;
    const scoreRaw = rec.score ?? rec.rerank_score ?? rec.relevance_score;
    const score = typeof scoreRaw === 'number' && Number.isFinite(scoreRaw) ? scoreRaw : null;
    if (id && validIds.has(id) && score !== null && !scores.has(id)) scores.set(id, score);
  }
  return scores.size > 0 ? scores : null;
}

export class ModalReranker implements RerankerProvider {
  readonly name = 'modal-nemotron-rerank-1b-v2';
  private url: string;
  private model: string;
  private timeout: number;

  constructor(url = modalUrl(), model = modalModel(), timeout = timeoutMs()) {
    this.url = url;
    this.model = model;
    this.timeout = timeout;
  }

  get configured(): boolean {
    return this.url.length > 0;
  }

  async rerank(query: string, candidates: ScoredChunk[], topN = MODAL_DEFAULT_TOP_N): Promise<RerankedChunk[]> {
    if (!this.configured) throw new Error('modal-reranker: MODAL_RERANKER_URL manquant');
    if (candidates.length === 0) return [];
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeout);
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          passages: candidates.map((c) => ({ chunk_id: c.chunk_id, text: c.text })),
          top_n: topN,
          model: this.model
        }),
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error(`modal-reranker ${res.status}`);
      const json = (await res.json()) as unknown;
      const scores = parseRerankResponse(json, candidates);
      if (!scores) throw new Error('modal-reranker: réponse invalide');
      const byId = new Map(candidates.map((c) => [c.chunk_id, c]));
      const ranked: RerankedChunk[] = [...scores.entries()]
        .filter(([id]) => byId.has(id))
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([id, s]) => ({ ...byId.get(id)!, rerank_score: s }));
      // Complète si le reranker a renvoyé moins que topN (ne jamais inventer).
      if (ranked.length < Math.min(topN, candidates.length)) {
        const seen = new Set(ranked.map((r) => r.chunk_id));
        for (const c of candidates) {
          if (ranked.length >= Math.min(topN, candidates.length)) break;
          if (!seen.has(c.chunk_id)) ranked.push({ ...c, rerank_score: c.score });
        }
      }
      return ranked;
    } finally {
      clearTimeout(t);
    }
  }
}

/** Fabrique : Modal si URL configurée, sinon passthrough (ordre retrieval conservé). */
export function getReranker(): { reranker: RerankerProvider; method: 'modal' | 'passthrough-fallback' } {
  const url = modalUrl();
  if (url) return { reranker: new ModalReranker(url), method: 'modal' };
  return { reranker: new PassthroughReranker(), method: 'passthrough-fallback' };
}
