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

---

## Testing

```bash
npm test    # pretest builds src/ → dist/, then runs the suite
```

**45 tests / 7 files**, all green, on Node's built-in runner (`node:test`) — no extra dev dependency.
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

Conventions:

- Assertions follow the spec (§9, §10, §15, §16, §20), not implementation details — refactors that keep the contract stay green.
- The Docker **build stage runs the suite**, so a red test fails `docker build`.
- Shared builders live in `src/fixtures.ts` (never imported by the runtime).

---

## Endpoints (spec §11.1)

| Method | Route | Front-end usage |
|---|---|---|
| GET | `/health` | Status + kill switches + snapshot flag |
| GET | `/api/demo/profile` | Pre-filled demo profile (300,000 FCFA, Dakar) |
| POST | `/api/profile/normalize` | Raw profile → `{ session_id, opportunity_dna }` |
| POST | `/api/opportunities/generate` | `{ session_id }` → jobs snapshot + 2 business options |
| POST | `/api/evidence/retrieve` | `{ session_id }` → ANSD/DER evidence |
| POST | `/api/decision/evaluate` | `{ session_id }` → Devil review + deterministic decision |
| POST | `/api/decision/recalculate` | `{ session_id, patch }` → e.g. `{"capital_at_risk":0}` proves live recalculation |
| GET | `/api/sources/:id` | Source detail ("Why this?") |
| GET | `/api/session/:id/artifacts` | `profile` + `opportunities` + `evidence` + `scores` + `decision` (jury proof, §16) |

CORS is open (`origin: true`) so the front-end can point at any host.

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
│   ├── data/                # jobs.snapshot · evidence.corpus (static, snapshot mode)
│   └── store/memory.ts      # In-memory session store
├── dist/                    # Build output (git-ignored)
├── Dockerfile               # Multi-stage, non-root, healthcheck — build stage runs `npm test`
├── docker-compose.yml
├── .dockerignore
├── .gitignore
├── .env.example
└── tsconfig.json            # strict: true
```

---

## Known limitations (assumed for the demo)

1. **No live LLM/NVIDIA calls (§13)** — the engine is fully deterministic over a static snapshot; `/health` reports `snapshot: true`.
2. **No timeout / circuit breaker (§11)** — no external connectors in snapshot mode, so not a live risk.
3. **In-memory store** — sessions reset on restart (fine for a demo, not for production).
4. **No coverage reporting** — the suite asserts spec behaviour (§9/§10/§15/§16), not line coverage; no `c8`/Istanbul wired yet.
