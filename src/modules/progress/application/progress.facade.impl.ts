import { Injectable } from '@nestjs/common';
import type { Page } from '@shared/http/pagination';
import { ProgressFacade } from '../contracts/progress.facade';
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
} from '../contracts/progress.dto';
import {
  ExportProgressReportUseCase,
  GenerateProgressReportUseCase,
  ReadAdvisorProgressDashboardUseCase,
  ReadArticleContributionUseCase,
  ReadCourseProgressDashboardUseCase,
  ReadProgressReportUseCase,
  ReadRiskSignalsUseCase,
} from './progress.use-cases';

@Injectable()
export class ProgressFacadeImpl extends ProgressFacade {
  constructor(
    private readonly advisorDashboardUseCase: ReadAdvisorProgressDashboardUseCase,
    private readonly courseDashboardUseCase: ReadCourseProgressDashboardUseCase,
    private readonly riskSignalsUseCase: ReadRiskSignalsUseCase,
    private readonly contributionUseCase: ReadArticleContributionUseCase,
    private readonly generateReportUseCase: GenerateProgressReportUseCase,
    private readonly readReportUseCase: ReadProgressReportUseCase,
    private readonly exportReportUseCase: ExportProgressReportUseCase,
  ) {
    super();
  }

  advisorDashboard(query: ProgressDashboardQuery): Promise<Page<ProgressTeamDto>> {
    return this.advisorDashboardUseCase.execute(query);
  }

  courseDashboard(query: CourseProgressQuery): Promise<CourseProgressSnapshot> {
    return this.courseDashboardUseCase.execute(query);
  }

  risks(actorId: string, courseId?: string): Promise<readonly RiskSignalDto[]> {
    return this.riskSignalsUseCase.execute(actorId, courseId);
  }

  contribution(actorId: string, articleId: string): Promise<ContributionDto> {
    return this.contributionUseCase.execute(actorId, articleId);
  }

  generateReport(query: ReportQuery): Promise<ProgressReportDto> {
    return this.generateReportUseCase.execute(query);
  }

  findReport(actorId: string, reportId: string): Promise<ProgressReportDto> {
    return this.readReportUseCase.execute(actorId, reportId);
  }

  exportReport(
    actorId: string,
    reportId: string,
    format: 'JSON' | 'CSV',
  ): Promise<ReportExportDto> {
    return this.exportReportUseCase.execute(actorId, reportId, format);
  }
}
