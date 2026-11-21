import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiFailures, ApiPageQuery, ApiPagedEnvelope } from '@shared/http/openapi';
import { pageRequestSchema, toPageRequest } from '@shared/http/pagination';
import { respondWithPage, type EnvelopeResult } from '@shared/http/response-envelope';
import { AuthenticatedRoute } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';

import { SearchUserDirectoryUseCase } from '../application/search-user-directory.use-case';
import type { DirectoryUserDto } from '../contracts/user-directory.dto';
import { DirectoryUserResponseDto, directoryQuerySchema, splitIds } from './user-directory.dto';
import { unwrap } from './result-mapper';

/**
 * O diretório de usuários (`user-directory`): escolher a pessoa nas designações e
 * resolver em nome o `userId` que as listagens dos outros módulos devolvem.
 *
 * **Rota autenticada, sem permissão declarada**, porque o diretório herda a permissão dos
 * requisitos a que serve — e a guarda de borda aceita uma só. A decisão fica no caso de
 * uso (`ADR-0014` §12), que conhece os dois modos.
 */
@ApiTags('Usuários')
@Controller('users')
export class UserDirectoryController {
  constructor(private readonly directory: SearchUserDirectoryUseCase) {}

  @Get()
  @AuthenticatedRoute()
  @ApiOperation({
    summary: 'Busca usuários da instituição para designação, ou resolve nomes por `ids`',
    description:
      'Sem `ids`, exige alguma permissão de designação ou de concessão. Com `ids` (até 100), ' +
      'qualquer usuário ativo obtém identificador e nome dos usuários da sua instituição.',
  })
  @ApiPageQuery()
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'active', required: false, enum: ['true', 'false'] })
  @ApiQuery({ name: 'ids', required: false, description: 'UUIDs separados por vírgula.' })
  @ApiQuery({ name: 'institutionId', required: false, format: 'uuid' })
  @ApiPagedEnvelope(DirectoryUserResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'VALIDATION_FAILED')
  async search(
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly DirectoryUserResponseDto[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const filters = parseOrFail(directoryQuerySchema, query);
    const page = unwrap(
      await this.directory.execute({
        actorId: session.state.userId,
        request,
        ...(filters.search === undefined || filters.search === ''
          ? {}
          : { search: filters.search }),
        ...(filters.role === undefined ? {} : { role: filters.role }),
        ...(filters.active === undefined ? {} : { active: filters.active === 'true' }),
        ...(filters.ids === undefined ? {} : { ids: splitIds(filters.ids) }),
        ...(filters.institutionId === undefined ? {} : { institutionId: filters.institutionId }),
      }),
    );

    return respondWithPage(page.items.map(toResponse), page.pagination);
  }
}

function toResponse(user: DirectoryUserDto): DirectoryUserResponseDto {
  return {
    id: user.id,
    name: user.name,
    ...(user.email === undefined ? {} : { email: user.email }),
    ...(user.active === undefined ? {} : { active: user.active }),
    ...(user.roleCodes === undefined ? {} : { roleCodes: [...user.roleCodes] }),
    ...(user.institutionId === undefined ? {} : { institutionId: user.institutionId }),
  };
}
