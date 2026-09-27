// The Devil — revue adversariale §9. Ne rejette jamais directement :
// produit risques + contre-preuves + penalty réinjectés dans le moteur déterministe.
import { DevilFinding, Opportunity } from '../types';

export const ENABLE_DEVIL = process.env.ENABLE_DEVIL !== 'false';

export function devilReview(opps: Opportunity[]): DevilFinding[] {
  if (!ENABLE_DEVIL) return [];
  // Devil sur 1-2 finalistes + meilleur BUSINESS fragile (récit démo §20 : une carte PROMISING → REJECTED).
  // Sans ça, une hypothèse BUSINESS à faible score ne serait jamais attaquée visiblement.
  const viable = [...opps].filter((o) => o.hard_constraint_status === 'PASS');
  const byScore = [...viable].sort((a, b) => (b._scores?.total ?? 0) - (a._scores?.total ?? 0));
  const finalists = byScore.slice(0, 2);
  // Garantie démo §20 : toutes les hypothèses BUSINESS sont revues (max 2-3),
  // sinon l'hypothèse fragile "Commerce général" ne serait jamais attaquée visiblement.
  for (const o of byScore) {
    if (o.type === 'BUSINESS' && !finalists.includes(o) && finalists.length < 4) finalists.push(o);
  }

  const findings: DevilFinding[] = [];
  for (const o of finalists) {
    const risks: string[] = [];
    const fragile: string[] = [];
    const counter: string[] = [];
    const missing: string[] = [];
    let penalty = 0;

    if (o.type === 'BUSINESS' && /commerce général/i.test(o.title)) {
      risks.push('Concentration sectorielle élevée (NINEA) : concurrence forte, différenciation faible.');
      counter.push('ANSD NINEA T2 2026 : créations commerce général élevées.');
      fragile.push('Hypothèse "je vends vite sans local" non prouvée.');
      missing.push('USER_VALIDATION_REQUIRED : interroger 5 prospects + relever 3 prix concurrents.');
      penalty += 25;
    }
    if ((o.capital_at_risk_exposure || 0) > 0 && o.reversibility === 'Low') {
      risks.push('Irréversibilité : stock/local engagé, revente incertaine.');
      penalty += 10;
    }
    if (o.evidence_confidence === 'Low') {
      fragile.push('Evidence confidence Low : extrapolation abusive interdite.');
      missing.push('FIELD VALIDATION REQUIRED avant tout spend.');
      penalty += 12;
    }
    if (o.type === 'JOB' && o.time_to_income_days > 45) {
      risks.push('Time-to-income long vs urgence < 60 jours : risque de tunnel sans revenu.');
      penalty += 5;
    }
    findings.push({
      opportunity_id: o.id,
      risks,
      fragile_assumptions: fragile,
      counter_evidence: counter,
      missing_evidence: missing,
      penalty,
      suggested_status: penalty >= 20 ? 'REJECTED' : penalty >= 10 ? 'INVESTIGATE' : undefined
    });
  }
  return findings;
}
