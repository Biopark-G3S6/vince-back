import { Injectable, Optional } from '@nestjs/common';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import type { UserProfileDto } from '@modules/access/contracts/user.dto';
import { CourseFacade } from '@modules/course/contracts/course.facade';
import { EventFacade } from '@modules/event/contracts/event.facade';
import { InstitutionFacade } from '@modules/institution/contracts/institution.facade';

import {
  ARTICLE_STATUS,
  isEditable,
  isResponsibleAdvisor,
  isTeamMember,
  type Article,
  type Template,
} from '../domain/article';
import { FAILURE, fail, ok, type Result } from '../domain/failure';
import {
  ArticleRepository,
  type ArticleCorpusRecord,
  type ArticleReach,
} from '../domain/ports/article-repository';

const ROLE = {
  INSTITUTION_ADMIN: 'INSTITUTION_ADMIN',
  COORDINATOR: 'COORDINATOR',
} as const;

@Injectable()
export class ArticleScope {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly access: AccessFacade,
    private readonly institutions: InstitutionFacade,
    private readonly courses: CourseFacade,
    /**
     * Ausente quando o processo não ativa `event`: então ninguém é orientador de evento e
     * o alcance se reduz a integrante e responsável.
     */
    @Optional() private readonly events?: EventFacade,
  ) {}

  /**
   * O alcance de leitura do ator sobre os artigos da sua instituição.
   *
   * `null` significa a instituição inteira — administrador institucional e coordenador,
   * como em `readableArticle`. Os demais alcançam o artigo das equipes que integram, das
   * que orientam como responsáveis e das equipes dos eventos que orientam (RF-ART-001 RN3).
   */
  async readingReach(
    actorId: string,
  ): Promise<Result<{ readonly institutionId: string; readonly reach: ArticleReach | null }>> {
    const institution = await this.actorInstitution(actorId);

    if (!institution.ok) {
      return institution;
    }

    const roles = new Set(institution.value.profile.roleCodes);

    if (roles.has(ROLE.INSTITUTION_ADMIN) || roles.has(ROLE.COORDINATOR)) {
      return ok({ institutionId: institution.value.id, reach: null });
    }

    return ok({
      institutionId: institution.value.id,
      reach: {
        userId: actorId,
        advisedEventIds: (await this.events?.advisedEventIdsOf(actorId)) ?? [],
      },
    });
  }

  async actorInstitution(
    actorId: string,
  ): Promise<Result<{ readonly id: string; readonly profile: UserProfileDto }>> {
    const profile = await this.access.findOwnProfile({ actorId, userId: actorId });

    if (!profile.ok || !profile.value.active || profile.value.institutionId === null) {
      return fail(FAILURE.PERMISSION_DENIED);
    }

    const state = await this.institutions.stateOf(profile.value.institutionId);

    if (!state.exists) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    if (!state.active) {
      return fail(FAILURE.INSTITUTION_INACTIVE);
    }

    return ok({ id: profile.value.institutionId, profile: profile.value });
  }

  async templateWriteScope(
    actorId: string,
    courseId: string | null,
  ): Promise<Result<{ readonly institutionId: string }>> {
    const institution = await this.actorInstitution(actorId);

    if (!institution.ok) {
      return institution;
    }

    const roles = new Set(institution.value.profile.roleCodes);

    if (roles.has(ROLE.INSTITUTION_ADMIN)) {
      return ok({ institutionId: institution.value.id });
    }

    if (!roles.has(ROLE.COORDINATOR) || courseId === null) {
      return fail(FAILURE.PERMISSION_DENIED);
    }

    const coordinatorId = await this.courses.coordinatorOf(courseId);

    return coordinatorId === actorId
      ? ok({ institutionId: institution.value.id })
      : fail(FAILURE.PERMISSION_DENIED);
  }

  async visibleTemplate(actorId: string, templateId: string): Promise<Result<Template>> {
    const institution = await this.actorInstitution(actorId);

    if (!institution.ok) {
      return institution;
    }

    const template = await this.repo.findTemplate(templateId);

    if (template === null || template.institutionId !== institution.value.id) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    return ok(template);
  }

  async readableArticle(actorId: string, articleId: string): Promise<Result<Article>> {
    const institution = await this.actorInstitution(actorId);

    if (!institution.ok) {
      return institution;
    }

    const article = await this.repo.findArticle(articleId);

    if (article === null || article.institutionId !== institution.value.id) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    if (isTeamMember(article, actorId) || isResponsibleAdvisor(article, actorId)) {
      return ok(article);
    }

    // O orientador do evento alcança os artigos de todas as equipes do evento (RN3).
    if (this.events !== undefined && (await this.events.isAdvisor(article.eventId, actorId))) {
      return ok(article);
    }

    const roles = new Set(institution.value.profile.roleCodes);

    return roles.has(ROLE.INSTITUTION_ADMIN) || roles.has(ROLE.COORDINATOR)
      ? ok(article)
      : fail(FAILURE.RESOURCE_NOT_FOUND);
  }

  async editableArticle(actorId: string, articleId: string): Promise<Result<Article>> {
    const article = await this.readableArticle(actorId, articleId);

    if (!article.ok) {
      return article;
    }

    if (!isTeamMember(article.value, actorId)) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    if (article.value.status === ARTICLE_STATUS.IN_REVIEW) {
      return fail(FAILURE.ARTICLE_LOCKED_FOR_REVIEW);
    }

    if (article.value.status === ARTICLE_STATUS.FINISHED) {
      return fail(FAILURE.ARTICLE_ALREADY_FINISHED);
    }

    return isEditable(article.value) ? ok(article.value) : fail(FAILURE.ARTICLE_ALREADY_FINISHED);
  }

  async reviewableByAdvisor(actorId: string, articleId: string): Promise<Result<Article>> {
    const article = await this.readableArticle(actorId, articleId);

    if (!article.ok) {
      return article;
    }

    if (!isResponsibleAdvisor(article.value, actorId)) {
      return fail(FAILURE.PERMISSION_DENIED);
    }

    return article.value.status === ARTICLE_STATUS.IN_REVIEW
      ? ok(article.value)
      : fail(FAILURE.ARTICLE_NOT_IN_REVIEW);
  }

  async progressFilter(
    actorId: string,
    scope: 'advisor' | 'course' | 'institution',
    courseId?: string,
  ): Promise<
    Result<{
      readonly advisorId?: string;
      readonly courseId?: string;
      readonly institutionId?: string;
    }>
  > {
    const institution = await this.actorInstitution(actorId);

    if (!institution.ok) {
      return institution;
    }

    const roles = new Set(institution.value.profile.roleCodes);

    if (scope === 'advisor' && roles.has('PROFESSOR')) {
      return ok({ advisorId: actorId, institutionId: institution.value.id });
    }

    if (scope === 'course' && courseId !== undefined && roles.has(ROLE.COORDINATOR)) {
      const coordinatorId = await this.courses.coordinatorOf(courseId);
      const course = await this.courses.findById({ actorId, courseId });

      if (!course.ok || coordinatorId !== actorId) {
        return fail(FAILURE.PERMISSION_DENIED);
      }

      if (course.value.institutionId !== institution.value.id) {
        return fail(FAILURE.RESOURCE_NOT_FOUND);
      }

      return ok({ courseId });
    }

    if (scope === 'institution' && roles.has(ROLE.INSTITUTION_ADMIN)) {
      return ok({ institutionId: institution.value.id });
    }

    return fail(FAILURE.PERMISSION_DENIED);
  }

  async similarityCorpus(
    actorId: string,
    articleId: string,
  ): Promise<Result<readonly ArticleCorpusRecord[]>> {
    const article = await this.readableArticle(actorId, articleId);

    if (!article.ok) {
      return article;
    }

    if (!isTeamMember(article.value, actorId) && !isResponsibleAdvisor(article.value, actorId)) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const corpus = await this.repo.listSimilarityCorpus(article.value.institutionId, articleId);

    return ok(corpus);
  }
}
