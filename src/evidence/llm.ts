// LLM final NVIDIA — nvidia/nemotron-3-ultra-550b-a55b (endpoint gratuit, OpenAI-compatible).
// Rôle strict : transformer 4-5 passages SOURCÉS en Evidence structurée.
// Garde-fous (spec) :
// - Ne jamais inventer de sources : toute ref hors passages fournis est rejetée vers unknowns.
// - Ne jamais modifier : contraintes, budget, capital_at_risk, dates, exigences d'offre,
//   valeurs sources, score final déterministe (le Decision Engine garde le dernier mot).
// - Sortie JSON stricte : supporting_evidence, contradicting_evidence, unknowns,
//   assumptions, source_refs, evidence_confidence (0-100), summary.
// Fallback : clé absente / timeout / JSON invalide -> throw, le pipeline utilise
// le NoopLLM déterministe (preuves brutes + Decision Engine, confidence 0 + unknowns).
import type { LLMProvider, StructuredEvidence } from './providers';
import { NoopLLM } from './providers';
import type { ScoredChunk } from './corpusTypes';

export const NVIDIA_LLM_DEFAULT_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b';
export const NVIDIA_LLM_TIMEOUT_MS = Number(process.env.NVIDIA_LLM_TIMEOUT_MS ?? 120000) || 120000;
export const NVIDIA_LLM_MAX_TOKENS = 2000;
/** Passages tronqués côté prompt (le chunk complet reste en session/index — seule la fenêtre LLM est réduite). */
export const NVIDIA_LLM_PASSAGE_CHARS = 800;

function llmModel(): string {
  return (process.env.NVIDIA_LLM_MODEL ?? NVIDIA_LLM_DEFAULT_MODEL).trim() || NVIDIA_LLM_DEFAULT_MODEL;
}

function llmBase(): string {
  return (process.env.NVIDIA_API_BASE ?? 'https://integrate.api.nvidia.com/v1').trim();
}

const SYSTEM_PROMPT = `Tu es l'extracteur Evidence de ProjectFit (hackathon GOMYCODE x NVIDIA).
Tu reçois une requête evidence + des passages SOURCES avec provenance (chunk_id, source_id, publisher, geography_level, observed_at).
RÈGLES ABSOLUES :
- N'invente JAMAIS de source, statistique, date ou valeur. Cite uniquement les passages fournis via chunk_id/source_id.
- Ne modifie JAMAIS : contraintes utilisateur, budget, capital_at_risk, dates, exigences d'offre, valeurs sources, score final.
- Une statistique NATIONAL ne prouve rien au niveau LOCAL : signale geography_mismatch comme limite, jamais comme preuve locale.
- Contradictions conservées : si deux passages se contredisent, mets-les en contradicting_evidence.
- Absence de preuve -> unknowns avec "UNKNOWN:" ou "INSUFFICIENT EVIDENCE:".
- Réponds UNIQUEMENT en JSON valide, sans markdown, avec ce schéma exact :
{"supporting_evidence":[{"chunk_id":"...","source_id":"...","quote":"... (extrait court du passage)"}],"contradicting_evidence":[{"chunk_id":"...","source_id":"...","quote":"..."}],"unknowns":["..."],"assumptions":["..."],"source_refs":["source_id..."],"evidence_confidence":0,"summary":"... (2 phrases max, pour le frontend)"}`;

/** Extrait le JSON d'une réponse LLM (tolère fences markdown ```json). */
export function extractJson(content: string): string {
  const t = content.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) return fence[1].trim();
  return t;
}

function buildUserPrompt(query: string, passages: ScoredChunk[]): string {
  const list = passages
    .map(
      (p, i) =>
        `[${i + 1}] chunk_id=${p.chunk_id} source_id=${p.source_id} publisher=${p.publisher} geography=${p.geography_level}${p.geography_mismatch ? ' (NATIONAL utilisée pour opportunité LOCALE : ne pas promouvoir en preuve locale)' : ''} observed_at=${p.observed_at} text=${JSON.stringify(p.text.slice(0, NVIDIA_LLM_PASSAGE_CHARS))}`
    )
    .join('\n');
  return `Requête evidence : ${query}\nPassages sources (${passages.length}) :\n${list}\nConsigne : quotes COURTES (1 phrase max), unknowns concis (max 6), assumptions max 4.`;
}

/** Valide + assainit la sortie LLM : refs inconnues -> unknowns, confidence clampée. */
export function sanitizeLLMOutput(raw: unknown, passages: ScoredChunk[]): StructuredEvidence {
  const noop = new NoopLLM();
  const knownChunks = new Set(passages.map((p) => p.chunk_id));
  const knownSources = new Set(passages.map((p) => p.source_id));
  const fallback = (extra: string[]): Promise<StructuredEvidence> =>
    noop.analyze('', passages).then((b) => ({ ...b, unknowns: [...b.unknowns, ...extra] }));

  if (raw == null || typeof raw !== 'object') return { supporting_evidence: [], contradicting_evidence: [], unknowns: ['UNKNOWN: sortie LLM invalide — preuves brutes uniquement.'], assumptions: [], source_refs: [...knownSources], evidence_confidence: 0 };
  const r = raw as Record<string, unknown>;

  const pickRefs = (v: unknown): { chunk_id: string; source_id: string; quote: string }[] => {
    if (!Array.isArray(v)) return [];
    const out: { chunk_id: string; source_id: string; quote: string }[] = [];
    for (const item of v) {
      if (item == null || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      if (typeof rec.chunk_id !== 'string' || !knownChunks.has(rec.chunk_id)) continue;
      const src = passages.find((p) => p.chunk_id === rec.chunk_id)!;
      out.push({
        chunk_id: rec.chunk_id,
        source_id: typeof rec.source_id === 'string' && knownSources.has(rec.source_id) ? rec.source_id : src.source_id,
        quote: typeof rec.quote === 'string' ? rec.quote.slice(0, 300) : src.text.slice(0, 300)
      });
    }
    return out;
  };
  const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 20) : []);
  const confRaw = typeof r.evidence_confidence === 'number' && Number.isFinite(r.evidence_confidence) ? Math.round(r.evidence_confidence) : 0;

  // Compte les refs inventées pour les signaler (sans les exposer comme preuves).
  let invented = 0;
  for (const key of ['supporting_evidence', 'contradicting_evidence'] as const) {
    if (Array.isArray(r[key])) {
      for (const item of r[key] as unknown[]) {
        const rec = (item ?? {}) as Record<string, unknown>;
        if (typeof rec.chunk_id !== 'string' || !knownChunks.has(rec.chunk_id)) invented++;
      }
    }
  }
  void fallback;

  return {
    supporting_evidence: pickRefs(r.supporting_evidence),
    contradicting_evidence: pickRefs(r.contradicting_evidence),
    unknowns: [...strArr(r.unknowns), ...(invented > 0 ? [`UNKNOWN: ${invented} référence(s) LLM hors corpus rejetée(s).`] : [])],
    assumptions: strArr(r.assumptions),
    source_refs: Array.isArray(r.source_refs)
      ? [...new Set((r.source_refs as unknown[]).filter((x): x is string => typeof x === 'string' && knownSources.has(x)))]
      : [...knownSources],
    evidence_confidence: Math.max(0, Math.min(100, confRaw)),
    summary: typeof r.summary === 'string' ? r.summary.slice(0, 600) : undefined
  };
}

export class NvidiaLLM implements LLMProvider {
  readonly name = 'nvidia-nemotron-3-ultra-550b-a55b';
  private apiKey: string;
  private model: string;
  private base: string;

  constructor(apiKey: string, model = llmModel(), base = llmBase()) {
    this.apiKey = apiKey;
    this.model = model;
    this.base = base;
  }

  get configured(): boolean {
    return this.apiKey.trim().length > 0;
  }

  async analyze(query: string, passages: ScoredChunk[]): Promise<StructuredEvidence> {
    if (!this.configured) throw new Error('nvidia-llm: NVIDIA_API_KEY manquant');
    if (passages.length === 0) {
      return { supporting_evidence: [], contradicting_evidence: [], unknowns: ['INSUFFICIENT EVIDENCE: aucun passage récupéré.'], assumptions: [], source_refs: [], evidence_confidence: 0 };
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), NVIDIA_LLM_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.base}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          max_tokens: NVIDIA_LLM_MAX_TOKENS,
          response_format: { type: 'json_object' },
          chat_template_kwargs: { enable_thinking: false },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(query, passages) }
          ]
        }),
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error(`nvidia-llm ${res.status}`);
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = extractJson(json.choices?.[0]?.message?.content ?? '');
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error('nvidia-llm: JSON invalide');
      }
      return sanitizeLLMOutput(parsed, passages);
    } finally {
      clearTimeout(t);
    }
  }
}

/** Fabrique : NVIDIA si clé présente, sinon noop (preuves brutes + moteur déterministe). */
export function getLLM(): { llm: LLMProvider; method: 'nvidia' | 'noop-fallback' } {
  const key = (process.env.NVIDIA_API_KEY ?? '').trim();
  if (key) return { llm: new NvidiaLLM(key), method: 'nvidia' };
  return { llm: new NoopLLM(), method: 'noop-fallback' };
}
