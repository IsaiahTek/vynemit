import { SendGridProvider } from '../src/sendgrid.adapter';

describe('SendGridProvider', () => {
    it('should be defined', () => {
        expect(SendGridProvider).toBeDefined();
    });

    it('should have the correct channel name', () => {
        const provider = new SendGridProvider('SG.xxx', 'from@example.com');
        expect(provider.name).toBe('email');
    });
});
