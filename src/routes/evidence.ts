// POST /api/evidence/analyze — endpoint stable pour l'équipe front.
// Body accepté : { session_id? , opportunity_id? , opportunity_title? , top_k? , top_n? , profile? }
// - session_id : utilise le profil normalisé en session (+ titre opportunité via opportunity_id si présent).
// - profile : profil inline (même schéma que /api/profile/normalize, sans session).
// Réponse : retrieved/reranked/sources/supporting/contradictions/unknowns/confidence/analyse.
// Ne modifie jamais la décision : lecture seule (+ session.evidence rafraîchi si session_id).
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getSession, saveSession } from '../store/memory';
import { runEvidencePipeline } from '../evidence/pipeline';
import type { OpportunityDNA } from '../types';

const InlineProfile = z.object({
  skills: z.array(z.union([z.string(), z.object({ name: z.string(), level: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate') })])).default([]),
  experience: z.array(z.object({ role: z.string(), duration_months: z.number().default(0), tasks: z.array(z.string()).default([]) })).default([]),
  education: z.string().default('Bac+3 marketing'),
  location: z.string().default('Dakar'),
  mobility: z.enum(['faible', 'moyenne', 'forte']).default('faible'),
  languages: z.array(z.string()).default(['Français']),
  assets: z.array(z.string()).default(['smartphone']),
  available_capital: z.number().default(300000),
  capital_at_risk: z.number().default(20000),
  available_time: z.string().default('temps plein'),
  income_urgency: z.string().default('<60 jours'),
  income_urgency_days: z.number().default(60),
  interests: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  risk_tolerance: z.enum(['faible', 'moyenne', 'forte']).default('faible'),
  country_id: z.string().default('SN'),
  region_id: z.string().optional()
});

const Body = z.object({
  session_id: z.string().optional(),
  opportunity_id: z.string().optional(),
  opportunity_title: z.string().optional(),
  top_k: z.number().int().min(1).max(20).optional(),
  top_n: z.number().int().min(1).max(10).optional(),
  profile: InlineProfile.optional()
});

function toDNA(p: z.infer<typeof InlineProfile>): OpportunityDNA {
  return {
    skills: p.skills.map((s) => (typeof s === 'string' ? { name: s, level: 'intermediate' as const } : s)),
    experience: p.experience,
    education: p.education,
    location: p.location,
    mobility: p.mobility,
    languages: p.languages,
    assets: p.assets,
    available_capital: p.available_capital,
    capital_at_risk: Math.min(p.capital_at_risk, p.available_capital),
    available_time: p.available_time,
    income_urgency: p.income_urgency,
    income_urgency_days: p.income_urgency_days,
    interests: p.interests,
    constraints: p.constraints,
    risk_tolerance: p.risk_tolerance,
    country_id: p.country_id,
    region_id: p.region_id
  };
}

export async function evidenceRoutes(app: FastifyInstance) {
  app.post('/api/evidence/analyze', async (req, reply) => {
    const parsed = Body.safeParse((req.body as object) ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'Body invalide', details: parsed.error.flatten() });
    const b = parsed.data;

    let profile: OpportunityDNA | null = null;
    let opportunityTitle: string | undefined = b.opportunity_title;
    const session = b.session_id ? getSession(b.session_id) : undefined;
    if (b.session_id && !session) return reply.code(404).send({ error: 'Session inconnue' });
    if (session?.normalized_profile) {
      profile = session.normalized_profile;
      if (b.opportunity_id && !opportunityTitle) {
        opportunityTitle = session.opportunities.find((o) => o.id === b.opportunity_id)?.title;
      }
    } else if (b.profile) {
      profile = toDNA(b.profile);
    } else {
      return reply.code(400).send({ error: 'Fournissez session_id (profil normalisé) ou profile inline.' });
    }

    const result = await runEvidencePipeline(profile!, opportunityTitle, { topK: b.top_k ?? 18, topN: b.top_n ?? 5 });

    if (session) {
      session.evidence = result.reranked.map((r) => ({
        source_id: r.source_id,
        source_url: r.source_url,
        publisher: r.publisher,
        observed_at: new Date().toISOString().slice(0, 10),
        geography_level: r.geography_level as 'LOCAL' | 'REGIONAL' | 'NATIONAL',
        field_or_passage: r.text,
        value: r.text,
        evidence_type: 'OBSERVED' as const,
        freshness: 'fresh' as const,
        confidence: result.evidence_confidence
      }));
      saveSession(session);
    }

    return { session_id: b.session_id ?? null, ...result };
  });
}
