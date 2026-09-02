import { VIOLATION, type FieldViolation } from './failure';

/**
 * A política de senha, **declarada em ponto único** (RF-ACS-004 E1, decisão D3).
 *
 * Comprimento, e nada além de comprimento: sem exigência de maiúscula, dígito ou símbolo.
 * A URS não define a política — RF-ACS-004 E1 apenas a pressupõe —, então isto é decisão
 * desta camada, e a razão é que regra de composição empurra o usuário para o padrão
 * previsível (`Senha@2026`) sem aumentar a entropia real. O comprimento é o fator que de
 * fato importa.
 *
 * O máximo existe para limitar o custo da derivação, e não a segurança: Argon2id não tem
 * o limite de 72 bytes do `bcrypt`, mas derivar uma cadeia arbitrariamente longa é um meio
 * de exaustão fácil demais de oferecer.
 *
 * **A confirmar com as partes interessadas** (decisão D3): é decisão de produto tomada por
 * ausência. Política própria da instituição prevalece, e altera este ponto — só este.
 */
export const PASSWORD_POLICY = {
  minLength: 12,
  maxLength: 128,
} as const;

/**
 * As violações da senha submetida, todas de uma vez.
 *
 * `field` é parâmetro porque o mesmo texto é validado sob nomes diferentes conforme a
 * operação — `password` na definição por meio de redefinição, `newPassword` na alteração
 * — e `ADR-0025` §17 exige que o item de `errors` aponte o campo que o cliente enviou.
 *
 * A senha submetida **não** atravessa este retorno, nem em `meta`: `ADR-0025` §18 e
 * `PAD-SEG-025`. O que sai é o limite violado, que é do sistema.
 */
export function violationsOfPassword(
  password: string | undefined,
  field = 'password',
): FieldViolation[] {
  if (password === undefined || password.length === 0) {
    return [{ field, code: VIOLATION.REQUIRED }];
  }

  if (password.length < PASSWORD_POLICY.minLength) {
    return [{ field, code: VIOLATION.TOO_SHORT }];
  }

  if (password.length > PASSWORD_POLICY.maxLength) {
    return [{ field, code: VIOLATION.TOO_LONG }];
  }

  return [];
}
