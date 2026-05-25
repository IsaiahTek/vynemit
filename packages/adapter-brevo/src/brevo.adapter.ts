import {
  TransactionalEmailsApi,
  AccountApi,
  SendSmtpEmail,
  SendSmtpEmailToInner,
  SendSmtpEmailSender,
  SendSmtpEmailReplyTo,
  SendSmtpEmailBccInner,
  SendSmtpEmailCcInner,
  SendSmtpEmailAttachmentInner,
} from '@getbrevo/brevo';
import {
  DeliveryReceipt,
  TransportAdapter,
  ChannelType,
  NotificationPreferences,
  EmailNotification,
} from '@vynelix/vynemit-core';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface BrevoSender {
  name: string;
  email: string;
}

export interface BrevoConfig {
  /** Brevo (formerly Sendinblue) API v3 key */
  apiKey: string;

  /** Default sender displayed in the From field */
  sender: BrevoSender;

  /**
   * Optional reply-to address.
   * Overridden per-notification when `notification.data.replyToEmail` is set.
   */
  replyTo?: BrevoSender;

  /**
   * Enable verbose console logging.
   */
  debug?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Applies the API key to a Brevo SDK API instance.
 *
 * The `@getbrevo/brevo` v2 SDK stores auth on each API class under the object
 * key `'apiKey'` (confirmed from SDK source). The `ApiKeyAuth` instance then
 * injects the value as an HTTP header named `'api-key'` on every request.
 *
 * SDK source reference (transactionalEmailsApi.js):
 *   this.authentications = {
 *     'apiKey': new ApiKeyAuth('header', 'api-key'),  // ← HTTP header name
 *   };
 */
function setApiKey(apiInstance: { authentications: Record<string, { apiKey?: string }> }, key: string): void {
  const auth = apiInstance.authentications['apiKey'];
  if (!auth) {
    throw new Error(
      '[Brevo] Could not locate "apiKey" entry in SDK authentications. ' +
      'SDK version may have changed – please report this at https://github.com/IsaiahTek/vynemit/issues'
    );
  }
  auth.apiKey = key;
}

// ============================================================================
// PROVIDER
// ============================================================================

export class BrevoProvider implements TransportAdapter {
  readonly name: ChannelType = 'email';

  private readonly apiKey: string;

  constructor(private readonly config: BrevoConfig) {
    if (!config.apiKey) {
      throw new Error('[Brevo] apiKey is required');
    }
    if (!config.sender?.email) {
      throw new Error('[Brevo] sender.email is required');
    }

    this.apiKey = config.apiKey;

    if (config.debug) {
      console.log(
        `[Brevo] Initialized – from: ${config.sender.name} <${config.sender.email}>`,
      );
    }
  }

  // --------------------------------------------------------------------------
  // TransportAdapter – required
  // --------------------------------------------------------------------------

  async send(
    notification: EmailNotification,
    preferences: NotificationPreferences,
  ): Promise<DeliveryReceipt> {
    try {
      const recipientEmail = this.resolveEmail(notification, preferences);

      if (!recipientEmail) {
        throw new Error('Recipient email address not found');
      }

      if (this.config.debug) {
        console.log(
          `[Brevo] Sending email to ${recipientEmail} – subject: "${notification.title}"`,
        );
      }

      const smtpEmail = this.buildSmtpEmail(notification, recipientEmail);

      const apiInstance = new TransactionalEmailsApi();
      setApiKey(apiInstance as unknown as { authentications: Record<string, { apiKey?: string }> }, this.apiKey);

      const response = await apiInstance.sendTransacEmail(smtpEmail);
      const messageId: string | undefined = (response.body as { messageId?: string })?.messageId;

      if (this.config.debug) {
        console.log(`[Brevo] Email sent – messageId: ${messageId}`);
      }

      return this.buildSuccessReceipt(notification.id, messageId);
    } catch (error: unknown) {
      return this.buildErrorReceipt(notification.id, error);
    }
  }

  // --------------------------------------------------------------------------
  // TransportAdapter – optional extensions
  // --------------------------------------------------------------------------

  async sendBatch(
    notifications: EmailNotification[],
    preferences: NotificationPreferences,
  ): Promise<DeliveryReceipt[]> {
    if (this.config.debug) {
      console.log(`[Brevo] Batch sending ${notifications.length} emails`);
    }

    // Brevo's transactional API does not expose a multi-message batch endpoint
    // with per-recipient individual status tracking, so we fan-out in parallel.
    // Rate-limit–conscious applications should throttle via a queue adapter.
    return Promise.all(notifications.map((n) => this.send(n, preferences)));
  }

  canSend(
    notification: EmailNotification,
    preferences: NotificationPreferences,
  ): boolean {
    const email = this.resolveEmail(notification, preferences);
    return !!email && this.isValidEmail(email);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const accountApi = new AccountApi();
      setApiKey(accountApi as unknown as { authentications: Record<string, { apiKey?: string }> }, this.apiKey);
      await accountApi.getAccount();
      return true;
    } catch (error: unknown) {
      if (this.config.debug) {
        console.error('[Brevo] Health check failed', error);
      }
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  /**
   * Builds the transactional email payload.
   *
   * Content priority:
   * 1. Brevo template (`notification.data.templateId`) – rendered server-side.
   * 2. `notification.html`
   * 3. `notification.text`
   * 4. `notification.body` (plain-text fallback)
   */
  private buildSmtpEmail(
    notification: EmailNotification,
    recipientEmail: string,
  ): SendSmtpEmail {
    const email = new SendSmtpEmail();

    // Recipients
    const toRecipient = new SendSmtpEmailToInner();
    toRecipient.email = recipientEmail;
    const recipientName = notification.data?.recipientName;
    if (typeof recipientName === 'string') {
      toRecipient.name = recipientName;
    }
    email.to = [toRecipient];

    // Sender
    const sender = new SendSmtpEmailSender();
    sender.name = (notification.data?.senderName as string | undefined) ?? this.config.sender.name;
    sender.email = (notification.data?.senderEmail as string | undefined) ?? this.config.sender.email;
    email.sender = sender;

    // Subject
    email.subject = notification.title;

    // Reply-To
    const replyToEmail =
      (notification.data?.replyToEmail as string | undefined) ??
      this.config.replyTo?.email;
    if (replyToEmail) {
      const replyTo = new SendSmtpEmailReplyTo();
      replyTo.email = replyToEmail;
      const replyToName =
        (notification.data?.replyToName as string | undefined) ??
        this.config.replyTo?.name;
      if (replyToName) replyTo.name = replyToName;
      email.replyTo = replyTo;
    }

    // Content – template takes precedence over inline HTML/text
    const templateId = notification.data?.templateId;
    if (typeof templateId === 'number') {
      email.templateId = templateId;
      // Template params: explicit `templateParams` object or the entire `data` bag
      const params =
        (notification.data?.templateParams as Record<string, unknown> | undefined) ??
        (notification.data as Record<string, unknown>);
      email.params = params;
    } else {
      email.htmlContent = notification.html ?? notification.body;
      email.textContent = notification.text ?? notification.body;
    }

    // Optional CC
    const cc = notification.data?.cc as Array<{ email: string; name?: string }> | undefined;
    if (cc?.length) {
      email.cc = cc.map((r) => {
        const c = new SendSmtpEmailCcInner();
        c.email = r.email;
        if (r.name) c.name = r.name;
        return c;
      });
    }

    // Optional BCC
    const bcc = notification.data?.bcc as Array<{ email: string; name?: string }> | undefined;
    if (bcc?.length) {
      email.bcc = bcc.map((r) => {
        const b = new SendSmtpEmailBccInner();
        b.email = r.email;
        if (r.name) b.name = r.name;
        return b;
      });
    }

    // Optional custom headers
    const headers = notification.data?.headers as Record<string, string> | undefined;
    if (headers) {
      email.headers = headers;
    }

    // Optional attachments (base-64 encoded content)
    const attachments = notification.data?.attachments as
      | Array<{ content: string; name: string }>
      | undefined;
    if (attachments?.length) {
      email.attachment = attachments.map((a) => {
        const att = new SendSmtpEmailAttachmentInner();
        att.content = a.content;
        att.name = a.name;
        return att;
      });
    }

    // Optional Brevo tags for analytics
    const tags = notification.data?.tags as string[] | undefined;
    if (tags?.length) {
      email.tags = tags;
    }

    return email;
  }

  /**
   * Resolves the recipient email address.
   *
   * Priority:
   * 1. `notification.data.email`  – explicit per-notification override
   * 2. `preferences.data.email`   – stored user preference
   * 3. `notification.userId`      – when it is a valid email address
   */
  private resolveEmail(
    notification: EmailNotification,
    preferences?: NotificationPreferences,
  ): string | undefined {
    if (notification.data?.email && typeof notification.data.email === 'string') {
      return notification.data.email;
    }
    if (preferences?.data?.email && typeof preferences.data.email === 'string') {
      return preferences.data.email;
    }
    if (this.isValidEmail(notification.userId)) {
      return notification.userId;
    }
    return undefined;
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private buildSuccessReceipt(
    notificationId: string,
    messageId?: string,
  ): DeliveryReceipt {
    return {
      notificationId,
      channel: 'email',
      status: 'sent',
      attempts: 1,
      lastAttempt: new Date(),
      metadata: { messageId },
    };
  }

  private buildErrorReceipt(
    notificationId: string,
    error: unknown,
  ): DeliveryReceipt {
    const errorMessage = this.extractErrorMessage(error);
    if (this.config.debug) {
      console.error(`[Brevo] Failed to send email: ${errorMessage}`, error);
    }
    return {
      notificationId,
      channel: 'email',
      status: 'failed',
      attempts: 1,
      lastAttempt: new Date(),
      error: errorMessage,
    };
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const resp = (
        error as { response?: { body?: { message?: string; code?: string } } }
      ).response;
      return resp?.body?.message ?? resp?.body?.code ?? 'Unknown Brevo API error';
    }
    return String(error);
  }
}
