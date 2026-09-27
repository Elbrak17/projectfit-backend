// Build du snapshot evidence-first : corpus -> chunks -> embeddings -> index JSON local.
// Usage: npm run evidence:build [-- --out src/data/evidence.index.json]
// Snapshot-first : fonctionne sans NVIDIA_API_KEY (fallback hash local).
// Avec NVIDIA_API_KEY : précalcule via nvidia/nemotron-3-embed-1b et stocke les vecteurs.
import { writeFileSync } from 'fs';
import { CORPUS_DOCS } from './corpus';
import { chunkCorpus } from './chunking';
import { getEmbeddingProvider } from './embeddingProvider';
import { buildIndex } from './vectorStore';

async function main() {
  const outIdx = process.argv.indexOf('--out');
  const out = outIdx >= 0 ? process.argv[outIdx + 1] : 'src/data/evidence.index.json';
  const provider = getEmbeddingProvider();
  const chunks = chunkCorpus(CORPUS_DOCS);
  const index = await buildIndex(chunks, provider);
  // Garde-fou : un ancien index présent avec une empreinte différente est écrasé, jamais réutilisé.
  const { existsSync, readFileSync } = await import('fs');
  if (existsSync(out)) {
    try {
      const prev = JSON.parse(readFileSync(out, 'utf8')) as { corpus_fingerprint?: string };
      if (prev.corpus_fingerprint && prev.corpus_fingerprint !== index.corpus_fingerprint) {
        console.log(`stale index détecté (empreinte ${prev.corpus_fingerprint.slice(0, 12)}… ≠ corpus courant) → reconstruction.`);
      }
    } catch {
      console.log('ancien index illisible → reconstruction.');
    }
  }
  writeFileSync(out, JSON.stringify(index, null, 2), 'utf8');
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        docs: CORPUS_DOCS.length,
        chunks: chunks.length,
        provider: index.provider,
        model: index.model,
        dim: index.dim,
        corpus_fingerprint: index.corpus_fingerprint,
        out
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
