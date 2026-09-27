// Petit corpus evidence BUSINESS — sources ANSD / DER-FJ (attribution CC BY 4.0, §9 + §12).
// Pas de scraping live dans le golden path : snapshot local uniquement.
import { Evidence, Source } from '../types';

export const SOURCES: Source[] = [
  {
    id: 'ansd-ninea-t2-2026',
    url: 'https://www.ansd.sn/Indicateur/bulletin-trimestriel-sur-les-nouvelles-immatriculations-au-ninea-btnin',
    publisher: 'ANSD',
    title: 'NINEA — nouvelles immatriculations T2 2026',
    country_id: 'SN',
    geography_level: 'NATIONAL',
    observed_at: '2026-09-01',
    license: 'CC BY 4.0 — Source: ANSD'
  },
  {
    id: 'ansd-emploi-t1-2026',
    url: 'https://www.ansd.sn/Indicateur/enquete-emploi',
    publisher: 'ANSD',
    title: 'Enquête Emploi T1 2026 — chômage élargi jeunes 28,4 % (15-34 ans)',
    country_id: 'SN',
    geography_level: 'NATIONAL',
    observed_at: '2026-06-15',
    license: 'CC BY 4.0 — Source: ANSD'
  },
  {
    id: 'der-secteurs-prio',
    url: 'https://www.der.sn/devenez-entrepreneur/secteurs-prioritaires/',
    publisher: 'DER/FJ',
    title: 'DER/FJ — secteurs prioritaires & programmes (BE YES)',
    country_id: 'SN',
    geography_level: 'NATIONAL',
    observed_at: '2026-09-10',
    license: 'Public — Source: DER/FJ'
  },
  {
    id: 'ansd-prix-ihpc-2026',
    url: 'https://www.ansd.sn/Indicateur/bulletin-mensuel-des-statistiques-economiques-et-financieres',
    publisher: 'ANSD',
    title: 'Bulletin prix / IHPC 2026',
    country_id: 'SN',
    geography_level: 'NATIONAL',
    observed_at: '2026-08-20',
    license: 'CC BY 4.0 — Source: ANSD'
  }
];

export const EVIDENCE_CORPUS: Evidence[] = [
  {
    source_id: 'ansd-emploi-t1-2026',
    source_url: 'https://www.ansd.sn/Indicateur/enquete-emploi',
    publisher: 'ANSD',
    observed_at: '2026-06-15',
    geography_level: 'NATIONAL',
    field_or_passage: 'chômage élargi 15-34 ans = 28,4 % vs 16,8 % adultes',
    value: 'Les jeunes restent plus exposés aux difficultés d’insertion — contexte favorable à JOB / LEARN_FIRST rapides.',
    evidence_type: 'OBSERVED',
    freshness: 'aging',
    confidence: 85
  },
  {
    source_id: 'ansd-ninea-t2-2026',
    source_url: 'https://www.ansd.sn/Indicateur/bulletin-trimestriel-sur-les-nouvelles-immatriculations-au-ninea-btnin',
    publisher: 'ANSD',
    observed_at: '2026-09-01',
    geography_level: 'NATIONAL',
    field_or_passage: 'créations commerce général élevées, concentration sectorielle forte',
    value: 'Commerce général : forte densité de créations → concurrence élevée, faible différenciation sans local/stock.',
    evidence_type: 'DERIVED',
    freshness: 'fresh',
    confidence: 72
  },
  {
    source_id: 'der-secteurs-prio',
    source_url: 'https://www.der.sn/devenez-entrepreneur/secteurs-prioritaires/',
    publisher: 'DER/FJ',
    observed_at: '2026-09-10',
    geography_level: 'NATIONAL',
    field_or_passage: 'services numériques / B2B légers compatibles petits tickets',
    value: 'Services B2B mobiles (saisie, reporting Excel, community management) testables avec < 20 000 FCFA.',
    evidence_type: 'OBSERVED',
    freshness: 'fresh',
    confidence: 68
  },
  {
    source_id: 'ansd-prix-ihpc-2026',
    source_url: 'https://www.ansd.sn/Indicateur/bulletin-mensuel-des-statistiques-economiques-et-financieres',
    publisher: 'ANSD',
    observed_at: '2026-08-20',
    geography_level: 'NATIONAL',
    field_or_passage: 'prix / coûts logistiques et loyers Dakar élevés',
    value: 'Activités nécessitant stock + local à Dakar = capital de démarrage sous-estimé si < 150 000 FCFA.',
    evidence_type: 'ESTIMATED',
    freshness: 'aging',
    confidence: 60
  }
];
