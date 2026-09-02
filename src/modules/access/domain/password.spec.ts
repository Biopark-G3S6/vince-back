import { describe, expect, it } from 'vitest';

import { VIOLATION } from './failure';
import { PASSWORD_POLICY, violationsOfPassword } from './password';

/**
 * A política declarada em ponto único (RF-ACS-004 E1, decisão D3). O que este teste
 * guarda é a política **como regra**, sem banco: `ADR-0024` §6 admite exatamente isso para
 * regra de domínio sem dependência.
 */
describe('política de senha', () => {
  it('senha conforme não produz violação', () => {
    expect(violationsOfPassword('a'.repeat(PASSWORD_POLICY.minLength))).toEqual([]);
    expect(violationsOfPassword('a'.repeat(PASSWORD_POLICY.maxLength))).toEqual([]);
  });

  it('senha abaixo do comprimento mínimo é recusada', () => {
    expect(violationsOfPassword('a'.repeat(PASSWORD_POLICY.minLength - 1))).toEqual([
      { field: 'password', code: VIOLATION.TOO_SHORT },
    ]);
  });

  it('senha acima do comprimento máximo é recusada', () => {
    expect(violationsOfPassword('a'.repeat(PASSWORD_POLICY.maxLength + 1))).toEqual([
      { field: 'password', code: VIOLATION.TOO_LONG },
    ]);
  });

  it('senha ausente ou vazia é campo obrigatório, e não senha curta', () => {
    expect(violationsOfPassword(undefined)).toEqual([
      { field: 'password', code: VIOLATION.REQUIRED },
    ]);
    expect(violationsOfPassword('')).toEqual([{ field: 'password', code: VIOLATION.REQUIRED }]);
  });

  it('o campo apontado é o que o cliente enviou', () => {
    expect(violationsOfPassword('curta', 'newPassword')).toEqual([
      { field: 'newPassword', code: VIOLATION.TOO_SHORT },
    ]);
  });

  /**
   * Não há regra de composição (decisão D3): exigir maiúscula, dígito ou símbolo empurra o
   * usuário para o padrão previsível sem aumentar a entropia real.
   */
  it('não exige maiúscula, dígito nem símbolo', () => {
    expect(violationsOfPassword('todasminusculassemdigito')).toEqual([]);
  });

  it('a violação não carrega o valor submetido (ADR-0025 §18)', () => {
    const submitted = 'senha-secreta-do-usuario';

    expect(JSON.stringify(violationsOfPassword(submitted, 'newPassword'))).not.toContain(submitted);
  });
});
