import { Injectable } from '@nestjs/common';

import { INSTITUTION_ADMIN_ROLE } from '../domain/institution';
import { InstitutionAdminRepository } from '../domain/ports/institution-admin-repository';

/** O aceite de convite que o `access` relata (`InvitationAccepted`). */
export interface AcceptedInvitationFact {
  readonly userId: string;
  readonly roleCode: string;
  readonly institutionId: string;
  readonly scopeType: string | null;
}

/**
 * O convite de administrador institucional aceito vira vínculo de administração
 * (RF-INS-002): a conta já nasce com o papel, e o escopo do papel decorre do vínculo (RN2).
 * Idempotente, como a designação direta (E1).
 */
@Injectable()
export class LinkInvitedAdminUseCase {
  constructor(private readonly admins: InstitutionAdminRepository) {}

  async execute(fact: AcceptedInvitationFact): Promise<void> {
    if (fact.roleCode !== INSTITUTION_ADMIN_ROLE || fact.scopeType !== null) return;
    if (fact.userId === '' || fact.institutionId === '') return;

    await this.admins.link(fact.institutionId, fact.userId);
  }
}
