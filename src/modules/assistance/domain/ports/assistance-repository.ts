export interface InstitutionAiConsentRecord {
  readonly id: string;
  readonly institutionId: string;
  readonly declarationVersion: string;
  readonly declarationSnapshot: string;
  readonly providerName: string;
  readonly processingPurpose: string;
  readonly consentedBy: string;
  readonly consentedAt: Date;
  readonly revokedBy: string | null;
  readonly revokedAt: Date | null;
}

export interface ArticleAnalysisRecord {
  readonly id: string;
  readonly createdAt: Date;
  readonly result: unknown;
}

export interface CreateAiConsent {
  readonly id: string;
  readonly institutionId: string;
  readonly declarationVersion: string;
  readonly declarationSnapshot: string;
  readonly providerName: string;
  readonly processingPurpose: string;
  readonly consentedBy: string;
  readonly consentedAt: Date;
}

export interface SaveArticleAnalysis {
  readonly id: string;
  readonly articleId: string;
  readonly kind: string;
  readonly requestedBy: string;
  readonly status: 'COMPLETE' | 'PROCESSING' | 'FAILED';
  readonly result?: unknown;
  readonly errorCode?: string | null;
  readonly correlationId?: string | null;
}

export interface UpdateArticleAnalysis {
  readonly status: 'COMPLETE' | 'PROCESSING' | 'FAILED';
  readonly result?: unknown;
  readonly errorCode?: string | null;
}

export abstract class AssistanceRepository {
  abstract latestConsent(institutionId: string): Promise<InstitutionAiConsentRecord | null>;
  abstract activeConsent(institutionId: string): Promise<InstitutionAiConsentRecord | null>;
  abstract createConsent(data: CreateAiConsent): Promise<InstitutionAiConsentRecord>;
  abstract revokeActiveConsent(
    institutionId: string,
    actorId: string,
    at: Date,
  ): Promise<InstitutionAiConsentRecord | null>;
  abstract saveAnalysis(data: SaveArticleAnalysis): Promise<void>;
  abstract updateAnalysis(id: string, data: UpdateArticleAnalysis): Promise<void>;
  abstract listAnalyses(
    articleId: string,
    actorId: string,
    kind: string,
    take: number,
  ): Promise<readonly ArticleAnalysisRecord[]>;
}
