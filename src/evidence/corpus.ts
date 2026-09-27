// Corpus snapshot normalisé — ingestion réelle des snapshots locaux (aucune source live).
// - JOB (76 offres SenJob, URLs individuelles) : champs OBSERVED recopiés tels quels ;
//   skills = DERIVED (index par mot-clé documenté dans jobs.snapshot.ts) ;
//   education_required / experience_required_months / contract_type = OBSERVED si la page
//   les énonce, sinon UNKNOWN (champ absent, jamais 0 ni inventé) ;
//   employer systématiquement UNKNOWN (aucun champ employeur sur les pages SenJob).
// - BUSINESS (Evidence Store officiel) : OBSERVED = citation source ; DERIVED/ESTIMATED =
//   conclusions ProjectFit avec derived_from ; passage brut et conclusion jamais mélangés.
// Règle : une stat NATIONALE ne devient jamais une preuve LOCALE (geography_level conservé).
// Contradictions conservées (ex: commerce général hors accompagnement DER vs densité NINEA).
import type { CorpusDoc } from './corpusTypes';
import { JOBS_SNAPSHOT } from '../data/jobs.snapshot';
import { EVIDENCE_CORPUS, SOURCES } from '../data/evidence.corpus';

function jobToDoc(j: (typeof JOBS_SNAPSHOT)[number]): CorpusDoc {
  const hasEdu = typeof j.education_required === 'string' && j.education_required.length > 0;
  const hasExp = typeof j.experience_required_months === 'number';
  const hasContract = typeof j.contract_type === 'string' && j.contract_type.length > 0;
  const lines = [
    `Offre: ${j.title}. Référence SenJob ${j.reference}. Localité: ${j.locality} (${j.region}).`,
    `Publiée le ${j.published_at}, expire le ${j.expires_at}.`,
    `Diplôme requis: ${j.education_required ?? 'UNKNOWN — non publié sur la page source'}.`,
    `Expérience requise: ${hasExp ? `${j.experience_required_months} mois` : 'UNKNOWN — non quantifiée sur la page source'}.`,
    `Contrat: ${j.contract_type ?? 'UNKNOWN — non publié sur la page source'}.`,
    `Compétences (index DERIVED par mot-clé): ${(j.skills ?? []).join(', ') || 'aucune'}.`,
    `Missions (extrait OBSERVED): ${j.responsibilities}`
  ];
  return {
    doc_id: `job-${j.id}`,
    source_id: 'senjob-listing',
    source_url: j.source_url,
    publisher: 'SenJob',
    observed_at: j.observed_at,
    published_at: j.published_at,
    expires_at: j.expires_at,
    country_id: j.country_id,
    region: j.region,
    geography_level: 'LOCAL',
    category: 'JOB_OFFER',
    title: `${j.title} (${j.locality})`,
    text: lines.join(' '),
    evidence_type: 'OBSERVED',
    freshness: 'fresh',
    confidence: 90,
    field_provenance: {
      title: 'OBSERVED',
      locality: 'OBSERVED',
      published_at: 'OBSERVED',
      expires_at: 'OBSERVED',
      reference: 'OBSERVED',
      responsibilities: 'OBSERVED',
      contract_type: hasContract ? 'OBSERVED' : 'UNKNOWN',
      skills: 'DERIVED',
      education_required: hasEdu ? 'OBSERVED' : 'UNKNOWN',
      experience_required_months: hasExp ? 'OBSERVED' : 'UNKNOWN',
      employer: 'UNKNOWN'
    },
    education_required: j.education_required,
    experience_required_months: j.experience_required_months,
    skills: [...(j.skills ?? [])],
    locality: j.locality
  };
}

const ECON_CATEGORY: Record<string, CorpusDoc['category']> = {
  'ansd-emploi-t1-2026': 'ECON_STAT',
  'ansd-ninea-t2-2026': 'ECON_STAT',
  'ansd-population-2025': 'ECON_STAT',
  'ansd-prix-ihpc-2026': 'PRICE_COST',
  'der-secteurs-prio': 'PROGRAM_INFO',
  'emploijeunes-anpej': 'PROGRAM_INFO',
  'senjob-listing': 'PROGRAM_INFO'
};

export function buildCorpusDocs(): CorpusDoc[] {
  const jobDocs = JOBS_SNAPSHOT.map(jobToDoc);
  const sourceById = new Map(SOURCES.map((s) => [s.id, s]));
  const econDocs: CorpusDoc[] = EVIDENCE_CORPUS.map((e, i) => {
    const s = sourceById.get(e.source_id);
    const isObserved = e.evidence_type === 'OBSERVED';
    return {
      doc_id: `econ-${e.source_id}-${i}`,
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
      // Passage brut conservé tel quel ; la conclusion vit dans `value` + evidence_type.
      text: `${e.field_or_passage} ${e.value}`,
      value: e.value,
      evidence_type: e.evidence_type,
      freshness: e.freshness,
      confidence: e.confidence,
      derived_from: (e as { derived_from?: string[] }).derived_from,
      field_provenance: isObserved
        ? { field_or_passage: 'OBSERVED', value: 'OBSERVED' }
        : { field_or_passage: e.evidence_type, value: e.evidence_type }
    };
  });
  return [...jobDocs, ...econDocs];
}

/** Snapshot figé à l'import (démo snapshot-first, aucune source live requise). */
export const CORPUS_DOCS: CorpusDoc[] = buildCorpusDocs();
