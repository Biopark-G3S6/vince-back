import { Injectable } from '@nestjs/common';

import { CredentialRepository } from '../domain/ports/credential-repository';
import { AccessPrisma } from './access-prisma';

@Injectable()
export class PrismaCredentialRepository extends CredentialRepository {
  constructor(private readonly prisma: AccessPrisma) {
    super();
  }

  async findHash(userId: string): Promise<string | null> {
    const row = await this.prisma.passwordCredential.findUnique({
      where: { userId },
      select: { hash: true },
    });

    return row?.hash ?? null;
  }

  /**
   * `upsert` porque definir a primeira senha e alterar a existente são a mesma gravação
   * do ponto de vista da tabela: uma conta tem no máximo uma credencial, e a chave
   * primária é a própria conta.
   */
  async save(userId: string, hash: string): Promise<void> {
    await this.prisma.passwordCredential.upsert({
      where: { userId },
      create: { userId, hash },
      update: { hash },
    });
  }
}
