import type {
  AdvisorCommand,
  AdvisorPageDto,
  CreateEventCommand,
  CreateMilestoneCommand,
  EligibilityQuery,
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
   * Quais destes usuários o escopo do evento torna elegíveis (RF-EVT-001 RN2)?
   *
   * Em lote, e em número de consultas independente da quantidade de identificadores
   * (`ADR-0032` §13). Usuário ausente do mapa não é elegível.
   */
  abstract eligibilityOf(query: EligibilityQuery): Promise<ReadonlyMap<string, boolean>>;

  /** A etapa corrente do cronograma, ou `null`. Leitura para a vertical do artigo. */
  abstract currentMilestoneOf(eventId: string): Promise<MilestoneDto | null>;

  /** Consome o fato de formação e atualiza a projeção de uso. Idempotente. */
  abstract handleTeamUsage(event: TeamUsageEvent): Promise<void>;
}
