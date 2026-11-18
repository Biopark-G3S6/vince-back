import { AccessFacade } from '@modules/access/contracts/access.facade';

/**
 * A instituição a que o leitor está vinculado (`RF-INS-001` RN4), ou `null` quando ele não
 * tem vínculo — o `SYSTEM_ADMIN`, que lê todas. Sem ator, a chamada vem de outro módulo e
 * não sofre recorte.
 */
export async function readerInstitution(
  access: AccessFacade,
  actorId: string | undefined,
): Promise<{ readonly scoped: boolean; readonly institutionId: string | null }> {
  if (actorId === undefined) return { scoped: false, institutionId: null };

  const profile = await access.findOwnProfile({ actorId, userId: actorId });
  const institutionId = profile.ok ? profile.value.institutionId : null;

  return { scoped: institutionId !== null, institutionId };
}
