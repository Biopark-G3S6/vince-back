export interface RiskSignalRecord {
  readonly id: string;
  readonly articleId: string;
  readonly teamId: string;
  readonly courseId: string | null;
  readonly eventId: string;
  readonly condition: string;
  readonly activationEventId: string;
  readonly active: boolean;
  readonly activatedAt: Date;
  readonly lastObservedAt: Date;
  readonly clearedAt: Date | null;
}

export interface ProgressReportRecord {
  readonly id: string;
  readonly courseId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly createdAt: Date;
  readonly status: string;
  readonly data: unknown;
}

export interface UpsertRiskSignal {
  readonly id: string;
  readonly articleId: string;
  readonly teamId: string;
  readonly courseId: string | null;
  readonly eventId: string;
  readonly condition: string;
  readonly activationEventId: string;
  readonly active: boolean;
  readonly activatedAt: Date;
  readonly lastObservedAt: Date;
  readonly wasActive: boolean;
}

export interface CreateProgressReport {
  readonly id: string;
  readonly courseId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly createdBy: string;
  readonly status: string;
  readonly data: unknown;
}

export abstract class ProgressRepository {
  abstract activeSignals(articleIds: readonly string[]): Promise<readonly RiskSignalRecord[]>;
  abstract signalsForTeams(teamIds: readonly string[]): Promise<readonly RiskSignalRecord[]>;
  abstract upsertSignal(data: UpsertRiskSignal): Promise<void>;
  abstract deactivateSignal(id: string, at: Date): Promise<void>;
  abstract createReport(data: CreateProgressReport): Promise<ProgressReportRecord>;
  abstract findReport(id: string): Promise<ProgressReportRecord | null>;
}
