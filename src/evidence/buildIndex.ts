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
