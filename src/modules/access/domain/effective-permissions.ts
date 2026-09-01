/**
 * A apuração das permissões efetivas, na forma de **união de origens** (decisão D6).
 *
 * RF-ACS-001 RN2 e `ADR-0014` §5 definem as permissões efetivas como a união das
 * concedidas pelos papéis e das concessões diretas ativas. Esta vertical implementa uma
 * origem — os papéis; `PermissionGrant` entra depois, como segunda origem, sem alterar a
 * assinatura da consulta.
 *
 * A forma da união já nasce pronta por isso: a autenticação da vertical seguinte passa a
 * consumir esta superfície, e mudá-la depois seria quebra de contrato (`ADR-0004` §11).
 */

/** As permissões vindas de uma origem, identificada para diagnóstico. */
export interface PermissionSourceResult {
  readonly source: string;
  readonly permissions: readonly string[];
}

/** As origens que compõem as permissões efetivas. */
export const PERMISSION_SOURCE = {
  ROLE: 'ROLE',
  /** Ainda não implementada — entra com RF-ACS-006 a RF-ACS-008. */
  GRANT: 'GRANT',
} as const;

/**
 * A união, sem repetição e em ordem estável.
 *
 * A ordenação é do resultado, não da apuração: sem ela, duas apurações com as mesmas
 * permissões produziriam vetores distintos conforme a ordem em que as origens
 * responderam, e o cache passaria a guardar valores diferentes para o mesmo fato.
 */
export function uniteSources(results: readonly PermissionSourceResult[]): readonly string[] {
  const united = new Set<string>();

  for (const result of results) {
    for (const permission of result.permissions) {
      united.add(permission);
    }
  }

  return [...united].sort();
}
