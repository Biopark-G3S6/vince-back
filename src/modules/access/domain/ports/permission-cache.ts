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

/**
 * O que a apuração produz e o cache guarda: as permissões **e** o vínculo institucional
 * da conta.
 *
 * Os dois juntos, e não em chaves separadas, porque quem os consome os quer no mesmo
 * instante (`ADR-0028` §13) e porque a mesma escrita os invalida: papel e vínculo mudam
 * pelas mesmas operações.
 */
export interface ResolvedPermissions {
  readonly permissions: readonly string[];
  /** `null` para `SYSTEM_ADMIN` e para conta inexistente. */
  readonly institutionId: string | null;
}

export abstract class PermissionCache {
  /** O que está em cache, ou `null` quando a chave não existe. */
  abstract read(userId: string): Promise<ResolvedPermissions | null>;

  /** Grava o apurado. O conjunto vazio é valor legítimo, e não ausência. */
  abstract write(userId: string, resolved: ResolvedPermissions): Promise<void>;

  /** Apaga a chave da conta. Apagar chave inexistente conclui com sucesso. */
  abstract invalidate(userId: string): Promise<void>;
}
