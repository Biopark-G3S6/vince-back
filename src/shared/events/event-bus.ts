export interface DomainEvent {
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface DeadLetterEvent {
  readonly event: DomainEvent;
  readonly attempts: number;
}

export type DomainEventHandler = (event: DomainEvent) => Promise<void>;

export abstract class DomainEventBus {
  abstract subscribe(type: string, handler: DomainEventHandler): () => void;
  abstract publish(event: DomainEvent): Promise<void>;
}

export class InMemoryDomainEventBus extends DomainEventBus {
  private readonly handlers = new Map<string, Set<DomainEventHandler>>();
  readonly deadLetters: DeadLetterEvent[] = [];

  constructor(private readonly maxAttempts = 3) {
    super();
  }

  subscribe(type: string, handler: DomainEventHandler): () => void {
    const handlers = this.handlers.get(type) ?? new Set<DomainEventHandler>();
    handlers.add(handler);
    this.handlers.set(type, handlers);

    return () => handlers.delete(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = [...(this.handlers.get(event.type) ?? [])];

    await Promise.all(
      handlers.map(async (handler) => {
        for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
          try {
            await handler(event);
            return;
          } catch {
            if (attempt === this.maxAttempts) {
              this.deadLetters.push({ event, attempts: attempt });
            }
          }
        }
      }),
    );
  }
}
