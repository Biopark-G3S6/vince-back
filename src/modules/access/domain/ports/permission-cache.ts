/**
 * Port do cache das permissões efetivas (decisão D3, `ADR-0014` §10).
 *
 * A chave é derivada do identificador da conta e prefixada pelo nome do módulo
 * (`ADR-0020` §6). A implementação vive em `infrastructure/`, sobre a instância única de
 * Redis do processo (`ADR-0020` §4).
 *
 * **Falha fechada.** Nenhum método devolve valor de reserva diante de indisponibilidade:
 * o erro sobe. `ADR-0013` §16 e a implicação 3 de `ADR-0014` equiparam a
 * indisponibilidade do cache à do sistema, e um modo degradado aqui concederia permissão
 * sem base íntegra — exatamente o que a spec proíbe.
 */
export abstract class PermissionCache {
  /** As permissões em cache, ou `null` quando a chave não existe. */
  abstract read(userId: string): Promise<readonly string[] | null>;

  /** Grava as permissões apuradas. O conjunto vazio é valor legítimo, e não ausência. */
  abstract write(userId: string, permissions: readonly string[]): Promise<void>;

  /** Apaga a chave da conta. Apagar chave inexistente conclui com sucesso. */
  abstract invalidate(userId: string): Promise<void>;
}
