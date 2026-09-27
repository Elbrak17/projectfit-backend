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

  // 4. Localisation / mobilité — §15.A : « budget, localisation, diplôme, exclusions »
  //    sont des contraintes dures. Mobilité faible => offres hors région = FAIL.
  if (opp.type === 'JOB' && opp.region && profile.location && profile.mobility === 'faible') {
    const remote = /\bremote\b/i.test(opp.title);
    if (!remote && norm(opp.region) !== norm(profile.location)) {
      reasons.push(
        `Localisation incompatible : offre en ${opp.region}, profil à ${profile.location} avec mobilité faible.`
      );
    }
  }
  if (opp.country_id !== profile.country_id) {
    reasons.push(`Pays incompatible : opportunité ${opp.country_id} vs profil ${profile.country_id}.`);
  }

  // 5. Diplôme minimum (Bac+N comparé). Un profil explicitement sans diplôme
  //    ("Aucun diplôme", "Sans formation") est vérifié lui aussi ; un format
  //    inconnu ("Licence", "CAP") n'est pas comparé (évite les faux rejets).
  if (opp.type === 'JOB' && opp.education_required) {
    const need = bacLevel(opp.education_required);
    const have = bacLevel(profile.education);
    if (need !== null && need > 0 && have !== null && have < need) {
      reasons.push(`Diplôme insuffisant : requis ${opp.education_required}, profil ${profile.education}.`);
    }
  }

  return { pass: reasons.length === 0, reasons };
}

/** Bac+N si présent, 0 si le profil dit explicitement « sans diplôme », null si non comparable. */
export function bacLevel(education: string | undefined): number | null {
  if (!education) return null;
  const m = education.match(/Bac\+(\d)/i);
  if (m) return parseInt(m[1], 10);
  if (/\b(aucun|aucune|sans|pas de)\b[^.]{0,15}\b(dipl[oô]me|formation|diplome|étude|etude)\b/i.test(education)) {
    return 0;
  }
  return null;
}
