import type { PageRequest } from '@shared/http/pagination';

export interface ProgressTeamDto {
  readonly articleId: string;
  readonly institutionId: string;
  readonly courseId: string | null;
  readonly eventId: string;
  readonly teamId: string;
  readonly advisorId: string | null;
  readonly memberIds: readonly string[];
  readonly status: string;
  readonly currentMilestoneId: string | null;
  readonly currentMilestoneOrder: number | null;
  readonly currentMilestoneDeadline: Date | null;
  readonly lastMilestoneOrder: number | null;
  readonly latestSubmissionAutomatic: boolean | null;
  readonly latestSubmissionAt: Date | null;
  readonly latestSubmissionMilestoneOrder: number | null;
  readonly pendingRemarkCount: number;
  readonly lastEditedAt: Date;
  readonly consecutiveAutomaticSubmissions: number;
  readonly editedMemberIds: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly elapsedSinceEditSeconds: number;
  readonly activeRisks: readonly string[];
}

export interface ProgressDashboardQuery {
  readonly actorId: string;
  readonly request: PageRequest;
  readonly status?: string;
  readonly riskOnly?: boolean;
}
export interface CourseProgressQuery {
  readonly actorId: string;
  readonly courseId: string;
  readonly request: PageRequest;
  readonly eventId?: string;
}
export interface CourseProgressSnapshot {
  readonly events: readonly {
    readonly eventId: string;
    readonly teamCount: number;
    readonly deliveredCurrentMilestoneCount: number;
    readonly activeSignalTeamCount: number;
    readonly finishedArticleCount: number;
  }[];
  readonly teams: import('@shared/http/pagination').Page<ProgressTeamDto>;
}
export interface RiskSignalDto {
  readonly id: string;
  readonly articleId: string;
  readonly teamId: string;
  readonly courseId: string | null;
  readonly eventId: string;
  readonly condition: string;
  readonly active: boolean;
  readonly activatedAt: Date;
  readonly lastObservedAt: Date;
  readonly clearedAt: Date | null;
}
export interface ContributionMemberDto {
  readonly userId: string;
  readonly insertedCharacters: number;
  readonly share: number;
  readonly editSessions: number;
  readonly addressedRemarks: number;
  readonly discussionMessages: number;
}
export interface ContributionDto {
  readonly articleId: string;
  readonly members: readonly ContributionMemberDto[];
  readonly volumeIsNotContributionMeasure: true;
  readonly note: 'SUBSIDY_ONLY_NO_GRADE';
  readonly sufficientHistory: boolean;
}
export interface ReportQuery {
  readonly actorId: string;
  readonly courseId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
}
export interface ProgressReportDto {
  readonly id: string;
  readonly courseId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly createdAt: Date;
  readonly data: Readonly<Record<string, unknown>>;
}
export interface ReportExportDto {
  readonly fileName: string;
  readonly contentType: string;
  readonly body: string;
}
