import { describe, expect, it } from 'vitest';

import {
  currentCorrelationId,
  generateCorrelationId,
  isWellFormedCorrelationId,
  resolveCorrelationId,
  runWithContext,
} from './correlation';

describe('identificador de correlação', () => {
  it('o gerado obedece ao formato declarado', () => {
    expect(isWellFormedCorrelationId(generateCorrelationId())).toBe(true);
  });

  it('reaproveita o identificador do cliente quando ele obedece ao formato', () => {
    const received = generateCorrelationId();

    expect(resolveCorrelationId(received)).toBe(received);
  });

  it('descarta o malformado e gera outro (ADR-0022 §8)', () => {
    for (const malformed of ['', 'nao-e-uuid', '../../etc/passwd', 'a'.repeat(500), '\n']) {
      const resolved = resolveCorrelationId(malformed);

      expect(resolved).not.toBe(malformed);
      expect(isWellFormedCorrelationId(resolved)).toBe(true);
    }
  });

  it('a ausência produz identificador novo', () => {
    expect(isWellFormedCorrelationId(resolveCorrelationId(undefined))).toBe(true);
  });

  it('o contexto acompanha a execução assíncrona', async () => {
    const correlationId = generateCorrelationId();

    const seen = await runWithContext({ correlationId, userId: null }, async () => {
      await Promise.resolve();

      return currentCorrelationId();
    });

    expect(seen).toBe(correlationId);
  });

  it('fora de uma requisição não há contexto', () => {
    expect(currentCorrelationId()).toBeNull();
  });
});
