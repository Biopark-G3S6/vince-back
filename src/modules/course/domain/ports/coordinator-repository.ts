export const COORDINATOR_AUDIT_OPERATION = {
  ASSIGNED: 'ASSIGNED',
  REVOKED: 'REVOKED',
} as const;

/** Código textual do papel global atribuído pela fachada de `access`. */
export const COORDINATOR_ROLE = 'COORDINATOR';

export type CoordinatorAuditOperation =
  (typeof COORDINATOR_AUDIT_OPERATION)[keyof typeof COORDINATOR_AUDIT_OPERATION];

export interface CoordinatorLink {
  readonly courseId: string;
  readonly userId: string;
}

export interface CoordinatorAuditEntry {
  readonly id: string;
  readonly courseId: string;
  readonly userId: string;
  readonly actorId: string;
  readonly operation: CoordinatorAuditOperation;
  readonly at: Date;
}

export interface CoordinatorWriteOutcome {
  readonly changed: boolean;
  /** Preenchido quando uma concorrência encontrou o vínculo que venceu. */
  readonly currentUserId?: string;
}

export abstract class CoordinatorRepository {
  abstract findByCourse(courseId: string): Promise<CoordinatorLink | null>;
  abstract assign(
    courseId: string,
    userId: string,
    actorId: string,
  ): Promise<CoordinatorWriteOutcome>;
  abstract revoke(
    courseId: string,
    userId: string,
    actorId: string,
  ): Promise<CoordinatorWriteOutcome>;
  abstract countByUser(userId: string): Promise<number>;

  /**
   * Os cursos que o usuário coordena. Uma consulta, qualquer que seja a quantidade
   * (`ADR-0011` §9).
   *
   * É a consulta inversa de `findByCourse`, e existe para quem precisa do **alcance** do
   * coordenador — `event`, ao listar os eventos do curso dele (`ADR-0032` §21).
   */
  abstract findByUser(userId: string): Promise<readonly string[]>;
  abstract findAuditByCourse(courseId: string): Promise<readonly CoordinatorAuditEntry[]>;
}
