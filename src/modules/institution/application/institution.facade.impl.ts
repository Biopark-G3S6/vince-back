import { Injectable } from '@nestjs/common';

import type { Page, PageRequest } from '@shared/http/pagination';

import type {
  CreateInstitutionCommand,
  InstitutionAdminCommand,
  InstitutionDto,
  InstitutionQuery,
  InstitutionStateCommand,
  InstitutionStateDto,
  UpdateInstitutionCommand,
} from '../contracts/institution.dto';
import { InstitutionFacade } from '../contracts/institution.facade';
import type { InstitutionResult } from '../contracts/result.dto';
import type { Result } from '../domain/failure';
import type { Institution } from '../domain/institution';
import { AssignInstitutionAdminUseCase } from './assign-institution-admin.use-case';
import { CreateInstitutionUseCase } from './create-institution.use-case';
import { FindInstitutionUseCase } from './find-institution.use-case';
import { ListInstitutionsUseCase } from './list-institutions.use-case';
import { ReadInstitutionStateUseCase } from './read-institution-state.use-case';
import { SetInstitutionActiveUseCase } from './set-institution-active.use-case';
import { UpdateInstitutionUseCase } from './update-institution.use-case';

/**
 * A implementação da fachada: **tradução, e não regra** (`ADR-0004` §6).
 *
 * Cada método delega a um caso de uso e converte a entidade de domínio no DTO. Nenhuma
 * decisão de negócio vive aqui — se alguma aparecer, ela pertence a um caso de uso.
 */

function toDto(institution: Institution): InstitutionDto {
  return {
    id: institution.id,
    name: institution.name,
    code: institution.code,
    cnpj: institution.cnpj,
    website: institution.website,
    contactEmail: institution.contactEmail,
    active: institution.active,
  };
}

/** O `Result` estreito de `domain/` no `InstitutionResult` de texto opaco de `contracts/`. */
function toResult<T, U>(result: Result<T>, project: (value: T) => U): InstitutionResult<U> {
  return result.ok
    ? { ok: true, value: project(result.value) }
    : { ok: false, failure: result.failure };
}

function toVoidResult(result: Result<void>): InstitutionResult<void> {
  return result.ok ? { ok: true, value: undefined } : { ok: false, failure: result.failure };
}

@Injectable()
export class InstitutionFacadeImpl extends InstitutionFacade {
  constructor(
    private readonly createInstitution: CreateInstitutionUseCase,
    private readonly findInstitution: FindInstitutionUseCase,
    private readonly listInstitutions: ListInstitutionsUseCase,
    private readonly updateInstitution: UpdateInstitutionUseCase,
    private readonly setActive: SetInstitutionActiveUseCase,
    private readonly admins: AssignInstitutionAdminUseCase,
    private readonly states: ReadInstitutionStateUseCase,
  ) {
    super();
  }

  async create(command: CreateInstitutionCommand): Promise<InstitutionResult<InstitutionDto>> {
    return toResult(await this.createInstitution.execute(command), toDto);
  }

  async findById(query: InstitutionQuery): Promise<InstitutionResult<InstitutionDto>> {
    return toResult(await this.findInstitution.execute(query.institutionId), toDto);
  }

  async list(request: PageRequest): Promise<Page<InstitutionDto>> {
    const page = await this.listInstitutions.execute(request);

    return { items: page.items.map(toDto), pagination: page.pagination };
  }

  async update(command: UpdateInstitutionCommand): Promise<InstitutionResult<InstitutionDto>> {
    const { institutionId, ...draft } = command;

    return toResult(await this.updateInstitution.execute(institutionId, draft), toDto);
  }

  async deactivate(command: InstitutionStateCommand): Promise<InstitutionResult<InstitutionDto>> {
    return toResult(await this.setActive.execute(command.institutionId, false), toDto);
  }

  async activate(command: InstitutionStateCommand): Promise<InstitutionResult<InstitutionDto>> {
    return toResult(await this.setActive.execute(command.institutionId, true), toDto);
  }

  async assignAdmin(command: InstitutionAdminCommand): Promise<InstitutionResult<void>> {
    return toVoidResult(
      await this.admins.assign(command.institutionId, command.userId, command.actorId),
    );
  }

  async revokeAdmin(command: InstitutionAdminCommand): Promise<InstitutionResult<void>> {
    return toVoidResult(
      await this.admins.revoke(command.institutionId, command.userId, command.actorId),
    );
  }

  async stateOf(institutionId: string): Promise<InstitutionStateDto> {
    return this.states.execute(institutionId);
  }

  async statesOf(
    institutionIds: readonly string[],
  ): Promise<ReadonlyMap<string, InstitutionStateDto>> {
    return this.states.executeMany(institutionIds);
  }
}
