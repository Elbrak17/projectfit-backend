import { SessionArtifacts } from '../types';
import { randomUUID } from 'crypto';

// Store en mémoire (hackathon). En prod: Postgres/SQLite + expiration session (§16).
const sessions = new Map<string, SessionArtifacts>();

export function createSession(): SessionArtifacts {
  const now = new Date().toISOString();
  const s: SessionArtifacts = {
    session_id: randomUUID(),
    profile_raw: null,
    normalized_profile: null,
    opportunities: [],
    evidence: [],
    devil_findings: [],
    scores: {},
    decision: null,
    created_at: now,
    updated_at: now
  };
  sessions.set(s.session_id, s);
  return s;
}

export function getSession(id: string): SessionArtifacts | undefined {
  return sessions.get(id);
}

export function saveSession(s: SessionArtifacts): void {
  s.updated_at = new Date().toISOString();
  sessions.set(s.session_id, s);
}

export function getOrCreate(id?: string): SessionArtifacts {
  if (id && sessions.has(id)) return sessions.get(id)!;
  return createSession();
}
