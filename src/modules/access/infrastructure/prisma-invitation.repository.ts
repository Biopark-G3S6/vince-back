import { Injectable } from '@nestjs/common';

import type { InvitationPurpose } from '../domain/invitation';
import { InvitationRepository, type NewInvitation } from '../domain/ports/invitation-repository';
import { AccessPrisma } from './access-prisma';

@Injectable()
export class PrismaInvitationRepository extends InvitationRepository {
  constructor(private readonly prisma: AccessPrisma) {
    super();
  }

  async create(invitation: NewInvitation): Promise<void> {
    await this.prisma.invitation.create({
      data: {
        id: invitation.id,
        userId: invitation.userId,
        purpose: invitation.purpose,
        tokenHash: invitation.tokenHash,
        expiresAt: invitation.expiresAt,
      },
    });
  }

  /**
   * O uso único é decidido **pelo banco**, na condição `usedAt: null` da gravação — e não
   * por uma leitura anterior que concluísse que ainda não fora usado. Entre ler e gravar
   * cabe a segunda requisição; dentro do `updateMany`, não.
   *
   * A leitura que a antecede serve só para saber de quem é o meio: ela não decide nada, e
   * é por isso que o seu resultado é descartado quando a gravação não alcança linha alguma.
   */
  async consume(tokenHash: string, purpose: InvitationPurpose, now: Date): Promise<string | null> {
    const row = await this.prisma.invitation.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, purpose: true },
    });

    if (row === null || row.purpose !== purpose) {
      return null;
    }

    const { count } = await this.prisma.invitation.updateMany({
      where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });

    return count === 1 ? row.userId : null;
  }

  async invalidateOutstanding(
    userId: string,
    purpose: InvitationPurpose,
    now: Date,
  ): Promise<void> {
    await this.prisma.invitation.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: now },
    });
  }
}
