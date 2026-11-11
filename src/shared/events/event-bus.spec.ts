import { describe, expect, it, vi } from 'vitest';

import { InMemoryDomainEventBus } from './event-bus';

describe('barramento de eventos', () => {
  it('reprocessa falhas transitórias até o consumidor concluir', async () => {
    const bus = new InMemoryDomainEventBus();
    let attempts = 0;

    bus.subscribe('TestEvent', async () => {
      await Promise.resolve();
      attempts += 1;
      if (attempts < 3) {
        throw new Error('transitório');
      }
    });

    await bus.publish({ type: 'TestEvent', payload: {} });

    expect(attempts).toBe(3);
    expect(bus.deadLetters).toHaveLength(0);
  });

  it('registra o evento em dead-letter após esgotar as tentativas', async () => {
    const bus = new InMemoryDomainEventBus();
    const handler = vi.fn(async () => {
      await Promise.resolve();
      throw new Error('permanente');
    });
    bus.subscribe('TestEvent', handler);

    await bus.publish({ type: 'TestEvent', payload: {} });

    expect(handler).toHaveBeenCalledTimes(3);
    expect(bus.deadLetters).toEqual([{ event: { type: 'TestEvent', payload: {} }, attempts: 3 }]);
  });
});
