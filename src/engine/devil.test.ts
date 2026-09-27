// §9 — The Devil : revue adversariale. Elle pénalise, elle ne décide pas seule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { devilReview } from './devil';
import { makeOpportunity, withTotal } from '../fixtures';

test('hypothèse "Commerce général" : penalty ≥ 20 => REJECTED, contre-preuves NINEA citées', () => {
  const opp = withTotal(
    makeOpportunity({
      type: 'BUSINESS',
      title: 'Commerce général (stock + local)',
      capital_at_risk_exposure: 15000,
      reversibility: 'Low',
      evidence_confidence: 'Low'
    }),
    40
  );
  const [f] = devilReview([opp]);
  assert.ok(f, 'le Devil doit produire une finding');
  assert.equal(f.penalty, 47); // 25 (concentration) + 10 (irréversibilité) + 12 (evidence Low)
  assert.equal(f.suggested_status, 'REJECTED');
  assert.match(f.counter_evidence.join(' '), /ANSD NINEA/);
  assert.match(f.missing_evidence.join(' '), /USER_VALIDATION_REQUIRED/);
  // §9 : le Devil ne rejette jamais directement l'objet, il propose un statut.
  assert.equal(opp.status, 'PROMISING');
});

test("hypothèse B2B saine : penalty 0 => aucune finding hostile", () => {
  const opp = withTotal(
    makeOpportunity({
      type: 'BUSINESS',
      title: 'Service B2B mobile (saisie, reporting Excel, community management)',
      capital_at_risk_exposure: 10000,
      reversibility: 'High',
      evidence_confidence: 'Medium'
    }),
    66
  );
  const [f] = devilReview([opp]);
  assert.equal(f.penalty, 0);
  assert.equal(f.suggested_status, undefined);
});

test('evidence Low seule => penalty 12 => INVESTIGATE (pas REJECTED)', () => {
  const opp = withTotal(
    makeOpportunity({ type: 'BUSINESS', title: 'Atelier couture', evidence_confidence: 'Low', capital_at_risk_exposure: 0 }),
    55
  );
  const [f] = devilReview([opp]);
  assert.equal(f.penalty, 12);
  assert.equal(f.suggested_status, 'INVESTIGATE');
});

test('JOB à time-to-income > 45 jours vs urgence => penalty 5 (INVESTIGATE non atteint)', () => {
  const opp = withTotal(makeOpportunity({ type: 'JOB', time_to_income_days: 60 }), 70);
  const [f] = devilReview([opp]);
  assert.equal(f.penalty, 5);
  assert.equal(f.suggested_status, undefined);
  assert.match(f.risks.join(' '), /Time-to-income long/);
});

test("les offres en FAIL de contrainte dure ne sont pas passées au crible", () => {
  const viable = withTotal(makeOpportunity({ id: 'ok' }), 70);
  const blocked = withTotal(
    makeOpportunity({ id: 'blocked', hard_constraint_status: 'FAIL', hard_constraint_reasons: ['pays incompatible'] }),
    99
  );
  const findings = devilReview([viable, blocked]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].opportunity_id, 'ok');
});
