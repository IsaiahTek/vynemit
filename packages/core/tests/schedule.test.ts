import { NotificationCenter } from '../src/notification_center';
import { NotificationInput } from '../src/types';

type MockStorage = {
    save: jest.Mock;
    findById: jest.Mock;
    countUnread: jest.Mock;
    // other methods can be no-ops
};

type MockQueue = {
    enqueueDelayed: jest.Mock;
    enqueue: jest.Mock;
};

describe('NotificationCenter schedule', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockStorage: MockStorage = {
        save: jest.fn().mockResolvedValue(undefined),
        findById: jest.fn(),
        countUnread: jest.fn(),
    } as any;
    const mockQueue: MockQueue = {
        enqueueDelayed: jest.fn().mockResolvedValue(undefined),
        enqueue: jest.fn().mockResolvedValue(undefined),
    } as any;

    const config = {
        storage: mockStorage,
        transports: [],
        queue: mockQueue,
        middleware: [],
    } as any;

    const center = new NotificationCenter(config);

    const input: NotificationInput = {
        type: 'test',
        title: 'Test',
        body: 'Body',
        userId: 'user1',
        channels: [],
        data: {},
    } as any;

    it('enqueues delayed notification when queue is present', async () => {
        const future = new Date(Date.now() + 1000 * 60); // 1 minute later
        const id = await center.schedule(input, future);
        expect(mockStorage.save).toHaveBeenCalled();
        expect(mockQueue.enqueueDelayed).toHaveBeenCalled();
        expect(id).toBeDefined();
    });

    it('enqueues scheduled notification as delayed when scheduled time is in the future', async () => {
        const scheduledNotification: NotificationInput = {
            ...input,
            scheduledFor: new Date(Date.now() + 1000 * 60)
        };
        const id = await center.send(scheduledNotification);
        expect(mockStorage.save).toHaveBeenCalled();
        expect(mockQueue.enqueueDelayed).toHaveBeenCalled();
        expect(id).toBeDefined();
    });

    it('does not enqueue when queue is absent', async () => {
        const configNoQueue = { ...config, queue: undefined } as any;
        const centerNoQueue = new NotificationCenter(configNoQueue);
        const future = new Date(Date.now() + 1000 * 60);
        const id = await centerNoQueue.schedule(input, future);
        expect(mockStorage.save).toHaveBeenCalled();
        // No queue methods should be called
        expect(mockQueue.enqueueDelayed).not.toHaveBeenCalled();
        expect(mockQueue.enqueue).not.toHaveBeenCalled();
        expect(id).toBeDefined();
    });
});
