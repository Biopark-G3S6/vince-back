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
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiEnvelope, ApiFailures, ApiPageQuery, ApiPagedEnvelope } from '@shared/http/openapi';
import { respondWithPage, type EnvelopeResult } from '@shared/http/response-envelope';
import { pageRequestSchema, toPageRequest } from '@shared/http/pagination';
import { RequiresPermission } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';

import { CohortFacade } from '../contracts/cohort.facade';
import type { CohortInvitationDto } from '../contracts/cohort.dto';
import { InvitationResponse, IssueInvitationRequest, issueInvitationSchema } from './cohort.dto';
import { unwrap } from './result-mapper';

@ApiTags('Convite de turma')
@Controller('cohorts/:cohortId/invitations')
export class CohortInvitationController {
  constructor(private readonly cohorts: CohortFacade) {}

  @Post()
  @HttpCode(201)
  @RequiresPermission('INVITATION:CREATE')
  @ApiOperation({ summary: 'Emite convite aberto para a turma' })
  @ApiEnvelope(InvitationResponse, { status: 201, description: 'Criado, com `Location`.' })
  @ApiFailures('PERMISSION_DENIED', 'VALIDATION_FAILED')
  async issue(
    @Param('cohortId', ParseUUIDPipe) cohortId: string,
    @Body() body: IssueInvitationRequest,
    @CurrentSession() session: Session,
    @Res({ passthrough: true }) response: Response,
  ): Promise<InvitationResponse> {
    const input = parseOrFail(issueInvitationSchema, body);
    const invitation = unwrap(
      await this.cohorts.issueInvitation({ ...input, actorId: session.state.userId, cohortId }),
    );

    if (invitation.url !== undefined) {
      response.setHeader('Location', invitation.url);
    }

    return invitation;
  }

  @Get()
  @RequiresPermission('INVITATION:READ')
  @ApiOperation({ summary: 'Lista os convites da turma' })
  @ApiPageQuery()
  @ApiPagedEnvelope(InvitationResponse)
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async list(
    @Param('cohortId', ParseUUIDPipe) cohortId: string,
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly CohortInvitationDto[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const page = unwrap(
      await this.cohorts.listInvitations({ actorId: session.state.userId, cohortId, request }),
    );

    return respondWithPage(page.items, page.pagination);
  }

  @Delete(':invitationId')
  @HttpCode(204)
  @RequiresPermission('INVITATION:REVOKE')
  @ApiOperation({ summary: 'Revoga convite da turma' })
  @ApiNoContentResponse({ description: 'Revogado ou já revogado.' })
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async revoke(
    @Param('cohortId', ParseUUIDPipe) cohortId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentSession() session: Session,
  ): Promise<void> {
    unwrap(
      await this.cohorts.revokeInvitation({
        actorId: session.state.userId,
        cohortId,
        invitationId,
      }),
    );
  }
}
