import type {
  ChangeOwnPasswordCommand,
  PasswordResetIssued,
  PasswordResetResult,
  RequestPasswordResetCommand,
  ResetPasswordCommand,
  VerifyCredentialQuery,
} from './credential.dto';
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
 * A credencial de senha entra aqui, e a sessão **não**: `ADR-0013` §17 e §18 põem a
 * autenticação em `shared/` e proíbem módulo de criar, ler ou invalidar sessão. A fachada
 * verifica a senha e diz de quem ela é; quem transforma isso em sessão é a borda.
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

  /**
   * Confere e-mail e senha (RF-ACS-001). Devolve o identificador da conta, ou `null`.
   *
   * `null` **não distingue** conta inexistente, senha incorreta, conta desativada e conta
   * sem senha definida — e o custo de tempo dos quatro caminhos é o mesmo (decisão D6).
   */
  abstract verifyCredential(query: VerifyCredentialQuery): Promise<string | null>;

  /** Altera a senha do titular, exigindo a atual (RF-ACS-004 RN1). */
  abstract changeOwnPassword(command: ChangeOwnPasswordCommand): Promise<AccessResult<void>>;

  /**
   * Emite o meio de redefinição (RF-ACS-003). Devolve `null` quando não há a quem emitir —
   * e quem chama DEVE responder identicamente nos dois casos (RN2).
   */
  abstract requestPasswordReset(
    command: RequestPasswordResetCommand,
  ): Promise<PasswordResetIssued | null>;

  /** Define a senha por meio de redefinição, sem exigir a atual (RF-ACS-004 RN1). */
  abstract resetPassword(command: ResetPasswordCommand): Promise<AccessResult<PasswordResetResult>>;
}
