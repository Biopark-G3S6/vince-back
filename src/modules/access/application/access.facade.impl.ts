import { Injectable } from '@nestjs/common';

import { AccessFacade } from '../contracts/access.facade';
import type {
  ChangeOwnPasswordCommand,
  PasswordResetIssued,
  PasswordResetResult,
  RequestPasswordResetCommand,
  ResetPasswordCommand,
  VerifyCredentialQuery,
} from '../contracts/credential.dto';
import type { AccessResult } from '../contracts/result.dto';
import type {
  RolePermissionsQuery,
  RolePermissionsResult,
} from '../contracts/role-permissions.dto';
import type {
  CreateUserCommand,
  EffectivePermissionsQuery,
  EffectivePermissionsResult,
  OwnProfileQuery,
  RoleAssignmentCommand,
  UpdateOwnProfileCommand,
  UserProfileDto,
  UserStateCommand,
} from '../contracts/user.dto';
import type { Result } from '../domain/failure';
import type { UserAccountWithRoles } from '../domain/ports/user-repository';
import { AssignRoleUseCase } from './assign-role.use-case';
import { ChangePasswordUseCase } from './change-password.use-case';
import { CreateUserUseCase } from './create-user.use-case';
import { FindRolePermissionsUseCase } from './find-role-permissions.use-case';
import { FindUserProfileUseCase } from './find-user-profile.use-case';
import { RequestPasswordResetUseCase } from './request-password-reset.use-case';
import { ResetPasswordUseCase } from './reset-password.use-case';
import { ResolveEffectivePermissionsUseCase } from './resolve-effective-permissions.use-case';
import { SetUserActiveUseCase } from './set-user-active.use-case';
import { UpdateUserProfileUseCase } from './update-user-profile.use-case';
import { VerifyCredentialUseCase } from './verify-credential.use-case';

/**
 * Implementação da fachada. Orquestra casos de uso e mapeia DTOs; nenhuma regra de
 * negócio reside aqui (`ADR-0004` §7).
 *
 * O mapeamento do `Result` do domínio para o `AccessResult` do contrato é o ponto em que
 * o código de falha deixa de ser tipo estreito e passa a ser texto opaco
 * (`ADR-0027` §14). Em execução é a mesma estrutura; o que muda é o que o tipo revela do
 * lado de fora.
 */
@Injectable()
export class AccessFacadeImpl extends AccessFacade {
  constructor(
    private readonly findRolePermissions: FindRolePermissionsUseCase,
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly findUserProfile: FindUserProfileUseCase,
    private readonly updateUserProfile: UpdateUserProfileUseCase,
    private readonly setUserActive: SetUserActiveUseCase,
    private readonly assignRoleUseCase: AssignRoleUseCase,
    private readonly resolveEffectivePermissions: ResolveEffectivePermissionsUseCase,
    private readonly verifyCredentialUseCase: VerifyCredentialUseCase,
    private readonly changePassword: ChangePasswordUseCase,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
  ) {
    super();
  }

  async permissionsOfRoles(query: RolePermissionsQuery): Promise<RolePermissionsResult> {
    return { permissions: await this.findRolePermissions.execute(query.roleCodes) };
  }

  async createUser(command: CreateUserCommand): Promise<AccessResult<UserProfileDto>> {
    return toProfileResult(
      await this.createUserUseCase.execute({
        email: command.email,
        name: command.name,
        roleCode: command.roleCode,
        institutionId: command.institutionId,
        expertiseArea: command.expertiseArea,
        preferredLanguage: command.preferredLanguage,
        actorId: command.actorId,
      }),
    );
  }

  async findOwnProfile(query: OwnProfileQuery): Promise<AccessResult<UserProfileDto>> {
    return toProfileResult(await this.findUserProfile.execute(query.actorId, query.userId));
  }

  async updateOwnProfile(command: UpdateOwnProfileCommand): Promise<AccessResult<UserProfileDto>> {
    return toProfileResult(await this.updateUserProfile.execute(command));
  }

  async deactivateUser(command: UserStateCommand): Promise<AccessResult<UserProfileDto>> {
    return toProfileResult(await this.setUserActive.execute(command.userId, false));
  }

  async activateUser(command: UserStateCommand): Promise<AccessResult<UserProfileDto>> {
    return toProfileResult(await this.setUserActive.execute(command.userId, true));
  }

  async assignRole(command: RoleAssignmentCommand): Promise<AccessResult<void>> {
    return toResult(
      await this.assignRoleUseCase.execute(
        command.actorId,
        command.userId,
        command.roleCode,
        'assign',
      ),
    );
  }

  async revokeRole(command: RoleAssignmentCommand): Promise<AccessResult<void>> {
    return toResult(
      await this.assignRoleUseCase.execute(
        command.actorId,
        command.userId,
        command.roleCode,
        'revoke',
      ),
    );
  }

  async effectivePermissions(
    query: EffectivePermissionsQuery,
  ): Promise<EffectivePermissionsResult> {
    return { permissions: await this.resolveEffectivePermissions.execute(query.userId) };
  }

  async verifyCredential(query: VerifyCredentialQuery): Promise<string | null> {
    return this.verifyCredentialUseCase.execute(query.email, query.password);
  }

  async changeOwnPassword(command: ChangeOwnPasswordCommand): Promise<AccessResult<void>> {
    return toResult(
      await this.changePassword.execute(
        command.userId,
        command.currentPassword,
        command.newPassword,
      ),
    );
  }

  async requestPasswordReset(
    command: RequestPasswordResetCommand,
  ): Promise<PasswordResetIssued | null> {
    return this.requestPasswordResetUseCase.execute(command.email);
  }

  async resetPassword(command: ResetPasswordCommand): Promise<AccessResult<PasswordResetResult>> {
    return toResult(await this.resetPasswordUseCase.execute(command.token, command.password));
  }
}

function toProfile(found: UserAccountWithRoles): UserProfileDto {
  return {
    id: found.account.id,
    email: found.account.email,
    name: found.account.name,
    expertiseArea: found.account.expertiseArea,
    preferredLanguage: found.account.preferredLanguage,
    active: found.account.active,
    institutionId: found.account.institutionId,
    roleCodes: found.roleCodes,
  };
}

function toResult<T>(result: Result<T>): AccessResult<T> {
  return result.ok ? { ok: true, value: result.value } : { ok: false, failure: result.failure };
}

function toProfileResult(result: Result<UserAccountWithRoles>): AccessResult<UserProfileDto> {
  return result.ok
    ? { ok: true, value: toProfile(result.value) }
    : { ok: false, failure: result.failure };
}
