import { describe, expect, it } from 'vitest';

import { csrfTokenFor, isValidCsrfToken } from './csrf';
import { generateSessionId } from './session';

const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';

describe('token anti-CSRF', () => {
  it('o token de uma sessão vale para ela', () => {
    const sessionId = generateSessionId();

    expect(isValidCsrfToken(csrfTokenFor(sessionId, SECRET), sessionId, SECRET)).toBe(true);
  });

  it('o token de uma sessão NÃO vale para outra (ADR-0013 §14)', () => {
    const mine = generateSessionId();
    const yours = generateSessionId();

    expect(isValidCsrfToken(csrfTokenFor(yours, SECRET), mine, SECRET)).toBe(false);
  });

  it('token vazio, truncado ou inventado é recusado', () => {
    const sessionId = generateSessionId();
    const valid = csrfTokenFor(sessionId, SECRET);

    for (const token of ['', valid.slice(0, -1), `${valid}x`, 'x'.repeat(valid.length)]) {
      expect(isValidCsrfToken(token, sessionId, SECRET)).toBe(false);
    }
  });

  it('trocar o segredo invalida os tokens emitidos', () => {
    const sessionId = generateSessionId();

    expect(isValidCsrfToken(csrfTokenFor(sessionId, SECRET), sessionId, `${SECRET}-novo`)).toBe(
      false,
    );
  });

  it('o token não revela o identificador da sessão', () => {
    const sessionId = generateSessionId();

    expect(csrfTokenFor(sessionId, SECRET)).not.toContain(sessionId);
  });
});
