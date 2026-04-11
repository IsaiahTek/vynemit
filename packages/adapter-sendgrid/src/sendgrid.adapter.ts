import sgMail from '@sendgrid/mail';
import { DeliveryReceipt, TransportAdapter, ChannelType, NotificationPreferences, EmailNotification } from '@vynelix/vynemit-core';

export class SendGridProvider implements TransportAdapter {
  name: ChannelType = 'email';
  private apiKey: string;
  private fromEmail: string;

  constructor(apiKey: string, fromEmail: string) {
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
    sgMail.setApiKey(this.apiKey);
  }

  async send(notification: EmailNotification, preferences: NotificationPreferences): Promise<DeliveryReceipt> {
    try {
      const email = this.resolveEmail(notification, preferences);
      if (!email) {
        throw new Error('Recipient email address not found');
      }

      const [response] = await sgMail.send({
        to: email,
        from: this.fromEmail,
        subject: notification.title,
        text: notification.text || notification.body,
        html: notification.html || notification.body,
      });

      return {
        notificationId: notification.id,
        channel: 'email',
        status: 'sent',
        attempts: 1,
        lastAttempt: new Date(),
        metadata: {
          messageId: response.headers['x-message-id'],
        },
      };
    } catch (error: any) {
      return {
        notificationId: notification.id,
        channel: 'email',
        status: 'failed',
        attempts: 1,
        lastAttempt: new Date(),
        error: error.message,
      };
    }
  }

  async sendBatch(notifications: EmailNotification[], preferences: NotificationPreferences): Promise<DeliveryReceipt[]> {
    // SendGrid supports batch sending, but for simplicity and to match SmtpProvider's behavior/structure, 
    // we can send them individually or use SendGrid's batch if preferred.
    // Given the task, I will implement it by iterating.
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
      // SendGrid doesn't have a simple verify() like nodemailer, but we can try to send a test email to the from address
      // or just assume it's up if the API key is set. For health check, maybe a simple request to SendGrid API.
      // However, to keep it consistent with the previous implementation:
      await sgMail.send({
        to: this.fromEmail,
        from: this.fromEmail,
        subject: 'Health Check',
        text: 'Health check',
      });
      return true;
    } catch {
      return false;
    }
  }
}