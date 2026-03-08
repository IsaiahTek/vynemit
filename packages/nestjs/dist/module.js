"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var NotificationsModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsModule = void 0;
exports.getNotificationCenterInstance = getNotificationCenterInstance;
exports.getNotificationsServiceInstance = getNotificationsServiceInstance;
exports.setNotificationsServiceInstance = setNotificationsServiceInstance;
const common_1 = require("@nestjs/common");
const notification_controller_1 = require("./controllers/notification.controller");
const notification_service_1 = require("./services/notification.service");
const notifications_websocket_gateway_1 = require("./gateways/notifications-websocket.gateway");
const core_1 = require("@notifyc/core");
let globalNotificationCenterInstance = null;
let globalNotificationsServiceInstance = null;
let initializationPromise = null;
async function createNotificationCenterAndSetGlobal(options) {
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
        const center = new core_1.NotificationCenter({
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
function getNotificationCenterInstance() {
    if (!globalNotificationCenterInstance) {
        throw new Error("NotificationCenter is not initialized. Ensure NotificationsModule.forRoot() is called.");
    }
    return globalNotificationCenterInstance;
}
function getNotificationsServiceInstance() {
    if (!globalNotificationsServiceInstance) {
        throw new Error("NotificationsService is not initialized. This should not happen.");
    }
    return globalNotificationsServiceInstance;
}
function setNotificationsServiceInstance(service) {
    globalNotificationsServiceInstance = service;
    console.log('✅ NotificationsService singleton instance set globally');
}
let NotificationsModule = NotificationsModule_1 = class NotificationsModule {
    static forRoot(options) {
        console.log('📦 NotificationsModule.forRoot() called');
        console.log('📦 Options:', {
            hasStorage: !!options.storage,
            hasQueue: !!options.queue,
            hasTransports: !!options.transports,
            enableWebSocket: options.enableWebSocket,
            enableRestApi: options.enableRestApi,
            templatesCount: options.templates?.length || 0
        });
        const InitializationProvider = {
            provide: 'NOTIFICATION_MODULE_INITIALIZER',
            useFactory: async () => {
                console.log('⚙️  NOTIFICATION_MODULE_INITIALIZER: Starting initialization...');
                const center = await createNotificationCenterAndSetGlobal(options);
                console.log('✅ NOTIFICATION_MODULE_INITIALIZER: Initialization complete.');
                return center;
            },
        };
        // Factory provider for NotificationsService that also sets the global singleton
        const ServiceProvider = {
            provide: notification_service_1.NotificationsService,
            useFactory: () => {
                console.log('🔧 Creating NotificationsService instance');
                const service = new notification_service_1.NotificationsService();
                setNotificationsServiceInstance(service);
                return service;
            },
        };
        const providers = [
            InitializationProvider,
            ServiceProvider,
        ];
        console.log('📦 Providers registered:', providers.length);
        const controllers = options.enableRestApi !== false
            ? [notification_controller_1.NotificationsController]
            : [];
        console.log('📦 Controllers registered:', controllers.length);
        const exports = [notification_service_1.NotificationsService];
        // Add Gateway as a simple class provider - it will use the global getter
        if (options.enableWebSocket !== false) {
            console.log('📦 Adding WebSocket Gateway...');
            providers.push(notifications_websocket_gateway_1.NotificationsGateway);
        }
        console.log('✅ NotificationsModule.forRoot() configuration complete');
        return {
            module: NotificationsModule_1,
            providers,
            controllers,
            exports,
            global: true,
        };
    }
    static forRootAsync(options) {
        const InitializationProvider = {
            provide: 'NOTIFICATION_MODULE_INITIALIZER_ASYNC',
            useFactory: async (...args) => {
                console.log('⚙️  NOTIFICATION_MODULE_INITIALIZER_ASYNC: Starting...');
                const resolvedOptions = await options.useFactory?.(...args);
                const center = await createNotificationCenterAndSetGlobal(resolvedOptions);
                console.log('✅ NOTIFICATION_MODULE_INITIALIZER_ASYNC: Complete.');
                return center;
            },
            inject: options.inject,
        };
        const ServiceProvider = {
            provide: notification_service_1.NotificationsService,
            useFactory: () => {
                console.log('🔧 Creating NotificationsService instance (async)');
                const service = new notification_service_1.NotificationsService();
                setNotificationsServiceInstance(service);
                return service;
            },
        };
        const providers = [
            InitializationProvider,
            ServiceProvider,
        ];
        if (options.enableWebSocket !== false) {
            providers.push(notifications_websocket_gateway_1.NotificationsGateway);
        }
        const controllers = options.enableRestApi !== false
            ? [notification_controller_1.NotificationsController]
            : [];
        const exports = [notification_service_1.NotificationsService];
        return {
            module: NotificationsModule_1,
            imports: options.imports,
            providers,
            controllers,
            exports,
            global: true,
        };
    }
};
exports.NotificationsModule = NotificationsModule;
exports.NotificationsModule = NotificationsModule = NotificationsModule_1 = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({})
], NotificationsModule);
