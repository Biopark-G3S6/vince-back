export interface AiConfigurationDto {
  readonly available: boolean;
  readonly providerName: string | null;
  readonly purpose: string | null;
  readonly legalBasis: string | null;
  readonly declarationVersion: string | null;
  readonly declaration: string | null;
}

export interface AiConsentDto {
  readonly institutionId: string;
  readonly consented: boolean;
  readonly consentedBy: string | null;
  readonly consentedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly revokedBy: string | null;
  readonly configuration: AiConfigurationDto;
}

export interface AssistanceIssueDto {
  readonly code: string;
  readonly category: 'FORMATTING' | 'STRUCTURE' | 'REFERENCES';
  readonly severity: 'ERROR' | 'RECOMMENDATION' | 'UNVERIFIED';
  readonly path: string | null;
  readonly referenceId?: string;
  readonly evidence?: string;
}

export interface ComplianceReportDto {
  readonly analysisId: string;
  readonly articleId: string;
  readonly norm: 'ABNT';
  readonly checkedAt: Date;
  readonly conformant: boolean | null;
  readonly issues: readonly AssistanceIssueDto[];
}

export interface SimilarityMatchDto {
  readonly text: string;
  readonly sourceArticleId: string | null;
  readonly sourcePath: string | null;
  readonly tokenCount: number;
  readonly percentageOfArticle: number;
}

export interface SimilarityReportDto {
  readonly analysisId: string;
  readonly articleId: string;
  readonly checkedAt: Date;
  readonly corpusSize: number;
  readonly insufficientCorpus: boolean;
  readonly matches: readonly SimilarityMatchDto[];
}

export interface AnalysisHistoryItemDto {
  readonly id: string;
  readonly createdAt: Date;
  readonly result: Readonly<Record<string, unknown>>;
}

export interface AuthorshipSignalDto {
  readonly articleId: string;
  readonly sufficientHistory: boolean;
  readonly timeline: readonly {
    readonly authorId: string | null;
    readonly kind: string;
    readonly createdAt: Date;
    readonly contentLength: number;
    readonly insertedCharacters: number;
  }[];
  readonly largeInsertions: readonly {
    readonly authorId: string | null;
    readonly createdAt: Date;
    readonly characters: number;
  }[];
  readonly sessions: readonly {
    readonly authorId: string | null;
    readonly startedAt: Date;
    readonly endedAt: Date;
    readonly editCount: number;
  }[];
  readonly authorship: readonly {
    readonly authorId: string;
    readonly insertedCharacters: number;
    readonly share: number;
  }[];
  readonly importMetadata: readonly { readonly createdAt: Date; readonly metadata: unknown }[];
  readonly statement: 'RECORDED_FACTS_ONLY';
}
