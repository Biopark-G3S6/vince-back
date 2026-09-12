import type { PrismaClient } from '@prisma/client';

/**
 * O cliente Prisma escopado ao módulo `institution` (`ADR-0010` §4, §5, §7).
 *
 * A instância crua nasce uma única vez no composition root e é estendida aqui. A extensão
 * faz duas coisas, porque uma só não bastaria:
 *
 *   - em tempo de compilação, o tipo exposto é a projeção dos models próprios; `user`, do
 *     módulo `access`, não existe nele;
 *   - em tempo de execução, o gancho de consulta recusa operação sobre model alheio,
 *     inclusive a alcançada por travessia de tipo.
 *
 * É o que torna `ADR-0028` §17 verificável e não apenas combinado: o módulo não pode
 * escrever em `access.user_role` nem que queira — a única via para o papel é a fachada.
 *
 * Consulta em SQL bruto não passa pelo gancho; `ADR-0010` §14 a submete à revisão de
 * código.
 */

/** Os models sob propriedade do módulo (`ADR-0028` §5). */
export const OWNED_MODELS = ['institution', 'institutionAdmin'] as const;

export type OwnedModel = (typeof OWNED_MODELS)[number];

const OWNED = new Set<string>(OWNED_MODELS);

/** `Institution` e `institution` nomeiam o mesmo model conforme o ponto de observação. */
function asDelegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/** A política de propriedade, isolada do encanamento do Prisma para ser testável. */
export function isOwnedModel(model: string): boolean {
  return OWNED.has(asDelegateName(model));
}

function scope(prisma: PrismaClient) {
  return prisma.$extends({
    name: 'institution-scope',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!isOwnedModel(model)) {
            throw new Error(
              `O módulo \`institution\` não possui o model \`${model}\` e não pode executar ` +
                `\`${operation}\` sobre ele (ADR-0006 §2, ADR-0010 §4, ADR-0028 §17).`,
            );
          }

          return query(args);
        },
      },
    },
  });
}

type ScopedClient = ReturnType<typeof scope>;

/** Os delegates dos models próprios, e nada além deles. */
export type InstitutionModels = Pick<ScopedClient, OwnedModel>;

export interface InstitutionTransactionOptions {
  /** `ADR-0019` §5: toda transação declara tempo limite. */
  readonly timeoutMs?: number;
  readonly maxWaitMs?: number;
}

/**
 * Token de injeção do cliente escopado. É `abstract class` porque interface não sobrevive
 * à compilação e não serve como token (`ADR-0004` §3).
 */
export abstract class InstitutionPrisma {
  abstract readonly institution: ScopedClient['institution'];
  abstract readonly institutionAdmin: ScopedClient['institutionAdmin'];

  abstract transaction<T>(
    run: (tx: InstitutionModels) => Promise<T>,
    options?: InstitutionTransactionOptions,
  ): Promise<T>;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_WAIT_MS = 5_000;

export function createInstitutionPrisma(prisma: PrismaClient): InstitutionPrisma {
  const scoped = scope(prisma);

  const client: InstitutionPrisma = {
    institution: scoped.institution,
    institutionAdmin: scoped.institutionAdmin,

    transaction: (run, options) =>
      scoped.$transaction(
        (tx) =>
          run({
            institution: tx.institution,
            institutionAdmin: tx.institutionAdmin,
          }),
        {
          timeout: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          maxWait: options?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS,
        },
      ),
  };

  return client;
}
