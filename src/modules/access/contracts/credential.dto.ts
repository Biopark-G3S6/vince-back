/**
 * DTOs da credencial de senha.
 *
 * A senha atravessa esta fronteira **em texto puro e apenas de fora para dentro**: é o
 * único caminho possível — derivar exige o valor —, e nenhum tipo daqui a devolve. O que
 * volta é sucesso, falha, ou o identificador da conta.
 */

export interface VerifyCredentialQuery {
  readonly email: string;
  readonly password: string;
}

export interface ChangeOwnPasswordCommand {
  readonly userId: string;
  /** Exigida (RF-ACS-004 RN1). Opcional no tipo para que a ausência seja recusada com
   *  `VALIDATION_FAILED`, e não impedida pelo compilador do lado de quem chama. */
  readonly currentPassword?: string;
  readonly newPassword?: string;
}

export interface RequestPasswordResetCommand {
  readonly email: string;
}

/**
 * O meio de redefinição emitido.
 *
 * `token` é o valor em texto puro, e **é equivalente a uma senha temporária**. Existe para
 * que a vertical de notificação o entregue ao titular por correio eletrônico. NÃO DEVE ser
 * devolvido em resposta HTTP, escrito em log nem persistido — o que o banco guarda é a sua
 * derivação (decisão D7).
 */
export interface PasswordResetIssued {
  readonly token: string;
  readonly userId: string;
}

export interface ResetPasswordCommand {
  readonly token?: string;
  readonly password?: string;
}

/** A conta cuja senha foi definida — quem chama precisa dela para revogar as sessões. */
export interface PasswordResetResult {
  readonly userId: string;
}
