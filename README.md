# ProjectFit — Backend (Fastify + TypeScript)

Economic opportunity decision engine — **GOMYCODE × NVIDIA hackathon**.
Deterministic core (constraints → scoring → adversarial review → decision), exposed as a REST API for the front-end team.

- **Stack:** Fastify 5 · TypeScript 5 (strict) · Zod
- **Port:** `3001` by default (`PORT` env var)
- **Mode:** `snapshot: true` — the engine runs on a static data snapshot (jobs + evidence corpus), no external calls.

---

## Quick start

### Local (Node ≥ 20)

```bash
npm install
npm test           # builds src/ → dist/ (pretest) + runs the 45-test suite
npm start          # runs the compiled build
# dev mode: npm run dev   (ts-node, no build step)
# health:   curl http://localhost:3001/health
```

### Docker

```bash
# Build + run
docker compose up --build -d

# Or plain Docker
docker build -t projectfit-backend .
docker run -d --name projectfit-api -p 3001:3001 projectfit-backend

# Verify
curl http://localhost:3001/health

# Logs / stop
docker compose logs -f api
docker compose down
```

The image is a **multi-stage build** (typecheck + **`npm test`** → production deps only), so a red test **fails the image build**. It runs as a **non-root user** and ships a `HEALTHCHECK` on `/health`.

### Environment variables

| Variable | Default | Effect |
|---|---|---|
| `PORT` | `3001` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `ENABLE_HYBRID` | `true` | `false` disables hybrid (job + business) decisions |
| `ENABLE_DEVIL` | `true` | `false` disables the adversarial review pass (the Devil) |
| `NVIDIA_API_KEY` | *(empty)* | Enables live NVIDIA calls (embeddings `nvidia/nemotron-3-embed-1b` + LLM `nvidia/nemotron-3-ultra-550b-a55b`). Empty = snapshot-first fallbacks (local hash + lexical, noop LLM) |
| `NVIDIA_API_BASE` | `https://integrate.api.nvidia.com/v1` | NVIDIA OpenAI-compatible base URL |
| `NVIDIA_EMBED_MODEL` | `nvidia/nemotron-3-embed-1b` | Embedding model |
| `NVIDIA_LLM_MODEL` | `nvidia/nemotron-3-ultra-550b-a55b` | Final structured-evidence model |
| `MODAL_RERANKER_URL` | *(empty)* | HTTPS endpoint self-hosting `nvidia/llama-nemotron-rerank-1b-v2` on Modal. Empty = passthrough fallback (retrieval order kept, −10 confidence) |
| `MODAL_RERANKER_MODEL` | `nvidia/llama-nemotron-rerank-1b-v2` | Model tag sent to the Modal endpoint |
| `MODAL_RERANKER_TIMEOUT_MS` | `15000` | Modal reranker timeout |

Copy `.env.example` → `.env` for local overrides (`.env` is git- and docker-ignored).

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run from source with `ts-node` |
| `npm run build` | Compile `src/` → `dist/` |
| `npm start` | Run the compiled build |
| `npm run typecheck` | `tsc --noEmit` (strict, zero-error gate) |
| `npm test` | Builds `src/` → `dist/` (via `pretest`), then runs the suite with Node's built-in test runner |
| `npm run benchmark` | Builds, then runs the §15 benchmark (20 profiles + baseline) and writes `benchmark-results.json` |

---

## Testing

```bash
npm test    # pretest builds src/ → dist/, then runs the suite
```

**59 tests / 9 files**, all green, on Node's built-in runner (`node:test`) — no extra dev dependency.
Tests compile to `dist/` alongside the app, so they always exercise the exact code that ships.

| File | Covers |
|---|---|
| `src/app.test.ts` | Integration through `app.inject()`: full golden path §15.1 (profile → opportunities → evidence → `HYBRID` → `capital_at_risk = 0` → `JOB`), artifacts §16, error contracts (400/404), PII pseudonymisation, `/health` kill switches |
| `src/engine/constraints.test.ts` | Hard constraints §10.1/§15.A: expiry, capital-at-risk, user exclusions, country, diploma |
| `src/engine/scoring.test.ts` | Deterministic scoring §10: skill / location / capital / time / evidence, risk + Devil penalties, zero floor, High-Medium-Low levels |
| `src/engine/decision.test.ts` | Decision + abstention: `HYBRID`, `JOB`, `BUSINESS`, `INSUFFICIENT_EVIDENCE`, `KEEP_YOUR_CAPITAL`, `NO_SAFE_RECOMMENDATION`, budget cap, rejected options excluded from `ranking` |
| `src/engine/devil.test.ts` | Adversarial review §9: penalty breakdown, `REJECTED` / `INVESTIGATE` suggestions, NINEA counter-evidence, FAILed options untouched |
| `src/engine/decision.hybrid-off.test.ts` | Kill switch `ENABLE_HYBRID=false` (own process: the flag is read at import time) |
| `src/engine/devil.disabled.test.ts` | Kill switch `ENABLE_DEVIL=false` (own process) |
| `src/benchmark/benchmark.test.ts` | Benchmark contract (§15): 20 profiles, 8 metrics in range, zero violations, zero expired, abstention correct, ProjectFit ahead of baseline, paraphrase stability |

Conventions:

- Assertions follow the spec (§9, §10, §15, §16, §20), not implementation details — refactors that keep the contract stay green.
- The Docker **build stage runs the suite**, so a red test fails `docker build`.
- Shared builders live in `src/fixtures.ts` (never imported by the runtime).

---

## Benchmark (§15)

```bash
npm run benchmark   # prints the jury table + writes benchmark-results.json
```

20 synthetic profiles (`src/benchmark/profiles.ts`, §21 must-have — no PII, fixed clock `2026-09-26`)
replayed through the exact production pipeline, scored on the 8 dossier metrics against a
deterministic generic-LLM baseline (keyword overlap, no constraint checks, uncited statistics,
never abstains — see `src/benchmark/baseline.ts`). Latest run:

| metric | ProjectFit | generic-LLM baseline | target |
|---|---|---|---|
| hard_constraint_violation_rate | **0.000** | 0.650 | → 0 |
| precision_at_3_jobs | **0.800** | 0.317 | higher wins |
| citation_precision | **1.000** | 0.000 | → 1 |
| citation_coverage | **1.000** | 0.000 | → 1 |
| unsupported_claim_rate | **0.000** | 0.500 | → 0 |
| correct_abstention_rate | **1.000** | 0.850 | → 1 |
| adversarial_downgrade_rate | **0.824** | 0.000 | > 0 |
| decision_stability | **1.000** | 1.000 | = 1 |
| expired_jobs_suggested | **0** | 19 | → 0 |

Paraphrase probe (reversed skill order, same meaning): ProjectFit stays at 1.000, the baseline
flips its top pick (0.950). Abstention cases P15/P16/P17 resolve to `KEEP_YOUR_CAPITAL`.

---

## Endpoints (spec §11.1)

| Method | Route | Front-end usage |
|---|---|---|
| GET | `/health` | Status + kill switches + snapshot flag |
| GET | `/api/demo/profile` | Pre-filled demo profile (300,000 FCFA, Dakar) |
| POST | `/api/profile/normalize` | Raw profile → `{ session_id, opportunity_dna }` |
| POST | `/api/opportunities/generate` | `{ session_id }` → jobs snapshot + 2 business options |
| POST | `/api/evidence/retrieve` | `{ session_id }` → ANSD/DER evidence |
| POST | `/api/evidence/analyze` | Evidence-first pipeline: `{ session_id?, profile?, opportunity_id?, opportunity_title?, top_k?, top_n? }` → `{ retrieved_count, reranked_count, sources, supporting_evidence, contradicting_evidence, unknowns, evidence_confidence, summary?, deterministic_note }`. Read-only: never mutates the decision |
| POST | `/api/decision/evaluate` | `{ session_id }` → Devil review + deterministic decision |
| POST | `/api/decision/recalculate` | `{ session_id, patch }` → e.g. `{"capital_at_risk":0}` proves live recalculation |
| GET | `/api/sources/:id` | Source detail ("Why this?") |
| GET | `/api/session/:id/artifacts` | `profile` + `opportunities` + `evidence` + `scores` + `decision` (jury proof, §16) |

CORS is open (`origin: true`) so the front-end can point at any host.

---

## Evidence-first pipeline (NVIDIA, snapshot-first)

```
profile + opportunity
  → buildEvidenceQuery
  → local vector retrieval (Top 15–20, `src/evidence/vectorStore.ts`)
  → Modal reranker `nvidia/llama-nemotron-rerank-1b-v2` via HTTPS (Top 4–5, `src/evidence/reranker.ts`)
  → NVIDIA `nvidia/nemotron-3-ultra-550b-a55b` → structured Evidence (`src/evidence/llm.ts`)
  → deterministic Devil / Decision Engine keeps the last word (untouched)
```

- **Snapshot-first:** 10 docs → 10 chunks (`src/data/evidence.index.json`, rebuilt with `npm run evidence:build`). No live web source is required for the demo.
- **Abstractions:** `EmbeddingProvider` · local store/retriever · `RerankerProvider` · `LLMProvider` (`src/evidence/providers.ts`, `reranker.ts`, `llm.ts`).
- **Fallbacks:** live source down → local snapshot · embedding down → lexical/BM25 (−20 confidence) · Modal down → retrieval order kept (−10) · NVIDIA LLM down → raw proofs + deterministic engine, no invented analysis.
- **LLM guardrails:** output validated in `sanitizeLLMOutput` — unknown `chunk_id` refs are rejected into `unknowns`, `source_refs` restricted to the corpus, `evidence_confidence` clamped 0–100. The LLM can never touch constraints, budget, `capital_at_risk`, dates, offer requirements, source values, or the final score.
- **Front contract:** `POST /api/evidence/analyze` returns everything the UI needs — `retrieved_count`, `reranked_count`, `retrieval_method` / `rerank_method` / `llm_method` (+ `*_fallback` flags), `sources`, `retrieved[]`, `reranked[]` (with `geography_mismatch`), `supporting_evidence`, `contradicting_evidence`, `unknowns`, `assumptions`, `source_refs`, `evidence_confidence`, `confidence_penalties`, `summary?`, `deterministic_note`.
- **No secrets in the repo:** `NVIDIA_API_KEY` and `MODAL_RERANKER_URL` live in `.env` only (see `.env.example`).

```bash
curl -s -X POST http://localhost:3001/api/evidence/analyze \
  -H 'Content-Type: application/json' \
  -d '{"profile":{"skills":["marketing","excel"],"education":"Bac+3 marketing","location":"Dakar","country_id":"SN"},"opportunity_title":"Assistant Marketing Digital"}'
```

---

## Golden path (curl)

```bash
BASE=http://localhost:3001

PROFIL=$(curl -s $BASE/api/demo/profile)
SID=$(curl -s -X POST $BASE/api/profile/normalize \
  -H 'Content-Type: application/json' -d "$PROFIL" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['session_id'])")

curl -s -X POST $BASE/api/opportunities/generate \
  -H 'Content-Type: application/json' -d "{\"session_id\":\"$SID\"}" | head -c 500
curl -s -X POST $BASE/api/decision/evaluate \
  -H 'Content-Type: application/json' -d "{\"session_id\":\"$SID\"}"

# Live proof: capital_at_risk = 0 → the business falls away, JOB surfaces
curl -s -X POST $BASE/api/decision/recalculate \
  -H 'Content-Type: application/json' \
  -d "{\"session_id\":\"$SID\",\"patch\":{\"capital_at_risk\":0}}"
```

---

## Engine rules (contract for the front-end)

- `hard_constraint_status: FAIL` → option excluded; always display the reason (expired, diploma, exclusion, capital).
- `status: REJECTED` → render the card struck through with `status_reason` (the Devil moment, §20).
- Decision `HYBRID` → display `best_next_move` + `preserved_capital` + `test_budget`.
- `KEEP_YOUR_CAPITAL` / `INSUFFICIENT_EVIDENCE` / `NO_SAFE_RECOMMENDATION` are **normal outcomes**, not errors — never render them as failures.
- Never display `_scores.total` as scientific truth — show Fit / Evidence / Risk (High / Medium / Low) instead.
- Kill switches: `ENABLE_HYBRID=false`, `ENABLE_DEVIL=false` via env vars.

---

## Project layout

```
projectfit-backend/
├── src/
│   ├── app.ts               # Fastify factory: CORS, /health, demo profile, routes
│   ├── app.test.ts          # Integration suite (golden path §15.1 + error contracts)
│   ├── server.ts            # Entrypoint (PORT / HOST)
│   ├── types.ts             # Shared domain types
│   ├── fixtures.ts          # Test builders (never imported by the runtime)
│   ├── routes/              # profile · opportunities · decision
│   ├── engine/              # constraints · scoring · devil · decision · opportunities (+ .test.ts per module)
│   ├── benchmark/           # §15: profiles (20) · runner · metrics · baseline · cli (+ benchmark.test.ts)
│   ├── data/                # jobs.snapshot · evidence.corpus (static, snapshot mode)
│   └── store/memory.ts      # In-memory session store
├── dist/                    # Build output (git-ignored)
├── benchmark-results.json   # Generated by `npm run benchmark` (git-ignored)
├── Dockerfile               # Multi-stage, non-root, healthcheck — build stage runs `npm test`
├── docker-compose.yml
├── .dockerignore
├── .gitignore
├── .env.example
└── tsconfig.json            # strict: true
```

---

## Known limitations (assumed for the demo)

1. **No live LLM/NVIDIA calls by default (§13)** — without `NVIDIA_API_KEY` / `MODAL_RERANKER_URL` the engine is fully deterministic over a static snapshot; `/health` reports `snapshot: true`.
   With keys set, `POST /api/evidence/analyze` calls NVIDIA embeddings + Modal reranker + Nemotron Ultra with the guardrails above.
   The benchmark baseline is a deterministic simulation of generic-prompt failure modes, not a live model call.
2. **No timeout / circuit breaker (§11)** — no external connectors in snapshot mode, so not a live risk.
3. **In-memory store** — sessions reset on restart (fine for a demo, not for production).
4. **No coverage reporting** — the suite asserts spec behaviour (§9/§10/§15/§16), not line coverage; no `c8`/Istanbul wired yet.
