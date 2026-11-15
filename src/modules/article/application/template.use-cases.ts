import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import type { Page } from '@shared/http/pagination';

import type {
  CreateTemplateCommand,
  ListTemplatesCommand,
  SelectTemplateCommand,
  TemplateDto,
  TemplateQuery,
  TemplateSelectionDto,
  UpdateTemplateCommand,
} from '../contracts/article.dto';
import { FAILURE, fail, failValidation, ok, type Result } from '../domain/failure';
import { ArticleRepository } from '../domain/ports/article-repository';
import { ArticleScope } from './article-scope';
import { validateTemplateDraft, validateTemplateUpdate } from './article-validation';

@Injectable()
export class CreateTemplateUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(command: CreateTemplateCommand): Promise<Result<TemplateDto>> {
    const violations = validateTemplateDraft(command);

    if (violations.length > 0) {
      return failValidation(violations);
    }

    const scope = await this.scope.templateWriteScope(command.actorId, command.courseId ?? null);

    if (!scope.ok) {
      return scope;
    }

    return ok(
      await this.repo.createTemplate({
        id: uuidv7(),
        versionId: uuidv7(),
        institutionId: scope.value.institutionId,
        courseId: command.courseId ?? null,
        name: command.name.trim(),
        description: command.description?.trim() ?? null,
        content: command.content,
        actorId: command.actorId,
      }),
    );
  }
}

@Injectable()
export class ListTemplatesUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(command: ListTemplatesCommand): Promise<Result<Page<TemplateDto>>> {
    const institution = await this.scope.actorInstitution(command.actorId);

    if (!institution.ok) {
      return institution;
    }

    return ok(
      await this.repo.listTemplates(institution.value.id, command.request, {
        courseId: command.courseId,
        includeInactive: command.includeInactive === true,
      }),
    );
  }
}

@Injectable()
export class FindTemplateUseCase {
  constructor(private readonly scope: ArticleScope) {}

  async execute(query: TemplateQuery): Promise<Result<TemplateDto>> {
    const template = await this.scope.visibleTemplate(query.actorId, query.templateId);

    return template.ok ? ok(template.value) : template;
  }
}

@Injectable()
export class UpdateTemplateUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(command: UpdateTemplateCommand): Promise<Result<TemplateDto>> {
    const template = await this.scope.visibleTemplate(command.actorId, command.templateId);

    if (!template.ok) {
      return template;
    }

    const courseId = command.courseId === undefined ? template.value.courseId : command.courseId;
    const scope = await this.scope.templateWriteScope(command.actorId, courseId ?? null);

    if (!scope.ok) {
      return scope;
    }

    const violations = validateTemplateUpdate(command);

    if (violations.length > 0) {
      return failValidation(violations);
    }

    const updated = await this.repo.updateTemplate({
      id: command.templateId,
      versionId: command.content === undefined ? undefined : uuidv7(),
      name: command.name?.trim(),
      description:
        command.description === undefined ? undefined : (command.description?.trim() ?? null),
      courseId: command.courseId,
      content: command.content,
      actorId: command.actorId,
    });

    return updated === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(updated);
  }
}

@Injectable()
export class DeactivateTemplateUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(query: TemplateQuery): Promise<Result<TemplateDto>> {
    const template = await this.scope.visibleTemplate(query.actorId, query.templateId);

    if (!template.ok) {
      return template;
    }

    const scope = await this.scope.templateWriteScope(query.actorId, template.value.courseId);

    if (!scope.ok) {
      return scope;
    }

    const updated = await this.repo.setTemplateActive(query.templateId, false);

    return updated === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(updated);
  }
}

@Injectable()
export class SelectTemplateUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(command: SelectTemplateCommand): Promise<Result<TemplateSelectionDto>> {
    const institution = await this.scope.actorInstitution(command.actorId);

    if (!institution.ok) {
      return institution;
    }

    const courseId = command.courseId ?? null;
    const template =
      command.templateId === null || command.templateId === undefined
        ? null
        : await this.scope.visibleTemplate(command.actorId, command.templateId);

    if (template !== null && !template.ok) {
      return template;
    }

    if (
      template !== null &&
      template.value.courseId !== null &&
      template.value.courseId !== courseId
    ) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const selection = await this.repo.createSelection({
      id: uuidv7(),
      eventId: command.eventId,
      institutionId: command.institutionId ?? institution.value.id,
      courseId,
      templateId: template?.value.id ?? null,
      templateVersionId: template?.value.currentVersionId ?? null,
      actorId: command.actorId,
    });

    return selection === 'ALREADY_EXISTS' ? fail(FAILURE.TEMPLATE_ALREADY_FIXED) : ok(selection);
  }
}
