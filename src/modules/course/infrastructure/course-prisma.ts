import type { PrismaClient } from '@prisma/client';

const OWNED_MODELS = ['course', 'courseCoordinator', 'courseCoordinatorAudit'] as const;
const OWNED = new Set<string>(OWNED_MODELS);

export type OwnedModel = (typeof OWNED_MODELS)[number];

function asDelegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

export function isOwnedModel(model: string): boolean {
  return OWNED.has(asDelegateName(model));
}

function scope(prisma: PrismaClient) {
  return prisma.$extends({
    name: 'course-scope',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!isOwnedModel(model)) {
            throw new Error(
              `O módulo \`course\` não possui o model \`${model}\` e não pode executar ` +
                `\`${operation}\` sobre ele (ADR-0006 §2, ADR-0010 §4, ADR-0029 §6).`,
            );
          }

          return query(args);
        },
      },
    },
  });
}

type ScopedClient = ReturnType<typeof scope>;
export type CourseModels = Pick<ScopedClient, OwnedModel>;

export interface CourseTransactionOptions {
  readonly timeoutMs?: number;
  readonly maxWaitMs?: number;
}

export abstract class CoursePrisma {
  abstract readonly course: ScopedClient['course'];
  abstract readonly courseCoordinator: ScopedClient['courseCoordinator'];
  abstract readonly courseCoordinatorAudit: ScopedClient['courseCoordinatorAudit'];
  abstract transaction<T>(
    run: (tx: CourseModels) => Promise<T>,
    options?: CourseTransactionOptions,
  ): Promise<T>;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_WAIT_MS = 5_000;

export function createCoursePrisma(prisma: PrismaClient): CoursePrisma {
  const scoped = scope(prisma);

  return {
    course: scoped.course,
    courseCoordinator: scoped.courseCoordinator,
    courseCoordinatorAudit: scoped.courseCoordinatorAudit,
    transaction: (run, options) =>
      scoped.$transaction(
        (tx) =>
          run({
            course: tx.course,
            courseCoordinator: tx.courseCoordinator,
            courseCoordinatorAudit: tx.courseCoordinatorAudit,
          }),
        {
          timeout: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          maxWait: options?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS,
        },
      ),
  };
}

export { OWNED_MODELS };
