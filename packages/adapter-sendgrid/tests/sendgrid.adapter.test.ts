import sgMail from '@sendgrid/mail';
import { SendGridProvider } from '../src/sendgrid.adapter';
import { EmailNotification, NotificationPreferences } from '@vynelix/vynemit-core';

jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(),
  client: {
    request: jest.fn(),
  },
}));

describe('SendGridProvider', () => {
  let provider: SendGridProvider;
  const mockConfig = {
    apiKey: 'SG.test-key',
    fromEmail: 'test@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new SendGridProvider(mockConfig);
  });

  it('should be defined', () => {
    expect(SendGridProvider).toBeDefined();
  });

  it('should have the correct channel name', () => {
    expect(provider.name).toBe('email');
  });

  it('should initialize SendGrid with API key', () => {
    expect(sgMail.setApiKey).toHaveBeenCalledWith(mockConfig.apiKey);
  });

  describe('send', () => {
    const mockNotification: EmailNotification = {
      id: '123',
      userId: 'user@example.com',
      title: 'Hello',
      body: 'World',
      channels: ['email'],
      status: 'pending',
      priority: 'normal',
      type: 'test',
      createdAt: new Date(),
      data: { email: 'recipient@example.com' },
    };

    const mockPreferences: NotificationPreferences = {
      userId: 'user@example.com',
      channels: { email: { enabled: true } },
    };

    it('should send an email successfully', async () => {
      (sgMail.send as jest.Mock).mockResolvedValue([{
        statusCode: 202,
        headers: { 'x-message-id': 'msg-123' },
      }]);

      const receipt = await provider.send(mockNotification, mockPreferences);

      expect(receipt.status).toBe('sent');
      expect(receipt.metadata?.messageId).toBe('msg-123');
      expect(sgMail.send).toHaveBeenCalledWith(expect.objectContaining({
        to: 'recipient@example.com',
        from: mockConfig.fromEmail,
        subject: 'Hello',
      }));
    });

    it('should support dynamic templates', async () => {
      (sgMail.send as jest.Mock).mockResolvedValue([{
        statusCode: 202,
        headers: { 'x-message-id': 'msg-template' },
      }]);

      const templateNotification = {
        ...mockNotification,
        data: {
          ...mockNotification.data,
          templateId: 'd-12345',
          templateData: { name: 'John' },
        },
      };

      await provider.send(templateNotification, mockPreferences);

      expect(sgMail.send).toHaveBeenCalledWith(expect.objectContaining({
        templateId: 'd-12345',
        dynamicTemplateData: { name: 'John' },
      }));
    });

    it('should handle API errors gracefully', async () => {
      const mockError = {
        response: {
          body: {
            errors: [{ message: 'Invalid API Key' }],
          },
        },
      };
      (sgMail.send as jest.Mock).mockRejectedValue(mockError);

      const receipt = await provider.send(mockNotification, mockPreferences);

      expect(receipt.status).toBe('failed');
      expect(receipt.error).toBe('Invalid API Key');
    });
  });

  describe('healthCheck', () => {
    it('should return true if health check succeeds', async () => {
      // @ts-ignore
      (sgMail.client.request as jest.Mock).mockResolvedValue({ statusCode: 200 });

      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(true);
      // @ts-ignore
      expect(sgMail.client.request).toHaveBeenCalledWith(expect.objectContaining({
        method: 'GET',
        url: '/v3/scopes',
      }));
    });

    it('should return false if health check fails', async () => {
      // @ts-ignore
      (sgMail.client.request as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });
});

