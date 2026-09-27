// Provenance intacte : /api/evidence/analyze ne remplace jamais les métadonnées
// originales d'un chunk reranké (observed_at, evidence_type, freshness, value,
// confidence, published_at).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chunkProvenance } from './provenance';
import { CORPUS_DOCS } from './corpus';
import { chunkCorpus } from './chunking';
import { buildApp } from '../app';

describe('provenance intacte', () => {
  it('chunkProvenance recopie les métadonnées originales au lieu de les remplacer', () => {
    const out = chunkProvenance(
      {
        source_id: 'ansd-emploi-t1-2026',
        source_url: 'https://www.ansd.sn/Indicateur/enquete-emploi',
        publisher: 'ANSD',
        observed_at: '2026-09-27',
        geography_level: 'NATIONAL',
        text: 'chômage élargi 22,9 %',
        value: 'Chômage élargi 22,9 % (T1 2026).',
        evidence_type: 'OBSERVED',
        freshness: 'aging',
        confidence: 85
      },
      42
    );
    assert.equal(out.observed_at, '2026-09-27');
    assert.equal(out.evidence_type, 'OBSERVED');
    assert.equal(out.freshness, 'aging');
    assert.equal(out.value, 'Chômage élargi 22,9 % (T1 2026).');
    assert.equal(out.confidence, 85);
  });

  it('une conclusion DERIVED garde son type et sa source après mapping', () => {
    const out = chunkProvenance(
      {
        source_id: 'ansd-ninea-t2-2026',
        source_url: 'https://www.ansd.sn/x',
        publisher: 'ANSD',
        observed_at: '2026-09-27',
        geography_level: 'NATIONAL',
        text: 'DERIVED (ProjectFit) : concurrence élevée',
        value: 'Conclusion : concurrence élevée.',
        evidence_type: 'DERIVED',
        freshness: 'fresh',
        confidence: 72
      },
      0
    );
    assert.equal(out.evidence_type, 'DERIVED');
    assert.equal(out.confidence, 72);
  });

  it('POST /api/evidence/analyze : la session garde observed_at/evidence_type d’origine', async () => {
    const app = buildApp({ logger: false });
    try {
      const demo = (await app.inject({ method: 'GET', url: '/api/demo/profile' })).json() as Record<string, unknown>;
      const norm = (await app.inject({ method: 'POST', url: '/api/profile/normalize', payload: demo })).json() as { session_id: string };
      await app.inject({ method: 'POST', url: '/api/opportunities/generate', payload: { session_id: norm.session_id } });
      await app.inject({
        method: 'POST',
        url: '/api/evidence/analyze',
        payload: { session_id: norm.session_id, opportunity_title: 'Chargé Opérationnel et Marketing' }
      });
      const art = (await app.inject({ method: 'GET', url: `/api/session/${norm.session_id}/artifacts` })).json() as {
        evidence: { source_id: string; observed_at: string; evidence_type: string; freshness: string; field_or_passage: string; value: string; confidence: number }[];
      };
      assert.ok(art.evidence.length > 0);
      // Référence : métadonnées originales des chunks du corpus, indexées par texte.
      const byText = new Map(chunkCorpus(CORPUS_DOCS).map((c) => [c.text, c]));
      for (const e of art.evidence) {
        const orig = byText.get(e.field_or_passage);
        assert.ok(orig, `preuve issue d'un chunk du corpus : ${e.field_or_passage.slice(0, 60)}`);
        assert.equal(e.observed_at, orig.observed_at, 'observed_at original conservé (jamais la date du jour)');
        assert.equal(e.evidence_type, orig.evidence_type, 'evidence_type original conservé (jamais forcé à OBSERVED)');
        assert.equal(e.freshness, orig.freshness ?? 'fresh', 'freshness originale conservée');
        assert.equal(e.value, orig.value ?? orig.text, 'value originale conservée');
        assert.equal(e.confidence, orig.confidence, 'confidence originale conservée');
      }
    } finally {
      await app.close();
    }
  });
});
