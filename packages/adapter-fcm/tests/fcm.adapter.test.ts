import { FcmProvider } from '../src/fcm.adapter';

describe('FcmProvider', () => {
    it('should be defined', () => {
        expect(FcmProvider).toBeDefined();
    });

    it('should have the correct channel name', () => {
        const provider = new FcmProvider({ messaging: {} as any });
        expect(provider.name).toBe('push');
    });

    it('should support backward compatibility for passing messaging directly', () => {
        const messaging = { send: jest.fn() } as any;
        const provider = new FcmProvider(messaging);
        expect(provider.name).toBe('push');
    });

    it('should log when debug is enabled', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        new FcmProvider({ messaging: {} as any, debug: true });
        expect(consoleSpy).toHaveBeenCalledWith('[FCM] Provider initialized');
        consoleSpy.mockRestore();
    });
});
