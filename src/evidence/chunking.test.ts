
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CORPUS_DOCS } from './corpus';
import { chunkCorpus, chunkDocument } from './chunking';

describe('chunking + provenance', () => {
  it('découpe en passages <= 600 chars avec offsets et provenance', () => {
    const chunks = chunkCorpus(CORPUS_DOCS);
    assert.ok(chunks.length >= CORPUS_DOCS.length);
    for (const c of chunks) {
      assert.ok(c.text.length <= 620);
      assert.ok(c.chunk_id.includes('#c'));
      assert.ok(c.char_end > c.char_start);
      assert.ok(c.source_id && c.source_url && c.publisher && c.observed_at);
    }
  });

  it('provenance recopiée à l’identique du doc', () => {
    const doc = CORPUS_DOCS[0];
    const chunks = chunkDocument(doc);
    for (const c of chunks) {
      assert.equal(c.doc_id, doc.doc_id);
      assert.equal(c.source_id, doc.source_id);
      assert.equal(c.geography_level, doc.geography_level);
      assert.equal(c.evidence_type, doc.evidence_type);
    }
  });
});
