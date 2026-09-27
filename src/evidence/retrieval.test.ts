
// Tests retrieval local : vectoriel (N verlassen fallback hash) + lexical, Top-K, mismatch géo.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CORPUS_DOCS } from './corpus';
import { chunkCorpus } from './chunking';
import { HashEmbeddingProvider } from './embeddingProvider';
import { buildIndex } from './vectorStore';
import { buildEvidenceQuery, retrieveLexical, retrieveLocal } from './retrieval';
import { makeProfile } from '../fixtures';

describe('retrieval local', () => {
  it('buildEvidenceQuery à partir du profil + opportunité', () => {
    const q = buildEvidenceQuery(makeProfile(), { title: 'Assistant Marketing Digital' });
    assert.ok(q.includes('marketing') && q.includes('Dakar'));
  });

  it('vectoriel local retourne 15-20 candidats avec provenance', async () => {
    const chunks = chunkCorpus(CORPUS_DOCS);
    const provider = new HashEmbeddingProvider();
    const index = await buildIndex(chunks, provider);
    const q = buildEvidenceQuery(makeProfile(), { title: 'Assistant Marketing Digital' });
    const { results, method } = await retrieveLocal(index, provider, q, { topK: 18 });
    assert.equal(method, 'vector');
    assert.ok(results.length > 0 && results.length <= 18);
    for (const r of results) assert.ok(r.source_id && r.source_url && r.text.length > 0);
  });

  it('requête marketing remonte l’offre job-001 dans le Top-18', async () => {
    const chunks = chunkCorpus(CORPUS_DOCS);
    const provider = new HashEmbeddingProvider();
    const index = await buildIndex(chunks, provider);
    const q = buildEvidenceQuery(makeProfile(), { title: 'Assistant Marketing Digital' });
    const { results } = await retrieveLocal(index, provider, q, { topK: 18 });
    assert.ok(results.some((r) => r.doc_id.includes('job-job-001')));
  });

  it('fallback lexical pur fonctionne sans embedding', () => {
    const chunks = chunkCorpus(CORPUS_DOCS);
    const res = retrieveLexical(chunks, 'marketing excel Dakar', { topK: 15 });
    assert.equal(res.length, Math.min(15, chunks.length));
    assert.ok(res.every((r) => r.method === 'lexical-fallback'));
  });

  it('geography_mismatch visible quand stat NATIONALE pour opportunité LOCALE', async () => {
    const chunks = chunkCorpus(CORPUS_DOCS);
    const provider = new HashEmbeddingProvider();
    const index = await buildIndex(chunks, provider);
    const { results } = await retrieveLocal(index, provider, 'chomage jeunes insertion', {
      topK: 18,
      opportunityGeography: 'LOCAL'
    });
    const nationals = results.filter((r) => r.geography_level === 'NATIONAL');
    assert.ok(nationals.length > 0);
    assert.ok(nationals.every((r) => r.geography_mismatch === true));
  });
});
