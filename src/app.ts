import Fastify from 'fastify';
import cors from '@fastify/cors';
import { profileRoutes } from './routes/profile';
import { opportunityRoutes } from './routes/opportunities';
import { evidenceRoutes } from './routes/evidence';
import { decisionRoutes } from './routes/decision';

export interface BuildAppOptions {
  /** Defaults to true; tests inject `false` to keep the runner output readable. */
  logger?: boolean;
}

export function buildApp(opts: BuildAppOptions = {}) {
  const app = Fastify({ logger: opts.logger ?? true });

  app.register(cors, { origin: true });

  app.get('/health', async () => ({
    ok: true,
    service: 'projectfit-backend',
    version: '0.1.0',
    snapshot: true,
    kill_switches: {
      ENABLE_HYBRID: process.env.ENABLE_HYBRID ?? 'true',
      ENABLE_DEVIL: process.env.ENABLE_DEVIL ?? 'true'
    }
  }));

  // Golden-path demo : profil démo §3 (23-24 ans, Dakar, 300k FCFA)
  app.get('/api/demo/profile', async () => ({
    education: 'Bac+3 marketing',
    location: 'Dakar',
    country_id: 'SN',
    skills: ['marketing', 'excel', 'canva'],
    experience: [{ role: 'stagiaire marketing', duration_months: 6, tasks: ['reporting', 'réseaux sociaux'] }],
    available_capital: 300000,
    capital_at_risk: 20000,
    income_urgency_days: 60,
    income_urgency: '<60 jours',
    mobility: 'faible',
    languages: ['Français', 'Wolof'],
    assets: ['smartphone', 'laptop'],
    constraints: ['restauration'],
    risk_tolerance: 'faible'
  }));

  app.register(profileRoutes);
  app.register(opportunityRoutes);
  app.register(evidenceRoutes);
  app.register(decisionRoutes);

  return app;
}
