/**
 * Port da atribuição de papel e da sua trilha de auditoria.
 *
 * As duas coisas vivem no mesmo port porque vivem na mesma transação (decisão D4,
 * `ADR-0019` §1): a spec exige que a falha não deixe rastro parcial, e só a transação
 * única garante isso.
 */

export const AUDIT_OPERATION = {
  ASSIGNED: 'ASSIGNED',
  REVOKED: 'REVOKED',
} as const;

export type AuditOperation = (typeof AUDIT_OPERATION)[keyof typeof AUDIT_OPERATION];

export interface RoleAssignmentAuditEntry {
  readonly id: string;
  /** Quem executou. Nulo quando a origem é a carga inicial, que não tem ator. */
  readonly actorId: string | null;
  readonly subjectId: string;
  readonly roleCode: string;
  readonly operation: AuditOperation;
  readonly at: Date;
}

/** O desfecho da atribuição ou da revogação, para o relato do caso de uso. */
export interface RoleAssignmentOutcome {
  /** `false` quando a operação foi idempotente: nada mudou, e nada foi registrado. */
  readonly changed: boolean;
}

export abstract class RoleAssignmentRepository {
  /**
   * Atribui o papel e registra a atribuição, na mesma transação. Idempotente: papel já
   * possuído conclui com sucesso, sem segundo vínculo e sem segundo registro.
   */
  abstract assign(
    actorId: string | null,
    subjectId: string,
    roleCode: string,
  ): Promise<RoleAssignmentOutcome>;

  /**
   * Revoga o papel e registra a revogação, na mesma transação. Idempotente: papel não
   * possuído conclui com sucesso e nada é alterado.
   */
  abstract revoke(
    actorId: string | null,
    subjectId: string,
    roleCode: string,
  ): Promise<RoleAssignmentOutcome>;

  /** Os códigos de papel que a conta possui. */
  abstract rolesOf(subjectId: string): Promise<readonly string[]>;
}

/**
 * Leitura da trilha de auditoria — e **somente** leitura.
 *
 * A trilha é imutável (`ADR-0014` §18, `ADR-0027` §5): não existe, aqui nem em lugar
 * algum, operação que altere ou remova um registro gravado. A gravação acontece dentro
 * da transação de `RoleAssignmentRepository`, que é o único ponto que acrescenta à
 * trilha.
 */
export abstract class RoleAssignmentAuditRepository {
  /** Os registros da conta, do mais antigo ao mais recente. */
  abstract findBySubject(subjectId: string): Promise<readonly RoleAssignmentAuditEntry[]>;
}
