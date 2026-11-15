import type { Page } from '@shared/http/pagination';
import type {
  ContributionDto,
  CourseProgressQuery,
  CourseProgressSnapshot,
  ProgressDashboardQuery,
  ProgressReportDto,
  ProgressTeamDto,
  ReportExportDto,
  ReportQuery,
  RiskSignalDto,
} from './progress.dto';

export abstract class ProgressFacade {
  abstract advisorDashboard(query: ProgressDashboardQuery): Promise<Page<ProgressTeamDto>>;
  abstract courseDashboard(query: CourseProgressQuery): Promise<CourseProgressSnapshot>;
  abstract risks(actorId: string, courseId?: string): Promise<readonly RiskSignalDto[]>;
  abstract contribution(actorId: string, articleId: string): Promise<ContributionDto>;
  abstract generateReport(query: ReportQuery): Promise<ProgressReportDto>;
  abstract findReport(actorId: string, reportId: string): Promise<ProgressReportDto>;
  abstract exportReport(
    actorId: string,
    reportId: string,
    format: 'JSON' | 'CSV',
  ): Promise<ReportExportDto>;
}
