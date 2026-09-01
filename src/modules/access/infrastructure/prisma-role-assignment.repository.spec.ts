import { PrismaClient } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AUDIT_OPERATION } from '../domain/ports/role-assignment-repository';
import { createAccessPrisma, type AccessPrisma } from './access-prisma';
import { PrismaRoleAssignmentRepository } from './prisma-role-assignment.repository';

/**
 * Integração do repositório contra PostgreSQL real (`ADR-0024` §1, §9).
 *
 * O cenário "Falha não deixa rastro parcial" não é alcançável pela fachada: o caso de uso
 * recusa a conta inexistente antes de chegar ao repositório, e é justamente por isso que
 * a atomicidade do par vínculo–trilha precisa ser verificada aqui, onde a falha pode ser
 * provocada dentro da transação.
 */

const ROLE_ID = '01930000-0000-7000-8000-0000000000a1';
const ABSENT_USER = '01930000-0000-7000-8000-00000000dead';

describe('atribuição de papel contra o banco', () => {
  let prisma: PrismaClient;
  let scoped: AccessPrisma;
  let repository: PrismaRoleAssignmentRepository;

  beforeAll(() => {
    prisma = new PrismaClient();
    scoped = createAccessPrisma(prisma);
    repository = new PrismaRoleAssignmentRepository(scoped);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.role.create({ data: { id: ROLE_ID, code: 'PROFESSOR' } });
  });

  it('a falha no vínculo não deixa registro de auditoria', async () => {
    // A conta não existe: o `INSERT` em `user_role` viola a chave estrangeira e derruba
    // a transação inteira, com a gravação já iniciada.
    await expect(repository.assign(null, ABSENT_USER, 'PROFESSOR')).rejects.toThrow();

    expect(await prisma.userRole.count({ where: { userId: ABSENT_USER } })).toBe(0);
    expect(await prisma.roleAssignmentAudit.count({ where: { subjectId: ABSENT_USER } })).toBe(0);
  });

  it('a falha depois do vínculo desfaz também o vínculo já gravado', async () => {
    const userId = uuidv7();

    await prisma.user.create({
      data: { id: userId, email: `rastro.${userId}@exemplo.edu.br`, name: 'Rastro' },
    });

    // Reproduz a ordem real — vínculo, depois trilha — e faz a segunda gravação falhar,
    // que é o instante que o cenário descreve: a falha ocorre com o vínculo já escrito.
    await expect(
      scoped.transaction(async (tx) => {
        await tx.userRole.create({ data: { userId, roleId: ROLE_ID } });

        await tx.roleAssignmentAudit.create({
          data: {
            id: uuidv7(),
            actorId: null,
            subjectId: userId,
            roleId: ROLE_ID,
            roleCode: 'PROFESSOR',
            operation: AUDIT_OPERATION.ASSIGNED,
          },
        });

        throw new Error('falha depois de a gravação ter começado');
      }),
    ).rejects.toThrow('falha depois de a gravação ter começado');

    expect(await prisma.userRole.count({ where: { userId } })).toBe(0);
    expect(await prisma.roleAssignmentAudit.count({ where: { subjectId: userId } })).toBe(0);
  });

  it('papel inexistente não altera nada e não registra nada', async () => {
    const outcome = await repository.assign(null, ABSENT_USER, 'AUDITOR');

    expect(outcome.changed).toBe(false);
    expect(await prisma.roleAssignmentAudit.count()).toBe(0);
  });
});
