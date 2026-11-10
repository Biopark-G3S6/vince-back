import { Injectable } from '@nestjs/common';
import { AssistanceFacade } from '../contracts/assistance.facade';
import type {
  AiConsentDto,
  AnalysisHistoryItemDto,
  AuthorshipSignalDto,
  ComplianceReportDto,
  SimilarityReportDto,
} from '../contracts/assistance.dto';
import {
  CheckArticleComplianceUseCase,
  CheckArticleSimilarityUseCase,
  ReadAiConsentUseCase,
  ReadAuthorshipSignalsUseCase,
  ReadComplianceHistoryUseCase,
  ReadSimilarityHistoryUseCase,
  SetAiConsentUseCase,
  SummarizeArticleChangesUseCase,
} from './assistance.use-cases';

@Injectable()
export class AssistanceFacadeImpl extends AssistanceFacade {
  constructor(
    private readonly readConsent: ReadAiConsentUseCase,
    private readonly setConsentUseCase: SetAiConsentUseCase,
    private readonly summarizeChanges: SummarizeArticleChangesUseCase,
    private readonly checkComplianceUseCase: CheckArticleComplianceUseCase,
    private readonly readComplianceHistory: ReadComplianceHistoryUseCase,
    private readonly checkSimilarityUseCase: CheckArticleSimilarityUseCase,
    private readonly readSimilarityHistory: ReadSimilarityHistoryUseCase,
    private readonly readAuthorship: ReadAuthorshipSignalsUseCase,
  ) {
    super();
  }

  consent(actorId: string, institutionId: string): Promise<AiConsentDto> {
    return this.readConsent.execute(actorId, institutionId);
  }

  setConsent(actorId: string, institutionId: string, consented: boolean): Promise<AiConsentDto> {
    return this.setConsentUseCase.execute(actorId, institutionId, consented);
  }

  summary(actorId: string, articleId: string): Promise<Readonly<Record<string, unknown>>> {
    return this.summarizeChanges.execute(actorId, articleId);
  }

  checkCompliance(actorId: string, articleId: string): Promise<ComplianceReportDto> {
    return this.checkComplianceUseCase.execute(actorId, articleId);
  }

  complianceHistory(
    actorId: string,
    articleId: string,
  ): Promise<readonly AnalysisHistoryItemDto[]> {
    return this.readComplianceHistory.execute(actorId, articleId);
  }

  checkSimilarity(actorId: string, articleId: string): Promise<SimilarityReportDto> {
    return this.checkSimilarityUseCase.execute(actorId, articleId);
  }

  similarityHistory(
    actorId: string,
    articleId: string,
  ): Promise<readonly AnalysisHistoryItemDto[]> {
    return this.readSimilarityHistory.execute(actorId, articleId);
  }

  authorship(actorId: string, articleId: string): Promise<AuthorshipSignalDto> {
    return this.readAuthorship.execute(actorId, articleId);
  }
}
