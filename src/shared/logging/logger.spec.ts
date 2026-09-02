import { describe, expect, it } from 'vitest';

import { runWithContext } from '../correlation/correlation';
import { LOG_CONTEXT_FIELDS, allowedContext } from './log-fields';
import { StructuredLogger, type LogRecord } from './logger';

function capture(): { readonly records: LogRecord[]; readonly logger: StructuredLogger } {
  const records: LogRecord[] = [];

  return {
    records,
    logger: new StructuredLogger('access', (record) => records.push(record), 'api', 'debug'),
  };
}

describe('log estruturado', () => {
  it('todo registro carrega instante, nível, correlação, papel e módulo (ADR-0022 §3)', () => {
    const { records, logger } = capture();

    runWithContext({ correlationId: 'c-1', userId: null }, () => {
      logger.info('SESSION_ESTABLISHED');
    });

    const record = records[0];

    expect(record?.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(record?.level).toBe('info');
    expect(record?.correlationId).toBe('c-1');
    expect(record?.role).toBe('api');
    expect(record?.module).toBe('access');
    expect(record?.event).toBe('SESSION_ESTABLISHED');
  });

  it('fora de uma requisição, a correlação é nula e o registro sai assim mesmo', () => {
    const { records, logger } = capture();

    logger.info('SEED_COMPLETED');

    expect(records[0]?.correlationId).toBeNull();
  });

  /**
   * A verificação que `ADR-0022` §4 pede: campo sensível **não declarado** acrescentado ao
   * contexto não aparece no registro emitido. É a diferença prática entre lista de
   * permissão e lista de bloqueio (§5) — ninguém precisou prever `password` para que ele
   * ficasse de fora.
   */
  it('campo não declarado não é registrado', () => {
    const { records, logger } = capture();

    logger.warn('AUTHORIZATION_DENIED', {
      userId: 'u-1',
      requiredPermission: 'EVENT:READ',
      password: 'senha-em-texto-puro',
      email: 'alguem@exemplo.test',
      cookie: 'vince_session=abc',
    });

    const context = records[0]?.context ?? {};

    expect(context).toEqual({ userId: 'u-1', requiredPermission: 'EVENT:READ' });
    expect(JSON.stringify(records[0])).not.toContain('senha-em-texto-puro');
    expect(JSON.stringify(records[0])).not.toContain('alguem@exemplo.test');
  });

  it('campo declarado e ausente não vira chave indefinida', () => {
    expect(allowedContext({ userId: undefined, route: '/profile' })).toEqual({
      route: '/profile',
    });
  });

  it('a lista de permissão não tem campo repetido', () => {
    expect(new Set(LOG_CONTEXT_FIELDS).size).toBe(LOG_CONTEXT_FIELDS.length);
  });

  it('o nível configurado descarta o que está abaixo dele', () => {
    const records: LogRecord[] = [];
    const logger = new StructuredLogger('shared', (record) => records.push(record), 'api', 'warn');

    logger.debug('IGNORADO');
    logger.info('IGNORADO');
    logger.warn('REGISTRADO');
    logger.error('REGISTRADO');

    expect(records.map((record) => record.level)).toEqual(['warn', 'error']);
  });
});
