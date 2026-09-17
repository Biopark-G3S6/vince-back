import { describe, expect, it } from 'vitest';

import {
  courseOf,
  deactivated,
  normalizeIdentification,
  violationsOfDraft,
  violationsOfUpdate,
  withChanges,
} from './course';

describe('entidade course', () => {
  it('exige nome e identificação no cadastro', () => {
    expect(violationsOfDraft({ name: ' ', identification: '' })).toEqual([
      { field: 'name', code: 'REQUIRED' },
      { field: 'identification', code: 'REQUIRED' },
    ]);
  });

  it('valida somente os campos informados na alteração', () => {
    expect(violationsOfUpdate({ name: ' ', identification: 'CURSO' })).toEqual([
      { field: 'name', code: 'REQUIRED' },
    ]);
  });

  it('normaliza a identificação e preserva o estado na alteração', () => {
    const course = courseOf('01930000-0000-7000-8000-000000000001', 'institution', {
      name: 'Administração',
      identification: ' adm ',
    });

    expect(course.identification).toBe('ADM');
    expect(withChanges(deactivated(course), { name: 'Novo nome' })).toMatchObject({
      name: 'Novo nome',
      identification: 'ADM',
      active: false,
    });
  });

  it('desativação é idempotente', () => {
    const course = courseOf('01930000-0000-7000-8000-000000000002', 'institution', {
      name: 'Administração',
      identification: 'ADM',
    });

    expect(deactivated(deactivated(course))).toEqual(deactivated(course));
  });

  it('não aceita identificação formada somente por espaços', () => {
    expect(normalizeIdentification('   ')).toBe('');
  });
});
