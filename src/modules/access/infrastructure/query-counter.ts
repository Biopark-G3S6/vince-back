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

/** Uma operação emitida contra um model, como o Prisma a nomeia. */
export interface RecordedOperation {
  readonly model: string;
  readonly operation: string;
}

export interface OperationLog {
  readonly client: PrismaClient;
  operations(): readonly RecordedOperation[];
  /** As operações emitidas contra um model, na ordem em que ocorreram. */
  against(model: string): readonly string[];
  reset(): void;
}

/**
 * Registro do que foi emitido, e não apenas de quanto.
 *
 * Sustenta a verificação de que a trilha de auditoria não recebe escrita destrutiva
 * (`ADR-0014` §18, `ADR-0027` §5): a ausência de método no repositório é promessa de
 * tipo, e some na primeira conversão; o que a torna verificável é observar, em execução,
 * quais operações de fato alcançaram o model.
 */
export function createOperationLog(prisma: PrismaClient): OperationLog {
  const recorded: RecordedOperation[] = [];

  const instrumented = prisma.$extends({
    name: 'operation-log',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          recorded.push({ model, operation });

          return query(args);
        },
      },
    },
  });

  return {
    client: instrumented as unknown as PrismaClient,
    operations: () => recorded,
    against: (model) =>
      recorded.filter((entry) => entry.model === model).map((entry) => entry.operation),
    reset: () => {
      recorded.length = 0;
    },
  };
}
