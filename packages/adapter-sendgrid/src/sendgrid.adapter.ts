import sgMail from '@sendgrid/mail';
import { DeliveryReceipt, TransportAdapter, ChannelType, NotificationPreferences, EmailNotification } from '@vynelix/vynemit-core';

export interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
  debug?: boolean;
}

export class SendGridProvider implements TransportAdapter {
  name: ChannelType = 'email';
  
  constructor(private config: SendGridConfig) {
    if (!config.apiKey) {
      throw new Error('SendGrid API Key is required');
    }
    sgMail.setApiKey(this.config.apiKey);
    if (this.config.debug) {
      console.log(`[SendGrid] Initialized with from: ${this.config.fromEmail}`);
    }
  }

  async send(notification: EmailNotification, preferences: NotificationPreferences): Promise<DeliveryReceipt> {
    try {
      const email = this.resolveEmail(notification, preferences);
      if (!email) {
        throw new Error('Recipient email address not found');
      }

      if (this.config.debug) {
        console.log(`[SendGrid] Sending email to ${email} (Subject: ${notification.title})`);
      }

      const msg: any = {
        to: email,
        from: this.config.fromEmail,
        subject: notification.title,
        text: notification.text || notification.body,
        html: notification.html || notification.body,
      };

      // Support for SendGrid Dynamic Templates
      if (notification.data?.templateId) {
        msg.templateId = notification.data.templateId;
        msg.dynamicTemplateData = notification.data.templateData || notification.data;
        // When using templates, SendGrid ignores subject/text/html if they are defined in the template
      }

      const [response] = await sgMail.send(msg);

      return {
        notificationId: notification.id,
        channel: 'email',
        status: 'sent',
        attempts: 1,
        lastAttempt: new Date(),
        metadata: {
          messageId: response.headers['x-message-id'],
          statusCode: response.statusCode,
        },
      };
    } catch (error: any) {
      const errorMessage = error.response?.body?.errors?.[0]?.message || error.message;
      if (this.config.debug) {
        console.error(`[SendGrid] Failed to send email: ${errorMessage}`, error.response?.body);
      }
      return {
        notificationId: notification.id,
        channel: 'email',
        status: 'failed',
        attempts: 1,
        lastAttempt: new Date(),
        error: errorMessage,
      };
    }
  }

  async sendBatch(notifications: EmailNotification[], preferences: NotificationPreferences): Promise<DeliveryReceipt[]> {
    if (this.config.debug) {
      console.log(`[SendGrid] Batch sending ${notifications.length} emails`);
    }
    // SendGrid supports batch sending via multiple personalizations, 
    // but for the Vynemit architecture, we parallelize status reports.
    return Promise.all(
      notifications.map(notification => this.send(notification, preferences))
    );
  }

  canSend(notification: EmailNotification, preferences: NotificationPreferences): boolean {
    const email = this.resolveEmail(notification, preferences);
    return !!email && this.isValidEmail(email);
  }

  private resolveEmail(notification: EmailNotification, preferences?: NotificationPreferences): string | undefined {
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

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Non-invasive health check using SendGrid client to hit a simple read-only endpoint
      // We'll use the stats API or scopes API which is standard for key verification
      // @ts-ignore - reaching into the client
      const client = (sgMail as any).client;
      await client.request({
        method: 'GET',
        url: '/v3/scopes',
      });
      return true;
    } catch (error) {
      if (this.config.debug) {
        console.error('[SendGrid] Health check failed', error);
      }
      return false;
    }
  }
}