// §10 — scoring déterministe : le LLM n'intervient jamais ici.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreOpportunity } from './scoring';
import { makeOpportunity, makeProfile } from '../fixtures';

test('skill fit: 3 compétences sur 4 => 75 (High)', () => {
  const opp = scoreOpportunity(
    makeOpportunity(),
    makeProfile(),
    { skills: ['marketing', 'excel', 'canva', 'reseaux sociaux'] },
    85
  );
  assert.equal(opp._scores?.skill, 75);
  assert.equal(opp.skill_fit, 'High');
});

test('skill fit: aucune compétence requise couverte => 0 (Low)', () => {
  const opp = scoreOpportunity(makeOpportunity(), makeProfile(), { skills: ['welding', 'forklift'] }, 85);
  assert.equal(opp._scores?.skill, 0);
  assert.equal(opp.skill_fit, 'Low');
});

test('skill fit: snapshot sans compétences exigées => 50 (Medium, pas 0)', () => {
  const opp = scoreOpportunity(makeOpportunity(), makeProfile(), { skills: [] }, 85);
  assert.equal(opp._scores?.skill, 50);
  assert.equal(opp.skill_fit, 'Medium');
});

test('un BUSINESS ne dépend pas des skills métier => 60', () => {
  const opp = scoreOpportunity(
    makeOpportunity({ type: 'BUSINESS', title: 'Commerce général (stock + local)' }),
    makeProfile(),
    { skills: ['python'] },
    45
  );
  assert.equal(opp._scores?.skill, 60);
});

test('location: même ville => 85, ville différente + mobilité faible => 30', () => {
  const same = scoreOpportunity(makeOpportunity({ region: 'Dakar' }), makeProfile({ location: 'Dakar', mobility: 'faible' }));
  assert.equal(same._scores?.location, 85);

  const far = scoreOpportunity(makeOpportunity({ region: 'Thiès' }), makeProfile({ location: 'Dakar', mobility: 'faible' }));
  assert.equal(far._scores?.location, 30);
  assert.equal(far.location_fit, 'Low');

  const mobile = scoreOpportunity(makeOpportunity({ region: 'Thiès' }), makeProfile({ location: 'Dakar', mobility: 'forte' }));
  assert.equal(mobile._scores?.location, 60);
});

test('capital: sans exposition => 100, à fond du budget => 0, à mi-budget => 50', () => {
  const none = scoreOpportunity(makeOpportunity(), makeProfile({ capital_at_risk: 20000 }));
  assert.equal(none._scores?.capital, 100);

  const half = scoreOpportunity(
    makeOpportunity({ type: 'BUSINESS', capital_at_risk_exposure: 10000 }),
    makeProfile({ capital_at_risk: 20000 })
  );
  assert.equal(half._scores?.capital, 50);

  const full = scoreOpportunity(
    makeOpportunity({ type: 'BUSINESS', capital_at_risk_exposure: 20000 }),
    makeProfile({ capital_at_risk: 20000 })
  );
  assert.equal(full._scores?.capital, 0);
});

test('time-to-income: rapide vs urgence => haut score, jamais négatif', () => {
  const fast = scoreOpportunity(makeOpportunity({ time_to_income_days: 0 }), makeProfile({ income_urgency_days: 60 }));
  assert.equal(fast._scores?.time, 100);

  const slow = scoreOpportunity(makeOpportunity({ time_to_income_days: 180 }), makeProfile({ income_urgency_days: 60 }));
  assert.equal(slow._scores?.time, 0);
});

test('penalty de risque: risk High + réversibilité Low = 25 points retirés', () => {
  const opp = scoreOpportunity(
    makeOpportunity({ type: 'BUSINESS', risk: 'High', reversibility: 'Low' }),
    makeProfile(),
    undefined,
    60
  );
  assert.equal(opp._scores?.risk_penalty, 25);
});

test('le penalty du Devil est bien soustrait du total', () => {
  const clean = scoreOpportunity(makeOpportunity(), makeProfile(), { skills: ['marketing', 'excel', 'canva'] }, 85, 0);
  const punished = scoreOpportunity(
    makeOpportunity({ id: 'opp-2' }),
    makeProfile(),
    { skills: ['marketing', 'excel', 'canva'] },
    85,
    12
  );
  assert.equal(punished._scores?.devil_penalty, 12);
  assert.equal(clean._scores!.total - punished._scores!.total, 12);
});

test('total déterministe et borné à 0 (jamais négatif, jamais de fausse précision)', () => {
  const opp = makeOpportunity({ type: 'BUSINESS', risk: 'High', reversibility: 'Low', time_to_income_days: 999 });
  const r = scoreOpportunity(opp, makeProfile({ capital_at_risk: 1 }), undefined, 0, 100);
  assert.equal(r._scores?.total, 0);
});

test("les niveaux affichés au front sont bien Low/Medium/High (pas de chiffres)", () => {
  const opp = scoreOpportunity(makeOpportunity(), makeProfile(), { skills: ['marketing', 'excel', 'canva'] }, 85);
  assert.ok(['Low', 'Medium', 'High'].includes(opp.skill_fit));
  assert.ok(['Low', 'Medium', 'High'].includes(opp.location_fit));
  assert.ok(['Low', 'Medium', 'High'].includes(opp.evidence_confidence));
});
