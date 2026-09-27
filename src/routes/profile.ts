import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getOrCreate, saveSession } from '../store/memory';
import { OpportunityDNA } from '../types';

const Skill = z.object({ name: z.string(), level: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate') });

const ProfileInput = z.object({
  session_id: z.string().optional(),
  skills: z.array(z.union([z.string(), Skill])).default([]),
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

export async function profileRoutes(app: FastifyInstance) {
  // POST /api/profile/normalize — §11.1. Pseudonymise : ignore nom/photo/contacts si envoyés.
  app.post('/api/profile/normalize', async (req, reply) => {
    const parsed = ProfileInput.safeParse((req.body as object) ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid profile', details: parsed.error.flatten() });
    const p = parsed.data;

    const skills = p.skills.map((s) => (typeof s === 'string' ? { name: s, level: 'intermediate' as const } : s));

    const dna: OpportunityDNA = {
      skills,
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

    const session = getOrCreate(p.session_id);
    session.profile_raw = req.body;
    session.normalized_profile = dna;
    saveSession(session);

    return {
      session_id: session.session_id,
      opportunity_dna: dna,
      note: 'Profil fonctionnel uniquement — identité (nom/photo/contacts) ignorée par design (§16).'
    };
  });
}
