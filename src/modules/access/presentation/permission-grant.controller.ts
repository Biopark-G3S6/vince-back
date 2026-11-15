import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiEnvelope, ApiFailures, ApiPageQuery, ApiPagedEnvelope } from '@shared/http/openapi';
import { pageRequestSchema, toPageRequest } from '@shared/http/pagination';
import { respondWithPage, type EnvelopeResult } from '@shared/http/response-envelope';
import { RequiresPermission } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';

import {
  GrantPermissionUseCase,
  ListPermissionGrantsUseCase,
  RevokePermissionGrantUseCase,
} from '../application/permission-grant.use-cases';
import type { PermissionGrantDto } from '../contracts/permission-grant.dto';
import {
  GrantPermissionRequestDto,
  PermissionGrantResponseDto,
  grantPermissionSchema,
  listPermissionGrantsSchema,
} from './permission-grant.dto';
import { unwrap } from './result-mapper';

/**
 * Concessões diretas de permissão (RF-ACS-006 a RF-ACS-008, `ADR-0014` §15–§21).
 *
 * Invoca os casos de uso sem passar pela fachada: nenhum outro módulo concede ou consulta
 * concessões, e a fachada é a superfície **pública** do módulo (`ADR-0027` §12) — alargá-la
 * sem consumidor seria expor o que ninguém pediu.
 */
@ApiTags('Concessões de permissão')
@Controller('permission-grants')
export class PermissionGrantController {
  constructor(
    private readonly grant: GrantPermissionUseCase,
    private readonly revoke: RevokePermissionGrantUseCase,
    private readonly list: ListPermissionGrantsUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @RequiresPermission('PERMISSION_GRANT:CREATE')
  @ApiOperation({ summary: 'Concede a outro usuário uma permissão que o ator possui' })
  @ApiEnvelope(PermissionGrantResponseDto, { status: 201 })
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'GRANT_NOT_HELD_BY_GRANTER',
    'SELF_GRANT_NOT_ALLOWED',
    'RESOURCE_NOT_FOUND',
  )
  async create(
    @Body() body: GrantPermissionRequestDto,
    @CurrentSession() session: Session,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PermissionGrantResponseDto> {
    const input = parseOrFail(grantPermissionSchema, body);
    const created = unwrap(
      await this.grant.execute({
        actorId: session.state.userId,
        beneficiaryId: input.beneficiaryId,
        permission: input.permission,
        validUntil:
          input.validUntil === undefined || input.validUntil === null
            ? null
            : new Date(input.validUntil),
      }),
    );

    response.setHeader('Location', `/permission-grants/${created.id}`);

    return toResponse(created);
  }

  @Get()
  @RequiresPermission('PERMISSION_GRANT:READ')
  @ApiOperation({ summary: 'Lista as concessões diretas ativas da instituição do ator' })
  @ApiPageQuery()
  @ApiQuery({ name: 'beneficiaryId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'granterId', required: false, format: 'uuid' })
  @ApiPagedEnvelope(PermissionGrantResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'VALIDATION_FAILED')
  async findAll(
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly PermissionGrantResponseDto[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const filters = parseOrFail(listPermissionGrantsSchema, query);
    const page = unwrap(
      await this.list.execute({ actorId: session.state.userId, request, ...filters }),
    );

    return respondWithPage(page.items.map(toResponse), page.pagination);
  }

  @Delete(':grantId')
  @HttpCode(204)
  @RequiresPermission('PERMISSION_GRANT:REVOKE')
  @ApiOperation({ summary: 'Revoga uma concessão ativa, com efeito imediato' })
  @ApiNoContentResponse({ description: 'Revogada.' })
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async remove(
    @Param('grantId', ParseUUIDPipe) grantId: string,
    @CurrentSession() session: Session,
  ): Promise<void> {
    unwrap(await this.revoke.execute({ actorId: session.state.userId, grantId }));
  }
}

function toResponse(grant: PermissionGrantDto): PermissionGrantResponseDto {
  return {
    id: grant.id,
    beneficiaryId: grant.beneficiaryId,
    granterId: grant.granterId,
    permission: grant.permission,
    grantedAt: grant.grantedAt.toISOString(),
    validUntil: grant.validUntil?.toISOString() ?? null,
  };
}
