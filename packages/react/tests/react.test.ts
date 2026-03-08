import { ChannelType } from '../src/types';

describe('React Components', () => {
    it('ChannelType should be defined', () => {
        // ChannelType is a type, but we can check if the file compiles
        const channels: ChannelType[] = ['email', 'push'];
        expect(channels).toContain('email');
    });
});
