import { DynamicModule } from '@nestjs/common';
import { NotificationsModuleOptions, NotificationsModuleAsyncOptions } from './types/types';
import { NotificationsService } from './services/notification.service';
import { NotificationCenter } from '@vynelix/vynemit-core';
export declare function getNotificationCenterInstance(): NotificationCenter;
export declare function getNotificationsServiceInstance(): NotificationsService;
export declare function setNotificationsServiceInstance(service: NotificationsService): void;
export declare class NotificationsModule {
    static forRoot(options: NotificationsModuleOptions): DynamicModule;
    static forRootAsync(options: NotificationsModuleAsyncOptions): DynamicModule;
}
