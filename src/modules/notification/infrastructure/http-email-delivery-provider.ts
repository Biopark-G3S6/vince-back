import type { NotificationEmailConfig } from '@shared/config/environment';
import {
  EmailDeliveryProvider,
  type EmailDeliveryMessage,
} from '../domain/ports/email-delivery-provider';

export class HttpEmailDeliveryProvider extends EmailDeliveryProvider {
  readonly available: boolean;

  constructor(private readonly configuration: NotificationEmailConfig) {
    super();
    this.available = Boolean(configuration.endpoint && configuration.token);
  }

  async send(message: EmailDeliveryMessage): Promise<void> {
    const { endpoint, token } = this.configuration;
    if (!endpoint || !token) throw new Error('EMAIL_PROVIDER_UNAVAILABLE');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('EMAIL_DELIVERY_FAILED');
  }
}
