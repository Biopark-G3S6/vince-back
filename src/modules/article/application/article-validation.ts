import type {
  CreateTemplateCommand,
  ReferenceCommand,
  UpdateTemplateCommand,
} from '../contracts/article.dto';
import {
  TEMPLATE_NAME_MAX_LENGTH,
  TEXT_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  validateOptionalText,
  validateRequiredText,
} from '../domain/article';
import type { FieldViolation } from '../domain/failure';

export function validateTemplateDraft(command: CreateTemplateCommand): FieldViolation[] {
  const violations: FieldViolation[] = [];
  validateRequiredText('name', command.name, TEMPLATE_NAME_MAX_LENGTH, violations);
  validateOptionalText('description', command.description, TEXT_MAX_LENGTH, violations);

  return violations;
}

export function validateTemplateUpdate(command: UpdateTemplateCommand): FieldViolation[] {
  const violations: FieldViolation[] = [];

  if (command.name !== undefined) {
    validateRequiredText('name', command.name, TEMPLATE_NAME_MAX_LENGTH, violations);
  }

  validateOptionalText('description', command.description, TEXT_MAX_LENGTH, violations);

  return violations;
}

export function validateReference(command: ReferenceCommand): FieldViolation[] {
  const violations: FieldViolation[] = [];
  validateRequiredText('type', command.type, 80, violations);
  validateRequiredText('title', command.title, TITLE_MAX_LENGTH, violations);

  return violations;
}
