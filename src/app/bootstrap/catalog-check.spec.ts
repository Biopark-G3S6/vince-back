import { describe, expect, it } from 'vitest';

import {
  compareCatalogs,
  compareResponseCodes,
  describeComparison,
  describeResponseCodes,
  DocumentationUnavailableError,
  isMatch,
  isResponseCodeMatch,
  parseUrsCatalog,
  parseUrsResponseCodes,
  readUrsCatalog,
  UrsFormatError,
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
  '',
  'Em maiúsculas, sem acento. A tradução ocorre no cliente, a partir de `status.code`.',
  '',
  '| Código | Origem |',
  '| :--- | :--- |',
  '| `SUCCESS` | `ADR-0025` §4, §9 |',
  '| `AUTHENTICATION_FAILED` | RF-ACS-001 |',
  '| `VALIDATION_FAILED` | RF-ACS-004 |',
  '',
  '---',
  '',
  '## 3. Pendências',
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

describe('conferência dos códigos de resposta com a URS §2.4', () => {
  const DECLARED_CODES = ['SUCCESS', 'AUTHENTICATION_FAILED', 'VALIDATION_FAILED'];

  it('lê a tabela de §2.4 sem confundi-la com o parágrafo que a antecede', () => {
    // O texto acima da tabela também traz crases — `status.code` —, e a coluna de
    // origem traz `ADR-0025`. Nem um nem outro é código de resposta.
    expect(parseUrsResponseCodes(URS)).toEqual(DECLARED_CODES);
  });

  it('não confunde a origem em crases com um código', () => {
    expect(parseUrsResponseCodes(URS)).not.toContain('ADR-0025');
    expect(parseUrsResponseCodes(URS)).not.toContain('status.code');
  });

  it('reconhece a correspondência quando as duas cópias batem', () => {
    const comparison = compareResponseCodes(DECLARED_CODES, parseUrsResponseCodes(URS));

    expect(isResponseCodeMatch(comparison)).toBe(true);
    expect(describeResponseCodes(comparison, DECLARED_CODES)).toContain('3 códigos');
  });

  /**
   * O caso que motivou o comando: um código entra no repositório antes de entrar na
   * URS. Aconteceu com `SUCCESS` e `INTERNAL_ERROR`, e nada reclamou.
   */
  it('acusa código do repositório sem origem na URS', () => {
    const comparison = compareResponseCodes(
      [...DECLARED_CODES, 'INTERNAL_ERROR'],
      parseUrsResponseCodes(URS),
    );

    expect(isResponseCodeMatch(comparison)).toBe(false);
    expect(comparison.surplus).toEqual(['INTERNAL_ERROR']);
    expect(describeResponseCodes(comparison, DECLARED_CODES)).toContain(
      'sem origem na URS: INTERNAL_ERROR',
    );
  });

  it('acusa código da URS ausente do repositório', () => {
    const comparison = compareResponseCodes(['SUCCESS'], parseUrsResponseCodes(URS));

    expect(isResponseCodeMatch(comparison)).toBe(false);
    expect(comparison.missing).toEqual(['AUTHENTICATION_FAILED', 'VALIDATION_FAILED']);
  });

  it('acusa divergência nos dois sentidos de uma vez', () => {
    const comparison = compareResponseCodes(
      ['SUCCESS', 'CODIGO_INVENTADO'],
      parseUrsResponseCodes(URS),
    );

    expect(comparison.surplus).toEqual(['CODIGO_INVENTADO']);
    expect(comparison.missing).toEqual(['AUTHENTICATION_FAILED', 'VALIDATION_FAILED']);
  });

  it('recusa a URS sem a seção §2.4, em vez de relatar correspondência', () => {
    expect(() => parseUrsResponseCodes('### 2.3 Catálogo de permissões\n')).toThrow(UrsFormatError);
  });

  it('recusa a tabela de §2.4 vazia', () => {
    const semLinhas = ['### 2.4 Catálogo de códigos de resposta', '', '## 3. Pendências'].join(
      '\n',
    );

    expect(() => parseUrsResponseCodes(semLinhas)).toThrow(/§2.4 veio vazia/);
  });
});
