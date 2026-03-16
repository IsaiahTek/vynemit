import { SmtpProvider } from '../src/smtp.adapter';

describe('SmtpProvider', () => {
    it('should be defined', () => {
        expect(SmtpProvider).toBeDefined();
    });

    it('should have the correct channel name', () => {
        const provider = new SmtpProvider({host:'host', port: 587, user: 'user', pass: 'pass', fromEmail: 'from@example.com'});
        expect(provider.name).toBe('email');
    });
});
