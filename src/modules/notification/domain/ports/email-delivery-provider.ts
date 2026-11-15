export interface EmailDeliveryMessage {
  readonly to: string;
  readonly language: string;
  readonly subject: string;
  readonly text: string;
  readonly type: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly data: unknown;
}

export abstract class EmailDeliveryProvider {
  abstract readonly available: boolean;
  abstract send(message: EmailDeliveryMessage): Promise<void>;
}
