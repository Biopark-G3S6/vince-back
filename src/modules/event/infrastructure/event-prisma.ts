import type { PrismaClient } from '@prisma/client';

/**
 * Os models que o módulo possui (`ADR-0032` §5, §6).
 *
 * A extensão não é documentação: ela **recusa em tempo de execução** qualquer operação
 * sobre model alheio. O lint impede a importação errada; isto impede a consulta errada,
 * que nenhuma análise estática enxergaria por trás do cliente único.
 */
const OWNED_MODELS = [
  'event',
  'milestone',
  'eventAdvisor',
  'eventAdvisorAudit',
  'eventProcessedEvent',
  'eventOutbox',
] as const;

const OWNED = new Set<string>(OWNED_MODELS);

function scope(prisma: PrismaClient) {
  return prisma.$extends({
    name: 'event-scope',
    query: {
      $allModels: {
        $allOperations({ model, args, query, operation }) {
          if (!OWNED.has(model.charAt(0).toLowerCase() + model.slice(1))) {
            throw new Error(
              `O módulo \`event\` não possui o model \`${model}\` e não pode executar \`${operation}\`.`,
            );
          }

          return query(args);
        },
      },
    },
  });
}

type ScopedClient = ReturnType<typeof scope>;
export type EventModels = Pick<ScopedClient, (typeof OWNED_MODELS)[number]>;

export interface EventTransactionOptions {
  readonly timeoutMs?: number;
  readonly maxWaitMs?: number;
}

export abstract class EventPrisma {
  abstract readonly event: ScopedClient['event'];
  abstract readonly milestone: ScopedClient['milestone'];
  abstract readonly advisor: ScopedClient['eventAdvisor'];
  abstract readonly advisorAudit: ScopedClient['eventAdvisorAudit'];
  abstract readonly processedEvent: ScopedClient['eventProcessedEvent'];
  abstract readonly outbox: ScopedClient['eventOutbox'];

  abstract transaction<T>(
    run: (tx: EventModels) => Promise<T>,
    options?: EventTransactionOptions,
  ): Promise<T>;
}

export function createEventPrisma(prisma: PrismaClient): EventPrisma {
  const scoped = scope(prisma);

  return {
    event: scoped.event,
    milestone: scoped.milestone,
    advisor: scoped.eventAdvisor,
    advisorAudit: scoped.eventAdvisorAudit,
    processedEvent: scoped.eventProcessedEvent,
    outbox: scoped.eventOutbox,
    transaction: (run, options) =>
      scoped.$transaction(
        (tx) =>
          run({
            event: tx.event,
            milestone: tx.milestone,
            eventAdvisor: tx.eventAdvisor,
            eventAdvisorAudit: tx.eventAdvisorAudit,
            eventProcessedEvent: tx.eventProcessedEvent,
            eventOutbox: tx.eventOutbox,
          }),
        { timeout: options?.timeoutMs ?? 30_000, maxWait: options?.maxWaitMs ?? 5_000 },
      ),
  };
}
