import { z } from 'zod';
import type { AssistanceConfig } from '@shared/config/environment';
import {
  AssistanceProvider,
  type AssistanceSummaryInput,
  type AssistanceSummaryResult,
} from '../domain/ports/assistance-provider';

export class HttpAssistanceProvider extends AssistanceProvider {
  readonly available: boolean;

  constructor(private readonly configuration: AssistanceConfig) {
    super();
    this.available = Boolean(configuration.analysisEndpoint && configuration.analysisToken);
  }

  async summarize(input: AssistanceSummaryInput): Promise<AssistanceSummaryResult> {
    const { analysisEndpoint, analysisToken } = this.configuration;
    if (!analysisEndpoint || !analysisToken) throw new Error('ASSISTANCE_PROVIDER_UNAVAILABLE');
    const response = await fetch(analysisEndpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${analysisToken}`,
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error('ASSISTANCE_PROVIDER_UNAVAILABLE');
    return z
      .object({
        summary: z.string(),
        unchangedRemarks: z.array(z.string().uuid()),
        unmetRemarks: z.array(z.string().uuid()),
      })
      .parse(await response.json());
  }
}
