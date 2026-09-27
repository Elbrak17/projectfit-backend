// Kill switch ENABLE_HYBRID=false — doit être testé dans un processus dédié
// car la constante est lue au chargement du module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeOpportunity, makeProfile, withTotal } from '../fixtures';

process.env.ENABLE_HYBRID = 'false';

test("ENABLE_HYBRID=false : jamais de décision HYBRID, on retombe sur JOB", async () => {
  const { decide } = await import('./decision');

  const job = withTotal(makeOpportunity({ id: 'job-001' }), 83);
  const biz = withTotal(makeOpportunity({ id: 'biz-1', type: 'BUSINESS' }), 66);
  const d = decide([job, biz], makeProfile());

  assert.notEqual(d.decision, 'HYBRID');
  assert.equal(d.decision, 'JOB');
  assert.equal(d.test_budget, 0);
});
