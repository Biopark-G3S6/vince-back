/**
 * DTOs da conta de usuário e do seu perfil.
 *
 * Nenhum tipo do Prisma entra aqui (`ADR-0004` §8, §9): os identificadores e os códigos
 * atravessam a fronteira como texto.
 */

/** O perfil devolvido ao titular (RF-ACS-005). */
export interface UserProfileDto {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  /** Ausente quando nunca informada — `null`, e não texto vazio. */
  readonly expertiseArea: string | null;
  readonly preferredLanguage: string | null;
  readonly active: boolean;
  readonly institutionId: string | null;
  readonly roleCodes: readonly string[];
}

/**
 * A criação de conta pelos fluxos internos — carga inicial, RF-TUR-003 e RF-TUR-005.
 *
 * NÃO é operação administrativa: enquanto nenhum requisito funcional a originar, não
 * existe permissão que a autorize (`ADR-0014` §7, `PAD-SEG-008`). Quem a chama é outro
 * caso de uso do sistema, nunca um endpoint.
 */
export interface CreateUserCommand {
  readonly email: string;
  readonly name: string;
  readonly roleCode: string;
  /** Obrigatório fora de `SYSTEM_ADMIN` (URS §1.4.1 item 3). */
  readonly institutionId?: string | null;
  readonly expertiseArea?: string | null;
  readonly preferredLanguage?: string | null;
  /** Quem criou, para a trilha de auditoria. Ausente na carga inicial. */
  readonly actorId?: string | null;
}

/**
 * A consulta e a alteração do perfil próprio.
 *
 * `actorId` e `userId` são ambos exigidos, e o caso de uso recusa quando diferem
 * (decisão D2): a titularidade é verificada dentro do caso de uso e NÃO é modelada como
 * permissão (`ADR-0014` §12, §13).
 */
export interface OwnProfileQuery {
  readonly actorId: string;
  readonly userId: string;
}

export interface UpdateOwnProfileCommand {
  readonly actorId: string;
  readonly userId: string;
  /** Campo ausente permanece como está; `null` remove o que é opcional. */
  readonly name?: string;
  readonly expertiseArea?: string | null;
  readonly preferredLanguage?: string | null;
  /**
   * O que o titular NÃO pode alterar em si mesmo (RF-ACS-005 RN1). Declarados para que
   * a tentativa seja recusada com `PERMISSION_DENIED`, e não silenciosamente ignorada.
   */
  readonly email?: string;
  readonly roleCode?: string;
  readonly institutionId?: string | null;
  readonly active?: boolean;
}

export interface UserStateCommand {
  readonly userId: string;
}

/** Atribuição e revogação de papel. `actorId` alimenta a trilha (`ADR-0014` §18). */
export interface RoleAssignmentCommand {
  readonly actorId?: string | null;
  readonly userId: string;
  readonly roleCode: string;
}

export interface EffectivePermissionsQuery {
  readonly userId: string;
}

export interface EffectivePermissionsResult {
  /** União das origens, sem repetição e em ordem estável. */
  readonly permissions: readonly string[];
}
