import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { DispatchNotificationEmailsUseCase } from './notification.use-cases';

@Injectable()
export class NotificationEmailWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;
  constructor(
    private readonly dispatch: DispatchNotificationEmailsUseCase,
    private readonly enabled: boolean,
  ) {}
  onModuleInit(): void {
    if (!this.enabled) return;
    const run = (): void => {
      void this.dispatch.execute().catch(() => undefined);
    };
    run();
    this.timer = setInterval(run, 30_000);
    this.timer.unref();
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
