import type { Page, PageRequest } from '@shared/http/pagination';

import type { UserAccount } from '../user';

export interface NotificationRecipientRecord {
  readonly userId: string;
  readonly email: string;
  readonly preferredLanguage: string | null;
  readonly active: boolean;
}

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

export interface AccountIdRows {
  readonly rows: readonly string[];
  readonly totalItems?: number;
}

/** O que a criação grava, já validado e normalizado pelo domínio. */
export interface NewUserAccount {
  readonly account: UserAccount;
  readonly roleCode: string;
  /** Quem criou. Nulo na carga inicial, que não tem ator. */
  readonly actorId: string | null;
}

/** Filtros do diretório de usuários (`user-directory`). Sempre dentro de uma instituição. */
export interface DirectoryFilters {
  readonly institutionId: string;
  readonly search?: string;
  readonly roleCode?: string;
  readonly active?: boolean;
  readonly ids?: readonly string[];
}

export interface DirectoryEntry {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly active: boolean;
  readonly roleCodes: readonly string[];
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

  /** Projeção mínima de destinatários em lote para correio eletrônico. */
  abstract findNotificationRecipients(
    userIds: readonly string[],
  ): Promise<readonly NotificationRecipientRecord[]>;

  /** A conta pelo e-mail **já normalizado**. Normalizar aqui esconderia a regra. */
  abstract findByEmail(email: string): Promise<UserAccount | null>;

  /** Grava o perfil alterado. Devolve a conta gravada, ou `null` se ela sumiu. */
  abstract saveProfile(account: UserAccount): Promise<UserAccount | null>;

  /**
   * Leva a conta ao estado informado. Devolve `null` quando a conta não existe —
   * `RESOURCE_NOT_FOUND` é decisão do caso de uso, não do repositório.
   */
  abstract setActive(id: string, active: boolean): Promise<UserAccount | null>;

  /**
   * O vínculo institucional de várias contas, em **uma** consulta (`ADR-0011` §9).
   *
   * Só conta ativa entra no mapa: quem pergunta é o escopo de outro módulo decidindo
   * elegibilidade, e conta desativada não é elegível a nada. A ausência da chave,
   * portanto, significa "não existe ou não está ativa" — e as duas são o mesmo caso para
   * quem pergunta.
   */
  abstract institutionLinksOf(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, string | null>>;

  /**
   * As contas ativas de um papel na instituição, paginadas.
   *
   * Existe para quem precisa **enumerar** o escopo, e não apenas conferir um vínculo
   * conhecido: é o caso de um evento de escopo institucional, que lista os seus alunos
   * elegíveis (`RF-EQP-006`). A ordem é estável por identificador, porque a paginação sem
   * ordem total devolve a mesma linha em duas páginas.
   */
  /** Uma consulta por página, com os papéis na mesma ida ao banco (`ADR-0011` §9). */
  abstract searchDirectory(
    filters: DirectoryFilters,
    request: PageRequest,
  ): Promise<Page<DirectoryEntry>>;

  abstract listByRole(
    institutionId: string,
    roleCode: string,
    request: PageRequest,
  ): Promise<AccountIdRows>;
}
