// Kill switch ENABLE_DEVIL=false — doit être testé dans un processus dédié
// car la constante est lue au chargement du module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeOpportunity, withTotal } from '../fixtures';

process.env.ENABLE_DEVIL = 'false';

test('ENABLE_DEVIL=false : la revue adversariale est bien neutralisée', async () => {
  const { devilReview } = await import('./devil');

  const fragile = withTotal(
    makeOpportunity({
      type: 'BUSINESS',
      title: 'Commerce général (stock + local)',
      capital_at_risk_exposure: 15000,
      reversibility: 'Low',
      evidence_confidence: 'Low'
    }),
    40
  );

  assert.deepEqual(devilReview([fragile]), []);
});
