import { describe, expect, it } from 'vitest';

import { requiresExclusiveInstance, resolveModules, resolveRole } from './role';

// Testes residem junto do código que exercitam (ADR-0024 §17).
// Regra sem dependência é testada isoladamente, sem banco (ADR-0024 §6).

describe('resolveRole', () => {
  it('assume o papel api quando ROLE não é declarado', () => {
    expect(resolveRole({})).toBe('api');
  });

  it.each(['api', 'worker', 'relay'] as const)('aceita o papel %s', (papel) => {
    expect(resolveRole({ ROLE: papel })).toBe(papel);
  });

  it('ignora espaços ao redor do valor', () => {
    expect(resolveRole({ ROLE: '  worker  ' })).toBe('worker');
  });

  it('rejeita papel não declarado em ADR-0008 §3', () => {
    expect(() => resolveRole({ ROLE: 'scheduler' })).toThrowError(/ROLE inválido/);
  });
});

describe('resolveModules', () => {
  it('retorna lista vazia quando MODULES não é declarado, o que significa todos', () => {
    expect(resolveModules({})).toEqual([]);
  });

  it('separa por vírgula e descarta espaços', () => {
    expect(resolveModules({ MODULES: 'observabilidade, orientacao' })).toEqual([
      'observabilidade',
      'orientacao',
    ]);
  });

  it('descarta entradas vazias', () => {
    expect(resolveModules({ MODULES: 'observabilidade,,' })).toEqual(['observabilidade']);
  });
});

describe('requiresExclusiveInstance', () => {
  it('exige instância única apenas para o relay, conforme ADR-0021 §7', () => {
    expect(requiresExclusiveInstance('relay')).toBe(true);
    expect(requiresExclusiveInstance('api')).toBe(false);
    expect(requiresExclusiveInstance('worker')).toBe(false);
  });
});
