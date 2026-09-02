/**
 * A identidade do usuário autenticado e a resolução das suas permissões efetivas, como
 * **port abstrato** (decisão D1, `ADR-0014` §9).
 *
 * As permissões são resolvidas **no servidor a cada requisição** e nunca viajam na
 * credencial de sessão (`ADR-0013` §3, `ADR-0014` §9): a sessão guarda o identificador da
 * conta, e nada mais. É o que faz a revogação valer imediatamente, sem janela residual.
 */

/** O que o endpoint de identidade devolve (`ADR-0013` §20). */
export interface AuthenticatedIdentity {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly preferredLanguage: string | null;
  readonly roles: readonly string[];
  /**
   * Destinam-se **exclusivamente à composição da interface** (`ADR-0013` §20,
   * RF-ACS-001 RN3). Nenhuma decisão de autorização as consulta: a decisão é da guarda de
   * borda, sobre as permissões que ela mesma resolve.
   */
  readonly permissions: readonly string[];
}

export abstract class IdentityResolver {
  /** O caminho crítico de toda requisição autenticada. */
  abstract permissionsOf(userId: string): Promise<readonly string[]>;

  /** A identidade completa. `null` quando a conta deixou de existir. */
  abstract identityOf(userId: string): Promise<AuthenticatedIdentity | null>;
}
