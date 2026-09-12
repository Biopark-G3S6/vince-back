/**
 * Port do domínio para o vínculo de administração (`ADR-0028` §5).
 *
 * O vínculo é a linha que dá escopo ao papel global `INSTITUTION_ADMIN`
 * (RF-INS-002 RN2): o papel diz o que a pessoa pode fazer, e o vínculo, onde.
 */

/** O que uma escrita idempotente de fato alterou. */
export interface LinkOutcome {
  readonly changed: boolean;
}

export abstract class InstitutionAdminRepository {
  /**
   * Cria o vínculo. **Idempotente**: repetir a designação não cria um segundo vínculo e
   * conclui com sucesso (RF-INS-002 E1), o que é o que permite a retomada de uma
   * designação interrompida (`ADR-0028` §18).
   */
  abstract link(institutionId: string, userId: string): Promise<LinkOutcome>;

  /** Remove o vínculo. Idempotente: remover vínculo inexistente conclui e nada altera. */
  abstract unlink(institutionId: string, userId: string): Promise<LinkOutcome>;

  /**
   * Quantos vínculos de administração o usuário conserva.
   *
   * É o que RF-INS-002 RN3 pergunta na revogação: o papel só cai quando não resta vínculo
   * que o justifique. Uma consulta, e não uma por instituição (`ADR-0011` §13).
   */
  abstract countByUser(userId: string): Promise<number>;
}
