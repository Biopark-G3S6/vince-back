/**
 * Os parâmetros de operação da credencial, injetados pelo composition root.
 *
 * É port, e não leitura direta de ambiente dentro do caso de uso, porque o caso de uso
 * precisa ser exercitável sem ambiente (`ADR-0024` §6) — e porque prazo é decisão de
 * operação, que muda por instalação.
 */
export abstract class CredentialSettings {
  /** Prazo de validade do meio de redefinição, em segundos (RF-ACS-003 RN1). */
  abstract readonly passwordResetTtlSeconds: number;
}
