// Evidence Store BUSINESS — corpus officiel préchargé (§8 + §12), snapshot-first.
// Collecte réelle le 2026-09-27 (curl, pages publiques). observed_at = date de collecte.
// Règle stricte : OBSERVED = citation directly lue dans la source (field_or_passage +
// value reprennent la donnée source). DERIVED = conclusion ProjectFit avec derived_from.
// ESTIMATED = hypothèse ProjectFit explicitement marquée. UNKNOWN = absent (les unknowns
// vivent dans les opportunités/décisions, pas dans le corpus).
// Attribution §16 : extraits courts + URL + publisher ; pas de recopie au-delà du nécessaire.
import { Evidence, Source } from '../types';

export const SOURCES: Source[] = [
  {
    id: 'ansd-ninea-t2-2026',
    url: 'https://www.ansd.sn/Indicateur/bulletin-trimestriel-sur-les-nouvelles-immatriculations-au-ninea-btnin',
    publisher: 'ANSD',
    title: 'NINEA — nouvelles immatriculations T2 2026 (22 180, -9,3 % trim.). Mise en ligne 07 Aoû 2026.',
    country_id: 'SN',
    geography_level: 'NATIONAL',
    observed_at: '2026-09-27',
    license: 'CC BY 4.0 — Source: ANSD'
  },
  {
    id: 'ansd-emploi-t1-2026',
    url: 'https://www.ansd.sn/Indicateur/enquete-emploi',
    publisher: 'ANSD',
    title: 'Enquête Emploi T1 2026 — chômage élargi 22,9 %, jeunes 28,4 % vs adultes 16,8 %',
    country_id: 'SN',
    geography_level: 'NATIONAL',
    observed_at: '2026-09-27',
    license: 'CC BY 4.0 — Source: ANSD'
  },
  {
    id: 'ansd-population-2025',
    url: 'https://www.ansd.sn/Indicateur/donnees-de-population',
    publisher: 'ANSD',
    title: 'Données de population — page indicateur (projections, méthode, RGPH)',
    country_id: 'SN',
    geography_level: 'NATIONAL',
    observed_at: '2026-09-27',
    license: 'CC BY 4.0 — Source: ANSD'
  },
  {
    id: 'ansd-prix-ihpc-2026',
    url: 'https://www.ansd.sn/Indicateur/bulletin-mensuel-des-statistiques-economiques-et-financieres',
    publisher: 'ANSD',
    title: 'Bulletin mensuel des statistiques économiques et financières (NINEA, emploi formel, IHPC, commerce extérieur)',
    country_id: 'SN',
    geography_level: 'NATIONAL',
    observed_at: '2026-09-27',
    license: 'CC BY 4.0 — Source: ANSD'
  },
  {
    id: 'der-secteurs-prio',
    url: 'https://www.der.sn/devenez-entrepreneur/secteurs-prioritaires/',
    publisher: 'DER/FJ',
    title: 'DER/FJ — secteurs prioritaires + exclusion du commerce de produits importés',
    country_id: 'SN',
    geography_level: 'NATIONAL',
    observed_at: '2026-09-27',
    license: 'Public — Source: DER/FJ'
  },
  {
    id: 'emploijeunes-anpej',
    url: 'https://www.emploijeunes.sn/',
    publisher: 'ANPEJ',
    title: 'ANPEJ / EmploiJeunes — portail offres, orientation, porteurs de projet, formation',
    country_id: 'SN',
    geography_level: 'NATIONAL',
    observed_at: '2026-09-27',
    license: 'Public — Source: ANPEJ'
  },
  {
    id: 'senjob-listing',
    url: 'https://senjob.com/offres-d-emploi.php',
    publisher: 'SenJob',
    title: 'SenJob — listing des offres (388 en cours au 2026-09-27 ; pages 1-2 snapshottées en URLs individuelles)',
    country_id: 'SN',
    geography_level: 'NATIONAL',
    observed_at: '2026-09-27',
    license: 'Extrait court avec attribution — Source: SenJob'
  }
];

export interface CorpusEvidence extends Evidence {
  /** IDs d'entrées sources dont une conclusion DERIVED/ESTIMATED est tirée. Absent pour OBSERVED. */
  derived_from?: string[];
}

export const EVIDENCE_CORPUS: CorpusEvidence[] = [
  {
    source_id: 'ansd-ninea-t2-2026',
    source_url: 'https://www.ansd.sn/Indicateur/bulletin-trimestriel-sur-les-nouvelles-immatriculations-au-ninea-btnin',
    publisher: 'ANSD',
    observed_at: '2026-09-27',
    geography_level: 'NATIONAL',
    field_or_passage:
      '« Au deuxième trimestre 2026, le RNEA a enregistré 22 180 nouvelles immatriculations, en baisse de 9,3 % par rapport au trimestre précédent (24 449), en hausse de 12,7 % par rapport au T2 2025. »',
    value: '22 180 immatriculations T2 2026 ; -9,3 % trim. ; +12,7 % a/a.',
    evidence_type: 'OBSERVED',
    freshness: 'fresh',
    confidence: 90
  },
  {
    source_id: 'ansd-ninea-t2-2026',
    source_url: 'https://www.ansd.sn/Indicateur/bulletin-trimestriel-sur-les-nouvelles-immatriculations-au-ninea-btnin',
    publisher: 'ANSD',
    observed_at: '2026-09-27',
    geography_level: 'NATIONAL',
    field_or_passage:
      '« Entreprises individuelles 71,9 %, GIE 7,2 %, SARL 2,9 %, SUARL 2,2 % des nouvelles immatriculations. »',
    value: 'EI 71,9 % ; GIE 7,2 % ; SARL 2,9 % ; SUARL 2,2 % (T2 2026).',
    evidence_type: 'OBSERVED',
    freshness: 'fresh',
    confidence: 88
  },
  {
    source_id: 'ansd-ninea-t2-2026',
    source_url: 'https://www.ansd.sn/Indicateur/bulletin-trimestriel-sur-les-nouvelles-immatriculations-au-ninea-btnin',
    publisher: 'ANSD',
    observed_at: '2026-09-27',
    geography_level: 'NATIONAL',
    field_or_passage:
      '« Le RNEA constitue la base de données exhaustive des unités économiques enregistrées (identification, localisation, classification) ; référence pour l’analyse des statistiques d’entreprises. »',
    value: 'RNEA = base exhaustive des unités enregistrées (pas du secteur informel non enregistré).',
    evidence_type: 'OBSERVED',
    freshness: 'fresh',
    confidence: 80
  },
  {
    source_id: 'ansd-emploi-t1-2026',
    source_url: 'https://www.ansd.sn/Indicateur/enquete-emploi',
    publisher: 'ANSD',
    observed_at: '2026-09-27',
    geography_level: 'NATIONAL',
    field_or_passage:
      '« T1 2026 : taux de chômage (élargi) 22,9 %, en hausse de 1,2 pt vs T1 2025 (21,7 %) ; rural 32,0 % vs urbain 17,4 % ; jeunes 28,4 % vs adultes 16,8 %. Taux d’activité 56,5 % (+0,5 pt a/a). »',
    value: 'Chômage élargi 22,9 % ; jeunes 28,4 % ; rural 32,0 % ; activité 56,5 % (T1 2026).',
    evidence_type: 'OBSERVED',
    freshness: 'aging',
    confidence: 85
  },
  {
    source_id: 'der-secteurs-prio',
    source_url: 'https://www.der.sn/devenez-entrepreneur/secteurs-prioritaires/',
    publisher: 'DER/FJ',
    observed_at: '2026-09-27',
    geography_level: 'NATIONAL',
    field_or_passage:
      '« Secteurs DER/FJ : Agriculture, Elevage, Pêche, Artisanat, Tourisme, Industries culturelles, Infrastructures, Transports et Logistique, Energie, Economie numérique, Innovation, Services. »',
    value: 'Liste des 12 familles de secteurs accompagnés par la DER/FJ.',
    evidence_type: 'OBSERVED',
    freshness: 'fresh',
    confidence: 80
  },
  {
    source_id: 'der-secteurs-prio',
    source_url: 'https://www.der.sn/devenez-entrepreneur/secteurs-prioritaires/',
    publisher: 'DER/FJ',
    observed_at: '2026-09-27',
    geography_level: 'NATIONAL',
    field_or_passage:
      '« Le commerce de produits importés est exclu des activités accompagnées, conformément à la politique de valorisation des produits locaux. »',
    value: 'Exclusion explicite : commerce de produits importés hors accompagnement DER/FJ.',
    evidence_type: 'OBSERVED',
    freshness: 'fresh',
    confidence: 85
  },
  {
    source_id: 'der-secteurs-prio',
    source_url: 'https://www.der.sn/devenez-entrepreneur/secteurs-prioritaires/',
    publisher: 'DER/FJ',
    observed_at: '2026-09-27',
    geography_level: 'NATIONAL',
    field_or_passage:
      '« Accompagner au mieux nos entrepreneurs, start-up et micro, petites et moyennes entreprises en développant un accompagnement véritablement structurant. »',
    value: 'Mission DER/FJ : accompagnement structurant entrepreneurs / start-up / MPME.',
    evidence_type: 'OBSERVED',
    freshness: 'fresh',
    confidence: 70
  },
  {
    source_id: 'ansd-population-2025',
    source_url: 'https://www.ansd.sn/Indicateur/donnees-de-population',
    publisher: 'ANSD',
    observed_at: '2026-09-27',
    geography_level: 'NATIONAL',
    field_or_passage:
      '« Page consultée le 2026-09-27 : projections par milieu de résidence, fécondité, espérance de vie, mortalité (table Coale & Demeny Nord), solde migratoire, urbanisation. Aucun chiffre de population recopié dans ce snapshot. »',
    value: 'Méthode et disponibilité des projections (chiffres détaillés : voir rapports SES/RGPH).',
    evidence_type: 'OBSERVED',
    freshness: 'aging',
    confidence: 60
  },
  {
    source_id: 'ansd-prix-ihpc-2026',
    source_url: 'https://www.ansd.sn/Indicateur/bulletin-mensuel-des-statistiques-economiques-et-financieres',
    publisher: 'ANSD',
    observed_at: '2026-09-27',
    geography_level: 'NATIONAL',
    field_or_passage:
      '« Le bulletin mensuel couvre : entreprises nouvellement immatriculées (NINEA), emploi formel, IHPC, commerce extérieur, statistiques financières et monétaires. Page consultée le 2026-09-27 ; aucune valeur IHPC recopiée dans ce snapshot. »',
    value: 'Couverture du bulletin (valeurs détaillées : voir bulletins PDF/XLSX ANSD).',
    evidence_type: 'OBSERVED',
    freshness: 'fresh',
    confidence: 60
  },
  {
    source_id: 'emploijeunes-anpej',
    source_url: 'https://www.emploijeunes.sn/',
    publisher: 'ANPEJ',
    observed_at: '2026-09-27',
    geography_level: 'NATIONAL',
    field_or_passage:
      '« Portail ANPEJ : offres d’emploi récentes, orientation des demandeurs, porteurs de projet, formation, services aux entreprises (recrutement, publication d’offres). Page d’accueil consultée le 2026-09-27 (contenu dynamique, offres non figées ici). »',
    value: 'Services ANPEJ/EmploiJeunes : offres, orientation, projet, formation, recrutement.',
    evidence_type: 'OBSERVED',
    freshness: 'fresh',
    confidence: 65
  },
  {
    source_id: 'senjob-listing',
    source_url: 'https://senjob.com/offres-d-emploi.php',
    publisher: 'SenJob',
    observed_at: '2026-09-27',
    geography_level: 'NATIONAL',
    field_or_passage:
      '« Listing SenJob consulté le 2026-09-27 : 388 offres en cours ; snapshot réel = pages 1-2, soit 76 offres à URL individuelle (réfs 163520-164028), chacune avec publication, expiration et page détail. »',
    value: 'Couverture du snapshot JOB : 76/388 offres, refs 163520-164028.',
    evidence_type: 'OBSERVED',
    freshness: 'fresh',
    confidence: 95
  },
  {
    source_id: 'ansd-ninea-t2-2026',
    source_url: 'https://www.ansd.sn/Indicateur/bulletin-trimestriel-sur-les-nouvelles-immatriculations-au-ninea-btnin',
    publisher: 'ANSD',
    observed_at: '2026-09-27',
    geography_level: 'NATIONAL',
    field_or_passage:
      'DERIVED (ProjectFit) des passages NINEA + exclusion DER : créations dominées par les entreprises individuelles (71,9 %) et commerce de produits importés exclu de l’accompagnement DER/FJ → un commerce général avec stock se lance dans une densité élevée sans différenciation ni filet DER.',
    value: 'Conclusion : concurrence élevée + hors accompagnement DER pour le commerce général importé.',
    evidence_type: 'DERIVED',
    freshness: 'fresh',
    confidence: 72,
    derived_from: ['ansd-ninea-t2-2026', 'der-secteurs-prio']
  },
  {
    source_id: 'ansd-emploi-t1-2026',
    source_url: 'https://www.ansd.sn/Indicateur/enquete-emploi',
    publisher: 'ANSD',
    observed_at: '2026-09-27',
    geography_level: 'NATIONAL',
    field_or_passage:
      'DERIVED (ProjectFit) du T1 2026 : chômage jeunes 28,4 % contre 16,8 % adultes → à capital contraint, la voie salariée (JOB) ou la montée en compétence (LEARN_FIRST) rapides priment sur un test business capitalisé.',
    value: 'Conclusion : priorité JOB / LEARN_FIRST rapides pour les jeunes à petit capital.',
    evidence_type: 'DERIVED',
    freshness: 'aging',
    confidence: 78,
    derived_from: ['ansd-emploi-t1-2026']
  },
  {
    source_id: 'der-secteurs-prio',
    source_url: 'https://www.der.sn/devenez-entrepreneur/secteurs-prioritaires/',
    publisher: 'DER/FJ',
    observed_at: '2026-09-27',
    geography_level: 'NATIONAL',
    field_or_passage:
      'ESTIMATED (ProjectFit, hypothèse à valider terrain) : micro-test de service B2B mobile ~10 000 FCFA (transport + data + impressions). Ce montant ne figure dans aucune source : c’est un plafond de test, pas un coût observé.',
    value: 'Plafond de micro-test : ~10 000 FCFA (hypothèse ProjectFit).',
    evidence_type: 'ESTIMATED',
    freshness: 'fresh',
    confidence: 50,
    derived_from: ['der-secteurs-prio']
  }
];
