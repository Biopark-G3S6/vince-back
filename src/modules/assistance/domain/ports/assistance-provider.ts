export interface AssistanceSummaryInput {
  readonly declarationVersion: string;
  readonly previousSubmission: unknown;
  readonly currentSubmission: unknown;
  readonly differences: readonly unknown[];
  readonly pendingRemarks: readonly {
    readonly id: string;
    readonly originalText: string;
    readonly currentText: string | null;
    readonly body: string;
    readonly anchor: unknown;
  }[];
}

export interface AssistanceSummaryResult {
  readonly summary: string;
  readonly unchangedRemarks: readonly string[];
  readonly unmetRemarks: readonly string[];
}

export abstract class AssistanceProvider {
  abstract readonly available: boolean;
  abstract summarize(input: AssistanceSummaryInput): Promise<AssistanceSummaryResult>;
}
