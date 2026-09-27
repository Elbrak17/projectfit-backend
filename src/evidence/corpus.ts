// Premier corpus snapshot normalisé — ingestion réelle des snapshots existants.
// Sources réellement intégrées (toutes publiques sénégalaises + 1 portail listing) :
//  - ANSD NINEA T2 2026 (ECON_STAT, NATIONAL)
//  - ANSD Enquête Emploi T1 2026 (ECON_STAT, NATIONAL)
//  - DER/FJ secteurs prioritaires (PROGRAM_INFO, NATIONAL)
//  - ANSD prix / IHPC 2026 (PRICE_COST, NATIONAL)
//  - EmploiJeunes / SenJob : 6 offres JOB_OFFER snapshot 2026-09-26 (Dakar/Thiès, LOCAL)
// Règle : une stat NATIONALE ne devient jamais une preuve LOCALE (geography_level conservé).
// Contradictions conservées (ex: commerce général porteur DER vs concurrence NINEA).
import type { CorpusDoc } from './corpusTypes';
import { JOBS_SNAPSHOT } from '../data/jobs.snapshot';
import { EVIDENCE_CORPUS, SOURCES } from '../data/evidence.corpus';

function jobToDoc(j: (typeof JOBS_SNAPSHOT)[number]): CorpusDoc {
  const skills = (j.skills ?? []).join(', ');
  return {
    doc_id: `job-${j.id}`,
    source_id: j.source === 'emploijeunes-snapshot' ? 'emploijeunes-snapshot' : 'senjob-snapshot',
    source_url: j.source_url,
    publisher: j.source === 'emploijeunes-snapshot' ? 'EmploiJeunes' : 'SenJob',
    observed_at: j.observed_at,
    published_at: j.published_at,
    expires_at: j.expires_at,
    country_id: j.country_id,
    region: j.region,
    geography_level: 'LOCAL',
    category: 'JOB_OFFER',
    title: `${j.title} — ${j.employer} (${j.locality})`,
    text:
      `Offre: ${j.title}. Employeur: ${j.employer}. Localité: ${j.locality} (${j.region}). ` +
      `Contrat: ${j.contract_type}. Publiée le ${j.published_at}, expire le ${j.expires_at}. ` +
      `Diplôme requis: ${j.education_required}. Expérience requise: ${j.experience_required_months} mois. ` +
      `Compétences: ${skills}. Missions: ${j.responsibilities}.`,
    evidence_type: 'OBSERVED',
    freshness: 'fresh',
    confidence: 80,
    education_required: j.education_required,
    experience_required_months: j.experience_required_months,
    skills: [...(j.skills ?? [])],
    locality: j.locality
  };
}

const ECON_CATEGORY: Record<string, CorpusDoc['category']> = {
  'ansd-emploi-t1-2026': 'ECON_STAT',
  'ansd-ninea-t2-2026': 'ECON_STAT',
  'der-secteurs-prio': 'PROGRAM_INFO',
  'ansd-prix-ihpc-2026': 'PRICE_COST'
};

export function buildCorpusDocs(): CorpusDoc[] {
  const jobDocs = JOBS_SNAPSHOT.map(jobToDoc);
  const sourceById = new Map(SOURCES.map((s) => [s.id, s]));
  const econDocs: CorpusDoc[] = EVIDENCE_CORPUS.map((e) => {
    const s = sourceById.get(e.source_id);
    return {
      doc_id: `econ-${e.source_id}`,
      source_id: e.source_id,
      source_url: e.source_url,
      publisher: e.publisher,
      observed_at: e.observed_at,
      published_at: undefined,
      country_id: s?.country_id ?? 'SN',
      region: undefined,
      geography_level: e.geography_level,
      category: ECON_CATEGORY[e.source_id] ?? 'ECON_STAT',
      title: s?.title ?? e.source_id,
      text: `${e.field_or_passage}. ${e.value}`,
      value: e.value,
      evidence_type: e.evidence_type,
      freshness: e.freshness,
      confidence: e.confidence
    };
  });
  return [...jobDocs, ...econDocs];
}

/** Snapshot figé à l'import (démo snapshot-first, aucune source live requise). */
export const CORPUS_DOCS: CorpusDoc[] = buildCorpusDocs();
