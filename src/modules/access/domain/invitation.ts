import { randomBytes, createHash } from 'node:crypto';

/**
 * O convite: a via de uso único e com prazo por onde alguém entra ou reentra na conta.
 *
 * O meio de redefinição de senha é um convite de propósito `PASSWORD_RESET`
 * (RF-ACS-003 RN1). Não é acomodação: `ADR-0027` §6 proíbe tabela fora da lista de §5, e a
 * URS §2.4 dá a RF-ACS-003 e a RF-ACS-004 o mesmo `INVITATION_EXPIRED` que dá ao convite
 * de criação de conta — o parentesco está declarado lá, não inventado aqui.
 */

export const INVITATION_PURPOSE = {
  PASSWORD_RESET: 'PASSWORD_RESET',
  /** Entra com RF-TUR-005. Declarado para que o propósito já nasça sendo uma escolha. */
  ACCOUNT_CREATION: 'ACCOUNT_CREATION',
} as const;

export type InvitationPurpose = (typeof INVITATION_PURPOSE)[keyof typeof INVITATION_PURPOSE];

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
