// Tests LLM Nemotron Ultra : sanitize (anti-invention), garde-fous, fabrique.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeLLMOutput, getLLM, NvidiaLLM } from './llm';
import type { ScoredChunk } from './corpusTypes';

function chunk(id: string, source = 'src-a'): ScoredChunk {
  return {
    chunk_id: id, doc_id: 'd', chunk_index: 0, char_start: 0, char_end: 10, text: `passage ${id}`,
    source_id: source, source_url: 'https://example.com', publisher: 'ANSD', observed_at: '2026-09-26',
    country_id: 'SN', geography_level: 'NATIONAL', category: 'ECON_STAT', evidence_type: 'OBSERVED',
    score: 0.2, method: 'vector', geography_mismatch: true
  };
}

describe('llm nemotron ultra', () => {
  it('garde uniquement les refs du corpus, rejette les inventions vers unknowns', () => {
    const passages = [chunk('a#c0'), chunk('b#c0', 'src-b')];
    const out = sanitizeLLMOutput(
      {
        supporting_evidence: [
          { chunk_id: 'a#c0', source_id: 'src-a', quote: 'ok' },
          { chunk_id: 'INVENTED', source_id: 'fake', quote: 'hallucination' }
        ],
        contradicting_evidence: [],
        unknowns: [],
        assumptions: ['test avec petit capital'],
        source_refs: ['src-a', 'fake-source'],
        evidence_confidence: 78,
        summary: 'Résumé.'
      },
      passages
    );
    assert.equal(out.supporting_evidence.length, 1);
    assert.equal(out.supporting_evidence[0].chunk_id, 'a#c0');
    assert.ok(out.unknowns.some((u) => u.includes('rejetée')));
    assert.deepEqual(out.source_refs, ['src-a']);
    assert.equal(out.evidence_confidence, 78);
  });

  it('confidence clampée 0-100, sortie invalide -> UNKNOWN sans crash', () => {
    const passages = [chunk('a#c0')];
    assert.equal(sanitizeLLMOutput({ evidence_confidence: 999 }, passages).evidence_confidence, 100);
    assert.equal(sanitizeLLMOutput({ evidence_confidence: -5 }, passages).evidence_confidence, 0);
    const bad = sanitizeLLMOutput(null, passages);
    assert.ok(bad.unknowns.some((u) => u.includes('UNKNOWN')));
  });

  it('fabrique : sans clé -> noop, avec clé -> nvidia', () => {
    const saved = process.env.NVIDIA_API_KEY;
    delete process.env.NVIDIA_API_KEY;
    assert.equal(getLLM().method, 'noop-fallback');
    process.env.NVIDIA_API_KEY = 'nv-test';
    assert.equal(getLLM().method, 'nvidia');
    assert.ok(new NvidiaLLM('nv-test').configured);
    if (saved === undefined) delete process.env.NVIDIA_API_KEY;
    else process.env.NVIDIA_API_KEY = saved;
  });

  it('NvidiaLLM sans clé -> throw (pipeline applique le fallback noop)', async () => {
    await assert.rejects(() => new NvidiaLLM('').analyze('q', [chunk('a#c0')]));
  });
});
