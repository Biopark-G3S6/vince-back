import { Injectable } from '@nestjs/common';

import { CourseFacade } from '@modules/course/contracts/course.facade';
import { EventFacade } from '@modules/event/contracts/event.facade';
import { TeamFacade } from '@modules/team/contracts/team.facade';

import type { Article } from '../domain/article';

/**
 * O alcance do ator sobre o artigo (`ADR-0030` §10, §12).
 *
 * Três perguntas, três respostas, e nenhuma delas se responde no schema `article`: a
 * participação é de `team`, a orientação e o escopo são de `event`, a coordenação é de
 * `course`. `ADR-0006` proíbe lê-las direto, então aqui se pergunta — e se pergunta na
 * ordem mais barata, parando no primeiro vínculo que confirma.
 */
@Injectable()
export class ArticleScope {
  constructor(
    private readonly teams: TeamFacade,
    private readonly events: EventFacade,
    private readonly courses: CourseFacade,
  ) {}

  /**
   * Quem pode **ler** o artigo (RF-ART-001 RN3).
   *
   * O aluno, se integra ou integrou a equipe; o orientador do evento, independentemente
   * de responsabilidade direta; o coordenador do curso do evento.
   *
   * Quem **integrou** e saiu continua lendo: a sua nota individual e o histórico da sua
   * participação permanecem consultáveis (`ADR-0030` §15), e esconder o artigo deixaria a
   * pessoa sem o contexto da própria avaliação.
   */
  async readable(article: Article, actorId: string): Promise<boolean> {
    const membership = await this.teams.membershipOf(article.teamId, actorId);

    if (membership.participated) {
      return true;
    }

    if (await this.events.isAdvisor(article.eventId, actorId)) {
      return true;
    }

    return this.coordinates(article, actorId);
  }

  /**
   * Quem pode **registrar publicação externa** (RF-ART-004).
   *
   * O orientador do evento e o integrante da equipe. O coordenador tem
   * `PUBLICATION:READ`, e não as de escrita — a borda já o barra, e esta verificação não
   * precisa repeti-la.
   */
  async authoring(article: Article, actorId: string): Promise<boolean> {
    const membership = await this.teams.membershipOf(article.teamId, actorId);

    return membership.active || (await this.events.isAdvisor(article.eventId, actorId));
  }

  /**
   * Quem pode **avaliar** (RF-ART-002, RF-ART-003).
   *
   * Somente o orientador **responsável** pela equipe. Orientador do evento sem
   * responsabilidade direta lê tudo e avalia nada — é a distinção que `RF-EQP-005` RN2
   * cria, e a razão de a recusa aqui ser `PERMISSION_DENIED` e não `RESOURCE_NOT_FOUND`:
   * quem tenta avaliar já provou que alcança o artigo.
   */
  async responsible(article: Article, actorId: string): Promise<boolean> {
    const state = await this.teams.stateOf(article.teamId);

    return state.exists && state.responsibleAdvisorId === actorId;
  }

  /** Os integrantes ativos da equipe, para a avaliação individual. */
  async membersOf(article: Article): Promise<readonly string[]> {
    return this.teams.activeMemberIdsOf(article.teamId);
  }

  /** O integrante integra ou integrou a equipe? */
  async participated(article: Article, userId: string): Promise<boolean> {
    return (await this.teams.membershipOf(article.teamId, userId)).participated;
  }

  async activeMember(article: Article, userId: string): Promise<boolean> {
    return (await this.teams.membershipOf(article.teamId, userId)).active;
  }

  private async coordinates(article: Article, actorId: string): Promise<boolean> {
    const event = await this.events.stateOf(article.eventId);

    if (!event.exists || event.courseId === null) {
      return false;
    }

    return (await this.courses.coordinatorOf(event.courseId)) === actorId;
  }
}
