import type { Session, SessionOrigin, SessionState } from './session';

/**
 * O repositório de sessões (`ADR-0013` §4, §10, §11).
 *
 * É `abstract class` e não interface porque também é o token de injeção — a mesma razão
 * que vale para os ports de `domain/` nos módulos (`ADR-0004` §2, §3).
 *
 * **Falha fechada.** Nenhum método devolve valor de reserva diante da indisponibilidade
 * do Redis: o erro sobe, e a borda o converte em negativa de autenticação. `ADR-0013`
 * §16 é explícito — não existe modo degradado que aceite requisição sem verificação.
 */
export abstract class SessionStore {
  /** Cria a sessão e devolve o identificador emitido. */
  abstract create(userId: string, origin: SessionOrigin): Promise<Session>;

  /**
   * O estado da sessão, **renovando a janela de inatividade** (`ADR-0013` §7).
   *
   * Devolve `null` quando a sessão não existe, expirou por inatividade ou atingiu o
   * prazo absoluto — os três casos são indistinguíveis para quem chama, e devem ser: a
   * borda responde `401` a todos.
   */
  abstract resolve(id: string): Promise<SessionState | null>;

  /** Encerra a sessão. Encerrar sessão inexistente conclui com sucesso (RF-ACS-002 E1). */
  abstract destroy(id: string): Promise<void>;

  /**
   * Revoga todas as sessões da conta em uma operação (`ADR-0013` §11), devolvendo
   * quantas alcançou.
   *
   * `keep` preserva uma sessão — é o que RF-ACS-004 RN2 pede na alteração de senha por
   * usuário autenticado: as demais caem, a que originou a operação permanece.
   */
  abstract revokeAllOfUser(userId: string, keep?: string): Promise<number>;
}

export type { Session, SessionOrigin, SessionState };
