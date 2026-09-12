import { randomBytes, createHash } from 'node:crypto';

import { VIOLATION, type FieldViolation } from './failure';
import { ROLE, type RoleCode } from './role-catalog';

/**
 * O convite: a via de entrada de uma conta ou de redefinição de senha.
 *
 * O meio de redefinição de senha é um convite de propósito `PASSWORD_RESET`
 * (RF-ACS-003 RN1). O armazenamento compartilhado é declarado pelo `ADR-0027` §5, e a
 * URS §2.4 dá a RF-ACS-003 e a RF-ACS-004 o mesmo `INVITATION_EXPIRED` que dá ao convite
 * de criação de conta — o parentesco está declarado lá, não inventado aqui.
 */

export const INVITATION_PURPOSE = {
  PASSWORD_RESET: 'PASSWORD_RESET',
  /** Entra com RF-TUR-005. Declarado para que o propósito já nasça sendo uma escolha. */
  ACCOUNT_CREATION: 'ACCOUNT_CREATION',
} as const;

export type InvitationPurpose = (typeof INVITATION_PURPOSE)[keyof typeof INVITATION_PURPOSE];

export const INVITATION_OPERATION = {
  ISSUED: 'ISSUED',
  ACCEPTED: 'ACCEPTED',
  REVOKED: 'REVOKED',
} as const;

export type InvitationOperation = (typeof INVITATION_OPERATION)[keyof typeof INVITATION_OPERATION];

export const INVITATION_STATE = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
  EXHAUSTED: 'EXHAUSTED',
} as const;

export type InvitationState = (typeof INVITATION_STATE)[keyof typeof INVITATION_STATE];

export interface InvitationRecord {
  readonly id: string;
  readonly purpose: InvitationPurpose;
  readonly targetEmail: string | null;
  readonly roleCode: string | null;
  readonly institutionId: string | null;
  readonly institutionName: string | null;
  readonly actorId: string | null;
  readonly expiresAt: Date;
  readonly maxUses: number | null;
  readonly useCount: number;
  readonly usedAt: Date | null;
  readonly revokedAt: Date | null;
}

export const INVITATION_ROLE_GRANTS: Readonly<Record<RoleCode, readonly RoleCode[]>> = {
  [ROLE.SYSTEM_ADMIN]: [ROLE.INSTITUTION_ADMIN],
  [ROLE.INSTITUTION_ADMIN]: [ROLE.COORDINATOR, ROLE.PROFESSOR],
  [ROLE.COORDINATOR]: [ROLE.PROFESSOR],
  [ROLE.PROFESSOR]: [ROLE.STUDENT],
  [ROLE.STUDENT]: [],
};

export interface InvitationDraft {
  readonly targetEmail?: string | null;
  readonly roleCode?: string;
  readonly institutionId?: string;
  readonly institutionName?: string;
  readonly expiresAt?: Date;
  readonly maxUses?: number | null;
}

/** Valida a forma e as invariantes comuns às duas formas de convite. */
export function violationsOfInvitationDraft(
  draft: InvitationDraft,
  now = new Date(),
): FieldViolation[] {
  const violations: FieldViolation[] = [];

  if (draft.roleCode === undefined || draft.roleCode.length === 0) {
    violations.push({ field: 'roleCode', code: VIOLATION.REQUIRED });
  }

  if (draft.institutionId === undefined || draft.institutionId.length === 0) {
    violations.push({ field: 'institutionId', code: VIOLATION.REQUIRED });
  }

  if (draft.institutionName === undefined || draft.institutionName.trim().length === 0) {
    violations.push({ field: 'institutionName', code: VIOLATION.REQUIRED });
  }

  if (draft.expiresAt === undefined) {
    violations.push({ field: 'expiresAt', code: VIOLATION.REQUIRED });
  } else if (
    !Number.isFinite(draft.expiresAt.getTime()) ||
    draft.expiresAt.getTime() <= now.getTime()
  ) {
    violations.push({ field: 'expiresAt', code: VIOLATION.MALFORMED });
  }

  if (draft.targetEmail !== undefined && draft.targetEmail !== null) {
    if (draft.targetEmail.trim().length === 0) {
      violations.push({ field: 'targetEmail', code: VIOLATION.MALFORMED });
    }

    if (draft.maxUses !== undefined && draft.maxUses !== null) {
      violations.push({ field: 'maxUses', code: VIOLATION.MALFORMED });
    }
  } else if (
    draft.maxUses !== undefined &&
    draft.maxUses !== null &&
    (!Number.isInteger(draft.maxUses) || draft.maxUses <= 0)
  ) {
    violations.push({ field: 'maxUses', code: VIOLATION.MALFORMED });
  }

  return violations;
}

export function invitationStateOf(invitation: InvitationRecord, now: Date): InvitationState {
  if (invitation.revokedAt !== null) {
    return INVITATION_STATE.REVOKED;
  }

  if (invitation.expiresAt.getTime() <= now.getTime()) {
    return INVITATION_STATE.EXPIRED;
  }

  if (
    invitation.usedAt !== null ||
    (invitation.maxUses !== null && invitation.useCount >= invitation.maxUses)
  ) {
    return INVITATION_STATE.EXHAUSTED;
  }

  return INVITATION_STATE.ACTIVE;
}

export function invitationFormOf(targetEmail: string | null): 'DIRECTED' | 'OPEN' {
  return targetEmail === null ? 'OPEN' : 'DIRECTED';
}

/**
 * 32 bytes de fonte criptograficamente segura, em `base64url`.
 *
 * **Não codifica informação sobre a conta** — a spec o exige, e a razão é que um meio de
 * redefinição que revele de quem ele é vira meio de enumeração de contas mesmo quando
 * expirado.
 */
const TOKEN_BYTES = 32;

export function generateInvitationToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/**
 * O valor guardado no banco (decisão D7). O valor entregue ao usuário não é persistido.
 *
 * **SHA-256, e não Argon2id**, e a diferença é deliberada. Argon2id existe para tornar
 * caro o ataque a um segredo de baixa entropia — uma senha que a pessoa escolheu. Aqui o
 * segredo tem 256 bits de aleatoriedade: nenhuma quantidade de força bruta o alcança, e o
 * que se ganharia em custo se perderia onde importa — a derivação lenta usa sal por linha,
 * o que impede procurar pelo valor derivado e obrigaria a percorrer a tabela inteira a
 * cada tentativa de uso.
 */
export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export function invitationExpiresAt(now: Date, ttlSeconds: number): Date {
  return new Date(now.getTime() + ttlSeconds * 1000);
}
