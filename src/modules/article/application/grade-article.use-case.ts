import { Injectable } from '@nestjs/common';

import type { GradeArticleCommand, GradeMemberCommand } from '../contracts/article.dto';
import { FAILURE, fail, failValidation, ok, type Result } from '../domain/failure';
import { violationsOfGrade, type Grade, type MemberGrade } from '../domain/grade';
import { ArticleRepository } from '../domain/ports/article-repository';
import { ArticleScope } from './article-scope';

/**
 * A avaliação do artigo e dos seus integrantes (RF-ART-002, RF-ART-003).
 *
 * As duas compartilham caso de uso porque compartilham todas as recusas — alcance,
 * responsabilidade direta e faixa de nota — e divergem apenas no alvo. O que **não**
 * compartilham é o significado: a nota do artigo não determina a aprovação (RF-ART-002
 * RN2); a individual, sim (RF-ART-003 RN2).
 *
 * Cada gravação cria uma linha histórica nova dentro da transação (`ADR-0030` §8). Nada
 * aqui altera ou remove registro anterior: o histórico é a evidência de autoria e
 * instante que RN3 exige.
 */
@Injectable()
export class GradeArticleUseCase {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async gradeArticle(command: GradeArticleCommand, now = new Date()): Promise<Result<Grade>> {
    const violations = violationsOfGrade(command.value);

    if (violations.length > 0) {
      return failValidation(violations);
    }

    const article = await this.articles.findById(command.articleId);

    if (article === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }
    if (!(await this.scope.readable(article, command.actorId))) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }
    if (!(await this.scope.responsible(article, command.actorId))) {
      return fail(FAILURE.PERMISSION_DENIED);
    }

    return ok(
      await this.articles.saveGrade(article.id, {
        value: command.value,
        authorId: command.actorId,
        recordedAt: now,
      }),
    );
  }

  async gradeMember(command: GradeMemberCommand, now = new Date()): Promise<Result<MemberGrade>> {
    const violations = violationsOfGrade(command.value);

    if (violations.length > 0) {
      return failValidation(violations);
    }

    const article = await this.articles.findById(command.articleId);

    if (article === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }
    if (!(await this.scope.readable(article, command.actorId))) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }
    if (!(await this.scope.responsible(article, command.actorId))) {
      return fail(FAILURE.PERMISSION_DENIED);
    }

    // Quem nunca integrou a equipe não tem nota individual nela. Quem integrou e saiu
    // tem, e continua tendo: a remoção não apaga avaliação (`ADR-0030` §15).
    if (!(await this.scope.participated(article, command.userId))) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    return ok(
      await this.articles.saveMemberGrade(article.id, {
        userId: command.userId,
        value: command.value,
        authorId: command.actorId,
        memberActive: await this.scope.activeMember(article, command.userId),
        recordedAt: now,
      }),
    );
  }
}
