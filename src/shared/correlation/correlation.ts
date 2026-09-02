import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/**
 * O identificador de correlação da requisição (`ADR-0022` §7 a §10).
 *
 * **O formato declarado é o UUID canônico**, em qualquer versão. Declarar um formato é o
 * que dá sentido a `ADR-0022` §8: sem ele não existe "não obedece ao formato", e o valor
 * do cliente entraria cru no log — que é onde ele vira injeção de conteúdo alheio.
 *
 * O identificador viaja por `AsyncLocalStorage`, e não por parâmetro: `ADR-0022` §9 o
 * quer nos casos de uso, nas consultas e nas mensagens publicadas, e propagá-lo à mão
 * significaria acrescentá-lo à assinatura de tudo — inclusive de código que não o usa.
 */

export const CORRELATION_HEADER = 'x-correlation-id';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isWellFormedCorrelationId(value: string): boolean {
  return UUID_SHAPE.test(value);
}

export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Reaproveita o identificador do cliente quando ele obedece ao formato, e o **descarta**
 * quando não (`ADR-0022` §8). Descartar é gerar outro, nunca corrigir o recebido.
 */
export function resolveCorrelationId(received: string | undefined): string {
  return received !== undefined && isWellFormedCorrelationId(received)
    ? received
    : generateCorrelationId();
}

/**
 * O contexto da requisição em curso.
 *
 * `userId` é preenchido pela guarda de borda, depois de a sessão ser resolvida — antes
 * disso não há usuário a registrar, e é por isso que ele é o único campo mutável.
 */
export interface RequestContext {
  readonly correlationId: string;
  userId: string | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, work: () => T): T {
  return storage.run(context, work);
}

/** O contexto corrente, ou `null` fora de uma requisição — em carga inicial e em worker. */
export function currentContext(): RequestContext | null {
  return storage.getStore() ?? null;
}

export function currentCorrelationId(): string | null {
  return currentContext()?.correlationId ?? null;
}
