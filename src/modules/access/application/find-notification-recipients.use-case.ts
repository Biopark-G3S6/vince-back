import { Injectable } from '@nestjs/common';

import { UserRepository, type NotificationRecipientRecord } from '../domain/ports/user-repository';

@Injectable()
export class FindNotificationRecipientsUseCase {
  constructor(private readonly users: UserRepository) {}

  execute(userIds: readonly string[]): Promise<readonly NotificationRecipientRecord[]> {
    if (userIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.users.findNotificationRecipients([...new Set(userIds)]);
  }
}
