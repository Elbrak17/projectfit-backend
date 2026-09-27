import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getSession, saveSession } from '../store/memory';
import { devilReview } from '../engine/devil';
import { decide } from '../engine/decision';
import { scoreOpportunity } from '../engine/scoring';
import { JOBS_SNAPSHOT } from '../data/jobs.snapshot';
import { SOURCES } from '../data/evidence.corpus';

export async function decisionRoutes(app: FastifyInstance) {
  // POST /api/decision/evaluate — pipeline complet §10 : devil + rescoring + décision
  app.post('/api/decision/evaluate', async (req, reply) => {
    const body = z.object({ session_id: z.string() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'session_id requis' });
    const session = getSession(body.data.session_id);
    if (!session || !session.normalized_profile || session.opportunities.length === 0) {
      return reply.code(404).send({ error: 'Générez d’abord profil + opportunités.' });
    }
    const profile = session.normalized_profile;

    // 1er scoring déjà fait ; Devil sur finalistes
    const findings = devilReview(session.opportunities);
    session.devil_findings = findings;
    const penalties = new Map(findings.map((f) => [f.opportunity_id, f.penalty]));

    // rescoring avec penalty + application statut Devil
    for (const opp of session.opportunities) {
      const pen = penalties.get(opp.id) ?? 0;
      const jobMeta = JOBS_SNAPSHOT.find((j) => j.id === opp.id);
      const evDefault = opp.type === 'JOB' ? 85 : opp.title.includes('B2B') ? 68 : 45;
      scoreOpportunity(opp, profile, { skills: jobMeta?.skills ?? [] }, evDefault, pen);
      const f = findings.find((x) => x.opportunity_id === opp.id);
      if (f?.suggested_status === 'REJECTED') {
        opp.status = 'REJECTED';
        opp.status_reason = [...f.risks, ...f.counter_evidence].join(' ');
      } else if (f?.suggested_status === 'INVESTIGATE') {
        opp.status = 'INVESTIGATE';
        opp.status_reason = f.risks.join(' ');
      }
    }

    const decision = decide(session.opportunities, profile, penalties);
    session.decision = decision;
    session.scores = Object.fromEntries(session.opportunities.map((o) => [o.id, o._scores?.total ?? 0]));
    saveSession(session);

    return { session_id: session.session_id, devil_findings: findings, decision, opportunities: session.opportunities };
  });

  // POST /api/decision/recalculate — preuve live §16 : change une contrainte, recalcule (ex: capital_at_risk=0)
  app.post('/api/decision/recalculate', async (req, reply) => {
    const body = z
      .object({ session_id: z.string(), patch: z.record(z.string(), z.any()).default({}) })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'session_id + patch requis' });
    const session = getSession(body.data.session_id);
    if (!session || !session.normalized_profile) return reply.code(404).send({ error: 'Session/profil inconnu' });

    Object.assign(session.normalized_profile, body.data.patch);
    const profile = session.normalized_profile;

    // re-contraintes + rescoring simple (sans régénérer les hypothèses)
    const { checkHardConstraints } = await import('../engine/constraints');
    for (const opp of session.opportunities) {
      const c = checkHardConstraints(opp, profile);
      opp.hard_constraint_status = c.pass ? 'PASS' : 'FAIL';
      opp.hard_constraint_reasons = c.reasons;
      if (c.pass && opp.status === 'REJECTED' && opp.capital_at_risk_exposure <= profile.capital_at_risk) {
        // on garde le REJECT Devil (adversarial stable) sauf si c'était un FAIL capital
      }
      const jobMeta = JOBS_SNAPSHOT.find((j) => j.id === opp.id);
      const evDefault = opp.type === 'JOB' ? 85 : opp.title.includes('B2B') ? 68 : 45;
      const pen = session.devil_findings.find((f) => f.opportunity_id === opp.id)?.penalty ?? 0;
      scoreOpportunity(opp, profile, { skills: jobMeta?.skills ?? [] }, evDefault, pen);
    }
    const decision = decide(session.opportunities, profile);
    session.decision = decision;
    saveSession(session);
    return { session_id: session.session_id, profile, decision, opportunities: session.opportunities };
  });

  // GET /api/sources/:id + GET /api/session/:id/artifacts — §11.1
  app.get('/api/sources/:id', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const s = SOURCES.find((x) => x.id === id);
    if (!s) return reply.code(404).send({ error: 'Source inconnue' });
    return s;
  });

  app.get('/api/session/:id/artifacts', async (req, reply) => {
    const session = getSession((req.params as { id: string }).id);
    if (!session) return reply.code(404).send({ error: 'Session inconnue' });
    return session;
  });
}
