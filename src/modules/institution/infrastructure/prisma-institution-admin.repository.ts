import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  InstitutionAdminRepository,
  type LinkOutcome,
} from '../domain/ports/institution-admin-repository';
import { InstitutionPrisma } from './institution-prisma';

/** Violação de restrição única — aqui, sempre a chave primária composta do vínculo. */
const UNIQUE_VIOLATION = 'P2002';

/** Registro exigido pela operação não foi encontrado. */
const RECORD_NOT_FOUND = 'P2025';

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

@Injectable()
export class PrismaInstitutionAdminRepository extends InstitutionAdminRepository {
  constructor(private readonly prisma: InstitutionPrisma) {
    super();
  }

  /**
   * Cria o vínculo, e conclui em paz se ele já existir (RF-INS-002 E1).
   *
   * A idempotência é obtida pela **colisão da chave primária**, e não por uma consulta
   * prévia: entre consultar e gravar cabe outra designação do mesmo par, e o índice é o
   * que de fato arbitra. `changed` distingue a criação da repetição — é o que permite ao
   * caso de uso não repetir efeito colateral que já ocorreu.
   */
  async link(institutionId: string, userId: string): Promise<LinkOutcome> {
    try {
      await this.prisma.institutionAdmin.create({ data: { institutionId, userId } });

      return { changed: true };
    } catch (error) {
      if (isPrismaError(error, UNIQUE_VIOLATION)) {
        return { changed: false };
      }

      throw error;
    }
  }

  /** Remove o vínculo. Remover o que não existe conclui com sucesso e nada altera. */
  async unlink(institutionId: string, userId: string): Promise<LinkOutcome> {
    try {
      await this.prisma.institutionAdmin.delete({
        where: { institutionId_userId: { institutionId, userId } },
      });

      return { changed: true };
    } catch (error) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) {
        return { changed: false };
      }

      throw error;
    }
  }

  /**
   * Quantos vínculos o usuário conserva (RF-INS-002 RN3).
   *
   * Uma contagem, servida pelo índice de `user_id` — e não a leitura de todos os vínculos
   * para contá-los na aplicação.
   */
  async countByUser(userId: string): Promise<number> {
    return this.prisma.institutionAdmin.count({ where: { userId } });
  }
}
