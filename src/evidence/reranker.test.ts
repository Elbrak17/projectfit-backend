// Tests reranker Modal : contrat, parsing tolérant, fallbacks.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseRerankResponse, ModalReranker, getReranker } from './reranker';
import { PassthroughReranker } from './providers';
import type { ScoredChunk } from './corpusTypes';

function chunk(id: string): ScoredChunk {
  return {
    chunk_id: id, doc_id: 'd', chunk_index: 0, char_start: 0, char_end: 10, text: `text ${id}`,
    source_id: 's', source_url: 'https://example.com', publisher: 'P', observed_at: '2026-09-26',
    country_id: 'SN', geography_level: 'LOCAL', category: 'JOB_OFFER', evidence_type: 'OBSERVED',
    score: 0.1, method: 'vector', geography_mismatch: false
  };
}

describe('reranker modal', () => {
  it('parse {results} et trie par score', () => {
    const cands = [chunk('a'), chunk('b'), chunk('c')];
    const m = parseRerankResponse({ results: [{ chunk_id: 'c', score: 0.9 }, { chunk_id: 'a', score: 0.5 }] }, cands);
    assert.ok(m && m.get('c') === 0.9 && m.get('a') === 0.5);
  });

  it('rejette les refs inventées et les réponses vides', () => {
    const cands = [chunk('a')];
    assert.equal(parseRerankResponse({ results: [{ chunk_id: 'zzz', score: 1 }] }, cands), null);
    assert.equal(parseRerankResponse({ results: [] }, cands), null);
    assert.equal(parseRerankResponse({ nope: 1 }, cands), null);
  });

  it('passthrough conserve l’ordre (fallback spec)', async () => {
    const cands = [chunk('a'), chunk('b'), chunk('c')];
    const out = await new PassthroughReranker().rerank('q', cands, 2);
    assert.deepEqual(out.map((o) => o.chunk_id), ['a', 'b']);
  });

  it('sans URL -> fabrique passthrough, avec URL -> modal', () => {
    const saved = process.env.MODAL_RERANKER_URL;
    delete process.env.MODAL_RERANKER_URL;
    assert.equal(getReranker().method, 'passthrough-fallback');
    process.env.MODAL_RERANKER_URL = 'https://modal.example/rerank';
    assert.equal(getReranker().method, 'modal');
    if (saved === undefined) delete process.env.MODAL_RERANKER_URL;
    else process.env.MODAL_RERANKER_URL = saved;
  });

  it('ModalReranker sans URL configurée -> throw (pipeline applique le fallback)', async () => {
    const r = new ModalReranker('');
    await assert.rejects(() => r.rerank('q', [chunk('a')]));
  });
});
