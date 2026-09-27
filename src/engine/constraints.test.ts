// §10 étape 1 + §15.A — les contraintes dures priment sur tout score.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkHardConstraints } from './constraints';
import { makeOpportunity, makeProfile } from '../fixtures';

test('un offre valide passe toutes les contraintes dures', () => {
  const r = checkHardConstraints(makeOpportunity(), makeProfile());
  assert.equal(r.pass, true);
  assert.deepEqual(r.reasons, []);
});

test('une offre expirée est exclue automatiquement', () => {
  const opp = makeOpportunity({ expires_at: '2020-01-01' });
  const r = checkHardConstraints(opp, makeProfile());
  assert.equal(r.pass, false);
  assert.match(r.reasons.join(' '), /expirée/i);
});

test('une offre non expirée reste PASS', () => {
  const opp = makeOpportunity({ expires_at: '2099-12-31' });
  assert.equal(checkHardConstraints(opp, makeProfile()).pass, true);
});

test('exposition business > budget à risque => FAIL avec montants cités', () => {
  const opp = makeOpportunity({
    type: 'BUSINESS',
    title: 'Commerce général (stock + local)',
    capital_at_risk_exposure: 50000
  });
  const r = checkHardConstraints(opp, makeProfile({ capital_at_risk: 20000 }));
  assert.equal(r.pass, false);
  assert.match(r.reasons.join(' '), /Capital exposé 50000 FCFA > capital-à-risque accepté 20000 FCFA/);
});

test('exposition business dans le budget => PASS', () => {
  const opp = makeOpportunity({ type: 'BUSINESS', capital_at_risk_exposure: 10000 });
  assert.equal(checkHardConstraints(opp, makeProfile({ capital_at_risk: 20000 })).pass, true);
});

test("exclusion utilisateur: 'restauration' bloque un titre 'Restaurant' (match stem)", () => {
  const opp = makeOpportunity({ title: 'Chef de cuisine — Restaurant Le Baobab' });
  const r = checkHardConstraints(opp, makeProfile({ constraints: ['restauration'] }));
  assert.equal(r.pass, false);
  assert.match(r.reasons.join(' '), /Exclusion utilisateur violée/);
});

test('pays incompatible => FAIL', () => {
  const opp = makeOpportunity({ country_id: 'CI' });
  const r = checkHardConstraints(opp, makeProfile({ country_id: 'SN' }));
  assert.equal(r.pass, false);
  assert.match(r.reasons.join(' '), /Pays incompatible : opportunité CI vs profil SN/);
});

test('diplôme requis supérieur au diplôme du profil => FAIL', () => {
  const opp = makeOpportunity({ education_required: 'Bac+5 informatique' });
  const r = checkHardConstraints(opp, makeProfile({ education: 'Bac+3 marketing' }));
  assert.equal(r.pass, false);
  assert.match(r.reasons.join(' '), /Diplôme insuffisant : requis Bac\+5/);
});

test("diplôme requis <= diplôme du profil => PASS", () => {
  const opp = makeOpportunity({ education_required: 'Bac+3 marketing' });
  assert.equal(checkHardConstraints(opp, makeProfile({ education: 'Bac+3 marketing' })).pass, true);
});
