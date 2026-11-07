import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { toPage, type Page, type PageRequest } from '@shared/http/pagination';

import type {
  CreatePublicationCommand,
  PublicationQuery,
  UpdatePublicationCommand,
} from '../contracts/article.dto';
import { FAILURE, fail, failValidation, ok, type Result } from '../domain/failure';
import { ArticleRepository } from '../domain/ports/article-repository';
import {
  publicationOf,
  violationsOfDraft,
  violationsOfUpdate,
  withChanges,
  type Publication,
} from '../domain/publication';
import { ArticleScope } from './article-scope';

/**
 * O registro manual de publicação externa (RF-ART-004).
 *
 * Manual e descritivo: o módulo não mantém catálogo de veículos, não acessa o endereço e
 * não trata entrega a evento interno como publicação externa (RN1, RN2, `ADR-0030` §16).
 * O que ele valida é a **forma** do que foi informado.
 */
@Injectable()
export class ManagePublicationUseCase {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async create(command: CreatePublicationCommand): Promise<Result<Publication>> {
    const violations = violationsOfDraft(command);

    if (violations.length > 0) {
      return failValidation(violations);
    }

    const reached = await this.reach(command.actorId, command.articleId, true);

    if (!reached.ok) {
      return reached;
    }

    return ok(
      await this.articles.createPublication(
        publicationOf(uuidv7(), command.articleId, command.actorId, command),
      ),
    );
  }

  async list(
    actorId: string,
    articleId: string,
    request: PageRequest,
  ): Promise<Result<Page<Publication>>> {
    const reached = await this.reach(actorId, articleId, false);

    if (!reached.ok) {
      return reached;
    }

    const rows = await this.articles.listPublications(articleId, request);

    return ok(toPage(request, rows.rows, rows.totalItems));
  }

  async update(command: UpdatePublicationCommand): Promise<Result<Publication>> {
    const violations = violationsOfUpdate(command);

    if (violations.length > 0) {
      return failValidation(violations);
    }

    const reached = await this.reach(command.actorId, command.articleId, true);

    if (!reached.ok) {
      return reached;
    }

    const current = await this.articles.findPublication(command.publicationId);

    if (current === null || current.articleId !== command.articleId) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const saved = await this.articles.savePublication(withChanges(current, command));

    return saved === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(saved);
  }

  async remove(query: PublicationQuery): Promise<Result<void>> {
    const reached = await this.reach(query.actorId, query.articleId, true);

    if (!reached.ok) {
      return reached;
    }

    const current = await this.articles.findPublication(query.publicationId);

    if (current === null || current.articleId !== query.articleId) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    await this.articles.deletePublication(current.id);

    return ok(undefined);
  }

  /**
   * O artigo, quando o ator o alcança.
   *
   * Escrita exige vínculo de autoria — integrante ativo ou orientador do evento (§16);
   * leitura basta o alcance. Em ambos os casos a recusa é `RESOURCE_NOT_FOUND` (E2): o
   * artigo que o ator não alcança não lhe é distinguível de inexistente.
   */
  private async reach(actorId: string, articleId: string, writing: boolean): Promise<Result<void>> {
    const article = await this.articles.findById(articleId);

    if (article === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const allowed = writing
      ? await this.scope.authoring(article, actorId)
      : await this.scope.readable(article, actorId);

    return allowed ? ok(undefined) : fail(FAILURE.RESOURCE_NOT_FOUND);
  }
}
