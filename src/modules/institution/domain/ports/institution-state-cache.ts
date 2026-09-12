import type { InstitutionState } from './institution-repository';

/**
 * Port do cache do estado da instituição (`ADR-0028` §14, `ADR-0014` §10).
 *
 * **Existe por causa do caminho crítico.** A composição de borda pergunta o estado da
 * instituição a cada requisição autenticada (`ADR-0028` §13); sem cache, isso seria uma
 * consulta ao banco por requisição, o que `ADR-0011` §9 não proíbe mas o orçamento de
 * latência de §1 não comporta.
 *
 * **A chave é por instituição, e não por usuário**, e é isso que atende `ADR-0011` §13: a
 * desativação invalida **uma** chave, qualquer que seja a quantidade de usuários
 * afetados. Invalidar o cache de permissões usuário a usuário seria a iteração com uma
 * consulta por elemento que a revisão reprova.
 *
 * **Falha fechada.** Nenhum método devolve valor de reserva diante de indisponibilidade:
 * o erro sobe, pelo mesmo motivo que no cache de permissões — um modo degradado aqui
 * concederia acesso a usuário de instituição desativada.
 */
export abstract class InstitutionStateCache {
  /** O estado em cache, ou `null` quando a chave não existe. */
  abstract read(institutionId: string): Promise<InstitutionState | null>;

  /** O mesmo, em lote. Uma ida ao cache, qualquer que seja a quantidade de chaves. */
  abstract readMany(
    institutionIds: readonly string[],
  ): Promise<ReadonlyMap<string, InstitutionState>>;

  /** Grava o estado apurado. Só instituição existente é gravada. */
  abstract write(institutionId: string, state: InstitutionState): Promise<void>;

  /** Apaga a chave. Apagar chave inexistente conclui com sucesso. */
  abstract invalidate(institutionId: string): Promise<void>;
}
