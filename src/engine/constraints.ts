// Contraintes dures — §10 étape 1 + §15.A. Priment sur tout score.
import { Opportunity, OpportunityDNA } from '../types';

export interface ConstraintCheck {
  pass: boolean;
  reasons: string[];
}

/** Normalise une chaîne pour comparaison insensible accents/casse */
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function checkHardConstraints(opp: Opportunity, profile: OpportunityDNA, now = new Date()): ConstraintCheck {
  const reasons: string[] = [];

  // 1. Expiration (JOB)
  if (opp.expires_at) {
    const exp = new Date(opp.expires_at);
    if (exp.getTime() < now.getTime()) {
      reasons.push(`Offre expirée (${opp.expires_at}) — exclusion automatique.`);
    }
  }

  // 2. Capital-at-risk : exposition > budget acceptable => FAIL (BUSINESS)
  if (opp.type === 'BUSINESS' && opp.capital_at_risk_exposure > profile.capital_at_risk) {
    reasons.push(
      `Capital exposé ${opp.capital_at_risk_exposure} FCFA > capital-à-risque accepté ${profile.capital_at_risk} FCFA.`
    );
  }

  // 3. Exclusions utilisateur (secteurs refusés) — match stem (ex: "restauration" ↔ "restaurant")
  for (const c of profile.constraints) {
    const nc = norm(c);
    if (!nc) continue;
    const stem = nc.slice(0, 6);
    const inTitle = norm(opp.title).includes(nc) || (stem.length >= 5 && norm(opp.title).includes(stem));
    if (inTitle) {
      reasons.push(`Exclusion utilisateur violée : "${c}" présent dans "${opp.title}".`);
    }
  }

  // 4. Localisation : mobilité faible => même région exigée (heuristique démo)
  if (profile.mobility === 'faible' && opp.region && profile.location) {
    if (norm(opp.region) !== norm(profile.location) && opp.type === 'JOB') {
      // pas un FAIL dur en démo, mais on le signale — le FAIL dur serait si pays différent
      // On garde PASS ici, le scoring pénalisera location_fit=Low.
    }
  }
  if (opp.country_id !== profile.country_id) {
    reasons.push(`Pays incompatible : opportunité ${opp.country_id} vs profil ${profile.country_id}.`);
  }

  // 5. Diplôme minimum (heuristique simple : Bac+N comparé)
  if (opp.type === 'JOB' && opp.education_required && profile.education) {
    const need = parseInt(opp.education_required.match(/Bac\+(\d)/)?.[1] ?? '0', 10);
    const have = parseInt(profile.education.match(/Bac\+(\d)/)?.[1] ?? '0', 10);
    if (need > 0 && have > 0 && have < need) {
      reasons.push(`Diplôme insuffisant : requis ${opp.education_required}, profil ${profile.education}.`);
    }
  }

  return { pass: reasons.length === 0, reasons };
}
