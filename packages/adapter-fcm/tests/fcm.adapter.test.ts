import { FcmProvider } from '../src/fcm.adapter';

describe('FcmProvider', () => {
    it('should be defined', () => {
        expect(FcmProvider).toBeDefined();
    });

    it('should have the correct channel name', () => {
        const provider = new FcmProvider({} as any);
        expect(provider.name).toBe('push');
    });
});
