import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { ApiEnvelope, ApiFailures, ApiPageQuery, ApiPagedEnvelope } from '@shared/http/openapi';
import { pageRequestSchema, toPageRequest } from '@shared/http/pagination';
import { respondWithPage, type EnvelopeResult } from '@shared/http/response-envelope';
import { RequiresPermission } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';

import type { InstitutionDto } from '../contracts/institution.dto';
import { InstitutionFacade } from '../contracts/institution.facade';
import {
  CreateInstitutionRequestDto,
  InstitutionDtoResponse,
  UpdateInstitutionRequestDto,
  createInstitutionSchema,
  updateInstitutionSchema,
} from './institution.dto';
import { unwrap } from './result-mapper';

/**
 * A manutenção de instituição (RF-INS-001).
 *
 * Toda rota exige permissão nomeada, e nenhuma delas é de titularidade: o
 * `SYSTEM_ADMIN` atua sobre **todas** as instituições (URS §1.4.1 item 3), de modo que
 * não há registro "próprio" a verificar dentro do caso de uso. É a exceção que confirma
 * `ADR-0014` §12 — quando o escopo é global, a permissão é a decisão inteira.
 *
 * A desativação e a reativação são rotas **próprias**, e não um campo de `PATCH`
 * (`ADR-0028` §11): elas exigem `INSTITUTION:DEACTIVATE`, e admiti-las na alteração daria
 * a quem tem `INSTITUTION:UPDATE` um poder que o catálogo não lhe deu.
 */
@ApiTags('Instituição')
@Controller('institutions')
export class InstitutionController {
  constructor(private readonly institutions: InstitutionFacade) {}

  @Post()
  @HttpCode(201)
  @RequiresPermission('INSTITUTION:CREATE')
  @ApiOperation({ summary: 'Cadastra uma instituição, que nasce ativa' })
  @ApiEnvelope(InstitutionDtoResponse, { status: 201, description: 'Criada, com `Location`.' })
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'VALIDATION_FAILED')
  async create(
    @Body() body: CreateInstitutionRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<InstitutionDtoResponse> {
    const command = parseOrFail(createInstitutionSchema, body);
    const institution = unwrap(await this.institutions.create(command));

    // `ADR-0025` §27: o recurso criado em `data` e o cabeçalho `Location`.
    response.setHeader('Location', `/institutions/${institution.id}`);

    return toResponse(institution);
  }

  @Get()
  @RequiresPermission('INSTITUTION:READ')
  @ApiOperation({
    summary: 'Lista as instituições, paginado',
    description:
      'Inclui ativas e inativas, distinguidas por `active`. `hasNext` é apurado sem ' +
      'consulta de contagem; `totalItems` e `totalPages` só com `withTotal=true`.',
  })
  @ApiPageQuery()
  @ApiPagedEnvelope(InstitutionDtoResponse)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'VALIDATION_FAILED')
  async list(
    @Query() query: Record<string, unknown>,
  ): Promise<EnvelopeResult<readonly InstitutionDtoResponse[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const page = await this.institutions.list(request);

    return respondWithPage(page.items.map(toResponse), page.pagination);
  }

  @Get(':institutionId')
  @RequiresPermission('INSTITUTION:READ')
  @ApiOperation({ summary: 'A instituição e o seu estado' })
  @ApiEnvelope(InstitutionDtoResponse)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async find(
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
  ): Promise<InstitutionDtoResponse> {
    return toResponse(unwrap(await this.institutions.findById({ institutionId })));
  }

  @Patch(':institutionId')
  @RequiresPermission('INSTITUTION:UPDATE')
  @ApiOperation({
    summary: 'Altera nome e dados de identificação',
    description:
      'NÃO muda o estado: um campo de estado no corpo é descartado, e a instituição ' +
      'permanece como estava. Ativar e desativar são rotas próprias.',
  })
  @ApiEnvelope(InstitutionDtoResponse)
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'RESOURCE_NOT_FOUND',
  )
  async update(
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
    @Body() body: UpdateInstitutionRequestDto,
  ): Promise<InstitutionDtoResponse> {
    const changes = parseOrFail(updateInstitutionSchema, body);

    return toResponse(unwrap(await this.institutions.update({ institutionId, ...changes })));
  }

  @Post(':institutionId/deactivation')
  @RequiresPermission('INSTITUTION:DEACTIVATE')
  @ApiOperation({
    summary: 'Desativa a instituição',
    description:
      'Aceita ainda que existam cursos ativos (RF-INS-001 E2). Idempotente. Não remove ' +
      'a instituição nem os seus registros; os usuários dela deixam de autenticar.',
  })
  @ApiEnvelope(InstitutionDtoResponse)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async deactivate(
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
  ): Promise<InstitutionDtoResponse> {
    return toResponse(unwrap(await this.institutions.deactivate({ institutionId })));
  }

  @Post(':institutionId/activation')
  @RequiresPermission('INSTITUTION:DEACTIVATE')
  @ApiOperation({
    summary: 'Reativa a instituição',
    description:
      'Idempotente. Os usuários voltam a autenticar e recuperam as permissões dos seus ' +
      'papéis, sem exigir nova autenticação de quem já tinha sessão.',
  })
  @ApiEnvelope(InstitutionDtoResponse)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async activate(
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
  ): Promise<InstitutionDtoResponse> {
    return toResponse(unwrap(await this.institutions.activate({ institutionId })));
  }
}

function toResponse(institution: InstitutionDto): InstitutionDtoResponse {
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
