import type { PrismaClient } from '@prisma/client';

/**
 * O cliente Prisma escopado ao módulo `access` (ADR-0010 §4, §5, §7).
 *
 * A instância crua nasce uma única vez no composition root e é estendida aqui. A
 * extensão faz duas coisas, porque uma só não bastaria:
 *
 *   - em tempo de compilação, o tipo exposto é a projeção dos models próprios;
 *     `assinaturaErro`, do módulo `observabilidade`, não existe nele;
 *   - em tempo de execução, o gancho de consulta recusa operação sobre model alheio,
 *     inclusive a alcançada por travessia de tipo.
 *
 * A extensão do Prisma, sozinha, NÃO remove model do tipo — daí a projeção. Consulta
 * em SQL bruto não passa pelo gancho; ADR-0010 §14 a submete à revisão de código.
 */

/** Os models sob propriedade do módulo (ADR-0027 §5). */
export const OWNED_MODELS = [
  'permission',
  'role',
  'rolePermission',
  'user',
  'userRole',
  'roleAssignmentAudit',
  'passwordCredential',
  'invitation',
] as const;

export type OwnedModel = (typeof OWNED_MODELS)[number];

const OWNED = new Set<string>(OWNED_MODELS);

/** `Permission` e `permission` nomeiam o mesmo model conforme o ponto de observação. */
function asDelegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/** A política de propriedade, isolada do encanamento do Prisma para ser testável. */
export function isOwnedModel(model: string): boolean {
  return OWNED.has(asDelegateName(model));
}

function scope(prisma: PrismaClient) {
  return prisma.$extends({
    name: 'access-scope',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!isOwnedModel(model)) {
            throw new Error(
              `O módulo \`access\` não possui o model \`${model}\` e não pode executar ` +
                `\`${operation}\` sobre ele (ADR-0006 §2, ADR-0010 §4).`,
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
export type AccessModels = Pick<ScopedClient, OwnedModel>;

export interface AccessTransactionOptions {
  /** ADR-0019 §5: toda transação declara tempo limite. */
  readonly timeoutMs?: number;
  readonly maxWaitMs?: number;
}

/**
 * Token de injeção do cliente escopado. É `abstract class` porque interface não
 * sobrevive à compilação e não serve como token (ADR-0004 §3).
 */
export abstract class AccessPrisma {
  abstract readonly permission: ScopedClient['permission'];
  abstract readonly role: ScopedClient['role'];
  abstract readonly rolePermission: ScopedClient['rolePermission'];
  abstract readonly user: ScopedClient['user'];
  abstract readonly userRole: ScopedClient['userRole'];
  abstract readonly roleAssignmentAudit: ScopedClient['roleAssignmentAudit'];
  abstract readonly passwordCredential: ScopedClient['passwordCredential'];
  abstract readonly invitation: ScopedClient['invitation'];

  abstract transaction<T>(
    run: (tx: AccessModels) => Promise<T>,
    options?: AccessTransactionOptions,
  ): Promise<T>;
}

/** Tempo limite padrão da transação da carga inicial, que grava algumas centenas de linhas. */
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_WAIT_MS = 5_000;

export function createAccessPrisma(prisma: PrismaClient): AccessPrisma {
  const scoped = scope(prisma);

  const client: AccessPrisma = {
    permission: scoped.permission,
    role: scoped.role,
    rolePermission: scoped.rolePermission,
    user: scoped.user,
    userRole: scoped.userRole,
    roleAssignmentAudit: scoped.roleAssignmentAudit,
    passwordCredential: scoped.passwordCredential,
    invitation: scoped.invitation,

    transaction: (run, options) =>
      scoped.$transaction(
        (tx) =>
          run({
            permission: tx.permission,
            role: tx.role,
            rolePermission: tx.rolePermission,
            user: tx.user,
            userRole: tx.userRole,
            roleAssignmentAudit: tx.roleAssignmentAudit,
            passwordCredential: tx.passwordCredential,
            invitation: tx.invitation,
          }),
        {
          timeout: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          maxWait: options?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS,
        },
      ),
  };

  return client;
}
