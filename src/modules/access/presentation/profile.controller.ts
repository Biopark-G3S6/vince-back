import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiEnvelope, ApiFailures } from '@shared/http/openapi';
import { AuthenticatedRoute } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';

import { AccessFacade } from '../contracts/access.facade';
import type { UserProfileDto } from '../contracts/user.dto';
import {
  UpdateProfileRequestDto,
  UserProfileDtoResponse,
  updateProfileSchema,
} from './profile.dto';
import { unwrap } from './result-mapper';

/**
 * O perfil próprio (RF-ACS-005, RF-INT-001).
 *
 * **Sem permissão declarada, e isso é a regra e não a falta dela.** RF-ACS-005 declara
 * "Permissões geradas: — (próprio perfil)": a titularidade é verificada dentro do caso de
 * uso (`ADR-0014` §12) e NÃO é modelada como permissão (§13). Uma `USER:READ_SELF` seria
 * permissão sem requisito que a origine, contra §7 e `PAD-SEG-008`.
 *
 * O identificador do titular vem **da sessão**, nunca do caminho nem do corpo: um
 * `/users/:id/profile` transferiria ao cliente a escolha de quem ele é.
 */
@ApiTags('Perfil')
@Controller('profile')
export class ProfileController {
  constructor(private readonly access: AccessFacade) {}

  @Get()
  @AuthenticatedRoute()
  @ApiOperation({ summary: 'O perfil do usuário autenticado' })
  @ApiEnvelope(UserProfileDtoResponse)
  @ApiFailures('AUTHENTICATION_FAILED', 'RESOURCE_NOT_FOUND')
  async find(@CurrentSession() session: Session): Promise<UserProfileDtoResponse> {
    const actorId = session.state.userId;

    return toResponse(unwrap(await this.access.findOwnProfile({ actorId, userId: actorId })));
  }

  @Patch()
  @AuthenticatedRoute()
  @ApiOperation({
    summary: 'Atualiza nome, área de atuação e preferência de idioma',
    description:
      'Tentar alterar e-mail, papéis, vínculo ou estado recusa a operação INTEIRA com ' +
      'PERMISSION_DENIED (RF-ACS-005 E2, RN1) — nenhum campo é alterado.',
  })
  @ApiEnvelope(UserProfileDtoResponse)
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'LANGUAGE_NOT_SUPPORTED',
    'RESOURCE_NOT_FOUND',
  )
  async update(
    @CurrentSession() session: Session,
    @Body() body: UpdateProfileRequestDto,
  ): Promise<UserProfileDtoResponse> {
    const update = parseOrFail(updateProfileSchema, body);
    const actorId = session.state.userId;

    return toResponse(
      unwrap(await this.access.updateOwnProfile({ actorId, userId: actorId, ...update })),
    );
  }
}

function toResponse(profile: UserProfileDto): UserProfileDtoResponse {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    expertiseArea: profile.expertiseArea,
    preferredLanguage: profile.preferredLanguage,
    active: profile.active,
    institutionId: profile.institutionId,
    roleCodes: [...profile.roleCodes],
  };
}
