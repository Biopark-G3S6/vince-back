import type { UserAccount } from '../user';

/**
 * Port do domínio para a conta de usuário e o seu perfil.
 *
 * É `abstract class` e não interface porque também é o token de injeção
 * (`ADR-0004` §2, §3). A implementação vive em `infrastructure/`.
 */

/** A conta com os papéis que ela possui — o que a consulta de perfil devolve. */
export interface UserAccountWithRoles {
  readonly account: UserAccount;
  readonly roleCodes: readonly string[];
}

/** O que a criação grava, já validado e normalizado pelo domínio. */
export interface NewUserAccount {
  readonly account: UserAccount;
  readonly roleCode: string;
  /** Quem criou. Nulo na carga inicial, que não tem ator. */
  readonly actorId: string | null;
}

export abstract class UserRepository {
  /**
   * Cria a conta, o vínculo com o papel inicial e o registro de auditoria da
   * atribuição, tudo em uma única transação (`ADR-0019` §1): a conta não existe sem o
   * papel que a criação declarou.
   *
   * Devolve `null` quando o e-mail já pertence a outra conta. A decisão é do banco, e
   * não de uma consulta prévia: entre consultar e gravar cabe outra criação, e o índice
   * único é o que de fato arbitra.
   */
  abstract create(user: NewUserAccount): Promise<UserAccountWithRoles | null>;

  /** A conta e seus papéis, ou `null` se não existir. Uma única consulta por relação. */
  abstract findWithRoles(id: string): Promise<UserAccountWithRoles | null>;

  /** A conta pelo e-mail **já normalizado**. Normalizar aqui esconderia a regra. */
  abstract findByEmail(email: string): Promise<UserAccount | null>;

  /** Grava o perfil alterado. Devolve a conta gravada, ou `null` se ela sumiu. */
  abstract saveProfile(account: UserAccount): Promise<UserAccount | null>;

  /**
   * Leva a conta ao estado informado. Devolve `null` quando a conta não existe —
   * `RESOURCE_NOT_FOUND` é decisão do caso de uso, não do repositório.
   */
  abstract setActive(id: string, active: boolean): Promise<UserAccount | null>;
}
