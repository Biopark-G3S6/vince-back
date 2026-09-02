import { describe, expect, it } from 'vitest';

import {
  RESPONSE_CODES,
  RESPONSE_CODE_CATALOG,
  httpStatusOf,
  isKnownResponseCode,
  severityOf,
} from './response-code';

/**
 * O catálogo é a cópia executável da URS §2.4. O que este teste guarda não é o conteúdo
 * — a conferência entre as duas cópias é de revisão —, é a **forma**: `ADR-0025` §7 e §29
 * fazem exigências que um código novo pode violar sem que nada mais reclame.
 */
describe('catálogo de códigos de resposta', () => {
  it('todo código é maiúsculo, sem acento e independente de idioma', () => {
    for (const code of RESPONSE_CODES) {
      expect(code).toMatch(/^[A-Z][A-Z_]*$/);
    }
  });

  it('todo código tem severidade e status HTTP declarados', () => {
    for (const code of RESPONSE_CODES) {
      expect(['success', 'warning', 'error']).toContain(severityOf(code));
      expect(httpStatusOf(code)).toBeGreaterThanOrEqual(200);
    }
  });

  it('falha nunca responde sob status de sucesso (ADR-0025 §14)', () => {
    for (const code of RESPONSE_CODES) {
      if (severityOf(code) === 'error') {
        expect(httpStatusOf(code)).toBeGreaterThanOrEqual(400);
      }
    }
  });

  it('só o sucesso responde na faixa 2xx', () => {
    for (const code of RESPONSE_CODES) {
      const success = httpStatusOf(code) < 300;

      expect(success).toBe(severityOf(code) === 'success');
    }
  });

  it('os status usados são os de ADR-0025 §29', () => {
    const permitted = new Set([200, 400, 401, 403, 404, 409, 422, 500]);

    for (const code of RESPONSE_CODES) {
      expect(permitted.has(httpStatusOf(code))).toBe(true);
    }
  });

  it('reconhece o que está no catálogo e recusa o que não está', () => {
    expect(isKnownResponseCode('AUTHENTICATION_FAILED')).toBe(true);
    expect(isKnownResponseCode('QUALQUER_COISA')).toBe(false);
    // Herdado de `Object.prototype`, e não do catálogo.
    expect(isKnownResponseCode('toString')).toBe(false);
  });

  it('os códigos que esta vertical emite estão declarados', () => {
    for (const code of [
      'SUCCESS',
      'INTERNAL_ERROR',
      'AUTHENTICATION_FAILED',
      'VALIDATION_FAILED',
      'PERMISSION_DENIED',
      'INVITATION_EXPIRED',
      'RESOURCE_NOT_FOUND',
      'LANGUAGE_NOT_SUPPORTED',
    ]) {
      expect(Object.hasOwn(RESPONSE_CODE_CATALOG, code)).toBe(true);
    }
  });
});
