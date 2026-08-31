import type { PrismaClient } from '@prisma/client';

/**
 * Instrumentação da contagem de consultas, por extensão do cliente Prisma
 * (ADR-0011 §12).
 *
 * Sustenta o teste de invariância de contagem exigido por ADR-0011 §10 e ADR-0024 §23:
 * a mesma operação, com um registro e com dez, precisa emitir a mesma quantidade de
 * consultas. Divergência reprova o build (ADR-0011 §11).
 */

export interface QueryCounter {
  /** O cliente instrumentado, a ser entregue ao módulo no lugar do original. */
  readonly client: PrismaClient;
  count(): number;
  reset(): void;
}

export function createQueryCounter(prisma: PrismaClient): QueryCounter {
  let queries = 0;

  const instrumented = prisma.$extends({
    name: 'query-counter',
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
    // O cliente estendido é, em execução, o mesmo cliente; o tipo do Prisma apenas não
    // sabe dizê-lo. A conversão fica contida aqui, e em nenhum outro ponto do módulo.
    client: instrumented as unknown as PrismaClient,
    count: () => queries,
    reset: () => {
      queries = 0;
    },
  };
}
