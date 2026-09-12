import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiEnvelope, ApiFailures } from '@shared/http/openapi';
import { PublicRoute } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';

import { AccessFacade } from '../contracts/access.facade';
import type { AcceptInvitationResult, InvitationDetails } from '../contracts/invitation.dto';
import {
  AcceptInvitationRequestDto,
  AcceptedInvitationResponse,
  InvitationDetailsResponse,
  acceptInvitationSchema,
} from './invitation.dto';
import { unwrap } from './result-mapper';

@ApiTags('Convite')
@Controller('invitations')
export class InvitationController {
  constructor(private readonly access: AccessFacade) {}

  @Get(':token')
  @PublicRoute()
  @ApiOperation({ summary: 'Consulta um convite disponível' })
  @ApiEnvelope(InvitationDetailsResponse)
  @ApiFailures('INVITATION_EXPIRED')
  async find(@Param('token') token: string): Promise<InvitationDetailsResponse> {
    return toDetails(unwrap(await this.access.findInvitation(token)));
  }

  @Post(':token/acceptance')
  @PublicRoute()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Aceita um convite e cria a conta' })
  @ApiEnvelope(AcceptedInvitationResponse, { status: 201 })
  @ApiFailures(
    'VALIDATION_FAILED',
    'EMAIL_ALREADY_REGISTERED',
    'INVITATION_EXPIRED',
    'INVITATION_REVOKED',
    'INVITATION_LIMIT_REACHED',
  )
  async accept(
    @Param('token') token: string,
    @Body() body: AcceptInvitationRequestDto,
  ): Promise<AcceptedInvitationResponse> {
    const input = parseOrFail(acceptInvitationSchema, body);

    return toAccepted(unwrap(await this.access.acceptInvitation({ token, ...input })));
  }
}

function toDetails(invitation: InvitationDetails): InvitationDetailsResponse {
  return invitation;
}

function toAccepted(accepted: AcceptInvitationResult): AcceptedInvitationResponse {
  return accepted;
}
