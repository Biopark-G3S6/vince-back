import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { EventFacade } from '@modules/event/contracts/event.facade';
import { TeamFacade } from '@modules/team/contracts/team.facade';

import { ArticleRepository } from '../domain/ports/article-repository';

/** O resultado da sincronização, para diagnóstico e teste. */
export type TeamSyncOutcome = 'CREATED' | 'UPDATED' | 'TEAM_NOT_FOUND';

/**
 * O artigo acompanha a sua equipe (RF-EQP-001 RN1, RE-05).
 *
 * Caso de uso **de sistema**: quem o aciona é o consumidor dos fatos de equipe, não um
 * usuário, e por isso não há ator nem verificação de escopo — a autorização já aconteceu
 * na operação da equipe que produziu o fato (`PAD-SEG-021`).
 *
 * Não aplica o delta que o fato transporta: relê a composição e o responsável pelas
 * fachadas e grava o estado corrente. Reprocessar um fato, ou recebê-los fora de ordem,
 * converge para o mesmo resultado.
 */
@Injectable()
export class SyncArticleWithTeamUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly teams: TeamFacade,
    private readonly events: EventFacade,
  ) {}

  /**
   * `articleTitle` vem do fato de criação da equipe (`article-title-and-feedback`): só é
   * usado ao criar o artigo; depois, o título é dos integrantes.
   */
  async execute(teamId: string, articleTitle?: string | null): Promise<TeamSyncOutcome> {
    const team = await this.teams.stateOf(teamId);

    if (!team.exists || team.eventId === null || team.institutionId === null) {
      return 'TEAM_NOT_FOUND';
    }

    const [memberIds, milestone] = await Promise.all([
      this.teams.activeMemberIdsOf(teamId),
      this.events.currentMilestoneOf(team.eventId),
    ]);
    const roster = {
      teamIdentification: team.identification ?? null,
      memberIds,
      advisorId: team.responsibleAdvisorId,
      currentMilestone:
        milestone === null
          ? null
          : { id: milestone.id, order: milestone.order, deadline: milestone.dueAt },
    };

    if ((await this.repo.findArticleByTeam(teamId)) === null) {
      const event = await this.events.stateOf(team.eventId);
      const created = await this.repo.createTeamArticle({
        id: uuidv7(),
        institutionId: team.institutionId,
        courseId: event.courseId,
        eventId: team.eventId,
        teamId,
        teamIdentification: roster.teamIdentification,
        advisorId: roster.advisorId,
        memberIds,
        currentMilestoneId: milestone?.id ?? null,
        currentMilestoneOrder: milestone?.order ?? null,
        currentMilestoneDeadline: milestone?.dueAt ?? null,
        lastMilestoneOrder: null,
        templateVersionId: null,
        title: articleTitle ?? null,
        content: {},
      });

      if (created !== 'ALREADY_EXISTS') {
        return 'CREATED';
      }
    }

    await this.repo.updateTeamRoster(teamId, roster);

    return 'UPDATED';
  }
}
