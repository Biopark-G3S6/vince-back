import type { PrismaClient } from '@prisma/client';

/**
 * Os models que o módulo possui (`ADR-0033` §5, §6).
 *
 * A extensão recusa em tempo de execução qualquer operação sobre model alheio — o lint
 * impede a importação errada, e isto, a consulta errada.
 */
const OWNED_MODELS = [
  'team',
  'teamMember',
  'teamInvitation',
  'teamAdvisor',
  'teamAdvisorAudit',
  'teamProcessedEvent',
  'teamOutbox',
] as const;

const OWNED = new Set<string>(OWNED_MODELS);

function scope(prisma: PrismaClient) {
  return prisma.$extends({
    name: 'team-scope',
    query: {
      $allModels: {
        $allOperations({ model, args, query, operation }) {
          if (!OWNED.has(model.charAt(0).toLowerCase() + model.slice(1))) {
            throw new Error(
              `O módulo \`team\` não possui o model \`${model}\` e não pode executar \`${operation}\`.`,
            );
          }

          return query(args);
        },
      },
    },
  });
}

type ScopedClient = ReturnType<typeof scope>;
type ScopedModels = Pick<ScopedClient, (typeof OWNED_MODELS)[number]>;

/**
 * O que a transação do módulo oferece: os seus models, mais duas operações que **só** se
 * expressam em SQL.
 *
 * `lock` serializa a escrita por chave de negócio. É o que transforma "conferir e gravar"
 * em operação atômica: sob `READ COMMITTED`, duas transações concorrentes contariam as
 * mesmas equipes e ambas gravariam, e é exatamente a corrida que `ADR-0033` §14 manda
 * fechar. A alternativa — `SERIALIZABLE` na transação inteira — pagaria reexecução em
 * toda escrita do módulo para proteger duas.
 *
 * `largestTeamSize` é uma agregação sobre agregação, que o construtor de consultas do
 * Prisma não expressa. Ela existe porque o fato publicado transporta a contagem já
 * apurada (`ADR-0033` §20): sem ela, quem projeta o uso teria de perguntar de volta.
 */
export interface TeamTransaction extends ScopedModels {
  lock(key: string): Promise<void>;
  largestTeamSize(eventId: string): Promise<number>;
}

export interface TeamTransactionOptions {
  readonly timeoutMs?: number;
  readonly maxWaitMs?: number;
}

export abstract class TeamPrisma {
  abstract readonly team: ScopedClient['team'];
  abstract readonly member: ScopedClient['teamMember'];
  abstract readonly invitation: ScopedClient['teamInvitation'];
  abstract readonly advisor: ScopedClient['teamAdvisor'];
  abstract readonly advisorAudit: ScopedClient['teamAdvisorAudit'];
  abstract readonly processedEvent: ScopedClient['teamProcessedEvent'];
  abstract readonly outbox: ScopedClient['teamOutbox'];

  abstract transaction<T>(
    run: (tx: TeamTransaction) => Promise<T>,
    options?: TeamTransactionOptions,
  ): Promise<T>;
}

export function createTeamPrisma(prisma: PrismaClient): TeamPrisma {
  const scoped = scope(prisma);

  return {
    team: scoped.team,
    member: scoped.teamMember,
    invitation: scoped.teamInvitation,
    advisor: scoped.teamAdvisor,
    advisorAudit: scoped.teamAdvisorAudit,
    processedEvent: scoped.teamProcessedEvent,
    outbox: scoped.teamOutbox,
    transaction: (run, options) =>
      scoped.$transaction(
        async (tx) =>
          run({
            team: tx.team,
            teamMember: tx.teamMember,
            teamInvitation: tx.teamInvitation,
            teamAdvisor: tx.teamAdvisor,
            teamAdvisorAudit: tx.teamAdvisorAudit,
            teamProcessedEvent: tx.teamProcessedEvent,
            teamOutbox: tx.teamOutbox,
            lock: async (key: string): Promise<void> => {
              // `xact`: o bloqueio cai com a transação, e não há caminho de erro que o
              // deixe pendurado.
              //
              // `$executeRaw`, e não `$queryRaw`: a função devolve `void`, e o
              // desserializador de linhas do Prisma não tem tipo para isso. Aqui o
              // resultado não interessa — interessa o efeito.
              await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
            },
            largestTeamSize: async (eventId: string): Promise<number> => {
              const rows = await tx.$queryRaw<{ value: number }[]>`
                SELECT COALESCE(MAX("count"), 0)::int AS "value"
                  FROM (
                        SELECT COUNT(*)::int AS "count"
                          FROM "team"."team_member"
                         WHERE "event_id" = ${eventId}::uuid
                           AND "status" = 'ACTIVE'
                         GROUP BY "team_id"
                       ) AS "sizes"
              `;

              return rows[0]?.value ?? 0;
            },
          }),
        { timeout: options?.timeoutMs ?? 30_000, maxWait: options?.maxWaitMs ?? 5_000 },
      ),
  };
}
