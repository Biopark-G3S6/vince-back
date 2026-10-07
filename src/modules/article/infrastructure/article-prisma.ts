import type { PrismaClient } from '@prisma/client';

const OWNED_MODELS = [
  'articleTemplate',
  'articleTemplateVersion',
  'articleTemplateSelection',
  'article',
  'articleReference',
  'articleCitation',
  'articleVersion',
  'articleSubmission',
  'articleRemark',
  'articlePresence',
] as const;
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
    name: 'article-scope',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!isOwnedModel(model)) {
            throw new Error(
              `O módulo \`article\` não possui o model \`${model}\` e não pode executar ` +
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
export type ArticleModels = Pick<ScopedClient, OwnedModel>;

export interface ArticleTransactionOptions {
  readonly timeoutMs?: number;
  readonly maxWaitMs?: number;
}

export abstract class ArticlePrisma {
  abstract readonly articleTemplate: ScopedClient['articleTemplate'];
  abstract readonly articleTemplateVersion: ScopedClient['articleTemplateVersion'];
  abstract readonly articleTemplateSelection: ScopedClient['articleTemplateSelection'];
  abstract readonly article: ScopedClient['article'];
  abstract readonly articleReference: ScopedClient['articleReference'];
  abstract readonly articleCitation: ScopedClient['articleCitation'];
  abstract readonly articleVersion: ScopedClient['articleVersion'];
  abstract readonly articleSubmission: ScopedClient['articleSubmission'];
  abstract readonly articleRemark: ScopedClient['articleRemark'];
  abstract readonly articlePresence: ScopedClient['articlePresence'];
  abstract transaction<T>(
    run: (tx: ArticleModels) => Promise<T>,
    options?: ArticleTransactionOptions,
  ): Promise<T>;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_WAIT_MS = 5_000;

export function createArticlePrisma(prisma: PrismaClient): ArticlePrisma {
  const scoped = scope(prisma);

  return {
    articleTemplate: scoped.articleTemplate,
    articleTemplateVersion: scoped.articleTemplateVersion,
    articleTemplateSelection: scoped.articleTemplateSelection,
    article: scoped.article,
    articleReference: scoped.articleReference,
    articleCitation: scoped.articleCitation,
    articleVersion: scoped.articleVersion,
    articleSubmission: scoped.articleSubmission,
    articleRemark: scoped.articleRemark,
    articlePresence: scoped.articlePresence,
    transaction: (run, options) =>
      scoped.$transaction(
        (tx) =>
          run({
            articleTemplate: tx.articleTemplate,
            articleTemplateVersion: tx.articleTemplateVersion,
            articleTemplateSelection: tx.articleTemplateSelection,
            article: tx.article,
            articleReference: tx.articleReference,
            articleCitation: tx.articleCitation,
            articleVersion: tx.articleVersion,
            articleSubmission: tx.articleSubmission,
            articleRemark: tx.articleRemark,
            articlePresence: tx.articlePresence,
          }),
        {
          timeout: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          maxWait: options?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS,
        },
      ),
  };
}
