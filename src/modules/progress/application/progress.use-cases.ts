import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import type { ProgressRiskConfig } from '@shared/config/environment';
import { ApiFailure } from '@shared/errors/api-failure';
import { offsetOf, toPage, type Page, type PageRequest } from '@shared/http/pagination';
import { AccessFacade } from '@modules/access/contracts/access.facade';
import { ArticleFacade } from '@modules/article/contracts/article.facade';
import type { ArticleProgressDto } from '@modules/article/contracts/article.dto';
import { CourseFacade } from '@modules/course/contracts/course.facade';
import { DiscussionFacade } from '@modules/discussion/contracts/discussion.facade';
import { NotificationFacade } from '@modules/notification/contracts/notification.facade';
import { AssistanceFacade } from '@modules/assistance/contracts/assistance.facade';
import type {
  ContributionDto,
  ContributionMemberDto,
  CourseProgressQuery,
  CourseProgressSnapshot,
  ProgressDashboardQuery,
  ProgressReportDto,
  ProgressTeamDto,
  ReportExportDto,
  ReportQuery,
  RiskSignalDto,
} from '../contracts/progress.dto';
import { ProgressRepository } from '../domain/ports/progress-repository';

const DAY_MS = 24 * 60 * 60 * 1000;

export class ProgressUseCaseContext {
  constructor(
    readonly repository: ProgressRepository,
    readonly articles: ArticleFacade,
    readonly courses: CourseFacade,
    readonly access: AccessFacade,
    readonly assistance: AssistanceFacade,
    readonly discussion: DiscussionFacade,
    readonly notifications: NotificationFacade,
    readonly riskConfig: ProgressRiskConfig,
  ) {}
}

abstract class ProgressUseCaseBase {
  protected constructor(protected readonly context: ProgressUseCaseContext) {}
  protected get repository() {
    return this.context.repository;
  }
  protected get articles() {
    return this.context.articles;
  }
  protected get courses() {
    return this.context.courses;
  }
  protected get access() {
    return this.context.access;
  }
  protected get assistance() {
    return this.context.assistance;
  }
  protected get discussion() {
    return this.context.discussion;
  }
  protected get notifications() {
    return this.context.notifications;
  }
  protected get riskConfig() {
    return this.context.riskConfig;
  }

  protected async evaluateArticle(
    article: ArticleProgressDto,
    existing: readonly {
      id: string;
      condition: string;
      activationEventId: string;
      active: boolean;
    }[],
    coordinator: string | null,
  ): Promise<void> {
    const now = new Date();
    const conditions = new Set<string>();
    if (
      article.status !== 'FINISHED' &&
      now.getTime() - article.lastEditedAt.getTime() >= this.riskConfig.inactivityDays * DAY_MS
    )
      conditions.add('NO_EDIT_FOR_LONG_PERIOD');
    if (article.consecutiveAutomaticSubmissions >= 2)
      conditions.add('TWO_CONSECUTIVE_AUTOMATIC_DELIVERIES');
    if (article.pendingRemarkCount >= this.riskConfig.pendingRemarks)
      conditions.add('PENDING_REMARKS_ACCUMULATED');
    if (article.memberIds.some((id) => !article.editedMemberIds.includes(id)))
      conditions.add('MEMBER_NEVER_EDITED');
    const hoursUntilDeadline = article.currentMilestoneDeadline
      ? article.currentMilestoneDeadline.getTime() - now.getTime()
      : null;
    if (
      hoursUntilDeadline !== null &&
      article.status !== 'FINISHED' &&
      hoursUntilDeadline >= 0 &&
      hoursUntilDeadline <= this.riskConfig.deadlineHours * 60 * 60 * 1000
    )
      conditions.add('DEADLINE_APPROACHING');
    if (
      hoursUntilDeadline !== null &&
      article.status !== 'FINISHED' &&
      hoursUntilDeadline >= 0 &&
      hoursUntilDeadline <= this.riskConfig.deadlineHours * 60 * 60 * 1000 &&
      article.latestSubmissionAt !== null &&
      article.lastEditedAt <= article.latestSubmissionAt
    )
      conditions.add('DEADLINE_NEAR_WITHOUT_EDIT');
    if (article.status === 'FINISHED') conditions.clear();
    for (const condition of conditions) {
      const signal = existing.find((row) => row.condition === condition);
      const wasActive = signal?.active ?? false;
      const id = signal?.id ?? uuidv7();
      const activationEventId = wasActive ? (signal?.activationEventId ?? uuidv7()) : uuidv7();
      await this.repository.upsertSignal({
        id,
        articleId: article.articleId,
        teamId: article.teamId,
        courseId: article.courseId,
        eventId: article.eventId,
        condition,
        activationEventId,
        active: true,
        activatedAt: now,
        lastObservedAt: now,
        wasActive,
      });
      await this.notifications.create({
        eventId: activationEventId,
        actorId: null,
        recipientIds: [
          ...(article.advisorId ? [article.advisorId] : []),
          ...(coordinator ? [coordinator] : []),
        ],
        type: 'RISK_SIGNAL',
        targetType: 'ARTICLE',
        targetId: article.articleId,
        data: { teamId: article.teamId, condition },
      });
      if (condition === 'DEADLINE_APPROACHING')
        await this.notifications.create({
          eventId: deriveEventId(activationEventId, 'TEAM_DEADLINE'),
          actorId: null,
          recipientIds: article.memberIds,
          type: 'MILESTONE_DEADLINE_SOON',
          targetType: 'ARTICLE',
          targetId: article.articleId,
          data: {
            teamId: article.teamId,
            milestoneOrder: article.currentMilestoneOrder,
            deadline: article.currentMilestoneDeadline?.toISOString(),
          },
        });
    }
    for (const row of existing)
      if (row.active && !conditions.has(row.condition))
        await this.repository.deactivateSignal(row.id, now);
  }

  protected async readAll(query: {
    actorId: string;
    scope: 'advisor' | 'course' | 'institution';
    courseId?: string;
  }): Promise<ArticleProgressDto[]> {
    const rows: ArticleProgressDto[] = [];
    let page = 1;
    while (true) {
      const result = this.unwrap(
        await this.articles.listProgress({
          ...query,
          request: { page, pageSize: 100, withTotal: false },
        }),
      );
      rows.push(...result.items);
      if (!result.pagination.hasNext) return rows;
      page += 1;
    }
  }

  protected async riskMap(articleIds: readonly string[]): Promise<Map<string, string[]>> {
    if (articleIds.length === 0) return new Map();
    const rows = await this.repository.activeSignals(articleIds);
    const map = new Map<string, string[]>();
    for (const row of rows)
      map.set(row.articleId, [...(map.get(row.articleId) ?? []), row.condition]);
    return map;
  }

  protected async allMessages(actorId: string, articleId: string) {
    const messages = [];
    let page = 1;
    while (true) {
      const result = await this.discussion.list({
        actorId,
        articleId,
        request: { page, pageSize: 100, withTotal: false },
      });
      messages.push(...result.items);
      if (!result.pagination.hasNext) return messages;
      page += 1;
    }
  }

  protected async assertReportAccess(
    actorId: string,
    courseId: string,
    institutionId: string,
  ): Promise<void> {
    const profile = await this.access.findOwnProfile({ actorId, userId: actorId });
    if (!profile.ok) throw new ApiFailure('PERMISSION_DENIED');
    if (
      profile.value.roleCodes.includes('COORDINATOR') &&
      (await this.courses.coordinatorOf(courseId)) === actorId
    )
      return;
    if (
      profile.value.roleCodes.includes('INSTITUTION_ADMIN') &&
      profile.value.institutionId === institutionId
    )
      return;
    throw new ApiFailure('PERMISSION_DENIED');
  }

  protected unwrap<T>(
    result:
      | { readonly ok: true; readonly value: T }
      | { readonly ok: false; readonly failure: { readonly code: string } },
  ): T {
    if (result.ok) return result.value;
    throw new ApiFailure(result.failure.code as never);
  }
}

@Injectable()
export class ReadAdvisorProgressDashboardUseCase extends ProgressUseCaseBase {
  constructor(context: ProgressUseCaseContext) {
    super(context);
  }

  async execute(query: ProgressDashboardQuery): Promise<Page<ProgressTeamDto>> {
    const rows = await this.readAll({ actorId: query.actorId, scope: 'advisor' });
    const risks = await this.riskMap(rows.map((row) => row.articleId));
    let filtered = rows.map((row) => toTeam(row, risks.get(row.articleId) ?? []));
    if (query.status) filtered = filtered.filter((row) => row.status === query.status);
    if (query.riskOnly) filtered = filtered.filter((row) => row.activeRisks.length > 0);
    filtered.sort(
      (a, b) =>
        a.lastEditedAt.getTime() - b.lastEditedAt.getTime() ||
        a.articleId.localeCompare(b.articleId),
    );
    return paginate(query.request, filtered);
  }
}

@Injectable()
export class ReadCourseProgressDashboardUseCase extends ProgressUseCaseBase {
  constructor(context: ProgressUseCaseContext) {
    super(context);
  }

  async execute(query: CourseProgressQuery): Promise<CourseProgressSnapshot> {
    const rows = await this.readAll({
      actorId: query.actorId,
      scope: 'course',
      courseId: query.courseId,
    });
    const risks = await this.riskMap(rows.map((row) => row.articleId));
    const allTeams = rows.map((row) => toTeam(row, risks.get(row.articleId) ?? []));
    const events = new Map<
      string,
      {
        eventId: string;
        teamCount: number;
        deliveredCurrentMilestoneCount: number;
        activeSignalTeamCount: number;
        finishedArticleCount: number;
      }
    >();
    for (const team of allTeams) {
      const aggregate = events.get(team.eventId) ?? {
        eventId: team.eventId,
        teamCount: 0,
        deliveredCurrentMilestoneCount: 0,
        activeSignalTeamCount: 0,
        finishedArticleCount: 0,
      };
      aggregate.teamCount += 1;
      if (
        team.latestSubmissionMilestoneOrder !== null &&
        team.latestSubmissionMilestoneOrder === team.currentMilestoneOrder
      )
        aggregate.deliveredCurrentMilestoneCount += 1;
      if (team.activeRisks.length > 0) aggregate.activeSignalTeamCount += 1;
      if (team.status === 'FINISHED') aggregate.finishedArticleCount += 1;
      events.set(team.eventId, aggregate);
    }
    const selected = query.eventId
      ? allTeams.filter((team) => team.eventId === query.eventId)
      : allTeams;
    return {
      events: [...events.values()].sort((a, b) => a.eventId.localeCompare(b.eventId)),
      teams: paginate(query.request, selected),
    };
  }
}

@Injectable()
export class ReadRiskSignalsUseCase extends ProgressUseCaseBase {
  constructor(context: ProgressUseCaseContext) {
    super(context);
  }

  async execute(actorId: string, courseId?: string): Promise<readonly RiskSignalDto[]> {
    const profile = await this.access.findOwnProfile({ actorId, userId: actorId });
    if (!profile.ok) throw new ApiFailure('PERMISSION_DENIED');
    const scope = courseId ? 'course' : 'advisor';
    const rows = await this.readAll({ actorId, scope, ...(courseId ? { courseId } : {}) });
    const signals = await this.repository.activeSignals(rows.map((row) => row.articleId));
    return signals.map(toRiskDto);
  }
}

@Injectable()
export class ReadArticleContributionUseCase extends ProgressUseCaseBase {
  constructor(context: ProgressUseCaseContext) {
    super(context);
  }

  async execute(actorId: string, articleId: string): Promise<ContributionDto> {
    const articleResult = await this.articles.findArticle({ actorId, articleId });
    if (!articleResult.ok || articleResult.value.advisorId !== actorId)
      throw new ApiFailure('RESOURCE_NOT_FOUND');
    const [authorship, remarksResult, messages] = await Promise.all([
      this.assistance.authorship(actorId, articleId),
      this.articles.listRemarks({ actorId, articleId }),
      this.allMessages(actorId, articleId),
    ]);
    const remarks = this.unwrap(remarksResult);
    const memberIds = articleResult.value.memberIds;
    const members: ContributionMemberDto[] = memberIds.map((userId) => {
      const author = authorship.authorship.find((entry) => entry.authorId === userId);
      const addressedRemarks = remarks.filter((remark) => remark.addressedBy === userId).length;
      const discussionMessages = messages.filter((message) => message.authorId === userId).length;
      const editSessions = authorship.sessions.filter(
        (session) => session.authorId === userId,
      ).length;
      return {
        userId,
        insertedCharacters: author?.insertedCharacters ?? 0,
        share: author?.share ?? 0,
        editSessions,
        addressedRemarks,
        discussionMessages,
      };
    });
    return {
      articleId,
      members,
      volumeIsNotContributionMeasure: true,
      note: 'SUBSIDY_ONLY_NO_GRADE',
      sufficientHistory: authorship.sufficientHistory,
    };
  }
}

@Injectable()
export class GenerateProgressReportUseCase extends ProgressUseCaseBase {
  constructor(context: ProgressUseCaseContext) {
    super(context);
  }

  async execute(query: ReportQuery): Promise<ProgressReportDto> {
    const course = await this.courses.findById({
      actorId: query.actorId,
      courseId: query.courseId,
    });
    if (!course.ok) throw new ApiFailure(course.failure.code as never);
    await this.assertReportAccess(query.actorId, query.courseId, course.value.institutionId);
    const rows = (
      await this.readAll({
        actorId: query.actorId,
        scope: 'course',
        courseId: query.courseId,
      }).catch(async (error: unknown) => {
        if (error instanceof ApiFailure && error.code === 'PERMISSION_DENIED')
          return this.readAll({ actorId: query.actorId, scope: 'institution' });
        throw error;
      })
    ).filter(
      (row) =>
        row.courseId === query.courseId &&
        row.createdAt >= query.periodStart &&
        row.createdAt <= query.periodEnd,
    );
    const activeRisks = await this.riskMap(rows.map((row) => row.articleId));
    const externalPublicationCount = await this.articles.countSystemPublications(
      query.courseId,
      query.periodStart,
      query.periodEnd,
    );
    const grouped = new Map<string, ArticleProgressDto[]>();
    for (const row of rows) grouped.set(row.eventId, [...(grouped.get(row.eventId) ?? []), row]);
    const eventTotals = [...grouped].map(([eventId, teams]) => ({
      eventId,
      teamCount: teams.length,
    }));
    const students = new Set(rows.flatMap((row) => row.memberIds));
    const overdue = rows
      .filter(
        (row) =>
          row.status !== 'FINISHED' &&
          row.currentMilestoneDeadline !== null &&
          row.currentMilestoneDeadline < query.periodEnd,
      )
      .map((row) => ({
        articleId: row.articleId,
        teamId: row.teamId,
        eventId: row.eventId,
        milestoneOrder: row.currentMilestoneOrder,
      }));
    const articleGrades = rows.map((row) => ({
      articleId: row.articleId,
      eventId: row.eventId,
      score: row.articleGrade,
    }));
    const individualGrades = rows.flatMap((row) =>
      row.memberIds.map((userId) => ({
        articleId: row.articleId,
        eventId: row.eventId,
        userId,
        score: row.memberGrades[userId] ?? null,
      })),
    );
    const articleGradeValues = articleGrades.flatMap((entry) =>
      entry.score === null ? [] : [entry.score],
    );
    const individualGradeValues = individualGrades.flatMap((entry) =>
      entry.score === null ? [] : [entry.score],
    );
    const reportData = {
      courseId: query.courseId,
      period: { start: query.periodStart.toISOString(), end: query.periodEnd.toISOString() },
      periodBasis: 'ARTICLE_CREATED_AT',
      empty: rows.length === 0 && externalPublicationCount === 0,
      snapshotAt: new Date().toISOString(),
      teamsByEvent: eventTotals,
      articles: {
        total: rows.length,
        finished: rows.filter((row) => row.status === 'FINISHED').length,
        notFinished: rows.filter((row) => row.status !== 'FINISHED').length,
      },
      participatingStudents: students.size,
      performance: {
        articleGrades,
        individualGrades,
        averageArticleGrade: average(articleGradeValues),
        averageIndividualGrade: average(individualGradeValues),
        ungradedArticles: articleGrades.filter((entry) => entry.score === null).length,
        ungradedStudents: individualGrades.filter((entry) => entry.score === null).length,
      },
      externalPublications: { count: externalPublicationCount },
      teamsBehind: overdue,
      activeRiskTeams: [...activeRisks.values()].filter((items) => items.length > 0).length,
    };
    const id = uuidv7();
    const row = await this.repository.createReport({
      id,
      courseId: query.courseId,
      periodStart: query.periodStart,
      periodEnd: query.periodEnd,
      createdBy: query.actorId,
      status: 'COMPLETE',
      data: reportData,
    });
    return {
      id: row.id,
      courseId: row.courseId,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      createdAt: row.createdAt,
      data: row.data as Readonly<Record<string, unknown>>,
    };
  }
}

@Injectable()
export class ReadProgressReportUseCase extends ProgressUseCaseBase {
  constructor(context: ProgressUseCaseContext) {
    super(context);
  }

  async execute(actorId: string, reportId: string): Promise<ProgressReportDto> {
    const row = await this.repository.findReport(reportId);
    if (row === null) throw new ApiFailure('RESOURCE_NOT_FOUND');
    const course = await this.courses.findById({ actorId, courseId: row.courseId });
    if (!course.ok) throw new ApiFailure('RESOURCE_NOT_FOUND');
    await this.assertReportAccess(actorId, row.courseId, course.value.institutionId);
    if (row.status !== 'COMPLETE' || row.data === null) throw new ApiFailure('REPORT_NOT_READY');
    return {
      id: row.id,
      courseId: row.courseId,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      createdAt: row.createdAt,
      data: row.data as Readonly<Record<string, unknown>>,
    };
  }
}

@Injectable()
export class ExportProgressReportUseCase extends ProgressUseCaseBase {
  constructor(
    context: ProgressUseCaseContext,
    private readonly readReport: ReadProgressReportUseCase,
  ) {
    super(context);
  }

  async execute(
    actorId: string,
    reportId: string,
    format: 'JSON' | 'CSV',
  ): Promise<ReportExportDto> {
    const report = await this.readReport.execute(actorId, reportId);
    if (format === 'JSON')
      return {
        fileName: `relatorio-${report.id}.json`,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(report, null, 2),
      };
    const rows = Object.entries(report.data).map(
      ([key, value]) => `${csv(key)},${csv(JSON.stringify(value))}`,
    );
    return {
      fileName: `relatorio-${report.id}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: ['campo,valor', ...rows].join('\r\n'),
    };
  }
}

@Injectable()
export class EvaluateProgressRisksUseCase extends ProgressUseCaseBase {
  constructor(context: ProgressUseCaseContext) {
    super(context);
  }

  async execute(): Promise<void> {
    const request: PageRequest = { page: 1, pageSize: 100, withTotal: false };
    let page = 1;
    while (true) {
      const batch = this.unwrap(await this.articles.listSystemProgress({ ...request, page }));
      const existing = await this.repository.signalsForTeams(
        batch.items.map((article) => article.teamId),
      );
      const signalsByTeam = new Map<string, typeof existing>();
      for (const signal of existing)
        signalsByTeam.set(signal.teamId, [...(signalsByTeam.get(signal.teamId) ?? []), signal]);
      const coordinatorByCourse = new Map<string, string | null>();
      for (const article of batch.items) {
        let coordinator: string | null = null;
        if (article.courseId) {
          if (!coordinatorByCourse.has(article.courseId)) {
            coordinatorByCourse.set(
              article.courseId,
              await this.courses.coordinatorOf(article.courseId),
            );
          }
          coordinator = coordinatorByCourse.get(article.courseId) ?? null;
        }
        await this.evaluateArticle(article, signalsByTeam.get(article.teamId) ?? [], coordinator);
      }
      if (!batch.pagination.hasNext) break;
      page += 1;
    }
  }
}

function average(values: readonly number[]): number | null {
  return values.length === 0
    ? null
    : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}
function toTeam(row: ArticleProgressDto, activeRisks: readonly string[]): ProgressTeamDto {
  const {
    articleGrade: _articleGrade,
    memberGrades: _memberGrades,
    externalPublicationCount: _publicationCount,
    ...progress
  } = row;
  return {
    ...progress,
    elapsedSinceEditSeconds: Math.max(
      0,
      Math.floor((Date.now() - row.lastEditedAt.getTime()) / 1000),
    ),
    activeRisks,
  };
}
function toRiskDto(row: {
  id: string;
  articleId: string;
  teamId: string;
  courseId: string | null;
  eventId: string;
  condition: string;
  active: boolean;
  activatedAt: Date;
  lastObservedAt: Date;
  clearedAt: Date | null;
}): RiskSignalDto {
  return { ...row };
}
function paginate<T>(request: PageRequest, rows: readonly T[]): Page<T> {
  const start = offsetOf(request);
  const visible = rows.slice(start, start + request.pageSize + 1);
  return toPage(request, visible, request.withTotal ? rows.length : undefined);
}
function csv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
function deriveEventId(source: string, label: string): string {
  const bytes = createHash('sha256').update(`${source}:${label}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const value = bytes.toString('hex');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
