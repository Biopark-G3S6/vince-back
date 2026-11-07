import { describe, expect, it } from 'vitest';

import {
  isPublicationKind,
  publicationOf,
  violationsOfDraft,
  violationsOfUpdate,
  withChanges,
} from './publication';

const DRAFT = {
  venue: '  Congresso Brasileiro de Computação  ',
  kind: 'EVENT',
  publishedAt: new Date('2026-09-01T00:00:00.000Z'),
  url: 'https://exemplo.test/artigo',
} as const;

describe('regras de publicação externa', () => {
  it('exige veículo, tipo, data e endereço', () => {
    expect(violationsOfDraft({})).toEqual([
      { field: 'venue', code: 'REQUIRED' },
      { field: 'kind', code: 'REQUIRED' },
      { field: 'publishedAt', code: 'REQUIRED' },
      { field: 'url', code: 'REQUIRED' },
    ]);
  });

  it('reconhece apenas evento científico e periódico', () => {
    expect(isPublicationKind('EVENT')).toBe(true);
    expect(isPublicationKind('JOURNAL')).toBe(true);
    expect(isPublicationKind('INTERNAL')).toBe(false);
    expect(violationsOfDraft({ ...DRAFT, kind: 'INTERNAL' })).toEqual([
      { field: 'kind', code: 'UNSUPPORTED' },
    ]);
  });

  it('recusa endereço malformado e esquema que não é http', () => {
    for (const url of ['nao-e-url', 'ftp://exemplo.test/a', 'javascript:alert(1)', 'https://']) {
      expect(violationsOfDraft({ ...DRAFT, url })).toEqual([{ field: 'url', code: 'MALFORMED' }]);
    }
  });

  it('apara o veículo e o endereço ao registrar', () => {
    expect(publicationOf('publication-id', 'article-id', 'author-id', DRAFT)).toEqual({
      id: 'publication-id',
      articleId: 'article-id',
      authorId: 'author-id',
      venue: 'Congresso Brasileiro de Computação',
      kind: 'EVENT',
      publishedAt: DRAFT.publishedAt,
      url: 'https://exemplo.test/artigo',
    });
  });

  it('não confere o campo que a alteração não informou', () => {
    expect(violationsOfUpdate({ venue: 'Outro veículo' })).toEqual([]);
    expect(violationsOfUpdate({})).toEqual([]);
    expect(violationsOfUpdate({ url: 'nao-e-url' })).toEqual([{ field: 'url', code: 'MALFORMED' }]);
  });

  it('preserva o artigo e o autor na alteração', () => {
    const publication = publicationOf('publication-id', 'article-id', 'author-id', DRAFT);

    expect(withChanges(publication, { kind: 'JOURNAL', venue: ' Revista ' })).toMatchObject({
      articleId: 'article-id',
      authorId: 'author-id',
      kind: 'JOURNAL',
      venue: 'Revista',
      url: 'https://exemplo.test/artigo',
    });
  });
});
