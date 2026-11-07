import type { FieldViolation } from './failure';

/**
 * A faixa de nota admitida.
 *
 * `RF-ART-002` E2 e `RF-ART-003` E2 exigem recusar nota "fora da faixa admitida" sem
 * declarar qual é. Fixamos de 0 a 10, com duas casas decimais — a escala corrente nas
 * instituições de origem da elicitação —, e a restrição de verificação da migração a
 * impõe no banco. **É premissa declarada, não requisito ratificado:** mudá-la exige
 * alterar a URS e a migração juntas, e por isso ela vive em um lugar só.
 */
export const GRADE_MIN = 0;
export const GRADE_MAX = 10;
export const GRADE_DECIMALS = 2;

export interface Grade {
  readonly value: number;
  readonly authorId: string;
  readonly recordedAt: Date;
}

export interface MemberGrade extends Grade {
  readonly userId: string;
  /** Instantâneo da participação no momento da avaliação (`ADR-0030` §15). */
  readonly memberActive: boolean;
}

function scaleOf(value: number): number {
  return Math.round(value * 10 ** GRADE_DECIMALS) / 10 ** GRADE_DECIMALS;
}

/**
 * A nota é válida?
 *
 * Fora da faixa e com mais casas decimais do que a escala admite são o mesmo caso para a
 * URS — `VALIDATION_FAILED` —, e o código do campo é que distingue. `NaN` e infinito
 * entram como malformados: não são "fora da faixa", são ausência de número.
 */
export function violationsOfGrade(value: number | undefined): FieldViolation[] {
  if (value === undefined) {
    return [{ field: 'value', code: 'REQUIRED' }];
  }
  if (!Number.isFinite(value)) {
    return [{ field: 'value', code: 'MALFORMED' }];
  }
  if (value < GRADE_MIN || value > GRADE_MAX) {
    return [{ field: 'value', code: 'OUT_OF_RANGE' }];
  }
  if (scaleOf(value) !== value) {
    return [{ field: 'value', code: 'TOO_PRECISE' }];
  }

  return [];
}
