// §15 decision_stability : les IDs business doivent être déterministes,
// sinon le ranking change d'un run à l'autre pour un état identique.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBusinessHypotheses, businessId } from './opportunities';
import { makeProfile } from '../fixtures';

test('businessId est déterministe et dérivé du titre', () => {
  assert.equal(businessId('Commerce général stock local'), 'biz-commerce-general-stock-local');
  assert.equal(businessId('Commerce général stock local'), businessId('Commerce général stock local'));
});

test('deux générations successives produisent les mêmes IDs', () => {
  const a = buildBusinessHypotheses(makeProfile()).map((o) => o.id);
  const b = buildBusinessHypotheses(makeProfile()).map((o) => o.id);
  assert.deepEqual(a, b, 'pas de randomUUID dans les IDs business');
  assert.equal(new Set(a).size, a.length, 'IDs uniques');
  for (const id of a) assert.match(id, /^biz-[a-z0-9-]+$/);
});
