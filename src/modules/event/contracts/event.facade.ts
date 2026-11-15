import type {
  AdvisorCommand,
  AdvisorPageDto,
  CreateEventCommand,
  CreateMilestoneCommand,
  EligibilityQuery,
  EligibleStudentQuery,
  EventDto,
  EventPageDto,
  EventQuery,
  EventStateDto,
  ListAdvisorsCommand,
  ListEventsCommand,
  ListMilestonesCommand,
  MilestoneDto,
  MilestonePageDto,
  MilestoneQuery,
  TeamUsageEvent,
  UpdateEventCommand,
  UpdateMilestoneCommand,
} from './event.dto';
import type { Page } from '@shared/http/pagination';

import type { EventResult } from './result.dto';

/**
 * A única superfície pública do módulo `event` (`ADR-0004` §1, `ADR-0032` §24).
 *
 * Declarada como `abstract class` para servir de token de injeção (`ADR-0004` §2, §3).
 *
 * A superfície tem duas metades, como a de `institution`: o ciclo de vida, o cronograma e
 * a orientação existem para os controllers **deste** módulo; `stateOf`, `isAdvisor`,
 * `eligibilityOf` e `currentMilestoneOf` existem para o **consumidor interno** — `team` e
 * `article`, que precisam do escopo e dos limites sem poder ler as suas tabelas
 * (`ADR-0006`).
 *
 * Não há aqui operação que pergunte pela equipe: a dependência é de mão única, e `event`
 * só conhece de `team` os fatos que ela publica (`ADR-0032` §16).
 */
export abstract class EventFacade {
  abstract create(command: CreateEventCommand): Promise<EventResult<EventDto>>;
  abstract list(command: ListEventsCommand): Promise<EventResult<EventPageDto>>;
  abstract findById(query: EventQuery): Promise<EventResult<EventDto>>;
  abstract update(command: UpdateEventCommand): Promise<EventResult<EventDto>>;
  /** Idempotente: cancelar evento já cancelado conclui com sucesso e nada muda. */
  abstract cancel(query: EventQuery): Promise<EventResult<EventDto>>;

  abstract createMilestone(command: CreateMilestoneCommand): Promise<EventResult<MilestoneDto>>;
  abstract listMilestones(command: ListMilestonesCommand): Promise<EventResult<MilestonePageDto>>;
  abstract updateMilestone(command: UpdateMilestoneCommand): Promise<EventResult<MilestoneDto>>;
  abstract removeMilestone(query: MilestoneQuery): Promise<EventResult<void>>;

  /** Idempotente: orientador já designado conclui sem duplicar o vínculo (RF-EVT-003 E3). */
  abstract assignAdvisor(command: AdvisorCommand): Promise<EventResult<void>>;
  abstract revokeAdvisor(command: AdvisorCommand): Promise<EventResult<void>>;
  abstract listAdvisors(command: ListAdvisorsCommand): Promise<EventResult<AdvisorPageDto>>;

  /** Existência, estado e limites. Não falha por inexistência. */
  abstract stateOf(eventId: string): Promise<EventStateDto>;

  /** O ator orienta neste evento? Falso também para evento inexistente. */
  abstract isAdvisor(eventId: string, userId: string): Promise<boolean>;

  /**
   * O ator é dono do escopo deste evento?
   *
   * É a pergunta de `RF-EQP-005`, que reserva ao dono do escopo a nomeação do responsável
   * por cada equipe. A propriedade desce a hierarquia — quem administra a instituição é
   * dono de tudo dentro dela —, e só o módulo `event` sabe resolvê-la, porque é ele que
   * guarda o escopo e a sua ancestralidade.
   */
  abstract isScopeOwner(eventId: string, userId: string): Promise<boolean>;

  /**
   * Quais destes usuários o escopo do evento torna elegíveis (RF-EVT-001 RN2)?
   *
   * Em lote, e em número de consultas independente da quantidade de identificadores
   * (`ADR-0032` §13). Usuário ausente do mapa não é elegível.
   */
  abstract eligibilityOf(query: EligibilityQuery): Promise<ReadonlyMap<string, boolean>>;

  /**
   * Os alunos que o escopo do evento torna elegíveis, paginados.
   *
   * Uma consulta por página, qualquer que seja o tamanho do escopo (`ADR-0011` §6). Não
   * desconta quem já integra equipe: isso é fato do módulo que possui a equipe, e
   * perguntá-lo aqui fecharia o ciclo que `ADR-0005` §6 proíbe. Evento inexistente
   * devolve página vazia.
   */
  abstract eligibleStudentsOf(query: EligibleStudentQuery): Promise<Page<string>>;

  /** A etapa corrente do cronograma, ou `null`. Leitura para a vertical do artigo. */
  abstract currentMilestoneOf(eventId: string): Promise<MilestoneDto | null>;

  /** Consome o fato de formação e atualiza a projeção de uso. Idempotente. */
  abstract handleTeamUsage(event: TeamUsageEvent): Promise<void>;
}
