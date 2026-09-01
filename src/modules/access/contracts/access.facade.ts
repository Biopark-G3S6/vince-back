import type { AccessResult } from './result.dto';
import type { RolePermissionsQuery, RolePermissionsResult } from './role-permissions.dto';
import type {
  CreateUserCommand,
  EffectivePermissionsQuery,
  EffectivePermissionsResult,
  OwnProfileQuery,
  RoleAssignmentCommand,
  UpdateOwnProfileCommand,
  UserProfileDto,
  UserStateCommand,
} from './user.dto';

/**
 * A única superfície pública do módulo `access` (`ADR-0004` §1, `ADR-0027` §12).
 *
 * Declarada como `abstract class` para servir de token de injeção (`ADR-0004` §2, §3).
 *
 * Não expõe operação de escrita sobre papel, permissão ou composição: o catálogo é
 * imutável em tempo de execução (`ADR-0027` §13). Também não expõe CRUD administrativo
 * de usuário — não há requisito funcional que o origine, e criá-lo produziria permissão
 * sem origem, contra `ADR-0014` §7 e `PAD-SEG-008`. A criação de conta existe aqui como
 * operação **de consumidor interno**, para os fluxos que a URS já especifica: a carga
 * inicial, RF-TUR-003 e RF-TUR-005.
 *
 * Nenhuma operação desta vertical publica rota. Toda rota que ela publicaria tem "sessão
 * ativa" como pré-condição, e a sessão nasce em `add-session-authentication`; os
 * controllers vêm sobre estes casos de uso, na vertical seguinte.
 */
export abstract class AccessFacade {
  abstract permissionsOfRoles(query: RolePermissionsQuery): Promise<RolePermissionsResult>;

  /** Cria conta pelos fluxos internos. A conta nasce ativa e sem credencial definida. */
  abstract createUser(command: CreateUserCommand): Promise<AccessResult<UserProfileDto>>;

  /** O perfil do titular, com papéis e vínculo (RF-ACS-005). */
  abstract findOwnProfile(query: OwnProfileQuery): Promise<AccessResult<UserProfileDto>>;

  /** Altera nome, área de atuação e preferência de idioma do próprio titular. */
  abstract updateOwnProfile(
    command: UpdateOwnProfileCommand,
  ): Promise<AccessResult<UserProfileDto>>;

  abstract deactivateUser(command: UserStateCommand): Promise<AccessResult<UserProfileDto>>;

  abstract activateUser(command: UserStateCommand): Promise<AccessResult<UserProfileDto>>;

  /** Idempotente: papel já possuído conclui com sucesso, sem segundo vínculo. */
  abstract assignRole(command: RoleAssignmentCommand): Promise<AccessResult<void>>;

  /** Idempotente: papel não possuído conclui com sucesso, e nada é alterado. */
  abstract revokeRole(command: RoleAssignmentCommand): Promise<AccessResult<void>>;

  /**
   * As permissões efetivas da conta, resolvidas no servidor a cada requisição
   * (`ADR-0014` §9). Conta inativa e conta inexistente devolvem o conjunto vazio, e a
   * apuração não falha por isso.
   */
  abstract effectivePermissions(
    query: EffectivePermissionsQuery,
  ): Promise<EffectivePermissionsResult>;
}
