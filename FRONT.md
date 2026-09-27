# ProjectFit — Contrat Front (Fastify backend)

Base: `http://localhost:3001` (PORT env, défaut 3001). CORS ouvert.

## Flow golden path (obligatoire démo 90s)

1. `GET /api/demo/profile` → profil pré-rempli Dakar 300k FCFA
2. `POST /api/profile/normalize` body=profil → `{ session_id, opportunity_dna }`
3. `POST /api/opportunities/generate` `{ session_id }` → `{ opportunities[8] }` (6 jobs snapshot + 2 business)
4. `POST /api/decision/evaluate` `{ session_id }` → `{ decision, devil_findings, opportunities }`
   - Attendu démo: `decision.decision = "HYBRID"`, `rejected` contient `Commerce général (stock+local)` en REJECTED (Devil penalty 35)
5. Preuve live: `POST /api/decision/recalculate` `{ session_id, patch:{ capital_at_risk:0 } }` → `decision.decision = "JOB"`
6. `GET /api/session/:id/artifacts` → tout (profile, opportunities, evidence, devil, scores, decision) — preuve jury §16
7. `GET /api/sources/:id` → détail source pour "Why this?"

## Règles d'affichage (dossier §10/§20)

- `hard_constraint_status: FAIL` → exclu, afficher `hard_constraint_reasons`
- `status: REJECTED` → carte barrée + `status_reason` (moment Devil)
- Ne jamais afficher `_scores.total` comme vérité (`92.7/100` interdit) → afficher Fit/Evidence/Risk High/Medium/Low
- `KEEP_YOUR_CAPITAL` / `INSUFFICIENT_EVIDENCE` / `NO_SAFE_RECOMMENDATION` = sorties normales
- `decision.preserved_capital` + `decision.test_budget` → "Keep 290 000 / test max 10 000"
- `decision.disclaimer` toujours visible (aucune garantie revenu/embauche)

## Types TS (copier dans front)

Voir `src/types.ts`: `OpportunityDNA`, `Opportunity`, `Evidence`, `DevilFinding`, `Decision`, `SessionArtifacts`.
`DecisionType = JOB|BUSINESS|HYBRID|LEARN_FIRST|KEEP_YOUR_CAPITAL|INSUFFICIENT_EVIDENCE|NO_SAFE_RECOMMENDATION`

## Exemple curl complet

```bash
BASE=http://localhost:3001
curl -s $BASE/api/demo/profile -o p.json
SID=$(curl -s -X POST $BASE/api/profile/normalize -H 'Content-Type: application/json' -d @p.json | python3 -c "import json,sys;print(json.load(sys.stdin)['session_id'])")
curl -s -X POST $BASE/api/opportunities/generate -H 'Content-Type: application/json' -d "{\"session_id\":\"$SID\"}" | head -c 400
curl -s -X POST $BASE/api/decision/evaluate -H 'Content-Type: application/json' -d "{\"session_id\":\"$SID\"}"
curl -s -X POST $BASE/api/decision/recalculate -H 'Content-Type: application/json' -d "{\"session_id\":\"$SID\",\"patch\":{\"capital_at_risk\":0}}"
```

Kill switches env: `ENABLE_HYBRID=false`, `ENABLE_DEVIL=false`.
