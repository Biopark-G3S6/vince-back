import type {
  AiConsentDto,
  AnalysisHistoryItemDto,
  AuthorshipSignalDto,
  ComplianceReportDto,
  SimilarityReportDto,
} from './assistance.dto';

export abstract class AssistanceFacade {
  abstract consent(actorId: string, institutionId: string): Promise<AiConsentDto>;
  abstract setConsent(
    actorId: string,
    institutionId: string,
    consented: boolean,
  ): Promise<AiConsentDto>;
  abstract summary(actorId: string, articleId: string): Promise<Readonly<Record<string, unknown>>>;
  abstract checkCompliance(actorId: string, articleId: string): Promise<ComplianceReportDto>;
  abstract complianceHistory(
    actorId: string,
    articleId: string,
  ): Promise<readonly AnalysisHistoryItemDto[]>;
  abstract checkSimilarity(actorId: string, articleId: string): Promise<SimilarityReportDto>;
  abstract similarityHistory(
    actorId: string,
    articleId: string,
  ): Promise<readonly AnalysisHistoryItemDto[]>;
  abstract authorship(actorId: string, articleId: string): Promise<AuthorshipSignalDto>;
}
