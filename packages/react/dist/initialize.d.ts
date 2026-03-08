import { NotificationApiClient } from './api_client';
import { NotificationConfig } from './types';
export declare let apiClient: NotificationApiClient | null;
export declare function initializeNotifications({ config, onInitialized, onConnected, onNotification }: {
    config: NotificationConfig;
    onInitialized?: () => void;
    onConnected?: () => void;
    onNotification?: (notification: Notification) => void;
}): void;
export declare function disconnectNotifications(): void;
