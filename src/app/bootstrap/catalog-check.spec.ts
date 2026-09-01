import { describe, expect, it } from 'vitest';

import {
  compareCatalogs,
  describeComparison,
  DocumentationUnavailableError,
  isMatch,
  parseUrsCatalog,
  readUrsCatalog,
  type CatalogSnapshot,
} from './catalog-check';

const URS = [
  '### 2.3 Catálogo de permissões',
  '',
  '| Permissão | Origem |',
  '| :--- | :--- |',
  '| `COURSE:CREATE` | RF-CUR-001 |',
  '| `COURSE:READ` | RF-CUR-001 |',
  '| `ARTICLE:READ` | RF-ART-001 |',
  '',
  '#### 2.3.1 Composição dos papéis padrão',
  '',
  '| Papel | Permissões |',
  '| :--- | :--- |',
  '| `COORDINATOR` | `COURSE:CREATE/READ`, `ARTICLE:READ` |',
  '| `STUDENT` | `ARTICLE:READ` |',
  '',
  '### 2.4 Catálogo de códigos de resposta',
].join('\n');

const DECLARED: CatalogSnapshot = {
  permissions: ['COURSE:CREATE', 'COURSE:READ', 'ARTICLE:READ'],
  roles: [
    { code: 'COORDINATOR', permissions: ['COURSE:CREATE', 'COURSE:READ', 'ARTICLE:READ'] },
    { code: 'STUDENT', permissions: ['ARTICLE:READ'] },
  ],
};

describe('leitura do catálogo da URS', () => {
  it('lê as permissões de §2.3 e expande a notação abreviada de §2.3.1', () => {
    const urs = parseUrsCatalog(URS);

    expect(urs.permissions).toEqual(['COURSE:CREATE', 'COURSE:READ', 'ARTICLE:READ']);
    expect(urs.roles).toEqual([
      { code: 'COORDINATOR', permissions: ['COURSE:CREATE', 'COURSE:READ', 'ARTICLE:READ'] },
      { code: 'STUDENT', permissions: ['ARTICLE:READ'] },
    ]);
  });

  it('falha indicando a indisponibilidade, sem relatar correspondência', () => {
    // Sem a documentação não há o que conferir: relatar correspondência aqui seria
    // afirmar o que não foi verificado.
    expect(() => readUrsCatalog('docs/Requisitos/inexistente.md')).toThrow(
      DocumentationUnavailableError,
    );
    expect(() => readUrsCatalog('docs/Requisitos/inexistente.md')).toThrow(/não está inicializado/);
  });
});

describe('conferência do catálogo com a URS', () => {
  it('relata correspondência integral e conclui com sucesso', () => {
    const comparison = compareCatalogs(DECLARED, parseUrsCatalog(URS));

    expect(isMatch(comparison)).toBe(true);
    expect(describeComparison(comparison, DECLARED)).toContain('em correspondência');
  });

  it('falha identificando a permissão do repositório sem requisito de origem', () => {
    const declared: CatalogSnapshot = {
      ...DECLARED,
      permissions: [...DECLARED.permissions, 'COURSE:DELETE'],
    };

    const comparison = compareCatalogs(declared, parseUrsCatalog(URS));

    expect(isMatch(comparison)).toBe(false);
    expect(comparison.surplusPermissions).toEqual(['COURSE:DELETE']);
    expect(describeComparison(comparison, declared)).toContain('COURSE:DELETE');
  });

  it('falha identificando a permissão da URS ausente do repositório', () => {
    const declared: CatalogSnapshot = {
      ...DECLARED,
      permissions: ['COURSE:CREATE', 'ARTICLE:READ'],
    };

    const comparison = compareCatalogs(declared, parseUrsCatalog(URS));

    expect(isMatch(comparison)).toBe(false);
    expect(comparison.missingPermissions).toEqual(['COURSE:READ']);
  });

  it('falha identificando a composição divergente, nos dois sentidos', () => {
    const declared: CatalogSnapshot = {
      ...DECLARED,
      roles: [
        { code: 'COORDINATOR', permissions: ['COURSE:CREATE'] },
        { code: 'STUDENT', permissions: ['ARTICLE:READ', 'COURSE:READ'] },
      ],
    };

    const comparison = compareCatalogs(declared, parseUrsCatalog(URS));

    expect(comparison.roleDifferences).toEqual([
      { code: 'COORDINATOR', missing: ['ARTICLE:READ', 'COURSE:READ'], surplus: [] },
      { code: 'STUDENT', missing: [], surplus: ['COURSE:READ'] },
    ]);
  });
});

// A conferência contra a URS real NÃO é testada aqui: `verify` não busca o submódulo
// `docs/` (ADR-0027 §19), e um teste que o lesse reprovaria no workflow. Ela é o
// comando `pnpm run docs:check-catalog`, executado deliberadamente na revisão.
