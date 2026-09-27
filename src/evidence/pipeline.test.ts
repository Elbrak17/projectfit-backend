// Tests pipeline + endpoint POST /api/evidence/analyze (fallbacks snapshot-first).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runEvidencePipeline, resetPipelineCache } from './pipeline';
import { makeProfile } from '../fixtures';
import { buildApp } from '../app';

describe('pipeline evidence-first', () => {
  it('snapshot-first sans clés : retrieved 10, reranked 5, fallbacks marqués', async () => {
    resetPipelineCache();
    const savedNvidia = process.env.NVIDIA_API_KEY;
    const savedModal = process.env.MODAL_RERANKER_URL;
    delete process.env.NVIDIA_API_KEY;
    delete process.env.MODAL_RERANKER_URL;
    try {
      const res = await runEvidencePipeline(makeProfile(), 'Assistant Marketing Digital');
      assert.equal(res.retrieved_count, 10);
      assert.equal(res.reranked_count, 5);
      assert.equal(res.retrieval_method, 'vector');
      assert.equal(res.rerank_method, 'passthrough-fallback');
      assert.equal(res.rerank_fallback, true);
      assert.equal(res.llm_method, 'noop-fallback');
      assert.equal(res.llm_fallback, true);
      assert.ok(res.reranked[0].chunk_id.includes('job-job-001'));
      assert.ok(res.sources.length > 0);
      assert.ok(res.deterministic_note.includes('Decision Engine'));
      assert.ok(res.evidence_confidence >= 0 && res.evidence_confidence <= 100);
    } finally {
      if (savedNvidia !== undefined) process.env.NVIDIA_API_KEY = savedNvidia;
      if (savedModal !== undefined) process.env.MODAL_RERANKER_URL = savedModal;
      resetPipelineCache();
    }
  });

  it('POST /api/evidence/analyze avec profil inline (contrat front)', async () => {
    resetPipelineCache();
    const app = buildApp({ logger: false });
    const res = await app.inject({
      method: 'POST',
      url: '/api/evidence/analyze',
      payload: {
        profile: {
          skills: ['marketing', 'excel'], education: 'Bac+3 marketing', location: 'Dakar',
          country_id: 'SN', mobility: 'faible', available_capital: 300000, capital_at_risk: 20000
        },
        opportunity_title: 'Assistant Marketing Digital'
      }
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as Record<string, unknown>;
    for (const k of ['retrieved_count', 'reranked_count', 'sources', 'supporting_evidence', 'contradicting_evidence', 'unknowns', 'evidence_confidence', 'deterministic_note', 'query']) {
      assert.ok(k in body, `clé manquante: ${k}`);
    }
    await app.close();
    resetPipelineCache();
  });

  it('POST /api/evidence/analyze 400 sans profil ni session', async () => {
    const app = buildApp({ logger: false });
    const res = await app.inject({ method: 'POST', url: '/api/evidence/analyze', payload: {} });
    assert.equal(res.statusCode, 400);
    await app.close();
  });

  it('POST /api/evidence/analyze 404 session inconnue', async () => {
    const app = buildApp({ logger: false });
    const res = await app.inject({ method: 'POST', url: '/api/evidence/analyze', payload: { session_id: 'nope' } });
    assert.equal(res.statusCode, 404);
    await app.close();
  });
});
