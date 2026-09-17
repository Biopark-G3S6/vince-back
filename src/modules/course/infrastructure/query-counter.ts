import type { PrismaClient } from '@prisma/client';

export interface QueryCounter {
  readonly client: PrismaClient;
  count(): number;
  reset(): void;
}

/** Instrumentação local para o teste de invariância de consultas (`ADR-0011`). */
export function createQueryCounter(prisma: PrismaClient): QueryCounter {
  let queries = 0;
  const client = prisma.$extends({
    name: 'course-query-counter',
    query: {
      $allModels: {
        $allOperations({ args, query }) {
          queries += 1;

          return query(args);
        },
      },
    },
  });

  return {
    client: client as unknown as PrismaClient,
    count: () => queries,
    reset: () => {
      queries = 0;
    },
  };
}
