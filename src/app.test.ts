// Tests d'intégration — golden path §15.1 + contrats d'erreur §11.1.
// Exécutés via `app.inject()` : pas de port, pas de réseau.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import type { Decision, Opportunity, OpportunityDNA, SessionArtifacts, Source } from './types';

let app: FastifyInstance;

before(async () => {
  app = buildApp({ logger: false });
  await app.ready();
});

after(async () => {
  await app.close();
});

function parse<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

test('GET /health expose ok + snapshot + kill switches (§15)', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(res.statusCode, 200);
  const h = parse<{ ok: boolean; snapshot: boolean; kill_switches: Record<string, string> }>(res.body);
  assert.equal(h.ok, true);
  assert.equal(h.snapshot, true);
  assert.equal(h.kill_switches.ENABLE_HYBRID, 'true');
  assert.equal(h.kill_switches.ENABLE_DEVIL, 'true');
});

test('GET /api/demo/profile renvoie le profil démo §3 (300 000 FCFA, Dakar)', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/demo/profile' });
  assert.equal(res.statusCode, 200);
  const p = parse<Record<string, unknown>>(res.body);
  assert.equal(p.available_capital, 300000);
  assert.equal(p.location, 'Dakar');
  assert.equal(p.country_id, 'SN');
  assert.ok(Array.isArray(p.constraints));
});

test('POST /api/profile/normalize pseudonymise : les PII envoyées ne reviennent jamais', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/profile/normalize',
    payload: {
      name: 'Elbrak BANSE',
      email: 'secret@example.com',
      phone: '+226 70 00 00 00',
      education: 'Bac+3 marketing',
      location: 'Dakar',
      skills: ['marketing', 'excel'],
      available_capital: 300000,
      capital_at_risk: 999999 // > available_capital : doit être plafonné
    }
  });
  assert.equal(res.statusCode, 200);
  const body = parse<{ session_id: string; opportunity_dna: OpportunityDNA }>(res.body);

  assert.equal(typeof body.session_id, 'string');
  assert.equal(body.opportunity_dna.capital_at_risk, 300000, 'capital_at_risk plafonné à available_capital');
  const serialized = JSON.stringify(body);
  assert.ok(!serialized.includes('Elbrak'), 'aucune PII dans la réponse');
  assert.ok(!serialized.includes('secret@example.com'));
  assert.ok(!serialized.includes('+226'));
});

test('POST /api/profile/normalize refuse un payload invalide (400 + détails Zod)', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/profile/normalize',
    payload: { skills: 'pas-un-tableau', available_capital: 'beaucoup' }
  });
  assert.equal(res.statusCode, 400);
  const body = parse<{ error: string; details: { fieldErrors: Record<string, unknown[]> } }>(res.body);
  assert.equal(body.error, 'Invalid profile');
  assert.ok(Object.keys(body.details.fieldErrors).length > 0);
});

test('golden path §15.1 : profil → opportunités → preuves → HYBRID → capital à 0 → JOB', async () => {
  // 1. Profil démo
  const demo = await app.inject({ method: 'GET', url: '/api/demo/profile' });
  const normalize = await app.inject({
    method: 'POST',
    url: '/api/profile/normalize',
    payload: parse<Record<string, unknown>>(demo.body)
  });
  assert.equal(normalize.statusCode, 200);
  const { session_id: sid } = parse<{ session_id: string }>(normalize.body);

  // 2. Génération : snapshot JOB réel SN (76 offres SenJob) + 2 hypothèses BUSINESS
  const gen = await app.inject({ method: 'POST', url: '/api/opportunities/generate', payload: { session_id: sid } });
  assert.equal(gen.statusCode, 200);
  const { opportunities } = parse<{ opportunities: Opportunity[] }>(gen.body);
  assert.equal(opportunities.length, 78, '76 offres JOB réelles (snapshot SenJob) + 2 hypothèses BUSINESS');
  assert.equal(opportunities.filter((o) => o.type === 'JOB').length, 76);
  assert.equal(opportunities.filter((o) => o.type === 'BUSINESS').length, 2);
  for (const o of opportunities) {
    assert.ok(typeof o._scores?.total === 'number', `${o.id} doit être scoré`);
    assert.ok(['PASS', 'FAIL'].includes(o.hard_constraint_status));
  }
  const failIds = opportunities.filter((o) => o.hard_constraint_status === 'FAIL').map((o) => o.id);
  assert.ok(failIds.length > 0, 'des offres doivent échouer une contrainte dure');
  // FAIL stables (indépendants de la date d’exécution) : hors-zone Dakar + mobilité faible.
  for (const id of ['senjob-163743', 'senjob-163984', 'senjob-164016', 'senjob-164028']) {
    assert.ok(failIds.includes(id), `${id} hors-zone → FAIL (§15.A localisation)`);
  }
  // Chaque opportunité JOB cite son URL individuelle, jamais le listing générique.
  for (const o of opportunities.filter((x) => x.type === 'JOB')) {
    assert.ok(o.source_refs.length > 0 && o.source_refs[0].includes('/jobseekers/'), `${o.id} : URL individuelle requise`);
  }

  // 3. Preuves : Evidence Store officiel (11 OBSERVED + 2 DERIVED + 1 ESTIMATED)
  const ev = await app.inject({ method: 'POST', url: '/api/evidence/retrieve', payload: { session_id: sid } });
  assert.equal(ev.statusCode, 200);
  const { evidence } = parse<{ evidence: unknown[] }>(ev.body);
  assert.equal(evidence.length, 14);

  // 4. Évaluation : Devil + décision déterministe
  const evalRes = await app.inject({ method: 'POST', url: '/api/decision/evaluate', payload: { session_id: sid } });
  assert.equal(evalRes.statusCode, 200);
  const evaluated = parse<{ decision: Decision; devil_findings: unknown[]; opportunities: Opportunity[] }>(evalRes.body);
  assert.equal(evaluated.decision.decision, 'HYBRID');
  assert.equal(evaluated.decision.test_budget, 10000);
  assert.equal(evaluated.decision.preserved_capital, 290000);
  assert.ok(evaluated.devil_findings.length > 0, 'le Devil doit s’être prononcé');
  assert.ok(
    evaluated.opportunities.some((o) => o.status === 'REJECTED' && /Commerce général/.test(o.title)),
    'l’hypothèse "Commerce général" doit être REJECTED (§20)'
  );
  assert.ok(evaluated.decision.disclaimer.length > 0);
  assert.ok(evaluated.decision.ranking.length <= 3);

  // 5. Artefacts pour le jury (§16)
  const art = await app.inject({ method: 'GET', url: `/api/session/${sid}/artifacts` });
  assert.equal(art.statusCode, 200);
  const session = parse<SessionArtifacts>(art.body);
  for (const key of ['normalized_profile', 'opportunities', 'evidence', 'devil_findings', 'scores', 'decision']) {
    assert.ok(key in session, `artefact manquant : ${key}`);
  }
  assert.equal(session.opportunities.length, 78);
  assert.equal(Object.keys(session.scores).length, 78);

  // 6. Preuve live §16 : capital à risque = 0 → le business s’efface, JOB émerge
  const rec = await app.inject({
    method: 'POST',
    url: '/api/decision/recalculate',
    payload: { session_id: sid, patch: { capital_at_risk: 0 } }
  });
  assert.equal(rec.statusCode, 200);
  const recalculated = parse<{ decision: Decision; opportunities: Opportunity[] }>(rec.body);
  assert.equal(recalculated.decision.decision, 'JOB', 'HYBRID → JOB après capital_at_risk = 0');
  assert.equal(recalculated.decision.test_budget, 0);
  const business = recalculated.opportunities.filter((o) => o.type === 'BUSINESS');
  assert.ok(business.length === 2);
  for (const b of business) {
    assert.equal(b.hard_constraint_status, 'FAIL', `${b.id} doit devenir FAIL avec capital_at_risk = 0`);
  }
});

test('POST /api/decision/evaluate avant génération → 404 explicite', async () => {
  const normalize = await app.inject({
    method: 'POST',
    url: '/api/profile/normalize',
    payload: { education: 'Bac+2', location: 'Thiès', country_id: 'SN' }
  });
  const { session_id: sid } = parse<{ session_id: string }>(normalize.body);

  const res = await app.inject({ method: 'POST', url: '/api/decision/evaluate', payload: { session_id: sid } });
  assert.equal(res.statusCode, 404);
  assert.match(parse<{ error: string }>(res.body).error, /Générez d’abord/);
});

test('session inconnue → 404 sur generate / evaluate / recalculate / artifacts', async () => {
  const unknown = '00000000-0000-4000-8000-000000000000';
  for (const [url, payload] of [
    ['/api/opportunities/generate', { session_id: unknown }],
    ['/api/evidence/retrieve', { session_id: unknown }],
    ['/api/decision/evaluate', { session_id: unknown }],
    ['/api/decision/recalculate', { session_id: unknown, patch: {} }]
  ] as const) {
    const res = await app.inject({ method: 'POST', url, payload });
    assert.equal(res.statusCode, 404, `${url} doit renvoyer 404`);
  }
  const art = await app.inject({ method: 'GET', url: `/api/session/${unknown}/artifacts` });
  assert.equal(art.statusCode, 404);
});

test('body manquant → 400 sur les endpoints POST', async () => {
  for (const url of ['/api/opportunities/generate', '/api/evidence/retrieve', '/api/decision/evaluate']) {
    const res = await app.inject({ method: 'POST', url, payload: {} });
    assert.equal(res.statusCode, 400, `${url} doit renvoyer 400`);
  }
});

test('GET /api/sources/:id renvoie la source citée, 404 sinon (§12)', async () => {
  const ok = await app.inject({ method: 'GET', url: '/api/sources/ansd-ninea-t2-2026' });
  assert.equal(ok.statusCode, 200);
  const s = parse<Source>(ok.body);
  assert.equal(s.publisher, 'ANSD');
  assert.equal(s.license, 'CC BY 4.0 — Source: ANSD');

  const ko = await app.inject({ method: 'GET', url: '/api/sources/inconnue' });
  assert.equal(ko.statusCode, 404);
});
