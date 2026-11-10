import type { PrismaClient } from '@prisma/client';
import {
  DiscussionRepository,
  type CreateDiscussionMessage,
  type CreateDiscussionOutboxEvent,
  type DiscussionMessageRecord,
  type DiscussionOutboxRecord,
} from '../domain/ports/discussion-repository';

const OWNED = new Set(['discussionMessage', 'discussionOutbox']);

function scope(prisma: PrismaClient) {
  return prisma.$extends({
    name: 'discussion-scope',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          const name = model.charAt(0).toLowerCase() + model.slice(1);
          if (!OWNED.has(name))
            throw new Error(`O módulo discussion não possui o model ${model} (${operation}).`);
          return query(args);
        },
      },
    },
  });
}

type Scoped = ReturnType<typeof scope>;

export function createDiscussionRepository(prisma: PrismaClient): DiscussionRepository {
  return new PrismaDiscussionRepository(scope(prisma));
}

class PrismaDiscussionRepository extends DiscussionRepository {
  constructor(private readonly db: Scoped) {
    super();
  }

  list(articleId: string, skip: number, take: number): Promise<readonly DiscussionMessageRecord[]> {
    return this.db.discussionMessage.findMany({
      where: { articleId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip,
      take,
    });
  }

  count(articleId: string): Promise<number> {
    return this.db.discussionMessage.count({ where: { articleId } });
  }

  listFirst(articleId: string, take: number): Promise<readonly DiscussionMessageRecord[]> {
    return this.db.discussionMessage.findMany({
      where: { articleId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take,
    });
  }

  find(id: string, articleId: string): Promise<DiscussionMessageRecord | null> {
    return this.db.discussionMessage.findFirst({ where: { id, articleId } });
  }

  listAfter(
    articleId: string,
    createdAt: Date,
    id: string,
    take: number,
  ): Promise<readonly DiscussionMessageRecord[]> {
    return this.db.discussionMessage.findMany({
      where: { articleId, OR: [{ createdAt: { gt: createdAt } }, { createdAt, id: { gt: id } }] },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take,
    });
  }

  listForRemark(articleId: string, remarkId: string): Promise<readonly DiscussionMessageRecord[]> {
    return this.db.discussionMessage.findMany({
      where: { articleId, remarkId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  createWithOutbox(
    message: CreateDiscussionMessage,
    event: CreateDiscussionOutboxEvent,
  ): Promise<DiscussionMessageRecord> {
    return this.db.$transaction(async (tx) => {
      const saved = await tx.discussionMessage.create({ data: message });
      await tx.discussionOutbox.create({
        data: {
          id: event.id,
          type: event.type,
          contractVersion: event.contractVersion,
          payload: event.payload as never,
          correlationId: event.correlationId,
        },
      });
      return saved;
    });
  }

  async markOutboxPublished(eventId: string, at: Date): Promise<void> {
    await this.db.discussionOutbox.update({ where: { id: eventId }, data: { publishedAt: at } });
  }

  listPendingOutbox(take: number): Promise<readonly DiscussionOutboxRecord[]> {
    return this.db.discussionOutbox.findMany({
      where: { publishedAt: null },
      orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take,
      select: { id: true, type: true, payload: true, attempts: true, updatedAt: true },
    });
  }

  async claimOutbox(eventId: string, updatedAt: Date): Promise<boolean> {
    const claimed = await this.db.discussionOutbox.updateMany({
      where: { id: eventId, publishedAt: null, updatedAt },
      data: { attempts: { increment: 1 } },
    });
    return claimed.count > 0;
  }

  async removeOwn(
    articleId: string,
    actorId: string,
    messageId: string,
    at: Date,
  ): Promise<boolean> {
    const changed = await this.db.discussionMessage.updateMany({
      where: { id: messageId, articleId, authorId: actorId, deletedAt: null },
      data: { body: null, deletedAt: at },
    });
    if (changed.count > 0) return true;
    return (
      (await this.db.discussionMessage.count({
        where: { id: messageId, articleId, authorId: actorId },
      })) > 0
    );
  }
}
