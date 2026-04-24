import { TwilioProvider } from '../src/twilio.adapter';
import { SmsNotification, NotificationPreferences } from '@vynelix/vynemit-core';

const mockMessagesCreate = jest.fn();
const mockAccountsFetch = jest.fn();

jest.mock('twilio', () => {
    return {
        Twilio: jest.fn().mockImplementation(() => ({
            messages: {
                create: mockMessagesCreate,
            },
            api: {
                accounts: jest.fn().mockReturnValue({
                    fetch: mockAccountsFetch,
                }),
            },
        })),
    };
});

describe('TwilioProvider', () => {
    let provider: TwilioProvider;
    const mockConfig = {
        accountSid: 'AC-test',
        authToken: 'token-test',
        fromNumber: '+1234567890',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        provider = new TwilioProvider(mockConfig);
    });

    it('should be defined', () => {
        expect(TwilioProvider).toBeDefined();
    });

    it('should send SMS successfully', async () => {
        mockMessagesCreate.mockResolvedValue({
            sid: 'SM-123',
            status: 'sent',
        });

        const notification: SmsNotification = {
            id: 'notif-1',
            userId: '+1987654321',
            title: 'Test SMS',
            body: 'Hello World',
            channels: ['sms'],
            status: 'pending',
            priority: 'normal',
            type: 'test',
            createdAt: new Date(),
            data: {},
        };

        const receipt = await provider.send(notification, {} as NotificationPreferences);

        expect(receipt.status).toBe('sent');
        expect(receipt.metadata?.messageSid).toBe('SM-123');
        expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
            to: '+1987654321',
            from: mockConfig.fromNumber,
            body: 'Hello World',
        }));
    });

    it('should support WhatsApp delivery', async () => {
        mockMessagesCreate.mockResolvedValue({ sid: 'WH-123', status: 'sent' });

        const notification: SmsNotification = {
            id: 'notif-2',
            userId: '+1987654321',
            title: 'WhatsApp Title',
            body: 'Hello WhatsApp',
            channels: ['sms'], // Still using sms channel for now
            status: 'pending',
            priority: 'normal',
            type: 'test',
            createdAt: new Date(),
            data: { whatsapp: true },
        };

        await provider.send(notification, {} as NotificationPreferences);

        expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
            to: 'whatsapp:+1987654321',
            from: 'whatsapp:+1234567890',
        }));
    });

    it('should support Messaging Service SID', async () => {
        const providerWithService = new TwilioProvider({
            ...mockConfig,
            messagingServiceSid: 'MG-123',
        });

        mockMessagesCreate.mockResolvedValue({ sid: 'SM-service', status: 'sent' });

        const notification: SmsNotification = {
            id: 'notif-3',
            userId: '+1987654321',
            title: 'Service Title',
            body: 'Hello Service',
            channels: ['sms'],
            status: 'pending',
            priority: 'normal',
            type: 'test',
            createdAt: new Date(),
            data: {},
        };

        await providerWithService.send(notification, {} as NotificationPreferences);

        expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
            messagingServiceSid: 'MG-123',
        }));
    });

    it('should handle Twilio errors with codes', async () => {
        const twilioError = new Error('Permission denied');
        (twilioError as any).code = 20003;
        mockMessagesCreate.mockRejectedValue(twilioError);

        const notification: SmsNotification = {
            id: 'notif-4',
            userId: '+1987654321',
            title: 'Error Title',
            body: 'Error Test',
            channels: ['sms'],
            status: 'pending',
            priority: 'normal',
            type: 'test',
            createdAt: new Date(),
            data: {},
        };

        const receipt = await provider.send(notification, {} as NotificationPreferences);

        expect(receipt.status).toBe('failed');
        expect(receipt.metadata?.errorCode).toBe(20003);
    });

    it('should return true if health check succeeds', async () => {
        mockAccountsFetch.mockResolvedValue({});
        const isHealthy = await provider.healthCheck();
        expect(isHealthy).toBe(true);
    });

    it('should return false if health check fails', async () => {
        mockAccountsFetch.mockRejectedValue(new Error('API Down'));
        const isHealthy = await provider.healthCheck();
        expect(isHealthy).toBe(false);
    });
});

