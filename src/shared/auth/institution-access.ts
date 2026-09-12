/**
 * O estado da instituição do titular, como **port abstrato** (`ADR-0028` §13, decisão D5).
 *
 * `ADR-0013` §17 põe a autenticação em `shared/`; `ADR-0009` §7 proíbe `shared/` de
 * importar de `modules/`; e o estado da instituição é dado do módulo `institution`
 * (`ADR-0028` §5). As três regras só se satisfazem ao mesmo tempo se `shared/` declarar o
 * que precisa e o composition root ligar à implementação — que é exatamente o que este
 * arquivo é, e é o mesmo arranjo de `CredentialVerifier`.
 *
 * **Não é o módulo `access` quem responde.** Ele não conhece a instituição, e não pode:
 * todo módulo depende da fachada de `access`, e uma dependência de volta fecharia o ciclo
 * que `ADR-0005` §6 proíbe (`ADR-0027` §9). Quem compõe as duas respostas é o composition
 * root, único ponto que enxerga os dois `contracts/`.
 *
 * A ausência do módulo `institution` no processo faz este port responder **sempre
 * permitido** — é o que preserva `ADR-0003` §11: remover o módulo do composition root não
 * pode quebrar os demais.
 */
export abstract class InstitutionAccess {
  /**
   * A conta pode agir?
   *
   * `true` quando não há vínculo institucional — o `SYSTEM_ADMIN` atua sobre todas as
   * instituições (URS §1.4.1 item 3) — e quando o vínculo é com instituição ativa.
   *
   * `false` quando a instituição está desativada (RF-INS-001 RN2) e quando o vínculo
   * aponta para instituição inexistente: os dois casos negam, e negar é o comportamento
   * seguro para um vínculo que não se pode confirmar.
   */
  abstract allows(userId: string): Promise<boolean>;
}
