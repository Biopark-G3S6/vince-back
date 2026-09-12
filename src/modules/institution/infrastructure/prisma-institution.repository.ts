import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { offsetOf, takeOf, type PageRequest } from '@shared/http/pagination';

import type { Institution } from '../domain/institution';
import {
  InstitutionRepository,
  type InstitutionRows,
  type InstitutionState,
  type UniqueField,
  type WriteOutcome,
} from '../domain/ports/institution-repository';
import { InstitutionPrisma } from './institution-prisma';

/** Violação de restrição única — aqui, o índice da sigla ou o do CNPJ. */
const UNIQUE_VIOLATION = 'P2002';

/** Registro exigido pela operação não foi encontrado. */
const RECORD_NOT_FOUND = 'P2025';

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

/**
 * Qual índice colidiu.
 *
 * `meta.target` do Prisma nomeia as colunas da restrição. Colisão que não seja de sigla é
 * de CNPJ: são os dois únicos índices únicos da tabela, e presumir a sigla diante do
 * desconhecido apontaria o campo errado.
 */
function duplicatedField(error: unknown): UniqueField {
  const target: unknown = (error as Prisma.PrismaClientKnownRequestError).meta?.target;

  // `meta.target` é o nome da restrição, ou o vetor das suas colunas, conforme o
  // conector. Só as duas formas textuais interessam; qualquer outra cai no padrão.
  const columns = Array.isArray(target)
    ? target.filter((entry): entry is string => typeof entry === 'string')
    : [typeof target === 'string' ? target : ''];

  return columns.some((column) => column.includes('cnpj')) ? 'cnpj' : 'code';
}

/** A linha do Prisma, projetada na entidade de domínio. */
interface InstitutionRow {
  id: string;
  name: string;
  code: string;
  cnpj: string | null;
  website: string | null;
  contactEmail: string | null;
  active: boolean;
}

function toInstitution(row: InstitutionRow): Institution {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    cnpj: row.cnpj,
    website: row.website,
    contactEmail: row.contactEmail,
    active: row.active,
  };
}

/** As colunas que compõem a entidade. Declaradas uma vez: `select` é contrato. */
const INSTITUTION_COLUMNS = {
  id: true,
  name: true,
  code: true,
  cnpj: true,
  website: true,
  contactEmail: true,
  active: true,
} as const;

/**
 * A ordenação da listagem.
 *
 * Por nome, que é o que o operador procura; e por identificador em seguida, que é o que
 * torna a ordem **total**. Sem o desempate, duas instituições homônimas poderiam trocar
 * de posição entre uma página e a seguinte, e a paginação por deslocamento repetiria uma
 * e omitiria a outra.
 */
const LIST_ORDER = [{ name: 'asc' as const }, { id: 'asc' as const }];

@Injectable()
export class PrismaInstitutionRepository extends InstitutionRepository {
  constructor(private readonly prisma: InstitutionPrisma) {
    super();
  }

  async create(institution: Institution): Promise<WriteOutcome> {
    try {
      const row = await this.prisma.institution.create({
        data: { ...institution },
        select: INSTITUTION_COLUMNS,
      });

      return { ok: true, institution: toInstitution(row) };
    } catch (error) {
      if (isPrismaError(error, UNIQUE_VIOLATION)) {
        return { ok: false, duplicated: duplicatedField(error) };
      }

      throw error;
    }
  }

  async findById(id: string): Promise<Institution | null> {
    const row = await this.prisma.institution.findUnique({
      where: { id },
      select: INSTITUTION_COLUMNS,
    });

    return row === null ? null : toInstitution(row);
  }

  /**
   * A página, em **uma** consulta — duas quando o total é pedido (`ADR-0025` §24).
   *
   * `take` é `pageSize + 1`: o registro excedente responde `hasNext` sem consulta de
   * contagem (§23), e é descartado antes de a página sair daqui. A contagem de consultas
   * não varia com a quantidade de registros devolvidos (`ADR-0011` §9).
   */
  async list(request: PageRequest): Promise<InstitutionRows> {
    const rows = await this.prisma.institution.findMany({
      select: INSTITUTION_COLUMNS,
      orderBy: LIST_ORDER,
      skip: offsetOf(request),
      take: takeOf(request),
    });

    const institutions = rows.map(toInstitution);

    if (!request.withTotal) {
      return { rows: institutions };
    }

    return { rows: institutions, totalItems: await this.prisma.institution.count() };
  }

  async save(institution: Institution): Promise<WriteOutcome | null> {
    const { id, ...changes } = institution;

    try {
      const row = await this.prisma.institution.update({
        where: { id },
        // `active` não é atualizado aqui por não estar em `changes`: a entidade que chega
        // veio de `withChanges`, que preserva o estado (`ADR-0028` §11).
        data: { ...changes },
        select: INSTITUTION_COLUMNS,
      });

      return { ok: true, institution: toInstitution(row) };
    } catch (error) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) {
        return null;
      }

      if (isPrismaError(error, UNIQUE_VIOLATION)) {
        return { ok: false, duplicated: duplicatedField(error) };
      }

      throw error;
    }
  }

  async setActive(id: string, active: boolean): Promise<Institution | null> {
    try {
      const row = await this.prisma.institution.update({
        where: { id },
        data: { active },
        select: INSTITUTION_COLUMNS,
      });

      return toInstitution(row);
    } catch (error) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) {
        return null;
      }

      throw error;
    }
  }

  /**
   * O estado de muitos identificadores em **uma** consulta (`ADR-0028` §21).
   *
   * Um `IN` com a lista inteira, e não um laço de consultas — que é o que `ADR-0011` §13
   * reprova em revisão. Identificador ausente do resultado não existe, e entra no mapa
   * como `exists: false`: quem pergunta precisa distinguir "não existe" de "existe e está
   * inativa", e um mapa incompleto obrigaria quem chama a inferir a diferença.
   */
  async statesOf(ids: readonly string[]): Promise<ReadonlyMap<string, InstitutionState>> {
    const states = new Map<string, InstitutionState>(
      ids.map((id) => [id, { exists: false, active: false }]),
    );

    if (ids.length === 0) {
      return states;
    }

    const rows = await this.prisma.institution.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, active: true },
    });

    for (const row of rows) {
      states.set(row.id, { exists: true, active: row.active });
    }

    return states;
  }
}
