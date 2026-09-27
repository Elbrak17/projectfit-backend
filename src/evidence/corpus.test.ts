// Tests corpus réel : schéma provenance complet, URLs individuelles, observé/dérivé séparés.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CORPUS_DOCS } from './corpus';

describe('evidence corpus', () => {
  it('contient le snapshot JOB réel + preuves éco officielles (snapshot-first)', () => {
    const cats = new Set(CORPUS_DOCS.map((d) => d.category));
    const jobs = CORPUS_DOCS.filter((d) => d.category === 'JOB_OFFER');
    const econ = CORPUS_DOCS.filter((d) => d.category !== 'JOB_OFFER');
    assert.ok(jobs.length >= 50, `snapshot JOB réel attendu (50-150), got ${jobs.length}`);
    assert.ok(econ.length >= 7, `corpus BUSINESS officiel attendu, got ${econ.length}`);
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

  it('offres JOB : URL individuelle obligatoire, jamais de listing générique', () => {
    const jobs = CORPUS_DOCS.filter((d) => d.category === 'JOB_OFFER');
    for (const j of jobs) {
      assert.ok(j.source_url.includes('/jobseekers/'), `${j.doc_id} doit citer son URL individuelle`);
      assert.ok(!j.source_url.endsWith('offres-d-emploi.php'), `${j.doc_id} : pas d'URL de listing comme preuve`);
      assert.ok(j.published_at && j.expires_at);
      assert.equal(j.geography_level, 'LOCAL');
    }
  });

  it('offres JOB : champs non publiés = absents (UNKNOWN), jamais inventés', () => {
    const jobs = CORPUS_DOCS.filter((d) => d.category === 'JOB_OFFER');
    const fp = jobs.map((j) => j.field_provenance ?? {});
    // Au moins une offre sans diplôme publié et une sans expérience quantifiée (cas réels).
    assert.ok(fp.some((p) => p.education_required === 'UNKNOWN'), 'cas UNKNOWN diplôme attendus');
    assert.ok(fp.some((p) => p.experience_required_months === 'UNKNOWN'), 'cas UNKNOWN expérience attendus');
    // Employeur jamais publié sur les pages SenJob -> toujours UNKNOWN.
    for (const p of fp) assert.equal(p.employer, 'UNKNOWN');
    // Aucune valeur synthétique marquée OBSERVED : skills toujours DERIVED.
    for (const p of fp) assert.equal(p.skills, 'DERIVED');
    for (const j of jobs) {
      if (j.education_required !== undefined) assert.ok(j.field_provenance?.education_required === 'OBSERVED');
      if (j.experience_required_months !== undefined) {
        assert.ok(typeof j.experience_required_months === 'number');
        assert.ok(j.field_provenance?.experience_required_months === 'OBSERVED');
      }
    }
  });

  it('BUSINESS : passages observés séparés des conclusions dérivées/estimées', () => {
    const econ = CORPUS_DOCS.filter((d) => d.category !== 'JOB_OFFER');
    const types = new Set(econ.map((d) => d.evidence_type));
    assert.ok(types.has('OBSERVED'), 'passages officiels bruts attendus');
    assert.ok(types.has('DERIVED'), 'conclusions dérivées attendues');
    assert.ok(types.has('ESTIMATED'), 'estimation ProjectFit marquée attendue');
    for (const d of econ.filter((x) => x.evidence_type !== 'OBSERVED')) {
      assert.ok((d.derived_from ?? []).length > 0, `${d.doc_id} : derived_from obligatoire`);
    }
    for (const d of econ.filter((x) => x.evidence_type === 'OBSERVED')) {
      assert.ok(!d.derived_from, `${d.doc_id} : OBSERVED sans derived_from`);
    }
  });

  it('stats nationales jamais promues locales', () => {
    const nationals = CORPUS_DOCS.filter((d) => d.geography_level === 'NATIONAL');
    assert.ok(nationals.length > 0);
    for (const n of nationals) assert.ok(!n.region || n.country_id === 'SN');
  });
});
