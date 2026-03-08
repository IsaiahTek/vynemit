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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsController = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const notification_service_1 = require("../services/notification.service");
let NotificationsController = class NotificationsController {
    constructor(notificationsService) {
        this.notificationsService = notificationsService;
    }
    async health() {
        return this.notificationsService.healthCheck();
    }
    streamNotifications(userId, req) {
        return new rxjs_1.Observable((subscriber) => {
            const push = (type, data) => subscriber.next({ type, data });
            void Promise.all([
                this.notificationsService.getForUser(userId, { limit: 20 }),
                this.notificationsService.getUnreadCount(userId),
            ]).then(([notifications, unreadCount]) => {
                push('initial-data', { notifications, unreadCount });
            }).catch((error) => {
                subscriber.error(error);
            });
            const unsubscribeNotification = this.notificationsService.subscribe(userId, (notification) => {
                console.log(`ATTEMPTING TO EMIT Notification sent for user ${notification.userId}:`, notification);
                if (String(notification.userId) === String(userId)) {
                    console.log(`Emitting notification to client ${userId}:`, notification);
                    push('notification', notification);
                }
            });
            const unsubscribeUnread = this.notificationsService.onUnreadCountChange(userId, (count, changedUserId) => {
                if (String(changedUserId) === String(userId)) {
                    push('unread-count', count);
                }
            });
            const close = () => {
                unsubscribeNotification();
                unsubscribeUnread();
                subscriber.complete();
            };
            req.once('close', close);
            return () => {
                req.removeListener('close', close);
                close();
            };
        });
    }
    async getNotifications(userId, status, type, category, limit, offset) {
        const filters = {
            ...(status && { status: status }),
            ...(type && { type }),
            ...(category && { category }),
            ...(limit && { limit: parseInt(limit) }),
            ...(offset && { offset: parseInt(offset) })
        };
        return this.notificationsService.getForUser(userId, filters);
    }
    async getUnreadCount(userId) {
        const count = await this.notificationsService.getUnreadCount(userId);
        return { count };
    }
    async getStats(userId) {
        return this.notificationsService.getStats(userId);
    }
    async getPreferences(userId) {
        return this.notificationsService.getPreferences(userId);
    }
    async updatePreferences(userId, preferences) {
        await this.notificationsService.updatePreferences(userId, preferences);
        return { success: true };
    }
    async sendNotification(input) {
        return this.notificationsService.send(input);
    }
    async sendBatch(inputs) {
        return this.notificationsService.sendBatch(inputs);
    }
    async markAsRead(userId, id) {
        await this.notificationsService.markAsReadForUser(userId, id);
        return { success: true };
    }
    async markAllAsRead(userId) {
        await this.notificationsService.markAllAsRead(userId);
        return { success: true };
    }
    async markAsUnread(userId, id) {
        await this.notificationsService.markAsUnreadForUser(userId, id);
        return { success: true };
    }
    async markAllAsUnread(userId) {
        await this.notificationsService.markAllAsUnread(userId);
        return { success: true };
    }
    async deleteAll(userId) {
        await this.notificationsService.deleteAll(userId);
        return { success: true };
    }
    async deleteNotification(userId, id) {
        await this.notificationsService.deleteForUser(userId, id);
        return { success: true };
    }
};
exports.NotificationsController = NotificationsController;
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "health", null);
__decorate([
    (0, common_1.Sse)(':userId/stream'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", rxjs_1.Observable)
], NotificationsController.prototype, "streamNotifications", null);
__decorate([
    (0, common_1.Get)(':userId'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('type')),
    __param(3, (0, common_1.Query)('category')),
    __param(4, (0, common_1.Query)('limit')),
    __param(5, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "getNotifications", null);
__decorate([
    (0, common_1.Get)(':userId/unread-count'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "getUnreadCount", null);
__decorate([
    (0, common_1.Get)(':userId/stats'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)(':userId/preferences'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "getPreferences", null);
__decorate([
    (0, common_1.Put)(':userId/preferences'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "updatePreferences", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "sendNotification", null);
__decorate([
    (0, common_1.Post)('batch'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "sendBatch", null);
__decorate([
    (0, common_1.Patch)(':userId/:id/read'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "markAsRead", null);
__decorate([
    (0, common_1.Patch)(':userId/read-all'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "markAllAsRead", null);
__decorate([
    (0, common_1.Patch)(':userId/:id/unread'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "markAsUnread", null);
__decorate([
    (0, common_1.Patch)(':userId/unread-all'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "markAllAsUnread", null);
__decorate([
    (0, common_1.Delete)(':userId/all'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "deleteAll", null);
__decorate([
    (0, common_1.Delete)(':userId/:id'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "deleteNotification", null);
exports.NotificationsController = NotificationsController = __decorate([
    (0, common_1.Controller)('notifications'),
    __metadata("design:paramtypes", [notification_service_1.NotificationsService])
], NotificationsController);
//# sourceMappingURL=notification.controller.js.map