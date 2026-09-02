import { randomBytes } from 'node:crypto';

/**
 * A sessão opaca de `ADR-0013`.
 *
 * **O identificador não codifica nada** (§3): é ruído de fonte criptograficamente segura,
 * e a única coisa que se extrai dele é ele mesmo. Quem quiser saber de quem é a sessão
 * precisa perguntar ao servidor — que é o ponto inteiro de a sessão ser opaca, e o que
 * torna a revogação imediata possível (§10, §11).
 *
 * 32 bytes, e não os 16 que os 128 bits de §2 exigiriam: o mínimo do ADR é mínimo, e o
 * custo de dobrá-lo é nenhum.
 */
const SESSION_ID_BYTES = 32;

export function generateSessionId(): string {
  return randomBytes(SESSION_ID_BYTES).toString('base64url');
}

/** Metadados de origem (`ADR-0013` §5). Ausentes é estado válido, e é `null`. */
export interface SessionOrigin {
  readonly ip: string | null;
  readonly userAgent: string | null;
}

/** O estado que reside no servidor (`ADR-0013` §4, §5). Instantes em ISO 8601 UTC. */
export interface SessionState {
  readonly userId: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly origin: SessionOrigin;
}

export interface Session {
  readonly id: string;
  readonly state: SessionState;
}
