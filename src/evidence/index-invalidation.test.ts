// Invalidation d'index : un ancien evidence.index.json ne doit jamais fournir
// ses anciens chunks après modification du corpus (fingerprint SHA-256).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { CORPUS_DOCS } from './corpus';
import { chunkCorpus } from './chunking';
import { HashEmbeddingProvider } from './embeddingProvider';
import { buildIndex, fingerprintChunks, indexMatchesCorpus, type VectorIndex } from './vectorStore';
import { runEvidencePipeline, resetPipelineCache } from './pipeline';

const INDEX_PATH = join(process.cwd(), 'src', 'data', 'evidence.index.json');

describe('invalidation index', () => {
  it('fingerprint stable sur le même corpus, différente après modification', async () => {
    const chunks = chunkCorpus(CORPUS_DOCS);
    const provider = new HashEmbeddingProvider();
    const a = await buildIndex(chunks, provider);
    const b = await buildIndex(chunks, provider);
    assert.equal(a.corpus_fingerprint, b.corpus_fingerprint);
    const modified = [...chunks, { ...chunks[0], chunk_id: `${chunks[0].chunk_id}-ghost`, text: `${chunks[0].text} ajout` }];
    assert.notEqual(fingerprintChunks(modified), a.corpus_fingerprint, 'ajout -> empreinte différente');
    assert.ok(!indexMatchesCorpus(a, modified, provider), 'ancien index rejeté après ajout');
    assert.ok(indexMatchesCorpus(a, chunks, provider), 'index courant accepté');
  });

  it('pipeline ignore un index périmé sur disque et sert le corpus courant', async () => {
    const raw = readFileSync(INDEX_PATH, 'utf8');
    const current = JSON.parse(raw) as VectorIndex;
    assert.ok(current.chunks.length > 50, 'index réel attendu avant le test');
    // Simule un ancien index (empreinte + chunks d'un corpus à 10 docs) puis restaure.
    const stale: VectorIndex = {
      ...current,
      corpus_fingerprint: '0'.repeat(64),
      chunks: current.chunks.slice(0, 10),
      vectors: current.vectors.slice(0, 10)
    };
    writeFileSync(INDEX_PATH, JSON.stringify(stale), 'utf8');
    resetPipelineCache();
    try {
      const { makeProfile } = await import('../fixtures');
      const res = await runEvidencePipeline(makeProfile(), 'Marketing Dakar');
      assert.equal(res.retrieved_count, 18, 'Top-K servi depuis le corpus courant, pas les 10 chunks périmés');
      assert.ok(
        res.retrieved.every((r) => r.doc_id.startsWith('job-senjob-') || r.doc_id.startsWith('econ-')),
        'chunks du corpus courant uniquement'
      );
      assert.ok(res.retrieved.some((r) => !stale.chunks.some((s) => s.chunk_id === r.chunk_id)) || res.retrieved.length > stale.chunks.length,
        'au-delà du périmètre périmé');
    } finally {
      writeFileSync(INDEX_PATH, raw, 'utf8');
      resetPipelineCache();
    }
  });
});
