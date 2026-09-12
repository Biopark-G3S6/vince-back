/**
 * DTOs da instituição.
 *
 * Nenhum tipo do Prisma entra aqui (`ADR-0004` §8, §9, `ADR-0028` §23): os identificadores
 * atravessam a fronteira como texto.
 */

export interface InstitutionDto {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly cnpj: string | null;
  readonly website: string | null;
  readonly contactEmail: string | null;
  readonly active: boolean;
}

/** O cadastro (RF-INS-001). A instituição nasce ativa; o estado não é informado aqui. */
export interface CreateInstitutionCommand {
  readonly name: string;
  readonly code: string;
  readonly cnpj?: string | null;
  readonly website?: string | null;
  readonly contactEmail?: string | null;
}

/**
 * A alteração (RF-INS-001). Campo ausente permanece como está; `null` remove o opcional.
 *
 * **Não há campo de estado**, e a ausência é a regra (`ADR-0028` §11): ativar e desativar
 * são operações próprias, com permissão própria.
 */
export interface UpdateInstitutionCommand {
  readonly institutionId: string;
  readonly name?: string;
  readonly code?: string;
  readonly cnpj?: string | null;
  readonly website?: string | null;
  readonly contactEmail?: string | null;
}

export interface InstitutionQuery {
  readonly institutionId: string;
}

/** Desativação e reativação, ambas idempotentes (`ADR-0028` §11). */
export interface InstitutionStateCommand {
  readonly institutionId: string;
}

/** A designação e a revogação de administrador institucional (RF-INS-002). */
export interface InstitutionAdminCommand {
  readonly institutionId: string;
  readonly userId: string;
  /** Quem executou, para a trilha de auditoria da atribuição de papel (`ADR-0014` §18). */
  readonly actorId?: string | null;
}

/**
 * Existência e estado de uma instituição, para o consumidor interno (`ADR-0028` §21).
 *
 * `exists: false` **não é falha** — é resposta. Quem pergunta é a composição de borda, e
 * uma exceção ali transformaria conta órfã em erro de servidor.
 */
export interface InstitutionStateDto {
  readonly exists: boolean;
  readonly active: boolean;
}
