import type { PrismaClient } from '@prisma/client';

/** Os models que o módulo possui (`ADR-0030` §4, §5). */
const OWNED_MODELS = [
  'article',
  'articleGrade',
  'memberGrade',
  'articleGradeHistory',
  'memberGradeHistory',
  'publication',
  'articleProcessedEvent',
  'articleOutbox',
] as const;

const OWNED = new Set<string>(OWNED_MODELS);

function scope(prisma: PrismaClient) {
  return prisma.$extends({
    name: 'article-scope',
    query: {
      $allModels: {
        $allOperations({ model, args, query, operation }) {
          if (!OWNED.has(model.charAt(0).toLowerCase() + model.slice(1))) {
            throw new Error(
              `O módulo \`article\` não possui o model \`${model}\` e não pode executar \`${operation}\`.`,
            );
          }

          return query(args);
        },
      },
    },
  });
}

type ScopedClient = ReturnType<typeof scope>;
export type ArticleModels = Pick<ScopedClient, (typeof OWNED_MODELS)[number]>;

export interface ArticleTransactionOptions {
  readonly timeoutMs?: number;
  readonly maxWaitMs?: number;
}

export abstract class ArticlePrisma {
  abstract readonly article: ScopedClient['article'];
  abstract readonly grade: ScopedClient['articleGrade'];
  abstract readonly memberGrade: ScopedClient['memberGrade'];
  abstract readonly gradeHistory: ScopedClient['articleGradeHistory'];
  abstract readonly memberGradeHistory: ScopedClient['memberGradeHistory'];
  abstract readonly publication: ScopedClient['publication'];
  abstract readonly processedEvent: ScopedClient['articleProcessedEvent'];
  abstract readonly outbox: ScopedClient['articleOutbox'];

  abstract transaction<T>(
    run: (tx: ArticleModels) => Promise<T>,
    options?: ArticleTransactionOptions,
  ): Promise<T>;
}

export function createArticlePrisma(prisma: PrismaClient): ArticlePrisma {
  const scoped = scope(prisma);

  return {
    article: scoped.article,
    grade: scoped.articleGrade,
    memberGrade: scoped.memberGrade,
    gradeHistory: scoped.articleGradeHistory,
    memberGradeHistory: scoped.memberGradeHistory,
    publication: scoped.publication,
    processedEvent: scoped.articleProcessedEvent,
    outbox: scoped.articleOutbox,
    transaction: (run, options) =>
      scoped.$transaction(
        (tx) =>
          run({
            article: tx.article,
            articleGrade: tx.articleGrade,
            memberGrade: tx.memberGrade,
            articleGradeHistory: tx.articleGradeHistory,
            memberGradeHistory: tx.memberGradeHistory,
            publication: tx.publication,
            articleProcessedEvent: tx.articleProcessedEvent,
            articleOutbox: tx.articleOutbox,
          }),
        { timeout: options?.timeoutMs ?? 30_000, maxWait: options?.maxWaitMs ?? 5_000 },
      ),
  };
}
