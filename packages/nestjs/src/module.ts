import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { NotificationsModuleOptions, NotificationsModuleAsyncOptions } from './types/types';
import { NotificationsController } from './controllers/notification.controller';
import { NotificationsService } from './services/notification.service';
import { NotificationsGateway } from './gateways/notifications-websocket.gateway';
import { NotificationCenter } from '@notifyc/core';

let globalNotificationCenterInstance: NotificationCenter | null = null;
let globalNotificationsServiceInstance: NotificationsService | null = null;
let initializationPromise: Promise<NotificationCenter> | null = null;

async function createNotificationCenterAndSetGlobal(options: NotificationsModuleOptions): Promise<NotificationCenter> {
    if (globalNotificationCenterInstance) {
        console.warn('NotificationCenter: Attempted re-initialization. Returning existing instance.');
        return globalNotificationCenterInstance;
    }

    if (initializationPromise) {
        console.log('NotificationCenter: Waiting for existing initialization...');
        return initializationPromise;
    }

    console.log('NotificationCenter: Creating new instance...');

    initializationPromise = (async () => {
        const center = new NotificationCenter({
            storage: options.storage,
            transports: options.transports,
            queue: options.queue,
            workers: options.workers,
            cleanup: options.cleanup,
            middleware: options.middleware
        });

        console.log('NotificationCenter: Instance created, registering templates...');

        if (options.templates) {
            options.templates.forEach(template => {
                center.registerTemplate(template);
                console.log(`NotificationCenter: Template registered: ${template.id}`);
            });
        }

        console.log('NotificationCenter: Starting center...');
        await center.start();
        console.log('NotificationCenter: Core library started successfully.');

        globalNotificationCenterInstance = center;
        return center;
    })();

    return initializationPromise;
}

export function getNotificationCenterInstance(): NotificationCenter {
    if (!globalNotificationCenterInstance) {
        throw new Error("NotificationCenter is not initialized. Ensure NotificationsModule.forRoot() is called.");
    }
    return globalNotificationCenterInstance;
}

export function getNotificationsServiceInstance(): NotificationsService {
    if (!globalNotificationsServiceInstance) {
        throw new Error("NotificationsService is not initialized. This should not happen.");
    }
    return globalNotificationsServiceInstance;
}

export function setNotificationsServiceInstance(service: NotificationsService): void {
    globalNotificationsServiceInstance = service;
    console.log('✅ NotificationsService singleton instance set globally');
}

@Global()
@Module({})
export class NotificationsModule {

    static forRoot(options: NotificationsModuleOptions): DynamicModule {
        console.log('NotificationsModule.forRoot() called');
        console.log('Options:', {
            hasStorage: !!options.storage,
            hasQueue: !!options.queue,
            hasTransports: !!options.transports,
            enableWebSocket: options.enableWebSocket,
            enableRestApi: options.enableRestApi,
            templatesCount: options.templates?.length || 0
        });

        const InitializationProvider: Provider = {
            provide: 'NOTIFICATION_MODULE_INITIALIZER',
            useFactory: async () => {
                console.log('⚙️  NOTIFICATION_MODULE_INITIALIZER: Starting initialization...');
                const center = await createNotificationCenterAndSetGlobal(options);
                console.log('✅ NOTIFICATION_MODULE_INITIALIZER: Initialization complete.');
                return center;
            },
        };

        // Factory provider for NotificationsService that also sets the global singleton
        const ServiceProvider: Provider = {
            provide: NotificationsService,
            useFactory: () => {
                console.log('🔧 Creating NotificationsService instance');
                const service = new NotificationsService();
                setNotificationsServiceInstance(service);
                return service;
            },
        };

        const providers: Provider[] = [
            InitializationProvider,
            ServiceProvider,
        ];

        console.log('Providers registered:', providers.length);

        const controllers = options.enableRestApi !== false
            ? [NotificationsController]
            : [];

        console.log('Controllers registered:', controllers.length);

        const exports: any[] = [NotificationsService];

        // Add Gateway as a simple class provider - it will use the global getter
        if (options.enableWebSocket !== false) {
            console.log('Adding WebSocket Gateway...');
            providers.push(NotificationsGateway);
        }

        console.log('✅ NotificationsModule.forRoot() configuration complete');

        return {
            module: NotificationsModule,
            providers,
            controllers,
            exports,
            global: true,
        };
    }

    static forRootAsync(options: NotificationsModuleAsyncOptions): DynamicModule {
        const InitializationProvider: Provider = {
            provide: 'NOTIFICATION_MODULE_INITIALIZER_ASYNC',
            useFactory: async (...args: any[]) => {
                console.log('⚙️  NOTIFICATION_MODULE_INITIALIZER_ASYNC: Starting...');
                const resolvedOptions = await options.useFactory?.(...args);
                const center = await createNotificationCenterAndSetGlobal(resolvedOptions!);
                console.log('✅ NOTIFICATION_MODULE_INITIALIZER_ASYNC: Complete.');
                return center;
            },
            inject: options.inject,
        };

        const ServiceProvider: Provider = {
            provide: NotificationsService,
            useFactory: () => {
                console.log('🔧 Creating NotificationsService instance (async)');
                const service = new NotificationsService();
                setNotificationsServiceInstance(service);
                return service;
            },
        };

        const providers: Provider[] = [
            InitializationProvider,
            ServiceProvider,
        ];

        if (options.enableWebSocket !== false) {
            providers.push(NotificationsGateway);
        }

        const controllers = options.enableRestApi !== false
            ? [NotificationsController]
            : [];
        const exports: any[] = [NotificationsService];

        return {
            module: NotificationsModule,
            imports: options.imports,
            providers,
            controllers,
            exports,
            global: true,
        };
    }
}
