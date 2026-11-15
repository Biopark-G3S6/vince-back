import type { DomainEventBus } from '@shared/events/event-bus';

import type { OutboxFact } from '../domain/ports/team-repository';

/**
 * Publica no barramento os fatos que a transação já gravou na outbox.
 *
 * A gravação é transacional; a publicação, **depois** do commit. É o arranjo de
 * `ADR-0021`: o fato não se perde se a publicação falhar, porque a linha da outbox
 * continua lá para o relay reenviar — e não se anuncia o que ainda pode ser desfeito.
 *
 * A falha de publicação não é propagada: a escrita de negócio já aconteceu, e derrubá-la
 * aqui faria o cliente receber erro sobre uma operação que de fato concluiu.
 */
export async function publishFacts(
  events: DomainEventBus,
  facts: readonly OutboxFact[],
): Promise<void> {
  for (const fact of facts) {
    await events.publish({ type: fact.type, payload: fact.payload });
  }
}
