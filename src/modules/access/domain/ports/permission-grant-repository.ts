import type { Page, PageRequest } from '@shared/http/pagination';

/** Uma concessão direta (`ADR-0014` §5, RF-ACS-006). A permissão atravessa como código. */
export interface PermissionGrantRecord {
  readonly id: string;
  readonly granterId: string;
  readonly beneficiaryId: string;
  readonly institutionId: string;
  readonly permissionCode: string;
  readonly validUntil: Date | null;
  readonly createdAt: Date;
}

export interface NewPermissionGrant {
  readonly id: string;
  readonly granterId: string;
  readonly beneficiaryId: string;
  readonly institutionId: string;
  readonly permissionCode: string;
  readonly validUntil: Date | null;
}

export interface PermissionGrantFilters {
  readonly institutionId: string;
  readonly beneficiaryId?: string;
  readonly granterId?: string;
}

/** As permissões que as concessões ativas dão a uma conta, e quando a primeira vence. */
export interface GrantedPermissions {
  readonly permissions: readonly string[];
  readonly earliestExpiry: Date | null;
}

/**
 * As concessões diretas. **Não existe operação de alteração nem de remoção**: a linha é a
 * trilha (`ADR-0014` §18), e a revogação só preenche o instante e o autor, uma vez.
 */
export abstract class PermissionGrantRepository {
  /** `UNKNOWN_PERMISSION` quando o código não está no catálogo carregado. */
  abstract create(grant: NewPermissionGrant): Promise<PermissionGrantRecord | 'UNKNOWN_PERMISSION'>;

  /**
   * Revoga a concessão ativa da instituição. Devolve o beneficiário, para invalidar o
   * cache dele, ou `null` quando não há concessão ativa com esse identificador.
   */
  abstract revoke(
    id: string,
    institutionId: string,
    actorId: string,
    now: Date,
  ): Promise<string | null>;

  abstract listActive(
    filters: PermissionGrantFilters,
    request: PageRequest,
    now: Date,
  ): Promise<Page<PermissionGrantRecord>>;

  abstract grantedTo(userId: string, now: Date): Promise<GrantedPermissions>;
}
