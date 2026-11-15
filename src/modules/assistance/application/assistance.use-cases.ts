import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import type { AssistanceConfig } from '@shared/config/environment';
import { ApiFailure } from '@shared/errors/api-failure';
import { AccessFacade } from '@modules/access/contracts/access.facade';
import { ArticleFacade } from '@modules/article/contracts/article.facade';
import type { ArticleDto, JsonValue } from '@modules/article/contracts/article.dto';
import { InstitutionFacade } from '@modules/institution/contracts/institution.facade';
import type {
  AiConfigurationDto,
  AiConsentDto,
  AnalysisHistoryItemDto,
  AuthorshipSignalDto,
  ComplianceReportDto,
  SimilarityMatchDto,
  SimilarityReportDto,
} from '../contracts/assistance.dto';
import { checkAbntFormatting } from './abnt-compliance';
import { AssistanceRepository } from '../domain/ports/assistance-repository';
import { AssistanceProvider } from '../domain/ports/assistance-provider';

const INSTITUTION_ADMIN = 'INSTITUTION_ADMIN';
const LARGE_INSERTION_CHARACTERS = 10_000;
const SESSION_GAP_MS = 30 * 60 * 1000;

export class AssistanceUseCaseContext {
  constructor(
    readonly repository: AssistanceRepository,
    readonly access: AccessFacade,
    readonly institutions: InstitutionFacade,
    readonly articles: ArticleFacade,
    readonly provider: AssistanceProvider,
    readonly configuration: AssistanceConfig,
  ) {}
}

abstract class AssistanceUseCaseBase {
  protected constructor(protected readonly context: AssistanceUseCaseContext) {}
  protected get repository() {
    return this.context.repository;
  }
  protected get access() {
    return this.context.access;
  }
  protected get institutions() {
    return this.context.institutions;
  }
  protected get articles() {
    return this.context.articles;
  }
  protected get provider() {
    return this.context.provider;
  }
  protected get configuration() {
    return this.context.configuration;
  }

  protected async articleFor(
    actorId: string,
    articleId: string,
    role: 'advisor' | 'participant',
  ): Promise<ArticleDto> {
    const result = await this.articles.findArticle({ actorId, articleId });
    if (!result.ok) throw new ApiFailure('RESOURCE_NOT_FOUND');
    const article = result.value;
    if (role === 'advisor' && article.advisorId !== actorId)
      throw new ApiFailure('PERMISSION_DENIED');
    if (
      role === 'participant' &&
      !article.memberIds.includes(actorId) &&
      article.advisorId !== actorId
    )
      throw new ApiFailure('RESOURCE_NOT_FOUND');
    return article;
  }

  protected async requireInstitutionAdmin(actorId: string, institutionId: string): Promise<void> {
    const profileResult = await this.access.findOwnProfile({ actorId, userId: actorId });
    if (
      !profileResult.ok ||
      profileResult.value.institutionId !== institutionId ||
      !profileResult.value.roleCodes.includes(INSTITUTION_ADMIN)
    )
      throw new ApiFailure('PERMISSION_DENIED');
    const state = await this.institutions.stateOf(institutionId);
    if (!state.exists) throw new ApiFailure('RESOURCE_NOT_FOUND');
    if (!state.active) throw new ApiFailure('INSTITUTION_INACTIVE');
  }

  protected async analysisHistory(
    actorId: string,
    articleId: string,
    kind: string,
  ): Promise<readonly AnalysisHistoryItemDto[]> {
    const rows = await this.repository.listAnalyses(articleId, actorId, kind, 20);
    return rows.flatMap((row) => {
      if (typeof row.result !== 'object' || row.result === null || Array.isArray(row.result))
        return [];
      return [
        {
          id: row.id,
          createdAt: row.createdAt,
          result: row.result as Readonly<Record<string, unknown>>,
        },
      ];
    });
  }

  protected async storeAnalysis(
    articleId: string,
    actorId: string,
    kind: string,
    result: unknown,
    id: string = uuidv7(),
  ): Promise<void> {
    await this.repository.saveAnalysis({
      id,
      articleId,
      kind,
      requestedBy: actorId,
      status: 'COMPLETE',
      result,
    });
  }
}

@Injectable()
export class ReadAiConsentUseCase extends AssistanceUseCaseBase {
  constructor(context: AssistanceUseCaseContext) {
    super(context);
  }

  async execute(actorId: string, institutionId: string): Promise<AiConsentDto> {
    await this.requireInstitutionAdmin(actorId, institutionId);
    const row = await this.repository.latestConsent(institutionId);
    return {
      institutionId,
      consented: row !== null && row.revokedAt === null,
      consentedBy: row?.consentedBy ?? null,
      consentedAt: row?.consentedAt ?? null,
      revokedAt: row?.revokedAt ?? null,
      revokedBy: row?.revokedBy ?? null,
      configuration: aiConfiguration(this.configuration),
    };
  }
}

@Injectable()
export class SetAiConsentUseCase extends AssistanceUseCaseBase {
  constructor(context: AssistanceUseCaseContext) {
    super(context);
  }

  async execute(actorId: string, institutionId: string, consented: boolean): Promise<AiConsentDto> {
    await this.requireInstitutionAdmin(actorId, institutionId);
    const config = aiConfiguration(this.configuration);
    const current = await this.repository.latestConsent(institutionId);
    if (consented) {
      if (!config.available) throw new ApiFailure('AI_SERVICE_UNAVAILABLE');
      const now = new Date();
      const row = await this.repository.createConsent({
        id: uuidv7(),
        institutionId,
        declarationVersion: config.declarationVersion!,
        declarationSnapshot: declarationSnapshot(config),
        providerName: config.providerName!,
        processingPurpose: config.purpose!,
        consentedBy: actorId,
        consentedAt: now,
      });
      return {
        institutionId,
        consented: true,
        consentedBy: row.consentedBy,
        consentedAt: row.consentedAt,
        revokedAt: row.revokedAt,
        revokedBy: row.revokedBy,
        configuration: config,
      };
    }
    if (current !== null && current.revokedAt === null) {
      const row = await this.repository.revokeActiveConsent(institutionId, actorId, new Date());
      if (row === null) throw new ApiFailure('RESOURCE_NOT_FOUND');
      return {
        institutionId,
        consented: false,
        consentedBy: row.consentedBy,
        consentedAt: row.consentedAt,
        revokedAt: row.revokedAt,
        revokedBy: row.revokedBy,
        configuration: config,
      };
    }
    return {
      institutionId,
      consented: false,
      consentedBy: current?.consentedBy ?? null,
      consentedAt: current?.consentedAt ?? null,
      revokedAt: current?.revokedAt ?? null,
      revokedBy: current?.revokedBy ?? null,
      configuration: config,
    };
  }
}

@Injectable()
export class SummarizeArticleChangesUseCase extends AssistanceUseCaseBase {
  constructor(context: AssistanceUseCaseContext) {
    super(context);
  }

  async execute(actorId: string, articleId: string): Promise<Readonly<Record<string, unknown>>> {
    const article = await this.articleFor(actorId, articleId, 'advisor');
    if (article.status !== 'IN_REVIEW') throw new ApiFailure('ARTICLE_NOT_IN_REVIEW');
    const consent = await this.repository.activeConsent(article.institutionId);
    if (consent === null) throw new ApiFailure('AI_CONSENT_REQUIRED');
    const config = aiConfiguration(this.configuration);
    if (!config.available || !this.provider.available)
      throw new ApiFailure('AI_SERVICE_UNAVAILABLE');
    const submissions = unwrap(await this.articles.listSubmissions({ actorId, articleId }))
      .filter((item) => item.revokedAt === null)
      .sort(
        (a, b) =>
          a.milestoneOrder - b.milestoneOrder || a.createdAt.getTime() - b.createdAt.getTime(),
      );
    const current = submissions.at(-1);
    if (current === undefined || submissions.length < 2) throw new ApiFailure('REPORT_NOT_READY');
    const comparison = unwrap(
      await this.articles.compareSubmission({ actorId, articleId, submissionId: current.id }),
    );
    const remarks = unwrap(await this.articles.listRemarks({ actorId, articleId })).filter(
      (remark) =>
        remark.visibleToTeam === false &&
        (remark.status === 'OPEN' || remark.status === 'ADDRESSED'),
    );
    const analysisId = uuidv7();
    await this.repository.saveAnalysis({
      id: analysisId,
      articleId,
      kind: 'AI_CHANGE_SUMMARY',
      requestedBy: actorId,
      status: 'PROCESSING',
      correlationId: analysisId,
    });
    const consentBeforeSubmission = await this.repository.activeConsent(article.institutionId);
    if (consentBeforeSubmission?.id !== consent.id) {
      await this.repository.updateAnalysis(analysisId, {
        status: 'FAILED',
        errorCode: 'AI_CONSENT_REQUIRED',
      });
      throw new ApiFailure('AI_CONSENT_REQUIRED');
    }
    try {
      const result = await this.provider.summarize({
        declarationVersion: consent.declarationVersion,
        previousSubmission: comparison.previousSubmission?.content,
        currentSubmission: comparison.submission.content,
        differences: comparison.differences,
        pendingRemarks: remarks.map(({ id, originalText, currentText, body, anchor }) => ({
          id,
          originalText,
          currentText,
          body,
          anchor,
        })),
      });
      const pendingRemarkIds = new Set(remarks.map((remark) => remark.id));
      if (
        [...result.unchangedRemarks, ...result.unmetRemarks].some((id) => !pendingRemarkIds.has(id))
      )
        throw new Error('INVALID_PROVIDER_RESPONSE');
      await this.repository.updateAnalysis(analysisId, { status: 'COMPLETE', result });
      return { articleId, analysisId, result };
    } catch {
      await this.repository.updateAnalysis(analysisId, {
        status: 'FAILED',
        errorCode: 'AI_SERVICE_UNAVAILABLE',
      });
      throw new ApiFailure('AI_SERVICE_UNAVAILABLE');
    }
  }
}

@Injectable()
export class CheckArticleComplianceUseCase extends AssistanceUseCaseBase {
  constructor(context: AssistanceUseCaseContext) {
    super(context);
  }

  async execute(actorId: string, articleId: string): Promise<ComplianceReportDto> {
    const article = await this.articleFor(actorId, articleId, 'participant');
    const issues: {
      code: string;
      category: 'FORMATTING' | 'STRUCTURE' | 'REFERENCES';
      severity: 'ERROR' | 'RECOMMENDATION' | 'UNVERIFIED';
      path: string | null;
      referenceId?: string;
      evidence?: string;
    }[] = [];
    issues.push(...checkAbntFormatting(article.formatProfile));
    const textPaths = flattenStrings(article.content);
    const normalized = textPaths.map(({ path, text }) => ({ path, text, key: normalize(text) }));
    const headings = flattenHeadings(article.content).map(({ path, text }) => ({
      path,
      text,
      key: normalize(text),
    }));
    const requiredSections = [
      { code: 'introduction', labels: ['introducao', 'apresentacao', 'introduction'] },
      {
        code: 'conclusion',
        labels: ['conclusao', 'consideracoes finais', 'conclusion', 'final considerations'],
      },
      {
        code: 'references',
        labels: ['referencias', 'referencias bibliograficas', 'references', 'bibliography'],
      },
    ];
    for (const section of requiredSections) {
      if (!headings.some(({ key }) => section.labels.some((label) => key.includes(label))))
        issues.push({
          code: 'EXPECTED_SECTION_NOT_FOUND',
          category: 'STRUCTURE',
          severity: 'ERROR',
          path: null,
          evidence: section.code,
        });
    }
    const nonDevelopmentLabels = [
      'introducao',
      'apresentacao',
      'introduction',
      'conclusao',
      'consideracoes finais',
      'conclusion',
      'final considerations',
      'referencias',
      'references',
      'bibliography',
      'resumo',
      'abstract',
      'palavras chave',
      'keywords',
      'agradecimentos',
      'acknowledgments',
      'sumario',
      'glossario',
      'apendice',
      'anexo',
    ];
    const textualHeadings = headings.filter(
      ({ key }) => !nonDevelopmentLabels.some((label) => key.includes(label)),
    );
    if (textualHeadings.length === 0)
      issues.push({
        code: 'EXPECTED_SECTION_NOT_FOUND',
        category: 'STRUCTURE',
        severity: 'ERROR',
        path: null,
        evidence: 'development',
      });
    const references = unwrap(await this.articles.listReferences({ actorId, articleId }));
    const citations = unwrap(await this.articles.listCitations({ actorId, articleId }));
    const citedIds = new Set(citations.map((citation) => citation.referenceId));
    for (const reference of references) {
      issues.push({
        code: 'REFERENCE_FORMAT_UNVERIFIED',
        category: 'REFERENCES',
        severity: 'UNVERIFIED',
        path: `references.${reference.id}`,
        referenceId: reference.id,
        evidence: `no field rules are registered for reference type "${reference.type}"`,
      });
      if (reference.type.trim().length === 0 || reference.title.trim().length === 0)
        issues.push({
          code: 'REFERENCE_METADATA_INCOMPLETE',
          category: 'REFERENCES',
          severity: 'ERROR',
          path: `references.${reference.id}`,
          referenceId: reference.id,
          evidence: 'type and title are required to render a structured reference',
        });
      if (!citedIds.has(reference.id))
        issues.push({
          code: 'REFERENCE_NOT_CITED',
          category: 'REFERENCES',
          severity: 'ERROR',
          path: `references.${reference.id}`,
          referenceId: reference.id,
          evidence: reference.title,
        });
    }
    for (const citation of citations) {
      if (normalize(citation.kind).includes('direct') && !citation.page?.trim())
        issues.push({
          code: 'DIRECT_CITATION_PAGE_MISSING',
          category: 'REFERENCES',
          severity: 'ERROR',
          path: `citations.${citation.id}`,
          referenceId: citation.referenceId,
          evidence: citation.kind,
        });
    }
    const referenceKeys = references.map((reference) =>
      normalize(`${reference.title} ${reference.year ?? ''} ${JSON.stringify(reference.authors)}`),
    );
    for (const { path, text, key } of normalized) {
      for (const match of text.matchAll(/\(([^()]{2,100}?\b(?:19|20)\d{2}[a-z]?)\)/g)) {
        const citation = normalize(match[1] ?? '');
        if (
          !referenceKeys.some(
            (reference) =>
              reference.includes(citation.split(' ').at(-1) ?? '') &&
              reference.includes(citation.match(/(?:19|20)\d{2}/)?.[0] ?? ''),
          )
        ) {
          issues.push({
            code: 'TEXT_CITATION_NOT_REFERENCED',
            category: 'REFERENCES',
            severity: 'ERROR',
            path,
            evidence: match[0],
          });
        }
      }
      void key;
    }
    const report: ComplianceReportDto = {
      analysisId: uuidv7(),
      articleId,
      norm: 'ABNT',
      checkedAt: new Date(),
      conformant: issues.some((issue) => issue.severity === 'ERROR')
        ? false
        : issues.some((issue) => issue.severity === 'UNVERIFIED')
          ? null
          : true,
      issues,
    };
    await this.storeAnalysis(articleId, actorId, 'COMPLIANCE_CHECK', report, report.analysisId);
    return report;
  }
}

@Injectable()
export class ReadComplianceHistoryUseCase extends AssistanceUseCaseBase {
  constructor(context: AssistanceUseCaseContext) {
    super(context);
  }

  async execute(actorId: string, articleId: string): Promise<readonly AnalysisHistoryItemDto[]> {
    await this.articleFor(actorId, articleId, 'participant');
    return this.analysisHistory(actorId, articleId, 'COMPLIANCE_CHECK');
  }
}

@Injectable()
export class CheckArticleSimilarityUseCase extends AssistanceUseCaseBase {
  constructor(context: AssistanceUseCaseContext) {
    super(context);
  }

  async execute(actorId: string, articleId: string): Promise<SimilarityReportDto> {
    const article = await this.articleFor(actorId, articleId, 'participant');
    const [corpus, references, citations] = await Promise.all([
      this.articles.listSimilarityCorpus({ actorId, articleId }).then(unwrap),
      this.articles.listReferences({ actorId, articleId }).then(unwrap),
      this.articles.listCitations({ actorId, articleId }).then(unwrap),
    ]);
    const citedReferenceIds = new Set(citations.map((citation) => citation.referenceId));
    const citedReferences = references.filter((reference) => citedReferenceIds.has(reference.id));
    const currentTexts = flattenStrings(article.content)
      .filter(({ path }) => !normalize(path).includes('referencias'))
      .map((entry) =>
        entry.text.replace(
          /["“]([^"”]{20,2000})["”]\s*\(([^)]{2,120}?\b(?:19|20)\d{2}[a-z]?[^)]*)\)/g,
          (fullMatch, _quotedText: string, citationText: string) =>
            isStructuredCitation(citationText, citedReferences) ? ' ' : fullMatch,
        ),
      )
      .join('\n');
    const currentTokens = tokenize(currentTexts);
    const matches: SimilarityMatchDto[] = [];
    for (const source of corpus) {
      const sourceTokens = tokenize(
        flattenStrings(source.content)
          .filter(({ path }) => !normalize(path).includes('referencias'))
          .map((entry) => entry.text)
          .join('\n'),
      );
      const segments = sharedSegments(currentTokens, sourceTokens);
      const tokenCount = segments.reduce((total, segment) => total + segment.length, 0);
      if (tokenCount < 8) continue;
      const member = article.memberIds.includes(actorId);
      const excerpts = segments.slice(0, 5).map((segment) => segment.tokens.slice(0, 80).join(' '));
      matches.push({
        text: excerpts.join(' … '),
        sourceArticleId: member ? null : source.articleId,
        sourcePath: null,
        tokenCount,
        percentageOfArticle:
          currentTokens.length === 0
            ? 0
            : Number(((tokenCount / currentTokens.length) * 100).toFixed(2)),
      });
    }
    matches.sort((a, b) => b.tokenCount - a.tokenCount);
    const report: SimilarityReportDto = {
      analysisId: uuidv7(),
      articleId,
      checkedAt: new Date(),
      corpusSize: corpus.length,
      insufficientCorpus: corpus.length === 0,
      matches: matches.slice(0, 25),
    };
    await this.storeAnalysis(articleId, actorId, 'SIMILARITY_CHECK', report, report.analysisId);
    return report;
  }
}

@Injectable()
export class ReadSimilarityHistoryUseCase extends AssistanceUseCaseBase {
  constructor(context: AssistanceUseCaseContext) {
    super(context);
  }

  async execute(actorId: string, articleId: string): Promise<readonly AnalysisHistoryItemDto[]> {
    await this.articleFor(actorId, articleId, 'participant');
    return this.analysisHistory(actorId, articleId, 'SIMILARITY_CHECK');
  }
}

@Injectable()
export class ReadAuthorshipSignalsUseCase extends AssistanceUseCaseBase {
  constructor(context: AssistanceUseCaseContext) {
    super(context);
  }

  async execute(actorId: string, articleId: string): Promise<AuthorshipSignalDto> {
    const article = await this.articleFor(actorId, articleId, 'advisor');
    const versions = [...unwrap(await this.articles.listHistory({ actorId, articleId }))].sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    );
    const timeline = versions.map((version, index) => {
      const contentLength = flattenStrings(version.content).reduce(
        (total, entry) => total + entry.text.length,
        0,
      );
      const prior = versions[index - 1];
      const priorLength = prior
        ? flattenStrings(prior.content).reduce((total, entry) => total + entry.text.length, 0)
        : 0;
      return {
        authorId: version.authorId,
        kind: version.kind,
        createdAt: version.createdAt,
        contentLength,
        insertedCharacters: Math.max(0, contentLength - priorLength),
      };
    });
    const authors = new Map<string, number>();
    for (const item of timeline)
      if (item.authorId !== null)
        authors.set(item.authorId, (authors.get(item.authorId) ?? 0) + item.insertedCharacters);
    const total = [...authors.values()].reduce((sum, value) => sum + value, 0);
    const sessions: {
      authorId: string | null;
      startedAt: Date;
      endedAt: Date;
      editCount: number;
    }[] = [];
    for (const item of timeline) {
      const current = sessions.at(-1);
      if (
        current &&
        current.authorId === item.authorId &&
        item.createdAt.getTime() - current.endedAt.getTime() <= SESSION_GAP_MS
      ) {
        sessions[sessions.length - 1] = {
          ...current,
          endedAt: item.createdAt,
          editCount: current.editCount + 1,
        };
      } else
        sessions.push({
          authorId: item.authorId,
          startedAt: item.createdAt,
          endedAt: item.createdAt,
          editCount: 1,
        });
    }
    const report: AuthorshipSignalDto = {
      articleId: article.id,
      sufficientHistory: versions.length > 1,
      timeline: timeline.map((item) => ({ ...item })),
      largeInsertions: timeline
        .filter((item) => item.insertedCharacters >= LARGE_INSERTION_CHARACTERS)
        .map((item) => ({
          authorId: item.authorId,
          createdAt: item.createdAt,
          characters: item.insertedCharacters,
        })),
      sessions,
      authorship: [...authors].map(([userId, insertedCharacters]) => ({
        authorId: userId,
        insertedCharacters,
        share: total === 0 ? 0 : Number((insertedCharacters / total).toFixed(4)),
      })),
      importMetadata: versions
        .filter((item) => item.kind === 'IMPORT')
        .map((item) => ({ createdAt: item.createdAt, metadata: item.metadata })),
      statement: 'RECORDED_FACTS_ONLY',
    };
    await this.storeAnalysis(articleId, actorId, 'AUTHORSHIP_SIGNALS', report);
    return report;
  }
}

function aiConfiguration(value: AssistanceConfig): AiConfigurationDto {
  return {
    available: Boolean(
      value.providerName &&
      value.processingPurpose &&
      value.legalBasis &&
      value.consentVersion &&
      value.consentText &&
      value.analysisEndpoint &&
      value.analysisToken,
    ),
    providerName: value.providerName,
    purpose: value.processingPurpose,
    legalBasis: value.legalBasis,
    declarationVersion: value.consentVersion,
    declaration: value.consentText,
  };
}
function declarationSnapshot(config: AiConfigurationDto): string {
  return JSON.stringify({
    providerName: config.providerName,
    purpose: config.purpose,
    legalBasis: config.legalBasis,
    declarationVersion: config.declarationVersion,
    declaration: config.declaration,
  });
}
function unwrap<T>(
  result:
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly failure: { readonly code: string } },
): T {
  if (result.ok) return result.value;
  throw new ApiFailure(result.failure.code as never);
}
function flattenStrings(value: JsonValue, path = '$'): { path: string; text: string }[] {
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value))
    return (value as readonly JsonValue[]).flatMap((child, index) =>
      flattenStrings(child, `${path}[${index}]`),
    );
  if (typeof value === 'object' && value !== null)
    return Object.entries(value as Record<string, JsonValue>).flatMap(([key, child]) =>
      flattenStrings(child, `${path}.${key}`),
    );
  return [];
}
function flattenHeadings(value: JsonValue, path = '$'): { path: string; text: string }[] {
  if (Array.isArray(value))
    return (value as readonly JsonValue[]).flatMap((child, index) =>
      flattenHeadings(child, `${path}[${index}]`),
    );
  if (typeof value !== 'object' || value === null) return [];
  const record = value as Record<string, JsonValue>;
  const isHeading = record.type === 'heading' || record.type === 'HEADING';
  const children = Object.entries(record).flatMap(([key, child]) =>
    flattenHeadings(child, `${path}.${key}`),
  );
  if (!isHeading) return children;
  const content = record.content;
  const text = flattenStrings(content ?? {})
    .map((entry) => entry.text)
    .join(' ')
    .trim();
  return text.length === 0 ? children : [{ path, text }, ...children];
}
function isStructuredCitation(
  citationText: string,
  references: readonly { readonly authors: JsonValue; readonly year: number | null }[],
): boolean {
  const year = citationText.match(/(?:19|20)\d{2}/)?.[0];
  if (!year) return false;
  const normalizedCitation = normalize(citationText);
  return references.some((reference) => {
    if (reference.year?.toString() !== year) return false;
    return stringLeaves(reference.authors).some((author) =>
      surnameAliases(author).some((surname) => normalizedCitation.includes(surname)),
    );
  });
}
function stringLeaves(value: JsonValue): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return (value as readonly JsonValue[]).flatMap(stringLeaves);
  if (typeof value === 'object' && value !== null)
    return Object.values(value as Record<string, JsonValue>).flatMap(stringLeaves);
  return [];
}
function surnameAliases(author: string): string[] {
  const comma = author.indexOf(',');
  const familyName = comma >= 0 ? author.slice(0, comma) : author;
  const tokens = normalize(author).split(' ').filter(Boolean);
  const aliases = [normalize(familyName), tokens.at(-1) ?? ''];
  return [...new Set(aliases)].filter((alias) => alias.length > 1);
}
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
function tokenize(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 2);
}
function sharedSegments(
  left: readonly string[],
  right: readonly string[],
): { length: number; tokens: string[] }[] {
  const shingleSize = 8;
  const source = new Map<string, number[]>();
  for (let index = 0; index <= right.length - shingleSize; index += 1) {
    const key = right.slice(index, index + shingleSize).join('\u0000');
    const candidates = source.get(key) ?? [];
    if (candidates.length < 25) candidates.push(index);
    source.set(key, candidates);
  }
  const matched = new Uint8Array(left.length);
  const segments: { length: number; tokens: string[] }[] = [];
  for (let leftIndex = 0; leftIndex <= left.length - shingleSize; leftIndex += 1) {
    if (matched[leftIndex] === 1) continue;
    const candidates =
      source.get(left.slice(leftIndex, leftIndex + shingleSize).join('\u0000')) ?? [];
    let bestLength = 0;
    for (const rightIndex of candidates) {
      let length = shingleSize;
      while (
        left[leftIndex + length] !== undefined &&
        right[rightIndex + length] !== undefined &&
        left[leftIndex + length] === right[rightIndex + length] &&
        matched[leftIndex + length] === 0
      )
        length += 1;
      if (length > bestLength) {
        bestLength = length;
      }
    }
    if (bestLength < shingleSize) continue;
    const tokens = left.slice(leftIndex, leftIndex + bestLength);
    segments.push({ length: bestLength, tokens });
    for (let offset = 0; offset < bestLength; offset += 1) matched[leftIndex + offset] = 1;
    leftIndex += bestLength - 1;
  }
  return segments;
}
