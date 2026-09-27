// Chunking déterministe + provenance recopiée (jamais modifiée en aval).
// Règle : max ~600 caractères par chunk, découpe sur frontières de phrases,
// chevauchement 0 (snapshot petit, traçabilité > rappel). Offsets char_start/char_end.
import type { CorpusChunk, CorpusDoc } from './corpusTypes';

export const MAX_CHUNK_CHARS = 600;

export function splitSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Þ0-9«"“'])/u)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text.trim()].filter(Boolean);
}

export function chunkDocument(doc: CorpusDoc, maxChars = MAX_CHUNK_CHARS): CorpusChunk[] {
  const sentences = splitSentences(doc.text).flatMap((s) => hardSplit(s, maxChars));
  const chunks: CorpusChunk[] = [];
  let current = '';
  let index = 0;
  let cursor = 0;

  const flush = () => {
    const text = current.trim();
    if (!text) return;
    const start = doc.text.indexOf(text, cursor);
    const safeStart = start >= 0 ? start : cursor;
    chunks.push({
      chunk_id: `${doc.doc_id}#c${index}`,
      doc_id: doc.doc_id,
      chunk_index: index,
      char_start: safeStart,
      char_end: safeStart + text.length,
      text,
      source_id: doc.source_id,
      source_url: doc.source_url,
      publisher: doc.publisher,
      observed_at: doc.observed_at,
      published_at: doc.published_at,
      country_id: doc.country_id,
      region: doc.region,
      geography_level: doc.geography_level,
      category: doc.category,
      evidence_type: doc.evidence_type,
      freshness: doc.freshness,
      confidence: doc.confidence,
      value: doc.value,
      derived_from: doc.derived_from ? [...doc.derived_from] : undefined,
      field_provenance: doc.field_provenance ? { ...doc.field_provenance } : undefined
    });
    cursor = safeStart + text.length;
    index += 1;
    current = '';
  };

  for (const s of sentences) {
    if ((current + ' ' + s).trim().length > maxChars && current.trim()) flush();
    current = current ? `${current} ${s}` : s;
  }
  flush();
  return chunks;
}

/** Coupe dure d'une phrase trop longue sur frontières de mots (contrat ≤ maxChars tenu même sans ponctuation). */
export function hardSplit(sentence: string, maxChars = MAX_CHUNK_CHARS): string[] {
  if (sentence.length <= maxChars) return [sentence];
  const words = sentence.split(/\s+/).filter(Boolean);
  const parts: string[] = [];
  let cur = '';
  for (const w of words) {
    if (w.length > maxChars) {
      if (cur.trim()) parts.push(cur.trim());
      // mot pathologique : coupe brute par tranches
      for (let i = 0; i < w.length; i += maxChars) parts.push(w.slice(i, i + maxChars));
      cur = '';
    } else if ((cur + ' ' + w).trim().length > maxChars && cur.trim()) {
      parts.push(cur.trim());
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.length > 0 ? parts : [sentence];
}

export function chunkCorpus(docs: CorpusDoc[], maxChars = MAX_CHUNK_CHARS): CorpusChunk[] {
  return docs.flatMap((d) => chunkDocument(d, maxChars));
}
