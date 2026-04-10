import nodemailer from 'nodemailer';
import { DeliveryReceipt, TransportAdapter, ChannelType, NotificationPreferences, EmailNotification } from '@vynelix/vynemit-core';

export class SmtpProvider implements TransportAdapter {
  private transporter;
  name: ChannelType = 'email';
  private fromEmail: string;

  constructor({ host, port, user, pass, fromEmail }: {
    host: string,
    port: number,
    user: string,
    pass: string,
    fromEmail: string
  }) {
    this.fromEmail = fromEmail;
    console.log(`[SMTP] Initializing SmtpProvider for ${host}:${port} (from: ${fromEmail})`);
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 5000, // 5 seconds
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });
  }

  async sendBatch(notifications: EmailNotification[], preferences: NotificationPreferences): Promise<DeliveryReceipt[]> {
    return Promise.all(
      notifications.map(notification => this.send(notification, preferences))
    );
  }

  canSend(notification: EmailNotification, preferences: NotificationPreferences): boolean {
    const email = this.resolveEmail(notification, preferences);
    return !!email && this.isValidEmail(email);
  }

  async send(notification: EmailNotification, preferences: NotificationPreferences): Promise<DeliveryReceipt> {
    try {
      const email = this.resolveEmail(notification, preferences);
      if (!email) {
        console.error('[SMTP] Recipient email address not found');
        throw new Error('Recipient email address not found');
      }

      console.log(`[SMTP] Attempting to send email via SMTP to: ${email}`);
      const info = await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: notification.title,
        text: notification.text || notification.body,
        html: notification.html || notification.body,
      });

      console.log(`[SMTP] Email sent successfully. MessageID: ${info.messageId}`);

      return {
        notificationId: notification.id,
        channel: 'email',
        status: 'sent',
        attempts: 1,
        lastAttempt: new Date(),
        metadata: {
          messageId: info.messageId,
        },
      };
    } catch (error: any) {
      console.error(`[SMTP] Error sending email to ${notification.data?.email}:`, error);
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

  private resolveEmail(notification: EmailNotification, preferences?: NotificationPreferences): string | undefined {
    // 1. Check notification data
    if (notification.data?.email && typeof notification.data.email === 'string') {
      return notification.data.email;
    }

    // 2. Check user preferences
    if (preferences?.data?.email && typeof preferences.data.email === 'string') {
      return preferences.data.email;
    }

    // 3. Fallback to userId if it looks like an email
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
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}