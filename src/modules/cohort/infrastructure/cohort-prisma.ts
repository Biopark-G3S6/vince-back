import type { PrismaClient } from '@prisma/client';

const OWNED_MODELS = [
  'cohort',
  'cohortProfessor',
  'cohortProfessorAudit',
  'enrollment',
  'cohortInvitation',
  'processedEvent',
  'cohortOutbox',
] as const;

const OWNED = new Set<string>(OWNED_MODELS);

function scope(prisma: PrismaClient) {
  return prisma.$extends({
    name: 'cohort-scope',
    query: {
      $allModels: {
        $allOperations({ model, args, query, operation }) {
          if (!OWNED.has(model.charAt(0).toLowerCase() + model.slice(1))) {
            throw new Error(
              `O módulo \`cohort\` não possui o model \`${model}\` e não pode executar \`${operation}\`.`,
            );
          }

          return query(args);
        },
      },
    },
  });
}

type ScopedClient = ReturnType<typeof scope>;
export type CohortModels = Pick<ScopedClient, (typeof OWNED_MODELS)[number]>;

export interface CohortTransactionOptions {
  readonly timeoutMs?: number;
  readonly maxWaitMs?: number;
}

export abstract class CohortPrisma {
  abstract readonly cohort: ScopedClient['cohort'];
  abstract readonly cohortProfessor: ScopedClient['cohortProfessor'];
  abstract readonly cohortProfessorAudit: ScopedClient['cohortProfessorAudit'];
  abstract readonly enrollment: ScopedClient['enrollment'];
  abstract readonly cohortInvitation: ScopedClient['cohortInvitation'];
  abstract readonly processedEvent: ScopedClient['processedEvent'];
  abstract readonly outbox: ScopedClient['cohortOutbox'];

  abstract transaction<T>(
    run: (tx: CohortModels) => Promise<T>,
    options?: CohortTransactionOptions,
  ): Promise<T>;
}

export function createCohortPrisma(prisma: PrismaClient): CohortPrisma {
  const scoped = scope(prisma);

  return {
    cohort: scoped.cohort,
    cohortProfessor: scoped.cohortProfessor,
    cohortProfessorAudit: scoped.cohortProfessorAudit,
    enrollment: scoped.enrollment,
    cohortInvitation: scoped.cohortInvitation,
    processedEvent: scoped.processedEvent,
    outbox: scoped.cohortOutbox,
    transaction: (run, options) =>
      scoped.$transaction(
        (tx) =>
          run({
            cohort: tx.cohort,
            cohortProfessor: tx.cohortProfessor,
            cohortProfessorAudit: tx.cohortProfessorAudit,
            enrollment: tx.enrollment,
            cohortInvitation: tx.cohortInvitation,
            processedEvent: tx.processedEvent,
            cohortOutbox: tx.cohortOutbox,
          }),
        { timeout: options?.timeoutMs ?? 30_000, maxWait: options?.maxWaitMs ?? 5_000 },
      ),
  };
}
