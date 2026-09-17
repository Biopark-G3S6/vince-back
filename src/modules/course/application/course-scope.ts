import { AccessFacade } from '@modules/access/contracts/access.facade';
import { InstitutionFacade } from '@modules/institution/contracts/institution.facade';

import { FAILURE, fail, ok, type Result } from '../domain/failure';

/** Obtém o vínculo institucional do ator sem consultar tabela de outro módulo. */
export async function actorInstitution(
  access: AccessFacade,
  institutions: InstitutionFacade,
  actorId: string,
): Promise<Result<string>> {
  const profile = await access.findOwnProfile({ actorId, userId: actorId });

  if (!profile.ok || !profile.value.active || profile.value.institutionId === null) {
    return fail(FAILURE.PERMISSION_DENIED);
  }

  const state = await institutions.stateOf(profile.value.institutionId);

  if (!state.exists) {
    return fail(FAILURE.RESOURCE_NOT_FOUND);
  }

  if (!state.active) {
    return fail(FAILURE.INSTITUTION_INACTIVE);
  }

  return ok(profile.value.institutionId);
}
