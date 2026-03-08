import { TwilioProvider } from '../src/twilio.adapter';

describe('TwilioProvider', () => {
    it('should be defined', () => {
        expect(TwilioProvider).toBeDefined();
    });

    it('should have the correct channel name', () => {
        const provider = new TwilioProvider({
            accountSid: 'ACxxx',
            authToken: 'xxx',
            fromNumber: '+1234567890'
        });
        expect(provider.name).toBe('sms');
    });
});
