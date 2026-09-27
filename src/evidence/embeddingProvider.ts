// Abstraction EmbeddingProvider + fallback local déterministe.
// Cible : nvidia/nemotron-3-embed-1b via endpoint OpenAI-compatible NVIDIA.
// Fallback (clé absente / réseau indisponible) : HashEmbedding local + retrieval lexical BM25-like,
// avec confidence réduite (documenté dans retrieval.ts).
// Aucune clé dans le repo : NVIDIA_API_KEY via .env uniquement.

export interface EmbeddingProvider {
  readonly name: string;
  readonly dim: number;
  readonly model: string;
  embed(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

const NVIDIA_BASE = process.env.NVIDIA_API_BASE ?? 'https://integrate.api.nvidia.com/v1';
const NVIDIA_EMBED_MODEL = process.env.NVIDIA_EMBED_MODEL ?? 'nvidia/nemotron-3-embed-1b';

function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

/** Fallback local 100 % hors-ligne : hash de tokens -> vecteur normalisé, déterministe. */
export class HashEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'hash-fallback';
  readonly dim = 256;
  readonly model = 'local-hash-256';

  private vectorize(text: string): number[] {
    const v = new Array<number>(this.dim).fill(0);
    const tokens = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9+_#]+/g)
      .filter((t) => t.length >= 2);
    for (const tok of tokens) {
      let h = 2166136261;
      for (let i = 0; i < tok.length; i++) {
        h ^= tok.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      v[Math.abs(h) % this.dim] += 1;
      // bigramme léger : renforce "marketing dakar", "bac+3", etc.
      v[(Math.abs(h) + tok.length * 31) % this.dim] += 0.5;
    }
    return normalize(v);
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.vectorize(t));
  }
  async embedQuery(text: string): Promise<number[]> {
    return this.vectorize(text);
  }
}

/** Provider NVIDIA : endpoint gratuit nvidia/nemotron-3-embed-1b (OpenAI-compatible). */
export class NvidiaEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'nvidia';
  readonly dim: number;
  readonly model: string;
  private apiKey: string;
  private base: string;

  constructor(apiKey: string, model = NVIDIA_EMBED_MODEL, dim = 2048, base = NVIDIA_BASE) {
    this.apiKey = apiKey;
    this.model = model;
    this.dim = dim;
    this.base = base;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(`${this.base}/embeddings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, input: texts }),
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error(`nvidia-embed ${res.status}`);
      const json = (await res.json()) as { data: { embedding: number[] }[] };
      return json.data.map((d) => normalize(d.embedding.slice(0, this.dim)));
    } finally {
      clearTimeout(t);
    }
  }

  async embedQuery(text: string): Promise<number[]> {
    return (await this.embed([text]))[0];
  }
}

/** Fabrique : NVIDIA si NVIDIA_API_KEY présent, sinon fallback local (snapshot-first). */
export function getEmbeddingProvider(): EmbeddingProvider {
  const key = process.env.NVIDIA_API_KEY;
  if (key && key.trim()) return new NvidiaEmbeddingProvider(key.trim());
  return new HashEmbeddingProvider();
}
