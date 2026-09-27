import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getOrCreate, saveSession, getSession } from '../store/memory';
import { buildJobOpportunities, buildBusinessHypotheses } from '../engine/opportunities';
import { checkHardConstraints } from '../engine/constraints';
import { scoreOpportunity } from '../engine/scoring';
import { EVIDENCE_CORPUS } from '../data/evidence.corpus';

export async function opportunityRoutes(app: FastifyInstance) {
  // POST /api/opportunities/generate — jobs snapshot + 2 hypothèses business
  app.post('/api/opportunities/generate', async (req, reply) => {
    const body = z.object({ session_id: z.string() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'session_id requis' });
    const session = getSession(body.data.session_id);
    if (!session || !session.normalized_profile) return reply.code(404).send({ error: 'Profil non normalisé. Appelez /api/profile/normalize d’abord.' });
    const profile = session.normalized_profile;

    const jobs = buildJobOpportunities(profile);
    const biz = buildBusinessHypotheses(profile);

    const all = [
      ...jobs.map(({ opp, skills }) => {
        const c = checkHardConstraints(opp, profile);
        opp.hard_constraint_status = c.pass ? 'PASS' : 'FAIL';
        opp.hard_constraint_reasons = c.reasons;
        return { opp, skills };
      }),
      ...biz.map((opp) => {
        const c = checkHardConstraints(opp, profile);
        opp.hard_constraint_status = c.pass ? 'PASS' : 'FAIL';
        opp.hard_constraint_reasons = c.reasons;
        return { opp, skills: [] as string[] };
      })
    ];

    // scoring initial (evidence default 60, devil appliqué plus tard)
    for (const { opp, skills } of all) {
      const evDefault = opp.type === 'JOB' ? 85 : opp.title.includes('B2B') ? 68 : 45;
      scoreOpportunity(opp, profile, { skills }, evDefault, 0);
    }

    session.opportunities = all.map((a) => a.opp);
    session.evidence = [...EVIDENCE_CORPUS];
    saveSession(session);

    return { session_id: session.session_id, opportunities: session.opportunities };
  });

  // POST /api/evidence/retrieve — rattache preuves (snapshot local, §8)
  app.post('/api/evidence/retrieve', async (req, reply) => {
    const body = z.object({ session_id: z.string() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'session_id requis' });
    const session = getSession(body.data.session_id);
    if (!session) return reply.code(404).send({ error: 'Session inconnue' });
    session.evidence = [...EVIDENCE_CORPUS];
    saveSession(session);
    return { session_id: session.session_id, evidence: session.evidence };
  });
}
