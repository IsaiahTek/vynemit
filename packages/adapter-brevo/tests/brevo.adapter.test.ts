import { BrevoProvider } from '../src/brevo.adapter';
import type { EmailNotification, NotificationPreferences } from '@vynelix/vynemit-core';

// ---------------------------------------------------------------------------
// Mock the @getbrevo/brevo SDK – no real HTTP calls
// ---------------------------------------------------------------------------

const mockSendTransacEmail = jest.fn().mockResolvedValue({
  body: { messageId: '<mock-message-id@brevo.example>' },
});

const mockGetAccount = jest.fn().mockResolvedValue({ body: {} });

jest.mock('@getbrevo/brevo', () => {
  class MockTransactionalEmailsApi {
    authentications = { 'apiKey': { apiKey: '' } };
    sendTransacEmail = mockSendTransacEmail;
  }

  class MockAccountApi {
    authentications = { 'apiKey': { apiKey: '' } };
    getAccount = mockGetAccount;
  }

  class MockSendSmtpEmail {}
  class MockSendSmtpEmailToInner {}
  class MockSendSmtpEmailSender {}
  class MockSendSmtpEmailReplyTo {}
  class MockSendSmtpEmailCcInner {}
  class MockSendSmtpEmailBccInner {}
  class MockSendSmtpEmailAttachmentInner {}

  return {
    TransactionalEmailsApi: MockTransactionalEmailsApi,
    AccountApi: MockAccountApi,
    SendSmtpEmail: MockSendSmtpEmail,
    SendSmtpEmailToInner: MockSendSmtpEmailToInner,
    SendSmtpEmailSender: MockSendSmtpEmailSender,
    SendSmtpEmailReplyTo: MockSendSmtpEmailReplyTo,
    SendSmtpEmailCcInner: MockSendSmtpEmailCcInner,
    SendSmtpEmailBccInner: MockSendSmtpEmailBccInner,
    SendSmtpEmailAttachmentInner: MockSendSmtpEmailAttachmentInner,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultConfig = {
  apiKey: 'test-brevo-api-key',
  sender: { name: 'Test Sender', email: 'noreply@example.com' },
};

const makeNotification = (overrides: Partial<EmailNotification> = {}): EmailNotification => ({
  id: 'notif-1',
  type: 'test',
  title: 'Hello from Brevo',
  body: 'Plain text fallback',
  html: '<p>Hello from <strong>Brevo</strong></p>',
  userId: 'user-123',
  priority: 'normal',
  status: 'pending',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  channels: ['email'],
  data: { email: 'recipient@example.com' },
  ...overrides,
});

const makePreferences = (overrides: Partial<NotificationPreferences> = {}): NotificationPreferences => ({
  userId: 'user-123',
  channels: { email: { enabled: true } },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BrevoProvider', () => {
  afterEach(() => jest.clearAllMocks());

  // -- Constructor -----------------------------------------------------------

  describe('constructor', () => {
    it('is defined', () => {
      expect(BrevoProvider).toBeDefined();
    });

    it('exposes channel name "email"', () => {
      const provider = new BrevoProvider(defaultConfig);
      expect(provider.name).toBe('email');
    });

    it('throws when apiKey is missing', () => {
      expect(() => new BrevoProvider({ ...defaultConfig, apiKey: '' })).toThrow(
        '[Brevo] apiKey is required',
      );
    });

    it('throws when sender.email is missing', () => {
      expect(
        () => new BrevoProvider({ ...defaultConfig, sender: { name: 'X', email: '' } }),
      ).toThrow('[Brevo] sender.email is required');
    });

    it('logs initialization message when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      new BrevoProvider({ ...defaultConfig, debug: true });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Brevo] Initialized'),
      );
      consoleSpy.mockRestore();
    });
  });

  // -- canSend ---------------------------------------------------------------

  describe('canSend', () => {
    it('returns true when notification.data.email is a valid address', () => {
      const provider = new BrevoProvider(defaultConfig);
      expect(provider.canSend(makeNotification(), makePreferences())).toBe(true);
    });

    it('returns true when email comes from preferences', () => {
      const provider = new BrevoProvider(defaultConfig);
      const notification = makeNotification({ data: {} });
      const prefs = makePreferences({ data: { email: 'pref@example.com' } });
      expect(provider.canSend(notification, prefs)).toBe(true);
    });

    it('returns true when userId is a valid email address', () => {
      const provider = new BrevoProvider(defaultConfig);
      const notification = makeNotification({ userId: 'uid@example.com', data: {} });
      expect(provider.canSend(notification, makePreferences())).toBe(true);
    });

    it('returns false when no email can be resolved', () => {
      const provider = new BrevoProvider(defaultConfig);
      const notification = makeNotification({ userId: 'no-email-user', data: {} });
      expect(provider.canSend(notification, makePreferences())).toBe(false);
    });
  });

  // -- send ------------------------------------------------------------------

  describe('send', () => {
    it('returns a sent receipt on success', async () => {
      const provider = new BrevoProvider(defaultConfig);
      const receipt = await provider.send(makeNotification(), makePreferences());

      expect(receipt.status).toBe('sent');
      expect(receipt.channel).toBe('email');
      expect(receipt.notificationId).toBe('notif-1');
      expect(receipt.metadata?.messageId).toBe('<mock-message-id@brevo.example>');
      expect(receipt.attempts).toBe(1);
    });

    it('calls sendTransacEmail exactly once per send()', async () => {
      const provider = new BrevoProvider(defaultConfig);
      await provider.send(makeNotification(), makePreferences());
      expect(mockSendTransacEmail).toHaveBeenCalledTimes(1);
    });

    it('returns a failed receipt when no email is resolvable', async () => {
      const provider = new BrevoProvider(defaultConfig);
      const notification = makeNotification({ userId: 'opaque-id', data: {} });
      const receipt = await provider.send(notification, makePreferences());

      expect(receipt.status).toBe('failed');
      expect(receipt.error).toMatch(/Recipient email address not found/);
    });

    it('returns a failed receipt when the API throws', async () => {
      mockSendTransacEmail.mockRejectedValueOnce(new Error('API rate limit exceeded'));

      const provider = new BrevoProvider(defaultConfig);
      const receipt = await provider.send(makeNotification(), makePreferences());

      expect(receipt.status).toBe('failed');
      expect(receipt.error).toContain('API rate limit exceeded');
    });

    it('resolves email from preferences when not in notification.data', async () => {
      const provider = new BrevoProvider(defaultConfig);
      const notification = makeNotification({ data: {} });
      const prefs = makePreferences({ data: { email: 'from-prefs@example.com' } });

      const receipt = await provider.send(notification, prefs);
      expect(receipt.status).toBe('sent');
    });

    it('resolves email from userId when it is a valid email', async () => {
      const provider = new BrevoProvider(defaultConfig);
      const notification = makeNotification({ userId: 'user@example.com', data: {} });

      const receipt = await provider.send(notification, makePreferences());
      expect(receipt.status).toBe('sent');
    });

    it('sets templateId and params when provided', async () => {
      const provider = new BrevoProvider(defaultConfig);
      await provider.send(
        makeNotification({
          data: {
            email: 'r@example.com',
            templateId: 42,
            templateParams: { FIRST_NAME: 'Alice' },
          },
        }),
        makePreferences(),
      );
      // sendTransacEmail should have been called with a payload that has templateId set
      expect(mockSendTransacEmail).toHaveBeenCalledTimes(1);
      const [emailArg] = mockSendTransacEmail.mock.calls[0];
      expect(emailArg.templateId).toBe(42);
      expect(emailArg.htmlContent).toBeUndefined();
    });

    it('sets replyTo from config when not overridden', async () => {
      const provider = new BrevoProvider({
        ...defaultConfig,
        replyTo: { name: 'Support', email: 'support@example.com' },
      });

      await provider.send(makeNotification(), makePreferences());
      const [emailArg] = mockSendTransacEmail.mock.calls[0];
      expect(emailArg.replyTo.email).toBe('support@example.com');
      expect(emailArg.replyTo.name).toBe('Support');
    });

    it('overrides replyTo from notification.data', async () => {
      const provider = new BrevoProvider({
        ...defaultConfig,
        replyTo: { name: 'Support', email: 'support@example.com' },
      });

      await provider.send(
        makeNotification({
          data: {
            email: 'r@example.com',
            replyToEmail: 'override@example.com',
            replyToName: 'Override',
          },
        }),
        makePreferences(),
      );
      const [emailArg] = mockSendTransacEmail.mock.calls[0];
      expect(emailArg.replyTo.email).toBe('override@example.com');
    });

    it('sets CC recipients when provided', async () => {
      const provider = new BrevoProvider(defaultConfig);
      await provider.send(
        makeNotification({
          data: {
            email: 'r@example.com',
            cc: [{ email: 'cc@example.com', name: 'CC User' }],
          },
        }),
        makePreferences(),
      );
      const [emailArg] = mockSendTransacEmail.mock.calls[0];
      expect(emailArg.cc).toHaveLength(1);
      expect(emailArg.cc[0].email).toBe('cc@example.com');
    });

    it('sets tags when provided', async () => {
      const provider = new BrevoProvider(defaultConfig);
      await provider.send(
        makeNotification({ data: { email: 'r@example.com', tags: ['welcome', 'onboarding'] } }),
        makePreferences(),
      );
      const [emailArg] = mockSendTransacEmail.mock.calls[0];
      expect(emailArg.tags).toEqual(['welcome', 'onboarding']);
    });

    it('logs when debug is enabled', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const provider = new BrevoProvider({ ...defaultConfig, debug: true });

      await provider.send(makeNotification(), makePreferences());

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Brevo] Sending email to'),
      );
      consoleSpy.mockRestore();
    });
  });

  // -- sendBatch -------------------------------------------------------------

  describe('sendBatch', () => {
    it('returns receipts for all notifications', async () => {
      const provider = new BrevoProvider(defaultConfig);
      const notifications = [
        makeNotification({ id: 'n1', data: { email: 'a@example.com' } }),
        makeNotification({ id: 'n2', data: { email: 'b@example.com' } }),
        makeNotification({ id: 'n3', data: { email: 'c@example.com' } }),
      ];

      const receipts = await provider.sendBatch(notifications, makePreferences());

      expect(receipts).toHaveLength(3);
      expect(receipts.every((r) => r.status === 'sent')).toBe(true);
      expect(mockSendTransacEmail).toHaveBeenCalledTimes(3);
    });

    it('includes failed receipts for unresolvable addresses', async () => {
      const provider = new BrevoProvider(defaultConfig);
      const notifications = [
        makeNotification({ id: 'n1', data: { email: 'ok@example.com' } }),
        makeNotification({ id: 'n2', userId: 'no-email', data: {} }),
      ];

      const receipts = await provider.sendBatch(notifications, makePreferences());
      expect(receipts[0].status).toBe('sent');
      expect(receipts[1].status).toBe('failed');
    });
  });

  // -- healthCheck -----------------------------------------------------------

  describe('healthCheck', () => {
    it('returns true when the account API responds successfully', async () => {
      const provider = new BrevoProvider(defaultConfig);
      const healthy = await provider.healthCheck();
      expect(healthy).toBe(true);
    });

    it('returns false when the account API throws', async () => {
      mockGetAccount.mockRejectedValueOnce(new Error('Unauthorized'));

      const provider = new BrevoProvider(defaultConfig);
      const healthy = await provider.healthCheck();
      expect(healthy).toBe(false);
    });
  });
});
