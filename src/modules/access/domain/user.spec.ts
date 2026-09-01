import { describe, expect, it } from 'vitest';

import { VIOLATION } from './failure';
import { DEFAULT_LANGUAGE, isSupportedLanguage } from './language';
import {
  acceptsLanguage,
  activated,
  allowsAbsentInstitution,
  deactivated,
  EXPERTISE_AREA_MAX_LENGTH,
  isKnownRole,
  isWellFormedEmail,
  NAME_MAX_LENGTH,
  normalizeEmail,
  normalizeOptionalText,
  violationsOfDraft,
  violationsOfProfileUpdate,
  withProfile,
  type UserAccount,
} from './user';

/**
 * Regra de domínio sem dependência, testada sem banco de dados (`ADR-0024` §6). O que
 * exige persistência — unicidade do e-mail, idempotência, trilha — é exercitado pela
 * fachada, em `access.module.spec.ts` (§2).
 */

const account: UserAccount = {
  id: '01930000-0000-7000-8000-000000000001',
  email: 'ana@exemplo.edu.br',
  name: 'Ana',
  expertiseArea: null,
  preferredLanguage: null,
  active: true,
  institutionId: '01930000-0000-7000-8000-0000000000ff',
};

const codesOf = (violations: readonly { field: string; code: string }[]): string[] =>
  violations.map((violation) => `${violation.field}:${violation.code}`);

describe('normalização do e-mail', () => {
  it('remove espaços nas extremidades e desconsidera a caixa', () => {
    expect(normalizeEmail('  Ana@Exemplo.EDU.br  ')).toBe('ana@exemplo.edu.br');
  });

  it('faz de duas grafias do mesmo endereço uma única chave', () => {
    expect(normalizeEmail('ANA@EXEMPLO.EDU.BR')).toBe(normalizeEmail(' ana@exemplo.edu.br '));
  });

  it('não altera endereço já normalizado', () => {
    expect(normalizeEmail('ana@exemplo.edu.br')).toBe('ana@exemplo.edu.br');
  });

  it('não depende da localidade do processo', () => {
    // O `I` maiúsculo vira `ı` sem ponto sob a localidade turca com `toLocaleLowerCase`.
    expect(normalizeEmail('IGOR@EXEMPLO.EDU.BR')).toBe('igor@exemplo.edu.br');
  });
});

describe('forma do e-mail', () => {
  it.each([
    'ana@exemplo.edu.br',
    'ana.paula@exemplo.com',
    'ana+turma@sub.exemplo.edu.br',
    "o'brien@exemplo.com",
  ])('aceita %s', (value) => {
    expect(isWellFormedEmail(value)).toBe(true);
  });

  it.each(['ana', 'ana@', '@exemplo.com', 'ana@exemplo', 'ana exemplo@x.com', 'ana@@exemplo.com'])(
    'recusa %s',
    (value) => {
      expect(isWellFormedEmail(value)).toBe(false);
    },
  );
});

describe('violações da criação de conta', () => {
  const draft = {
    email: 'novo@exemplo.edu.br',
    name: 'Novo',
    role: 'STUDENT',
    institutionId: '01930000-0000-7000-8000-0000000000ff',
  };

  it('não acusa nada quando tudo está informado', () => {
    expect(violationsOfDraft(draft)).toEqual([]);
  });

  it('acusa o e-mail ausente', () => {
    expect(codesOf(violationsOfDraft({ ...draft, email: '   ' }))).toContain(
      `email:${VIOLATION.REQUIRED}`,
    );
  });

  it('acusa o e-mail malformado', () => {
    expect(codesOf(violationsOfDraft({ ...draft, email: 'não-é-endereço' }))).toContain(
      `email:${VIOLATION.MALFORMED}`,
    );
  });

  it('acusa o nome ausente', () => {
    expect(codesOf(violationsOfDraft({ ...draft, name: '  ' }))).toContain(
      `name:${VIOLATION.REQUIRED}`,
    );
  });

  it('acusa o nome longo demais', () => {
    const long = 'a'.repeat(NAME_MAX_LENGTH + 1);

    expect(codesOf(violationsOfDraft({ ...draft, name: long }))).toContain(
      `name:${VIOLATION.TOO_LONG}`,
    );
  });

  it('acusa um item por campo inválido, e não apenas o primeiro', () => {
    const violations = violationsOfDraft({ email: '', name: '', role: 'STUDENT' });

    expect(codesOf(violations)).toEqual([
      `email:${VIOLATION.REQUIRED}`,
      `name:${VIOLATION.REQUIRED}`,
      `institutionId:${VIOLATION.REQUIRED}`,
    ]);
  });

  it('não devolve o valor submetido em violação alguma', () => {
    const violations = violationsOfDraft({ ...draft, email: 'ana@invalido' });

    expect(JSON.stringify(violations)).not.toContain('ana@invalido');
  });

  it('acusa a área de atuação longa demais', () => {
    const long = 'a'.repeat(EXPERTISE_AREA_MAX_LENGTH + 1);

    expect(codesOf(violationsOfDraft({ ...draft, expertiseArea: long }))).toContain(
      `expertiseArea:${VIOLATION.TOO_LONG}`,
    );
  });

  it('não trata idioma não suportado como violação de campo', () => {
    // Idioma tem código próprio no catálogo: `LANGUAGE_NOT_SUPPORTED`, não `VALIDATION_FAILED`.
    expect(violationsOfDraft({ ...draft, preferredLanguage: 'xx-YY' })).toEqual([]);
  });
});

describe('vínculo institucional', () => {
  it('é dispensado para o administrador de sistema', () => {
    expect(allowsAbsentInstitution('SYSTEM_ADMIN')).toBe(true);
    expect(violationsOfDraft({ email: 'a@b.com', name: 'A', role: 'SYSTEM_ADMIN' })).toEqual([]);
  });

  it('é exigido dos demais papéis', () => {
    for (const role of ['INSTITUTION_ADMIN', 'COORDINATOR', 'PROFESSOR', 'STUDENT']) {
      expect(allowsAbsentInstitution(role)).toBe(false);
      expect(codesOf(violationsOfDraft({ email: 'a@b.com', name: 'A', role }))).toContain(
        `institutionId:${VIOLATION.REQUIRED}`,
      );
    }
  });
});

describe('violações da atualização de perfil', () => {
  it('não apura campo que a atualização não informa', () => {
    expect(violationsOfProfileUpdate({})).toEqual([]);
    expect(violationsOfProfileUpdate({ expertiseArea: null })).toEqual([]);
  });

  it('acusa o nome vazio', () => {
    expect(codesOf(violationsOfProfileUpdate({ name: '' }))).toEqual([
      `name:${VIOLATION.REQUIRED}`,
    ]);
  });

  it('acusa o nome fora do tamanho admitido', () => {
    expect(codesOf(violationsOfProfileUpdate({ name: 'a'.repeat(NAME_MAX_LENGTH + 1) }))).toEqual([
      `name:${VIOLATION.TOO_LONG}`,
    ]);
  });
});

describe('aplicação da alteração de perfil', () => {
  it('altera apenas o que a atualização informa', () => {
    const changed = withProfile(account, { name: '  Ana Paula  ' });

    expect(changed.name).toBe('Ana Paula');
    expect(changed.email).toBe(account.email);
    expect(changed.expertiseArea).toBeNull();
  });

  it('trata texto vazio como remoção, e não como texto vazio', () => {
    const withArea = withProfile(account, { expertiseArea: 'Engenharia de Software' });

    expect(withProfile(withArea, { expertiseArea: '   ' }).expertiseArea).toBeNull();
  });

  it('remove a preferência de idioma quando ela vem nula', () => {
    const withLanguage = withProfile(account, { preferredLanguage: DEFAULT_LANGUAGE });

    expect(withLanguage.preferredLanguage).toBe(DEFAULT_LANGUAGE);
    expect(withProfile(withLanguage, { preferredLanguage: null }).preferredLanguage).toBeNull();
  });

  it('não toca no vínculo nem no estado', () => {
    const changed = withProfile(account, { name: 'Outra' });

    expect(changed.institutionId).toBe(account.institutionId);
    expect(changed.active).toBe(true);
  });
});

describe('preferência de idioma', () => {
  it('aceita idioma suportado', () => {
    expect(isSupportedLanguage(DEFAULT_LANGUAGE)).toBe(true);
    expect(acceptsLanguage(DEFAULT_LANGUAGE)).toBe(true);
  });

  it('recusa idioma fora dos suportados', () => {
    expect(acceptsLanguage('xx-YY')).toBe(false);
    expect(acceptsLanguage('en-US')).toBe(false);
  });

  it('aceita a ausência de preferência, que é estado válido', () => {
    expect(acceptsLanguage(null)).toBe(true);
    expect(acceptsLanguage(undefined)).toBe(true);
    expect(acceptsLanguage('   ')).toBe(true);
  });
});

describe('transição de estado', () => {
  it('a conta nasce ativa e a desativação a torna inativa', () => {
    expect(account.active).toBe(true);
    expect(deactivated(account).active).toBe(false);
  });

  it('a desativação é idempotente', () => {
    expect(deactivated(deactivated(account))).toEqual(deactivated(account));
  });

  it('a reativação devolve a conta ao estado ativo', () => {
    expect(activated(deactivated(account)).active).toBe(true);
  });

  it('a transição não remove dado algum da conta', () => {
    const inactive = deactivated(account);

    expect(inactive.email).toBe(account.email);
    expect(inactive.institutionId).toBe(account.institutionId);
  });
});

describe('texto opcional', () => {
  it('trata ausente, nulo, vazio e só-espaços como a mesma coisa', () => {
    for (const value of [undefined, null, '', '   ']) {
      expect(normalizeOptionalText(value)).toBeNull();
    }
  });

  it('preserva o texto informado, sem as extremidades', () => {
    expect(normalizeOptionalText('  Direito Digital ')).toBe('Direito Digital');
  });
});

describe('papel reconhecido', () => {
  it('reconhece os cinco papéis da URS §1.4', () => {
    for (const role of [
      'SYSTEM_ADMIN',
      'INSTITUTION_ADMIN',
      'COORDINATOR',
      'PROFESSOR',
      'STUDENT',
    ]) {
      expect(isKnownRole(role)).toBe(true);
    }
  });

  it('não reconhece papel fora dos cinco', () => {
    for (const role of ['AUDITOR', 'student', 'ADMIN', '']) {
      expect(isKnownRole(role)).toBe(false);
    }
  });
});
