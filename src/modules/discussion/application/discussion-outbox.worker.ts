import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { DispatchDiscussionNotificationsUseCase } from './discussion.use-cases';

@Injectable()
export class DiscussionOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly dispatch: DispatchDiscussionNotificationsUseCase,
    private readonly enabled: boolean,
  ) {}

  onModuleInit(): void {
    if (!this.enabled) return;
    const run = (): void => {
      void this.dispatch.execute().catch(() => undefined);
    };
    run();
    this.timer = setInterval(run, 5_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
