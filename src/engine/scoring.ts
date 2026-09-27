// Scoring déterministe — §10. Le LLM n'intervient jamais ici.
// Évite la fausse précision : on expose Fit/Evidence/Risk en High/Medium/Low au front.
import { Opportunity, OpportunityDNA } from '../types';

function level(n: number): 'Low' | 'Medium' | 'High' {
  if (n >= 70) return 'High';
  if (n >= 45) return 'Medium';
  return 'Low';
}

function skillScore(oppSkills: string[], profile: OpportunityDNA): number {
  if (oppSkills.length === 0) return 50;
  const mine = new Set(profile.skills.map((s) => s.name.toLowerCase()));
  const hit = oppSkills.filter((s) => mine.has(s.toLowerCase())).length;
  return Math.round((hit / oppSkills.length) * 100);
}

export function scoreOpportunity(
  opp: Opportunity,
  profile: OpportunityDNA,
  jobMeta?: { skills: string[] },
  evidenceConfidencePct = 60,
  devilPenalty = 0
): Opportunity {
  const skills = jobMeta?.skills ?? [];
  const skill = opp.type === 'JOB' ? skillScore(skills, profile) : 60;

  // location
  let location = 70;
  if (opp.region && profile.location) {
    location =
      opp.region.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') ===
      profile.location.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        ? 85
        : profile.mobility === 'faible'
          ? 30
          : 60;
  }

  // capital : 100 si aucune exposition, dégressif sinon
  const exposure = opp.capital_at_risk_exposure || 0;
  const budget = Math.max(profile.capital_at_risk, 1);
  const capital = exposure <= 0 ? 100 : Math.max(0, Math.round(100 - (exposure / budget) * 100));

  // time-to-income : plus c'est rapide vs urgence, mieux c'est
  const urgency = Math.max(profile.income_urgency_days, 1);
  const time = Math.max(0, Math.round(100 - (opp.time_to_income_days / urgency) * 60));

  const evidence = Math.round(evidenceConfidencePct);

  // risk penalty selon réversibilité + risque affiché
  const riskPenalty =
    (opp.risk === 'High' ? 15 : opp.risk === 'Medium' ? 7 : 0) +
    (opp.reversibility === 'Low' ? 10 : opp.reversibility === 'Medium' ? 4 : 0);

  const total = Math.max(
    0,
    Math.round(skill * 0.3 + location * 0.15 + capital * 0.2 + time * 0.15 + evidence * 0.2 - riskPenalty - devilPenalty)
  );

  opp.skill_fit = level(skill);
  opp.location_fit = level(location);
  opp.evidence_confidence = level(evidence);
  opp._scores = { skill, location, capital, time, evidence, risk_penalty: riskPenalty, devil_penalty: devilPenalty, total };
  return opp;
}
