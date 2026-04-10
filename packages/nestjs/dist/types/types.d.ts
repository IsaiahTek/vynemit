import { NotificationConfig, NotificationTemplate } from "@vynelix/vynemit-core";
export declare const NOTIFICATION_OPTIONS = "NOTIFICATION_OPTIONS";
export declare const NOTIFICATION_CENTER = "NOTIFICATION_CENTER";
export interface NotificationsModuleOptions extends NotificationConfig {
    enableWebSocket?: boolean;
    websocketPort?: number;
    websocketPath?: string;
    enableRestApi?: boolean;
    apiPrefix?: string;
    authGuard?: any;
    templates?: NotificationTemplate[];
}
export interface NotificationsModuleAsyncOptions {
    imports?: any[];
    useFactory?: (...args: any[]) => Promise<NotificationsModuleOptions> | NotificationsModuleOptions;
    inject?: any[];
    enableWebSocket?: boolean;
    enableRestApi?: boolean;
}
