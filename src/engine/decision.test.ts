// §10 (8 étapes) — le moteur de décision déterministe, y compris l'abstention.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from './decision';
import { makeOpportunity, makeProfile, withTotal } from '../fixtures';

const profile = makeProfile(); // 300 000 FCFA, 20 000 à risque

test('HYBRID : job solide + business testable (score ≥ 45) => job + micro-test plafonné', () => {
  const job = withTotal(makeOpportunity({ id: 'job-001' }), 83);
  const biz = withTotal(
    makeOpportunity({ id: 'biz-1', type: 'BUSINESS', title: 'Service B2B mobile', status: 'PROMISING' }),
    66
  );
  const d = decide([job, biz], profile);

  assert.equal(d.decision, 'HYBRID');
  assert.equal(d.test_budget, 10000); // plafond §15 : min(10000, capital_at_risk)
  assert.equal(d.preserved_capital, 290000); // le capital est préservé
  assert.equal(d.ranking.length, 2);
  assert.ok(d.best_next_move.includes('HYBRID'));
  assert.ok(d.disclaimer.length > 0, 'le disclaimer est obligatoire (§16)');
  assert.ok(d.next_action.length > 0);
});

test('JOB : pas de business viable => candidature, zéro dépense', () => {
  const jobs = [
    withTotal(makeOpportunity({ id: 'job-001' }), 83),
    withTotal(makeOpportunity({ id: 'job-002', title: 'Commercial Terrain — DakaDistribution' }), 71)
  ];
  const d = decide(jobs, profile);

  assert.equal(d.decision, 'JOB');
  assert.equal(d.test_budget, 0);
  assert.equal(d.preserved_capital, profile.available_capital);
  assert.equal(d.ranking.length, 2);
});

test('le test budget est plafonné à la budget à risque si celui-ci est inférieur', () => {
  const job = withTotal(makeOpportunity({ id: 'job-001' }), 83);
  const biz = withTotal(makeOpportunity({ id: 'biz-1', type: 'BUSINESS' }), 66);
  const poor = makeProfile({ capital_at_risk: 5000 });
  const d = decide([job, biz], poor);
  assert.equal(d.decision, 'HYBRID');
  assert.equal(d.test_budget, 5000);
  assert.equal(d.preserved_capital, 300000 - 5000);
});

test('KEEP_YOUR_CAPITAL : que du business, tout est en FAIL de contrainte dure => abstention', () => {
  const biz = [
    makeOpportunity({ id: 'biz-1', type: 'BUSINESS', hard_constraint_status: 'FAIL', hard_constraint_reasons: ['Capital exposé'] }),
    makeOpportunity({ id: 'biz-2', type: 'BUSINESS', hard_constraint_status: 'FAIL', hard_constraint_reasons: ['Pays incompatible'] })
  ];
  const d = decide(biz, profile);

  assert.equal(d.decision, 'KEEP_YOUR_CAPITAL');
  assert.equal(d.ranking.length, 0);
  assert.equal(d.test_budget, 0);
  assert.equal(d.preserved_capital, profile.available_capital);
  assert.equal(d.rejected.length, 2, 'chaque exclusion doit être listée pour le front');
  assert.ok(d.best_next_move.includes('KEEP YOUR CAPITAL'));
});

test('NO_SAFE_RECOMMENDATION : que des jobs bloqués => abstention (ce n’est pas une erreur)', () => {
  const jobs = [
    makeOpportunity({ id: 'job-001', hard_constraint_status: 'FAIL', hard_constraint_reasons: ['Offre expirée'] }),
    makeOpportunity({ id: 'job-002', hard_constraint_status: 'FAIL', hard_constraint_reasons: ['Diplôme insuffisant'] })
  ];
  const d = decide(jobs, profile);

  assert.equal(d.decision, 'NO_SAFE_RECOMMENDATION');
  assert.equal(d.ranking.length, 0);
  assert.equal(d.preserved_capital, profile.available_capital);
});

test('BUSINESS : unique alternative viable et bien prouvée => test à budget plafonné', () => {
  const biz = withTotal(
    makeOpportunity({ id: 'biz-1', type: 'BUSINESS', title: 'Service B2B mobile', evidence_confidence: 'High' }),
    64
  );
  const d = decide([biz], profile);

  assert.equal(d.decision, 'BUSINESS');
  assert.equal(d.test_budget, 10000);
  assert.equal(d.preserved_capital, 290000);
});

test('INSUFFICIENT_EVIDENCE : business à evidence Low, aucun job => ne rien dépenser', () => {
  const biz = withTotal(
    makeOpportunity({ id: 'biz-1', type: 'BUSINESS', title: 'Commerce général', evidence_confidence: 'Low' }),
    52
  );
  const d = decide([biz], profile);

  assert.equal(d.decision, 'INSUFFICIENT_EVIDENCE');
  assert.equal(d.test_budget, 0);
  assert.equal(d.preserved_capital, profile.available_capital);
  assert.match(d.next_action, /FIELD VALIDATION REQUIRED/);
});

test('les options REJECTED ou FAIL n’apparaissent jamais dans le ranking', () => {
  const job = withTotal(makeOpportunity({ id: 'job-001' }), 83);
  const rejected = withTotal(
    makeOpportunity({ id: 'biz-1', type: 'BUSINESS', status: 'REJECTED', status_reason: 'Concentration NINEA' }),
    90 // score maximal : le status doit quand même l'écarter
  );
  const failed = makeOpportunity({ id: 'job-002', hard_constraint_status: 'FAIL', hard_constraint_reasons: ['Pays incompatible'] });
  const d = decide([job, rejected, failed], profile);

  assert.equal(d.decision, 'JOB');
  assert.deepEqual(
    d.ranking.map((r) => r.opportunity_id),
    ['job-001']
  );
  assert.equal(d.rejected.length, 2);
  assert.ok(d.rejected.some((r) => r.opportunity_id === 'biz-1' && r.reason === 'Concentration NINEA'));
  assert.ok(d.rejected.some((r) => r.opportunity_id === 'job-002'));
});

test('le ranking exposé au front est borné à 3 entrées', () => {
  const jobs = [83, 78, 74, 70, 66].map((t, i) => withTotal(makeOpportunity({ id: `job-${i}` }), t));
  const d = decide(jobs, profile);
  assert.equal(d.ranking.length, 3);
  // tri décroissant sur le score total
  assert.deepEqual(d.ranking.map((r) => r.total), [83, 78, 74]);
});
