// Tests corpus normalisé : schéma provenance complet, géographie préservée.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CORPUS_DOCS } from './corpus';

describe('evidence corpus', () => {
  it('contient offres JOB + preuves éco (snapshot-first)', () => {
    const cats = new Set(CORPUS_DOCS.map((d) => d.category));
    assert.ok(CORPUS_DOCS.length >= 10);
    assert.ok(cats.has('JOB_OFFER'));
    assert.ok(cats.has('ECON_STAT') || cats.has('PROGRAM_INFO'));
  });

  it('chaque doc porte la provenance minimale', () => {
    for (const d of CORPUS_DOCS) {
      assert.ok(d.source_id && d.source_url.startsWith('http'));
      assert.ok(d.publisher && d.observed_at);
      assert.ok(d.country_id === 'SN');
      assert.ok(['LOCAL', 'REGIONAL', 'NATIONAL'].includes(d.geography_level));
      assert.ok(d.text.length > 20);
      assert.ok(['OBSERVED', 'DERIVED', 'ESTIMATED', 'UNKNOWN'].includes(d.evidence_type));
    }
  });

  it('offres JOB avec champs requis', () => {
    const jobs = CORPUS_DOCS.filter((d) => d.category === 'JOB_OFFER');
    assert.ok(jobs.length >= 6);
    for (const j of jobs) {
      assert.ok(j.published_at && j.expires_at);
      assert.ok(j.education_required);
      assert.ok(typeof j.experience_required_months === 'number');
      assert.ok((j.skills ?? []).length > 0);
      assert.equal(j.geography_level, 'LOCAL');
    }
  });

  it('stats nationales jamais promues locales', () => {
    const nationals = CORPUS_DOCS.filter((d) => d.geography_level === 'NATIONAL');
    assert.ok(nationals.length > 0);
    for (const n of nationals) assert.ok(!n.region || n.country_id === 'SN');
  });
});
