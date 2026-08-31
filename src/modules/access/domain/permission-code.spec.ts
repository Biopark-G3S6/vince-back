import { describe, expect, it } from 'vitest';

import { violationOfPermissionCode } from './permission-code';

describe('forma da permissão', () => {
  it('aceita o formato RECURSO:ACAO', () => {
    expect(violationOfPermissionCode('COURSE:CREATE')).toBeNull();
    expect(violationOfPermissionCode('PERMISSION_GRANT:CREATE')).toBeNull();
    expect(violationOfPermissionCode('ARTICLE:READ_HISTORY')).toBeNull();
    expect(violationOfPermissionCode('INSTITUTION:CONSENT_AI')).toBeNull();
  });

  it('aceita recurso singular terminado em `SS`', () => {
    // `PROGRESS` está no catálogo e é singular: a heurística de plural não pode recusá-lo.
    expect(violationOfPermissionCode('PROGRESS:READ')).toBeNull();
  });

  it('recusa curinga em qualquer posição', () => {
    expect(violationOfPermissionCode('COURSE:*')).toBe('wildcard');
    expect(violationOfPermissionCode('*:READ')).toBe('wildcard');
    expect(violationOfPermissionCode('COUR*SE:READ')).toBe('wildcard');
  });

  it('recusa ausência do separador e separador repetido', () => {
    expect(violationOfPermissionCode('COURSECREATE')).toBe('missing-separator');
    expect(violationOfPermissionCode('COURSE:READ:ALL')).toBe('missing-separator');
  });

  it('recusa minúscula e acento', () => {
    expect(violationOfPermissionCode('course:create')).toBe('invalid-characters');
    expect(violationOfPermissionCode('COURSE:Create')).toBe('invalid-characters');
    expect(violationOfPermissionCode('CURSO:CRIAÇÃO')).toBe('invalid-characters');
    expect(violationOfPermissionCode('COURSE:')).toBe('invalid-characters');
  });

  it('recusa recurso no plural', () => {
    expect(violationOfPermissionCode('COURSES:CREATE')).toBe('plural-resource');
    expect(violationOfPermissionCode('RISK_SIGNALS:READ')).toBe('plural-resource');
  });
});
