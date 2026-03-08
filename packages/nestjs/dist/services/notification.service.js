"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const events_1 = require("events");
const module_1 = require("../module");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    constructor() {
        this.logger = new common_1.Logger(NotificationsService_1.name);
        this.eventEmitter = new events_1.EventEmitter();
        this.notificationCenter = null;
        this.logger.log('NotificationsService: Constructor called.');
    }
    async onModuleInit() {
        this.logger.log('NotificationsService: onModuleInit called. Retrieving NotificationCenter instance...');
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
            this.notificationCenter = (0, module_1.getNotificationCenterInstance)();
            this.logger.log('NotificationsService: NotificationCenter instance retrieved successfully.');
        }
        catch (error) {
            this.logger.error('NotificationsService: Failed to get NotificationCenter instance', error);
            throw error;
        }
    }
    async onModuleDestroy() {
        if (this.notificationCenter) {
            await this.notificationCenter.stop();
            this.logger.log('Notification system stopped');
        }
    }
    getCenter() {
        if (!this.notificationCenter) {
            this.notificationCenter = (0, module_1.getNotificationCenterInstance)();
        }
        return this.notificationCenter;
    }
    onNotificationSent(callback) {
        this.eventEmitter.on('notification:sent', callback);
        return () => this.eventEmitter.off('notification:sent', callback);
    }
    onUnreadCountChanged(callback) {
        this.eventEmitter.on('unread:changed', callback);
        return () => this.eventEmitter.off('unread:changed', callback);
    }
    async send(input) {
        console.log("🔔 NotificationsService.send() CALLED");
        console.log("📋 Input:", JSON.stringify(input, null, 2));
        this.logger.log("SEND NOTIFICATION TRIGGERED WITH INPUT: ", input);
        let notification;
        try {
            const center = this.getCenter();
            console.log("✅ NotificationCenter instance obtained");
            notification = await center.send(input);
            console.log("✅ Notification sent successfully:", notification.id);
            this.eventEmitter.emit('notification:sent', notification);
            console.log("✅ Event emitted: notification:sent");
        }
        catch (error) {
            const errorMessage = `Failed to send notification via NotificationCenter: ${error.message}`;
            console.error("❌ " + errorMessage, error);
            this.logger.error(errorMessage, error.stack);
            throw new common_1.InternalServerErrorException('Notification sending failed.');
        }
        return notification;
    }
    async sendBatch(inputs) {
        const center = this.getCenter();
        const notifications = await center.sendBatch(inputs);
        notifications.forEach(notification => {
            this.eventEmitter.emit('notification:sent', notification);
        });
        return notifications;
    }
    async multicast(inputs) {
        const center = this.getCenter();
        const notifications = await center.sendMulticast(inputs);
        notifications.forEach(notification => {
            this.eventEmitter.emit('notification:sent', notification);
        });
        return notifications;
    }
    async schedule(input, when) {
        const center = this.getCenter();
        return center.schedule(input, when);
    }
    async getForUser(userId, filters) {
        const center = this.getCenter();
        return center.getForUser(userId, filters);
    }
    async getById(id) {
        const center = this.getCenter();
        return center.getById(id);
    }
    async getUnreadCount(userId) {
        const center = this.getCenter();
        return center.getUnreadCount(userId);
    }
    async getStats(userId) {
        const center = this.getCenter();
        return center.getStats(userId);
    }
    async markAsRead(notificationId) {
        const center = this.getCenter();
        const notification = await center.getById(notificationId);
        await center.markAsRead(notificationId);
        if (notification) {
            const count = await center.getUnreadCount(notification.userId);
            this.eventEmitter.emit('unread:changed', notification.userId, count);
        }
    }
    async markAsReadForUser(userId, notificationId) {
        const center = this.getCenter();
        const notification = await center.getById(notificationId);
        if (!notification) {
            throw new common_1.NotFoundException('Notification not found.');
        }
        if (String(notification.userId) !== String(userId)) {
            throw new common_1.ForbiddenException('Cannot mark another user\'s notification as read.');
        }
        await center.markAsRead(notificationId);
        const count = await center.getUnreadCount(userId);
        this.eventEmitter.emit('unread:changed', userId, count);
    }
    async markAllAsRead(userId) {
        const center = this.getCenter();
        await center.markAllAsRead(userId);
        this.eventEmitter.emit('unread:changed', userId, 0);
    }
    async markAsUnreadForUser(userId, notificationId) {
        const center = this.getCenter();
        const notification = await center.getById(notificationId);
        if (!notification) {
            throw new common_1.NotFoundException('Notification not found.');
        }
        if (String(notification.userId) !== String(userId)) {
            throw new common_1.ForbiddenException('Cannot mark another user\'s notification as unread.');
        }
        await center.markAsUnread(notificationId);
        const count = await center.getUnreadCount(userId);
        this.eventEmitter.emit('unread:changed', userId, count);
    }
    async markAllAsUnread(userId) {
        const center = this.getCenter();
        await center.markAllAsUnread(userId);
        this.eventEmitter.emit('unread:changed', userId, 0);
    }
    async delete(notificationId) {
        const center = this.getCenter();
        return center.delete(notificationId);
    }
    async deleteForUser(userId, notificationId) {
        const center = this.getCenter();
        const notification = await center.getById(notificationId);
        if (!notification) {
            throw new common_1.NotFoundException('Notification not found.');
        }
        if (String(notification.userId) !== String(userId)) {
            throw new common_1.ForbiddenException('Cannot delete another user\'s notification.');
        }
        await center.delete(notificationId);
        const count = await center.getUnreadCount(userId);
        this.eventEmitter.emit('unread:changed', userId, count);
    }
    async deleteAll(userId) {
        const center = this.getCenter();
        return center.deleteAll(userId);
    }
    async getPreferences(userId) {
        const center = this.getCenter();
        return center.getPreferences(userId);
    }
    async updatePreferences(userId, prefs) {
        const center = this.getCenter();
        return center.updatePreferences(userId, prefs);
    }
    registerTemplate(template) {
        const center = this.getCenter();
        center.registerTemplate(template);
    }
    subscribe(userId, callback) {
        const center = this.getCenter();
        return center.subscribe(userId, callback);
    }
    onUnreadCountChange(userId, callback) {
        const center = this.getCenter();
        return center.onUnreadCountChange(userId, callback);
    }
    async healthCheck() {
        const center = this.getCenter();
        return center.healthCheck();
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], NotificationsService);
//# sourceMappingURL=notification.service.js.map